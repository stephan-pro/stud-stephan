// Series (P12, F13): finding a theme, counting what building its series costs, and building it.
//
// A series is a Rebrickable theme below a main theme ("Star Wars – The Clone Wars"). Its sets come
// from Rebrickable (cached 30 days), the figures of each set from BrickLink (one call per set,
// cached 30 days per set, counted on the day's limit shared with the catalog and the price run).
// The build is a queue in the database that works in portions like the price run: what one call
// does not finish, the next call goes on with; when the day's BrickLink limit is used up it waits for
// the next day instead of stopping.

import type { BricklinkClient } from "./bricklinkClient.ts";
import type { CatalogStore } from "./catalogStore.ts";
import { CatalogError } from "./json.ts";
import { MAX_ATTEMPTS, nextCountDay } from "./priceRunService.ts";
import type { RebrickableClient, RebrickableThemeNode } from "./rebrickableClient.ts";
import type { ClaimedSet, SeriesStore, SetOutcome } from "./seriesStore.ts";
import type { SeriesFigureInfo, SeriesPlan, SeriesSummary, SeriesTheme } from "./seriesTypes.ts";

export interface SeriesDeps {
  readonly store: SeriesStore;
  /** The cache of the catalog: themes, the sets of a theme, the figures of a set. */
  readonly cache: CatalogStore;
  readonly rebrickable: RebrickableClient;
  /** A client that counts its calls on the day's limit (`beforeCall`). */
  readonly bricklink: Pick<BricklinkClient, "minifigsOfSet">;
  readonly now: () => Date;
}

const CACHE_DAYS = 30;
/** Themes found by one search. */
const MAX_HITS = 15;
/** A theme with more sub themes than this is cut off (a main theme is not meant to be built). */
const MAX_THEMES_IN_TREE = 25;
/** Sets taken from the queue at once; small, so a call can stop on time. */
export const BATCH_SIZE = 5;

/** Words people type that the English theme names do not have. */
const ALIASES: Readonly<Record<string, readonly string[]>> = {
  sammelserie: ["collectible"],
  sammelserien: ["collectible"],
  sammelfiguren: ["collectible"],
  sammelminifiguren: ["collectible"],
};

async function cached<T>(
  deps: SeriesDeps,
  key: string,
  produce: () => Promise<T>,
  valid: (value: unknown) => value is T,
): Promise<T> {
  const now = deps.now();
  const notBefore = new Date(now.getTime() - CACHE_DAYS * 86_400_000).toISOString();
  const known = await deps.cache.read(key, notBefore);
  if (valid(known)) return known;
  const value = await produce();
  await deps.cache.write(key, value, now.toISOString());
  return value;
}

const isNodeList = (value: unknown): value is RebrickableThemeNode[] =>
  Array.isArray(value) &&
  value.every((node) => typeof node?.id === "number" && typeof node?.name === "string");

const isSetList = (value: unknown): value is { number: string; name: string }[] =>
  Array.isArray(value) &&
  value.every((set) => typeof set?.number === "string" && typeof set?.name === "string");

const isFigureList = (value: unknown): value is SeriesFigureInfo[] =>
  Array.isArray(value) &&
  value.every((figure) => typeof figure?.number === "string" && typeof figure?.name === "string");

/** Lower case without accents and punctuation. */
function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function loadThemes(deps: SeriesDeps): Promise<RebrickableThemeNode[]> {
  return cached(deps, "series:themes", () => deps.rebrickable.themes(), isNodeList);
}

/** "Collectible Minifigures – The LEGO Batman Movie Series": the names from the root down. */
export function themePath(themes: readonly RebrickableThemeNode[], node: RebrickableThemeNode) {
  const names = [node.name];
  let parentId = node.parentId;
  for (let level = 0; parentId !== undefined && level < 6; level++) {
    const parent = themes.find((theme) => theme.id === parentId);
    if (!parent) break;
    names.unshift(parent.name);
    parentId = parent.parentId;
  }
  return names.join(" – ");
}

/**
 * A series is built from a sub theme, or from a theme that has none ("Ninjago – Staffel 1", not
 * all of "Ninjago"): a main theme with sub themes would mean hundreds of BrickLink calls.
 */
function selectable(themes: readonly RebrickableThemeNode[], node: RebrickableThemeNode): boolean {
  return node.parentId !== undefined || !themes.some((theme) => theme.parentId === node.id);
}

/** The themes whose name has every word of the query, shortest names first. */
export async function searchThemes(deps: SeriesDeps, query: string): Promise<SeriesTheme[]> {
  const words = plain(query)
    .split(" ")
    .filter((word) => word !== "")
    .flatMap((word) => ALIASES[word] ?? [word]);
  if (words.length === 0) return [];
  const themes = await loadThemes(deps);
  return themes
    .filter((node) => selectable(themes, node))
    .map((node) => ({ id: node.id, name: themePath(themes, node) }))
    .filter((theme) => {
      const text = plain(theme.name);
      return words.every((word) => text.includes(word));
    })
    .sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name, "de"))
    .slice(0, MAX_HITS);
}

