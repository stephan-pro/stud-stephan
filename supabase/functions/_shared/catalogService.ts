// The catalog (F2): search by number or name, and the full entry of a figure or set.
//
// Numbers are BrickLink numbers (UMSETZUNG.md section 1): BrickLink gives name, year, picture, the
// minifigs in a set and the sets of a minifig. Rebrickable adds the name search (BrickLink has none),
// a set's piece count and its theme. A figure found by name has only a Rebrickable number
// ("fig-014663"); it is turned into a BrickLink number through the subsets of one of its sets, by
// name. If that fails the entry has no number and the person types it in the form.

import type { BricklinkClient } from "./bricklinkClient.ts";
import type { CatalogStore } from "./catalogStore.ts";
import type {
  CatalogFigureInfo,
  CatalogHit,
  CatalogItem,
  CatalogKind,
  CatalogSetInfo,
} from "./catalogTypes.ts";
import { CatalogError, joinTheme } from "./json.ts";
import type { RebrickableClient } from "./rebrickableClient.ts";

export interface CatalogDeps {
  readonly bricklink: BricklinkClient;
  readonly rebrickable: RebrickableClient;
  readonly store: CatalogStore;
  readonly now: () => Date;
}

const CACHE_DAYS = 30;
const MAX_THEME_LEVELS = 4;
const MAX_SETS_TRIED = 2;

/** A BrickLink minifig number: letters, then digits ("sw0194", "coltlbm28", "hp001"). */
const MINIFIG_NUMBER = /^[a-z]{2,8}\d{1,6}[a-z]{0,2}$/i;
const REBRICKABLE_FIG = /^fig-\d+$/i;
const SET_NUMBER = /^\d{3,7}(-\d{1,2})?$/;

export type Query = { by: "number"; ref: string } | { by: "name"; text: string };

/** Whether the text is a number of the kind or a name to search for. */
export function classifyQuery(kind: CatalogKind, text: string): Query {
  const query = text.trim();
  if (kind === "legoSet") {
    return SET_NUMBER.test(query)
      ? { by: "number", ref: normalizeSetNumber(query) }
      : { by: "name", text: query };
  }
  if (REBRICKABLE_FIG.test(query)) return { by: "number", ref: query.toLowerCase() };
  return MINIFIG_NUMBER.test(query)
    ? { by: "number", ref: query.toLowerCase() }
    : { by: "name", text: query };
}

/** "75372" → "75372-1": both catalogs number the first edition of a set with "-1". */
export function normalizeSetNumber(text: string): string {
  const value = text.trim();
  return value.includes("-") ? value : `${value}-1`;
}

/** Names compared without case, accents and punctuation. */
export function sameName(a: string, b: string): boolean {
  const plain = (text: string) =>
    text
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  return plain(a) !== "" && plain(a) === plain(b);
}

async function cached<T>(
  deps: CatalogDeps,
  key: string,
  produce: () => Promise<{ value: T; complete: boolean }>,
): Promise<T> {
  const now = deps.now();
  const notBefore = new Date(now.getTime() - CACHE_DAYS * 86_400_000).toISOString();
  const known = await deps.store.read(key, notBefore);
  if (known !== undefined && known !== null) return known as T;
  const { value, complete } = await produce();
  if (complete) await deps.store.write(key, value, now.toISOString());
  return value;
}

/** Runs a part that only adds detail: if it fails, the entry is still good but not complete. */
async function optional<T>(
  part: () => Promise<T>,
  incomplete: { value: boolean },
): Promise<T | undefined> {
  try {
    return await part();
  } catch (error) {
    if (error instanceof CatalogError) {
      incomplete.value = true;
      return undefined;
    }
    throw error;
  }
}

/** "Star Wars – The Clone Wars": the root of a theme tree and the level below it. */
async function themeChain(
  deps: CatalogDeps,
  prefix: string,
  firstId: number | undefined,
  load: (id: number) => Promise<{ name: string; parentId?: number }>,
): Promise<string | undefined> {
  const names: string[] = [];
  let id = firstId;
  for (let level = 0; id !== undefined && level < MAX_THEME_LEVELS; level++) {
    const step = id;
    const node = await cached(deps, `${prefix}:${step}`, async () => ({
      value: await load(step),
      complete: true,
    }));
    names.push(node.name);
    id = node.parentId;
  }
  const root = names.at(-1);
  const sub = names.length > 1 ? names.at(-2) : undefined;
  return joinTheme(root, sub);
}

