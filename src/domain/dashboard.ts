// The lists of the dashboard (F12): the most valuable objects and the share per sub theme.

import { countsOnItsOwn } from "./inSet";
import { mainTheme, showcaseItems, subTheme } from "./showcase";
import type { Collection, IsoDate, ShowcaseItem } from "./types";
import { valueOfItem } from "./value";

export const TOP_COUNT = 10;
/** Sub themes shown on their own; the rest is summed up as "Sonstige". */
export const THEME_ROWS = 5;

const collator = new Intl.Collator("de", { sensitivity: "base", numeric: true });

export interface RankedItem {
  item: ShowcaseItem;
  cents: number;
}

/** The most valuable figures, sets and special parts, each copy on its own; 0 € never ranks. */
export function mostValuable(collection: Collection, limit = TOP_COUNT): RankedItem[] {
  return showcaseItems(collection)
    .filter((item) => countsOnItsOwn(collection, item))
    .map((item) => ({ item, cents: valueOfItem(item, collection.prices).cents }))
    .filter((ranked) => ranked.cents > 0)
    .sort((a, b) => b.cents - a.cents || collator.compare(a.item.name, b.item.name))
    .slice(0, limit);
}

export type ThemeShare =
  | { kind: "theme"; name: string; count: number; percent: number }
  | { kind: "none" | "rest"; count: number; percent: number };

/**
 * The share of figures, sets and special parts per sub theme (PO decision 31.10.2026: "The Clone
 * Wars", not "Star Wars"); a theme without sub theme counts under its own name.
 */
export function themeShares(collection: Collection, rows = THEME_ROWS): ThemeShare[] {
  const items = showcaseItems(collection);
  if (items.length === 0) return [];
  const groups = new Map<string, { name: string | undefined; count: number }>();
  for (const item of items) {
    const name = subTheme(item.theme) ?? mainTheme(item.theme);
    const key = item.theme?.trim() ? item.theme.trim() : "";
    const group = groups.get(key) ?? { name, count: 0 };
    group.count += 1;
    groups.set(key, group);
  }
  const percent = (count: number) => Math.round((count / items.length) * 100);
  const ranked = [...groups.values()].sort(
    (a, b) => b.count - a.count || collator.compare(a.name ?? "", b.name ?? ""),
  );
  const shares: ThemeShare[] = ranked
    .slice(0, rows)
    .map((group) =>
      group.name === undefined
        ? { kind: "none", count: group.count, percent: percent(group.count) }
        : { kind: "theme", name: group.name, count: group.count, percent: percent(group.count) },
    );
  const rest = ranked.slice(rows).reduce((sum, group) => sum + group.count, 0);
  if (rest > 0) shares.push({ kind: "rest", count: rest, percent: percent(rest) });
  return shares;
}

/** The last day with a price: "Preise Stand vom …". */
export function latestPriceDate(collection: Collection, today: IsoDate): IsoDate | undefined {
  return collection.prices
    .map((point) => point.date)
    .filter((date) => date <= today)
    .sort()
    .at(-1);
}