/** The theme and its sub themes, the theme first; cut off at `MAX_THEMES_IN_TREE`. */
function treeOf(themes: readonly RebrickableThemeNode[], id: number): number[] {
  const found = [id];
  for (let index = 0; index < found.length && found.length < MAX_THEMES_IN_TREE; index++) {
    for (const theme of themes) {
      if (theme.parentId === found[index] && !found.includes(theme.id)) found.push(theme.id);
    }
  }
  return found.slice(0, MAX_THEMES_IN_TREE);
}

interface ThemeInfo {
  readonly theme: SeriesTheme;
  readonly sets: readonly { number: string; name: string }[];
}

/** The theme with the sets of it and its sub themes, each set once. */
async function themeInfo(deps: SeriesDeps, themeId: number): Promise<ThemeInfo> {
  const themes = await loadThemes(deps);
  const node = themes.find((theme) => theme.id === themeId);
  if (!node || !selectable(themes, node)) throw new CatalogError("not_found", "Thema unbekannt");
  const sets = new Map<string, { number: string; name: string }>();
  for (const id of treeOf(themes, themeId)) {
    const own = await cached(
      deps,
      `series:sets:${id}`,
      () => deps.rebrickable.setsOfTheme(id),
      isSetList,
    );
    for (const set of own) if (!sets.has(set.number)) sets.set(set.number, set);
  }
  return {
    theme: { id: node.id, name: themePath(themes, node) },
    sets: [...sets.values()].sort((a, b) =>
      a.number.localeCompare(b.number, "en", { numeric: true }),
    ),
  };
}

/** What building the series of a theme costs: its sets, each one a BrickLink call. */
export async function planSeries(deps: SeriesDeps, themeId: number): Promise<SeriesPlan> {
  const { theme, sets } = await themeInfo(deps, themeId);
  return { theme, setCount: sets.length };
}

/** Creates the series of a theme for the owner (or finds the one there is) and queues its sets. */
export async function startSeries(
  deps: SeriesDeps,
  owner: string,
  themeId: number,
): Promise<SeriesSummary> {
  const { theme, sets } = await themeInfo(deps, themeId);
  return deps.store.begin(owner, theme, sets);
}

export interface SeriesWork {
  /** Sets finished in this call (done, failed or back for another try). */
  readonly processed: number;
  /** BrickLink's day is used up; the build goes on tomorrow. */
  readonly paused: boolean;
}

/** The figures of one set: from the cache, else BrickLink (one counted call). */
async function figuresOfSet(deps: SeriesDeps, setNumber: string): Promise<SeriesFigureInfo[]> {
  return cached(
    deps,
    `series:figures:${setNumber}`,
    async () =>
      (await deps.bricklink.minifigsOfSet(setNumber)).map((entry) => ({
        number: entry.number,
        name: entry.name,
        ...(entry.imageUrl === undefined ? {} : { imageUrl: entry.imageUrl }),
      })),
    isFigureList,
  );
}

function keyOf(item: ClaimedSet): string {
  return `${item.seriesId}|${item.setNumber}`;
}

/**
 * Works on the open series of one owner (the app) or of all (the cron job) until the queue is
 * empty, BrickLink's day is used up or `budgetMs` has passed.
 */
export async function workOnSeries(
  deps: SeriesDeps,
  options: { readonly owner?: string | undefined; readonly budgetMs: number },
): Promise<SeriesWork> {
  const started = deps.now().getTime();
  const overBudget = () => deps.now().getTime() - started >= options.budgetMs;
  // Sets that failed in this call are tried again by a later one, not at once.
  const retried = new Set<string>();
  let processed = 0;

  while (!overBudget()) {
    const taken = await deps.store.claim(options.owner, BATCH_SIZE);
    const again = taken.filter((item) => retried.has(keyOf(item)));
    const items = taken.filter((item) => !retried.has(keyOf(item)));
    if (again.length > 0) await deps.store.release(again);
    if (items.length === 0) break;

    for (const [index, item] of items.entries()) {
      if (overBudget()) {
        await deps.store.release(items.slice(index));
        return { processed, paused: false };
      }
      let outcome: SetOutcome;
      try {
        outcome = { kind: "done", figures: await figuresOfSet(deps, item.setNumber) };
      } catch (error) {
        if (error instanceof CatalogError && error.failure === "limit_reached") {
          await deps.store.release(items.slice(index), nextCountDay(deps.now()));
          return { processed, paused: true };
        }
        const unknown = error instanceof CatalogError && error.failure === "not_found";
        outcome = unknown || item.attempts >= MAX_ATTEMPTS ? { kind: "failed" } : { kind: "retry" };
        if (outcome.kind === "retry") retried.add(keyOf(item));
      }
      await deps.store.finish(item, outcome);
      processed += 1;
    }
  }
  return { processed, paused: false };
}
