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
import {
  type SeriesFigureInfo,
  type SeriesPlan,
  type SeriesSearch,
  type SeriesSummary,
  type SeriesTheme,
  setNumberOfSingleId,
  singleSetId,
} from "./seriesTypes.ts";
import { classifyQuery, plain, searchWords } from "./themeQuery.ts";

export interface SeriesDeps {
  readonly store: SeriesStore;
  /** The cache of the catalog: themes, the sets of a theme, the figures of a set. */
  readonly cache: CatalogStore;
  readonly rebrickable: RebrickableClient;
  /** A client that counts its calls on the day's limit (`beforeCall`). */
  readonly bricklink: Pick<BricklinkClient, "contentsOfSet" | "setsOfMinifig">;
  readonly now: () => Date;
}

const CACHE_DAYS = 30;
/** Themes shown by one search; a main theme brings its sub themes, so there can be many. */
export const MAX_HITS = 40;
/** A theme with more sub themes than this is cut off (a main theme is not meant to be built). */
const MAX_THEMES_IN_TREE = 25;
/** Sets taken from the queue at once; small, so a call can stop on time. */
export const BATCH_SIZE = 5;
/** Sets of a minifig that are asked about for the theme (one Rebrickable call each). */
export const MAX_FIGURE_SETS = 3;
/**
 * Rebrickable has hundreds of themes; a list this short is a cut-off or broken answer and is
 * neither used nor kept ("Star Wars" must not be "no hit" because the list was never whole).
 */
export const MIN_PLAUSIBLE_THEMES = 50;
/** "themes2": the first version kept whatever it got, also a list that was too short. */
const THEMES_KEY = "series:themes2";

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