export async function searchCatalog(
  deps: CatalogDeps,
  kind: CatalogKind,
  text: string,
): Promise<CatalogHit[]> {
  const query = classifyQuery(kind, text);
  if (query.by === "number") {
    try {
      const item = await deps.bricklink.item(kind === "legoSet" ? "SET" : "MINIFIG", query.ref);
      const hit: CatalogHit = { kind, ref: item.number, number: item.number, name: item.name };
      if (item.year !== undefined) hit.year = item.year;
      if (item.imageUrl !== undefined) hit.imageUrl = item.imageUrl;
      return [hit];
    } catch (error) {
      if (error instanceof CatalogError && error.failure === "not_found") return [];
      throw error;
    }
  }
  if (kind === "legoSet") {
    return (await deps.rebrickable.searchSets(query.text)).map((set) => ({
      kind,
      ref: set.number,
      number: set.number,
      name: set.name,
      ...(set.year === undefined ? {} : { year: set.year }),
      ...(set.imageUrl === undefined ? {} : { imageUrl: set.imageUrl }),
    }));
  }
  return (await deps.rebrickable.searchMinifigs(query.text)).map((fig) => ({
    kind,
    ref: fig.figNum,
    name: fig.name,
    ...(fig.imageUrl === undefined ? {} : { imageUrl: fig.imageUrl }),
  }));
}

export async function loadItem(
  deps: CatalogDeps,
  kind: CatalogKind,
  ref: string,
): Promise<CatalogItem> {
  const query = classifyQuery(kind, ref);
  if (query.by !== "number") throw new CatalogError("not_found", "Keine Nummer");
  const key = `item:${kind}:${query.ref}`;
  return cached(deps, key, () =>
    kind === "legoSet" ? setItem(deps, query.ref) : minifigItem(deps, query.ref),
  );
}

async function setItem(
  deps: CatalogDeps,
  number: string,
): Promise<{ value: CatalogItem; complete: boolean }> {
  const incomplete = { value: false };
  const base = await deps.bricklink.item("SET", number);
  const figures = await optional(() => deps.bricklink.minifigsOfSet(number), incomplete);
  const rebrickable = await optional(() => deps.rebrickable.set(number), incomplete);
  const themeId = rebrickable?.themeId;
  const theme =
    (await optional(
      () => themeChain(deps, "rb-theme", themeId, (id) => deps.rebrickable.theme(id)),
      incomplete,
    )) ?? (await optional(() => bricklinkTheme(deps, base.categoryId), incomplete));
  const item: CatalogItem = { kind: "legoSet", number: base.number, name: base.name };
  const released = base.year ?? rebrickable?.year;
  const imageUrl = base.imageUrl ?? rebrickable?.imageUrl;
  if (released !== undefined) item.year = released;
  if (theme !== undefined) item.theme = theme;
  if (rebrickable?.pieceCount !== undefined) item.pieceCount = rebrickable.pieceCount;
  if (imageUrl !== undefined) item.imageUrl = imageUrl;
  if (figures) item.figures = figures.map(figureInfo);
  return { value: item, complete: !incomplete.value };
}

function figureInfo(entry: {
  number: string;
  name: string;
  quantity: number;
  imageUrl?: string;
}): CatalogFigureInfo {
  return {
    number: entry.number,
    name: entry.name,
    quantity: entry.quantity,
    ...(entry.imageUrl === undefined ? {} : { imageUrl: entry.imageUrl }),
  };
}

function bricklinkTheme(deps: CatalogDeps, categoryId: number | undefined) {
  return themeChain(deps, "bl-category", categoryId, (id) => deps.bricklink.category(id));
}

async function minifigItem(
  deps: CatalogDeps,
  ref: string,
): Promise<{ value: CatalogItem; complete: boolean }> {
  if (REBRICKABLE_FIG.test(ref)) return resolveRebrickableFigure(deps, ref);
  const incomplete = { value: false };
  const base = await deps.bricklink.item("MINIFIG", ref);
  const theme = await optional(() => bricklinkTheme(deps, base.categoryId), incomplete);
  const sets = await optional(() => deps.bricklink.setsOfMinifig(ref), incomplete);
  const item: CatalogItem = { kind: "minifig", number: base.number, name: base.name };
  if (base.year !== undefined) item.year = base.year;
  if (theme !== undefined) item.theme = theme;
  if (base.imageUrl !== undefined) item.imageUrl = base.imageUrl;
  if (sets) item.sets = sets.map((set): CatalogSetInfo => ({ number: set.number, name: set.name }));
  return { value: item, complete: !incomplete.value };
}

/** A figure known by Rebrickable's number: find its BrickLink twin in the subsets of its sets. */
async function resolveRebrickableFigure(
  deps: CatalogDeps,
  figNum: string,
): Promise<{ value: CatalogItem; complete: boolean }> {
  const fig = await deps.rebrickable.minifig(figNum);
  const incomplete = { value: false };
  const setNumbers =
    (await optional(() => deps.rebrickable.setsOfMinifig(figNum), incomplete)) ?? [];
  for (const setNumber of setNumbers.slice(0, MAX_SETS_TRIED)) {
    const entries = await optional(() => deps.bricklink.minifigsOfSet(setNumber), incomplete);
    const match = entries?.find((entry) => sameName(entry.name, fig.name));
    if (match) return minifigItem(deps, match.number);
  }
  const item: CatalogItem = { kind: "minifig", number: "", name: fig.name };
  if (fig.imageUrl !== undefined) item.imageUrl = fig.imageUrl;
  return { value: item, complete: !incomplete.value };
}
