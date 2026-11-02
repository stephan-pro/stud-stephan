// The catalog (F2): search by number or name, and the full entry of a figure, set or special part.
//
// Numbers are BrickLink numbers (UMSETZUNG.md section 1): BrickLink gives name, year, picture, the
// minifigs in a set and the sets of a minifig. Rebrickable adds the name search (BrickLink has none),
// a set's piece count and its theme. A figure found by name has only a Rebrickable number
// ("fig-014663"); it is turned into a BrickLink number through the subsets of one of its sets, by
// name. If that fails the entry has no number and the person types it in the form.

import type { BricklinkClient, BricklinkItem } from "./bricklinkClient.ts";
import type { CatalogStore } from "./catalogStore.ts";
import {
  type CatalogFigureInfo,
  type CatalogHit,
  type CatalogItem,
  type CatalogKind,
  type CatalogSetInfo,
  FIGURE_TYPES,
  type FigureType,
  parseFigureRef,
  parseSpecialPartRef,
  SPECIAL_PART_TYPES,
  type SpecialPartType,
  specialPartRef,
  typedRef,
} from "./catalogTypes.ts";
import { CatalogError, decodeNames, joinTheme } from "./json.ts";
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
/**
 * A BrickLink part number of a Big Fig: digits, a printed or assembled variant ("pb01", "c01"):
 * "11323pb01c01" (the Rancor of 75005), "973c01". Plain digits are not one (they are set numbers).
 */
const PART_NUMBER = /^\d{2,6}[a-z]{1,4}\d{1,4}(?:[a-z]{1,2}\d{1,3})*$/i;
const REBRICKABLE_FIG = /^fig-\d+$/i;
const SET_NUMBER = /^\d{3,7}(-\d{1,2})?$/;
/** A special part's number: one token with at least one digit ("5010325", "5010325-1", "gear012"). */
const SPECIAL_NUMBER = /^(?=.*\d)[A-Za-z0-9][A-Za-z0-9._-]{0,49}$/;

export type Query = { by: "number"; ref: string } | { by: "name"; text: string };

