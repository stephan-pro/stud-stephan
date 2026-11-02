// The showcase (F11): which tiles there are, filtered and sorted. Copies of the same figure share
// one tile with a count ("×3", F5).

import type { PhotoFocusMap } from "./photoFocus";
import { itemNumber } from "./prices";
import type {
  Collection,
  Condition,
  LegoSet,
  Manufacturer,
  ManufacturerKind,
  Minifig,
  PhotoFocus,
  PricePoint,
  ShowcaseItem,
  SpecialPart,
} from "./types";
import { isModified, valueOfItem } from "./value";

const collator = new Intl.Collator("de", { sensitivity: "base", numeric: true });

const THEME_SEPARATOR = " – ";

/** "Star Wars – The Clone Wars" → "Star Wars". */
export function mainTheme(theme: string | undefined): string | undefined {
  const main = theme?.split(THEME_SEPARATOR)[0]?.trim();
  return main || undefined;
}

/** "Star Wars – The Clone Wars" → "The Clone Wars"; a theme without sub theme has none. */
export function subTheme(theme: string | undefined): string | undefined {
  const sub = theme?.split(THEME_SEPARATOR).slice(1).join(THEME_SEPARATOR).trim();
  return sub || undefined;
}

/** Lower case without accents, for searching and for comparing names. */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("de").trim();
}

function manufacturerKey(manufacturer: Manufacturer): string {
  return "name" in manufacturer
    ? `${manufacturer.kind}:${normalize(manufacturer.name)}`
    : manufacturer.kind;
}

export type ShowcaseEntry =
  | { type: "minifig"; key: string; copies: Minifig[] }
  | { type: "legoSet"; key: string; item: LegoSet }
  | { type: "specialPart"; key: string; item: SpecialPart };

export type CopyGroup = Extract<ShowcaseEntry, { type: "minifig" }>;

export function entryItems(entry: ShowcaseEntry): ShowcaseItem[] {
  return entry.type === "minifig" ? entry.copies : [entry.item];
}

const newestFirst = (a: { createdAt: string; id: string }, b: { createdAt: string; id: string }) =>
  b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);

/** Same figure = same manufacturer and BrickLink number; without a number, the same name. */
function copyKey(minifig: Minifig): string {
  const number = itemNumber(minifig);
  const identity = number ? `#${normalize(number)}` : `name:${normalize(minifig.name)}`;
  return `minifig:${manufacturerKey(minifig.manufacturer)}:${identity}`;
}

/** Groups copies of the same figure (F5); copies newest first, groups in order of appearance. */
export function groupCopies(minifigs: readonly Minifig[]): CopyGroup[] {
  const groups = new Map<string, Minifig[]>();
  for (const minifig of minifigs) {
    const key = copyKey(minifig);
    groups.set(key, [...(groups.get(key) ?? []), minifig]);
  }
  return [...groups].map(([key, copies]) => ({
    type: "minifig",
    key,
    copies: copies.sort(newestFirst),
  }));
}

export type CoverImage =
  | { kind: "photo"; path: string; focus?: PhotoFocus }
  | { kind: "catalog"; url: string };

/** An own photo with its point, as boxes that fill their area need it. */
export function photoImage(
  object: { readonly photoFocus?: PhotoFocusMap | undefined },
  path: string,
): CoverImage {
  const focus = object.photoFocus?.[path];
  return focus ? { kind: "photo", path, focus } : { kind: "photo", path };
}

/** The gallery of a detail page: own photos in order, the catalog image last (S2). */
export function galleryImages(item: ShowcaseItem): CoverImage[] {
  const images: CoverImage[] = item.photos.map((path) => photoImage(item, path));
  if (item.catalogImageUrl) images.push({ kind: "catalog", url: item.catalogImageUrl });
  return images;
}

/** Own photos before the catalog image (F11); for a group the first copy that has a photo. */
export function coverImage(entry: ShowcaseEntry): CoverImage | undefined {
  const items = entryItems(entry);
  for (const item of items) {
    const path = item.photos[0];
    if (path) return photoImage(item, path);
  }
  const url = items.find((item) => item.catalogImageUrl)?.catalogImageUrl;
  return url ? { kind: "catalog", url } : undefined;
}

