// The numbers of the whole collection (F10, F12): value, purchase sum, mod spend, counts.

import { mainTheme, showcaseItems } from "./showcase";
import type { Cents, Collection } from "./types";
import { modSpend, valueOfItem } from "./value";

export interface Totals {
  /** Sum of all values; objects without a value count with 0 €. */
  value: Cents;
  purchase: Cents;
  /** Value minus purchase sum ("Wertdifferenz"). */
  difference: Cents;
  /** "Ausgaben für Mods", not part of the value (F6). */
  modSpend: Cents;
  /** Figures, sets and special parts without market value and without entered value ("ohne Wert"). */
  withoutValue: number;
  counts: { minifigs: number; sets: number; specialParts: number; dioramas: number };
  /** Figures, sets and special parts per main theme, most first; objects without theme are left out. */
  themes: { theme: string; count: number }[];
}

export function totals(collection: Collection): Totals {
  const items = showcaseItems(collection);
  let value = 0;
  let purchase = 0;
  let withoutValue = 0;
  const themes = new Map<string, number>();
  for (const item of items) {
    const valuation = valueOfItem(item, collection.prices);
    value += valuation.cents;
    purchase += item.purchasePrice ?? 0;
    if (valuation.ownValueMissing) withoutValue += 1;
    const theme = mainTheme(item.theme);
    if (theme) themes.set(theme, (themes.get(theme) ?? 0) + 1);
  }
  // A diorama only adds a value Stephan estimated; without one it is not "ohne Wert", because its
  // figures are counted on their own.
  for (const diorama of collection.dioramas) value += valueOfItem(diorama, collection.prices).cents;
  return {
    value,
    purchase,
    difference: value - purchase,
    modSpend: collection.minifigs.reduce((sum, minifig) => sum + modSpend(minifig), 0),
    withoutValue,
    counts: {
      minifigs: collection.minifigs.length,
      sets: collection.sets.length,
      specialParts: collection.specialParts.length,
      dioramas: collection.dioramas.length,
    },
    themes: [...themes]
      .map(([theme, count]) => ({ theme, count }))
      .sort((a, b) => b.count - a.count || a.theme.localeCompare(b.theme, "de")),
  };
}