/** An empty list is not taken from the cache: older builds stored "no figures" for sets they read too shallowly. */
const isFigureList = (value: unknown): value is SeriesFigureInfo[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((figure) => typeof figure?.number === "string" && typeof figure?.name === "string");

/** A list that can be Rebrickable's whole list of themes (see `MIN_PLAUSIBLE_THEMES`). */
const isThemeList = (value: unknown): value is RebrickableThemeNode[] =>
  isNodeList(value) &&
  value.length >= MIN_PLAUSIBLE_THEMES &&
  value.some((node) => node.parentId !== undefined);

const isThemeRef = (value: unknown): value is { themeId: number } =>
  typeof (value as { themeId?: unknown } | null)?.themeId === "number";

const isNumberList = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((entry) => typeof entry === "string" && entry !== "");

function loadThemes(deps: SeriesDeps): Promise<RebrickableThemeNode[]> {
  return cached(
    deps,
    THEMES_KEY,
    async () => {
      const themes: RebrickableThemeNode[] = await deps.rebrickable.themes();
      // An answer that is too short is an error the person is told about, not "no hits".
      if (themes.length < MIN_PLAUSIBLE_THEMES || !themes.some((node) => node.parentId)) {
        throw new CatalogError(
          "unavailable",
          `Rebrickable lieferte nur ${themes.length} Themen, erwartet sind mehrere hundert`,
        );
      }
      return themes;
    },
    isThemeList,
  );
}

/** "Collectible Minifigures", "The LEGO Batman Movie Series": the names from the root down. */
function themeNames(themes: readonly RebrickableThemeNode[], node: RebrickableThemeNode): string[] {
  const names = [node.name];
  let parentId = node.parentId;
  for (let level = 0; parentId !== undefined && level < 6; level++) {
    const parent = themes.find((theme) => theme.id === parentId);
    if (!parent) break;
    names.unshift(parent.name);
    parentId = parent.parentId;
  }
  return names;
}

/** "Collectible Minifigures – The LEGO Batman Movie Series". */
export function themePath(themes: readonly RebrickableThemeNode[], node: RebrickableThemeNode) {
  return themeNames(themes, node).join(" – ");
}

/** Sub themes below a theme (any depth), in tree order: each theme before its own sub themes. */
function descendantsOf(
  themes: readonly RebrickableThemeNode[],
  node: RebrickableThemeNode,
): RebrickableThemeNode[] {
  const found = [node.id];
  for (let index = 0; index < found.length; index++) {
    for (const theme of themes) {
      if (theme.parentId === found[index] && !found.includes(theme.id)) found.push(theme.id);
    }
  }
  return themes
    .filter((theme) => theme.id !== node.id && found.includes(theme.id))
    .sort(byPath(themes));
}

/** Tree order: names from the root down, compared name by name. */
function byPath(themes: readonly RebrickableThemeNode[]) {
  return (a: RebrickableThemeNode, b: RebrickableThemeNode) => {
    const left = themeNames(themes, a);
    const right = themeNames(themes, b);
    for (let level = 0; level < Math.min(left.length, right.length); level++) {
      const order = (left[level] ?? "").localeCompare(right[level] ?? "", "de");
      if (order !== 0) return order;
    }
    return left.length - right.length;
  };
}

/**
 * A series is built from a sub theme, or from a theme that has none ("Ninjago – Staffel 1", not
 * all of "Ninjago"): a main theme with sub themes would mean hundreds of BrickLink calls.
 */
function selectable(themes: readonly RebrickableThemeNode[], node: RebrickableThemeNode): boolean {
  return node.parentId !== undefined || !themes.some((theme) => theme.parentId === node.id);
}

const NOTHING: SeriesSearch = { themes: [], more: false };

function hitOf(
  themes: readonly RebrickableThemeNode[],
  node: RebrickableThemeNode,
  via?: SeriesTheme["via"],
): SeriesTheme {
  return {
    id: node.id,
    name: themePath(themes, node),
    selectable: selectable(themes, node),
    ...(via === undefined ? {} : { via }),
  };
}

/** A main theme with sub themes comes with its sub themes below it (it cannot be chosen itself). */
function hitsOfTheme(
  themes: readonly RebrickableThemeNode[],
  node: RebrickableThemeNode,
  via?: SeriesTheme["via"],
): SeriesTheme[] {
  const own = hitOf(themes, node, via);
  if (own.selectable) return [own];
  return [own, ...descendantsOf(themes, node).map((sub) => hitOf(themes, sub))];
}

function cutOff(hits: readonly SeriesTheme[]): SeriesSearch {
  const seen = new Set<number>();
  const unique = hits.filter((hit) => !seen.has(hit.id) && seen.add(hit.id));
  return { themes: unique.slice(0, MAX_HITS), more: unique.length > MAX_HITS };
}

/** The theme id of a set (Rebrickable, kept 30 days); nothing for a set it does not know. */
async function themeIdOfSet(deps: SeriesDeps, setNumber: string): Promise<number | undefined> {
  try {
    const known = await cached(
      deps,
      `series:set:${setNumber}`,
      async () => {
        const set = await deps.rebrickable.set(setNumber);
        if (set.themeId === undefined) throw new CatalogError("not_found", "Set ohne Thema");
        return { themeId: set.themeId };
      },
      isThemeRef,
    );
    return known.themeId;
  } catch (error) {
    if (error instanceof CatalogError && error.failure === "not_found") return undefined;
    throw error;
  }
}

/** The themes of the first few sets a minifig comes in (one BrickLink call, a few Rebrickable calls). */
async function themeIdsOfFigure(deps: SeriesDeps, figureNumber: string): Promise<number[]> {
  let setNumbers: string[];
  try {
    setNumbers = await cached(
      deps,
      `series:figure-sets:${figureNumber}`,
      async () => (await deps.bricklink.setsOfMinifig(figureNumber)).map((set) => set.number),
      isNumberList,
    );
  } catch (error) {
    if (error instanceof CatalogError && error.failure === "not_found") return [];
    throw error;
  }
  const ids: number[] = [];
  for (const setNumber of setNumbers.slice(0, MAX_FIGURE_SETS)) {
    const id = await themeIdOfSet(deps, setNumber);
    if (id !== undefined && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** The themes a typed set or minifig number leads to; nothing if the number is not known. */
async function searchByNumber(
  deps: SeriesDeps,
  themes: readonly RebrickableThemeNode[],
  kind: "set" | "figure",
  number: string,
): Promise<SeriesSearch> {
  const ids =
    kind === "set"
      ? [await themeIdOfSet(deps, number)].flatMap((id) => id ?? [])
      : await themeIdsOfFigure(deps, number);
  const via = { kind, number } as const;
  const only = kind === "set" ? await onlySetHit(deps, number) : undefined;
  return cutOff([
    ...(only ? [only] : []),
    ...ids.flatMap((id) => {
      const node = themes.find((theme) => theme.id === id);
      return node ? hitsOfTheme(themes, node, via) : [];
    }),
  ]);
}

/**
 * "Nur dieses Set": a series of the one set a number names, with how many figures it holds. The
 * figures come from the same cache the build uses (one counted BrickLink call the first time);
 * nothing for a set that is unknown, has no figures or cannot be asked about right now.
 */
async function onlySetHit(deps: SeriesDeps, number: string): Promise<SeriesTheme | undefined> {
  const id = singleSetId(number);
  if (id === undefined) return undefined;
  try {
    const figures = await figuresOfSet(deps, number);
    if (figures.length === 0) return undefined;
    return {
      id,
      name: number,
      selectable: true,
      onlySet: { number, figureCount: figures.length },
    };
  } catch (error) {
    if (error instanceof CatalogError) return undefined;
    throw error;
  }
}

const isName = (value: unknown): value is { name: string } =>
  typeof (value as { name?: unknown } | null)?.name === "string";

/** "75455-1 Name of the set": the series of a single set; the number alone if Rebrickable lacks it. */
async function singleSetName(deps: SeriesDeps, number: string): Promise<string> {
  try {
    const known = await cached(
      deps,
      `series:setname:${number}`,
      async () => ({ name: (await deps.rebrickable.set(number)).name }),
      isName,
    );
    return `${number} ${known.name}`;
  } catch (error) {
    if (error instanceof CatalogError && error.failure === "not_found") return number;
    throw error;
  }
}

/**
 * What a typed text leads to, in tree order (a main theme, then its sub themes):
 * - a set number ("75372", "75372-1"): the theme of the set,
 * - a BrickLink minifig number ("sw0194"): the themes of the first sets it comes in,
 * - else the themes whose name has every word (English names, a few German words).
 * A main theme with sub themes is listed but cannot be chosen (`selectable: false`).
 */
export async function searchThemes(deps: SeriesDeps, query: string): Promise<SeriesSearch> {
  const kind = classifyQuery(query);
  const words = searchWords(query);
  if (kind.kind === "words" && words.length === 0) return NOTHING;
  const themes = await loadThemes(deps);
  if (kind.kind !== "words") {
    const found = await searchByNumber(deps, themes, kind.kind, kind.number);
    if (found.themes.length > 0) return found;
  }
  if (words.length === 0) return NOTHING;
  return cutOff(
    themes
      .filter((node) => {
        const text = plain(themePath(themes, node));
        return words.every((word) => text.includes(word));
      })
      .sort(byPath(themes))
      .map((node) => hitOf(themes, node)),
  );
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
  const only = setNumberOfSingleId(themeId);
  if (only !== undefined) {
    return {
      theme: { id: themeId, name: await singleSetName(deps, only), selectable: true },
      sets: [{ number: only, name: only }],
    };
  }
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
    theme: { id: node.id, name: themePath(themes, node), selectable: true },
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

/** Sets inside a set that are looked into for figures (a collectible series has about 20). */
const MAX_INNER_SETS = 40;

/**
 * The figures of one set: from the cache, else BrickLink (one counted call). A set that holds no
 * minifig itself but sets (collectible minifigure series: one set per figure) is looked into one
 * level deeper, one call per inner set, each cached on its own.
 */
async function figuresOfSet(
  deps: SeriesDeps,
  setNumber: string,
  inner = true,
): Promise<SeriesFigureInfo[]> {
  return cached(
    deps,
    // "figures2": the first version stored names with HTML characters.
    `series:figures2:${setNumber}`,
    async () => {
      const { minifigs, sets } = await deps.bricklink.contentsOfSet(setNumber);
      const found = new Map<string, SeriesFigureInfo>();
      for (const entry of minifigs) {
        found.set(entry.number, {
          number: entry.number,
          name: entry.name,
          ...(entry.imageUrl === undefined ? {} : { imageUrl: entry.imageUrl }),
        });
      }
      if (minifigs.length === 0 && inner) {
        for (const set of sets.slice(0, MAX_INNER_SETS)) {
          for (const figure of await figuresOfSet(deps, set.number, false)) {
            if (!found.has(figure.number)) found.set(figure.number, figure);
          }
        }
      }
      return [...found.values()];
    },
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