export type ShowcaseType = "all" | ShowcaseItem["type"];

export interface ShowcaseFilter {
  /** The chips Alle · Figuren · Sets · Sonderteile. */
  type: ShowcaseType;
  /** Search in name, number, theme and manufacturer. */
  query: string;
  /**
   * Themes, two levels (PO decision 31.10.2026): a main theme ("Star Wars") takes everything below
   * it, a sub theme ("Star Wars – The Clone Wars") only its own objects. Empty = all.
   */
  themes: string[];
  manufacturers: ManufacturerKind[];
  conditions: Condition[];
  /** "Modifiziert": egal · ja · nein. Ja/nein only applies to figures. */
  modified: "any" | "yes" | "no";
  /** "Nur Figuren ohne Diorama". */
  withoutDiorama: boolean;
}

export const NO_FILTER: ShowcaseFilter = {
  type: "all",
  query: "",
  themes: [],
  manufacturers: [],
  conditions: [],
  modified: "any",
  withoutDiorama: false,
};

/** Number on the "Filter" button: each restricting part of the filter sheet counts once. */
export function activeFilterCount(filter: ShowcaseFilter): number {
  return [
    filter.themes.length > 0,
    filter.manufacturers.length > 0,
    filter.conditions.length > 0,
    filter.modified !== "any",
    filter.withoutDiorama,
  ].filter(Boolean).length;
}

function matchesQuery(item: ShowcaseItem, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const manufacturer =
    "name" in item.manufacturer ? item.manufacturer.name : item.manufacturer.kind;
  const text = normalize(
    [item.name, itemNumber(item), item.theme, manufacturer].filter(Boolean).join(" "),
  );
  return words.every((word) => text.includes(word));
}

/** Whether the theme is chosen: itself (sub theme) or its main theme. `themes` is normalized. */
function themeSelected(themes: ReadonlySet<string>, theme: string | undefined): boolean {
  if (theme === undefined) return false;
  return themes.has(normalize(theme)) || themes.has(normalize(mainTheme(theme) ?? ""));
}

/**
 * The F11 filters. Modified yes/no and "ohne Diorama" are properties of figures, so they show
 * figures only.
 */
export function filterShowcase(
  items: readonly ShowcaseItem[],
  filter: ShowcaseFilter,
): ShowcaseItem[] {
  const themes = new Set(filter.themes.map(normalize));
  return items.filter((item) => {
    if (filter.type !== "all" && item.type !== filter.type) return false;
    if (themes.size > 0 && !themeSelected(themes, item.theme)) return false;
    if (filter.manufacturers.length > 0 && !filter.manufacturers.includes(item.manufacturer.kind))
      return false;
    if (filter.conditions.length > 0 && !filter.conditions.includes(item.condition)) return false;
    if (filter.modified !== "any") {
      if (item.type !== "minifig" || isModified(item) !== (filter.modified === "yes")) return false;
    }
    if (filter.withoutDiorama && (item.type !== "minifig" || item.dioramaId)) return false;
    return matchesQuery(item, filter.query);
  });
}

export interface ThemeGroup {
  /** The main theme, e.g. "Star Wars". */
  theme: string;
  /** Its sub themes as full themes ("Star Wars – The Clone Wars") with the shown `name`. */
  subThemes: { theme: string; name: string }[];
}

/** Themes for the filter sheet, two levels, each alphabetically and without doubles. */
export function showcaseThemes(items: readonly ShowcaseItem[]): ThemeGroup[] {
  const groups = new Map<string, { theme: string; subs: Map<string, string> }>();
  for (const item of items) {
    const main = mainTheme(item.theme);
    if (!main) continue;
    const group = groups.get(normalize(main)) ?? { theme: main, subs: new Map() };
    groups.set(normalize(main), group);
    const sub = subTheme(item.theme);
    if (sub && !group.subs.has(normalize(sub))) group.subs.set(normalize(sub), sub);
  }
  return [...groups.values()]
    .sort((a, b) => collator.compare(a.theme, b.theme))
    .map(({ theme, subs }) => ({
      theme,
      subThemes: [...subs.values()]
        .sort(collator.compare)
        .map((name) => ({ theme: `${theme}${THEME_SEPARATOR}${name}`, name })),
    }));
}

