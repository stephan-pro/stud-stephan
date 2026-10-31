// The showcase (F11): which tiles there are, filtered and sorted. Copies of the same figure share
// one tile with a count ("×3", F5).

import { itemNumber } from "./prices";
import type {
  Collection,
  Condition,
  LegoSet,
  Manufacturer,
  ManufacturerKind,
  Minifig,
  PricePoint,
  ShowcaseItem,
  SpecialPart,
} from "./types";
import { isModified, valueOfItem } from "./value";

const collator = new Intl.Collator("de", { sensitivity: "base", numeric: true });

/** "Star Wars – The Clone Wars" → "Star Wars"; the filter and the dashboard use the main theme. */
export function mainTheme(theme: string | undefined): string | undefined {
  const main = theme?.split(" – ")[0]?.trim();
  return main || undefined;
}

/** Lower case without accents, for searching and for comparing names. */
function normalize(text: string): string {
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

export type CoverImage = { kind: "photo"; path: string } | { kind: "catalog"; url: string };

/** Own photos before the catalog image (F11); for a group the first copy that has a photo. */
export function coverImage(entry: ShowcaseEntry): CoverImage | undefined {
  const items = entryItems(entry);
  for (const item of items) {
    const path = item.photos[0];
    if (path) return { kind: "photo", path };
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
  /** Main themes; empty = all. */
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
    if (themes.size > 0 && !themes.has(normalize(mainTheme(item.theme) ?? ""))) return false;
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

/** Main themes for the filter sheet, alphabetically. */
export function showcaseThemes(items: readonly ShowcaseItem[]): string[] {
  const themes = new Map<string, string>();
  for (const item of items) {
    const theme = mainTheme(item.theme);
    if (theme && !themes.has(normalize(theme))) themes.set(normalize(theme), theme);
  }
  return [...themes.values()].sort(collator.compare);
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