/** Whether the text is a number of the kind or a name to search for. */
export function classifyQuery(kind: CatalogKind, text: string): Query {
  const query = text.trim();
  if (kind === "specialPart") {
    const typed = parseSpecialPartRef(query);
    if (typed) return { by: "number", ref: specialPartRef(typed.type, typed.number) };
    return SPECIAL_NUMBER.test(query) ? { by: "number", ref: query } : { by: "name", text: query };
  }
  if (kind === "legoSet") {
    return SET_NUMBER.test(query)
      ? { by: "number", ref: normalizeSetNumber(query) }
      : { by: "name", text: query };
  }
  if (REBRICKABLE_FIG.test(query)) return { by: "number", ref: query.toLowerCase() };
  // "PART:11323pb01c01" names the type; a plain number is tried as a minifig, then as a part.
  const typed = parseFigureRef(query);
  if (typed) return { by: "number", ref: typedRef(typed.type, typed.number.toLowerCase()) };
  return MINIFIG_NUMBER.test(query) || PART_NUMBER.test(query)
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
  if (known !== undefined && known !== null) return decodeNames(known as T);
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

/**
 * A special part by number: BrickLink has no list of GWPs, Insiders rewards and the like, they are
 * gear, sets or books, and a number does not say which. The types are asked one after the other
 * (gear first: that is where most promotional items are); "not found" goes on to the next, any
 * other failure ends the search. A reference with a type ("GEAR:5010325") asks that type only.
 * A set number without its variant gets "-1" like everywhere.
 */
async function findSpecialPart(
  deps: CatalogDeps,
  ref: string,
): Promise<{ type: SpecialPartType; item: BricklinkItem } | undefined> {
  const typed = parseSpecialPartRef(ref);
  const types = typed ? [typed.type] : SPECIAL_PART_TYPES;
  const number = typed?.number ?? ref;
  for (const type of types) {
    try {
      const item = await deps.bricklink.item(
        type,
        type === "SET" ? normalizeSetNumber(number) : number,
      );
      return { type, item };
    } catch (error) {
      if (error instanceof CatalogError && error.failure === "not_found") continue;
      throw error;
    }
  }
  return undefined;
}

/**
 * A figure by BrickLink number: a minifig, else a part (Big Figs such as the Rancor are "Large
 * Figure" parts). "Not found" goes on to the next type, any other failure ends the search; a
 * reference with a type ("PART:11323pb01c01") asks that type only.
 */
async function findFigure(
  deps: CatalogDeps,
  ref: string,
): Promise<{ type: FigureType; item: BricklinkItem } | undefined> {
  const typed = parseFigureRef(ref);
  const types = typed ? [typed.type] : FIGURE_TYPES;
  const number = typed?.number ?? ref;
  for (const type of types) {
    try {
      return { type, item: await deps.bricklink.item(type, number) };
    } catch (error) {
      if (error instanceof CatalogError && error.failure === "not_found") continue;
      throw error;
    }
  }
  return undefined;
}

export async function searchCatalog(
  deps: CatalogDeps,
  kind: CatalogKind,
  text: string,
): Promise<CatalogHit[]> {
  const query = classifyQuery(kind, text);
  if (kind === "specialPart") {
    // BrickLink cannot search by name, and no other source lists these items: numbers only.
    if (query.by !== "number") return [];
    const found = await findSpecialPart(deps, query.ref);
    if (!found) return [];
    const { type, item } = found;
    return [
      {
        kind,
        ref: specialPartRef(type, item.number),
        number: item.number,
        bricklinkType: type,
        name: item.name,
        ...(item.year === undefined ? {} : { year: item.year }),
        ...(item.imageUrl === undefined ? {} : { imageUrl: item.imageUrl }),
      },
    ];
  }
  if (query.by === "number") {
    try {
      // A figure may be a minifig or a part (Big Fig); only a part keeps its type in the hit.
      const found =
        kind === "legoSet"
          ? { type: "SET" as const, item: await deps.bricklink.item("SET", query.ref) }
          : await findFigure(deps, query.ref);
      if (!found) return [];
      const { type, item } = found;
      const isPart = type === "PART";
      const hit: CatalogHit = {
        kind,
        ref: isPart ? typedRef("PART", item.number) : item.number,
        number: item.number,
        name: item.name,
      };
      if (isPart) hit.bricklinkType = "PART";
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
  return cached(deps, key, () => {
    if (kind === "specialPart") return specialPartItem(deps, query.ref);
    return kind === "legoSet" ? setItem(deps, query.ref) : minifigItem(deps, query.ref);
  });
}

/** A GWP, Insiders reward or the like: name, year, picture and category from BrickLink. */
async function specialPartItem(
  deps: CatalogDeps,
  ref: string,
): Promise<{ value: CatalogItem; complete: boolean }> {
  const found = await findSpecialPart(deps, ref);
  if (!found) {
    throw new CatalogError(
      "not_found",
      "BrickLink: weder Gear noch Set noch Buch mit dieser Nummer",
    );
  }
  const { type, item: base } = found;
  const incomplete = { value: false };
  const theme = await optional(() => bricklinkTheme(deps, base.categoryId), incomplete);
  const item: CatalogItem = {
    kind: "specialPart",
    number: base.number,
    bricklinkType: type,
    name: base.name,
  };
  if (base.year !== undefined) item.year = base.year;
  if (theme !== undefined) item.theme = theme;
  if (base.imageUrl !== undefined) item.imageUrl = base.imageUrl;
  return { value: item, complete: !incomplete.value };
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
  bricklinkType?: "PART";
}): CatalogFigureInfo {
  return {
    number: entry.number,
    name: entry.name,
    quantity: entry.quantity,
    ...(entry.imageUrl === undefined ? {} : { imageUrl: entry.imageUrl }),
    ...(entry.bricklinkType === undefined ? {} : { bricklinkType: entry.bricklinkType }),
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
  // A minifig, else a part (a Big Fig such as the Rancor); the type is kept for a part only.
  const found = await findFigure(deps, ref);
  if (!found) {
    throw new CatalogError("not_found", "BrickLink: weder Minifigur noch Teil mit dieser Nummer");
  }
  const { type, item: base } = found;
  const theme = await optional(() => bricklinkTheme(deps, base.categoryId), incomplete);
  const sets = await optional(() => deps.bricklink.setsOf(type, base.number), incomplete);
  const item: CatalogItem = { kind: "minifig", number: base.number, name: base.name };
  if (type === "PART") item.bricklinkType = "PART";
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
    if (match) {
      return minifigItem(deps, match.bricklinkType ? typedRef("PART", match.number) : match.number);
    }
  }
  const item: CatalogItem = { kind: "minifig", number: "", name: fig.name };
  if (fig.imageUrl !== undefined) item.imageUrl = fig.imageUrl;
  return { value: item, complete: !incomplete.value };
}