/** What the tile of an entry shows, without texts (the interface words them). */
export interface TileFacts {
  name: string;
  manufacturer: Manufacturer;
  /** BrickLink number, set number or number of the special part. */
  number?: string;
  /** Main theme. */
  theme?: string;
  /** Copies behind the tile; more than one shows "×3". */
  copies: number;
  modified: boolean;
  /** Some copy stands in no diorama (figures only). */
  withoutDiorama: boolean;
  /** Value of the most valuable copy; "ohne Wert" instead when `valueMissing`. */
  cents: number;
  valueMissing: boolean;
}

export function tileFacts(entry: ShowcaseEntry, prices: readonly PricePoint[]): TileFacts {
  const items = entryItems(entry);
  const first = items[0] as ShowcaseItem;
  const valuations = items.map((item) => valueOfItem(item, prices));
  const facts: TileFacts = {
    name: first.name,
    manufacturer: first.manufacturer,
    copies: items.length,
    modified: entry.type === "minifig" && entry.copies.some(isModified),
    withoutDiorama: entry.type === "minifig" && entry.copies.some((copy) => !copy.dioramaId),
    cents: Math.max(...valuations.map((valuation) => valuation.cents)),
    valueMissing: valuations.every((valuation) => valuation.ownValueMissing),
  };
  const number = itemNumber(first);
  if (number) facts.number = number;
  const theme = mainTheme(first.theme);
  if (theme) facts.theme = theme;
  return facts;
}

/** "75372-1" → "75372": the set number without the version suffix, as the tile shows it. */
export function shortSetNumber(setNumber: string): string {
  return setNumber.replace(/^(\d+)-\d+$/, "$1");
}

export function showcaseItems(collection: Collection): ShowcaseItem[] {
  return [...collection.minifigs, ...collection.sets, ...collection.specialParts];
}

/** Tiles from items: figures grouped, sets and special parts one tile each. */
export function toEntries(items: readonly ShowcaseItem[]): ShowcaseEntry[] {
  const entries: ShowcaseEntry[] = groupCopies(
    items.filter((item): item is Minifig => item.type === "minifig"),
  );
  for (const item of items) {
    if (item.type === "legoSet") entries.push({ type: "legoSet", key: `legoSet:${item.id}`, item });
    if (item.type === "specialPart")
      entries.push({ type: "specialPart", key: `specialPart:${item.id}`, item });
  }
  return entries;
}

/** "Zuletzt hinzugefügt" · "Name" · "Wert" (highest first). */
export type ShowcaseSort = "recent" | "name" | "value";

export function sortShowcase(
  entries: readonly ShowcaseEntry[],
  sort: ShowcaseSort,
  prices: readonly PricePoint[],
): ShowcaseEntry[] {
  interface Keyed {
    entry: ShowcaseEntry;
    name: string;
    createdAt: string;
    value: number;
  }
  const keyed: Keyed[] = entries.map((entry) => {
    const items = entryItems(entry);
    return {
      entry,
      name: items[0]?.name ?? "",
      // A group counts with its newest copy and its most valuable one.
      createdAt:
        items
          .map((item) => item.createdAt)
          .sort()
          .at(-1) ?? "",
      value:
        sort === "value" ? Math.max(...items.map((item) => valueOfItem(item, prices).cents)) : 0,
    };
  });
  const byName = (a: Keyed, b: Keyed) =>
    collator.compare(a.name, b.name) || a.entry.key.localeCompare(b.entry.key);
  const compare: Record<ShowcaseSort, (a: Keyed, b: Keyed) => number> = {
    recent: (a, b) => b.createdAt.localeCompare(a.createdAt) || byName(a, b),
    name: byName,
    value: (a, b) => b.value - a.value || byName(a, b),
  };
  return keyed.sort(compare[sort]).map(({ entry }) => entry);
}

/** Everything the showcase grid shows: filter the items, group the copies, sort the tiles. */
export function showcase(
  collection: Collection,
  filter: ShowcaseFilter,
  sort: ShowcaseSort,
): ShowcaseEntry[] {
  const items = filterShowcase(showcaseItems(collection), filter);
  return sortShowcase(toEntries(items), sort, collection.prices);
}
