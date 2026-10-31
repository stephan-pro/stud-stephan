// The wishlist (F14): market price in the wished condition, "Zielpreis erreicht", sorting.

import { type MarketPrice, marketPrice } from "./prices";
import type { Cents, PricePoint, Priority, WishItem } from "./types";

/** Reached if the market price is at or below the target, exact to the cent; needs both prices. */
export function targetReached(targetPrice: Cents | undefined, price: Cents | undefined): boolean {
  return targetPrice !== undefined && price !== undefined && price <= targetPrice;
}

export interface WishStatus {
  marketPrice?: MarketPrice;
  targetReached: boolean;
}

export function wishStatus(item: WishItem, prices: readonly PricePoint[]): WishStatus {
  const price = marketPrice(item, item.desiredCondition, prices);
  const reached = targetReached(item.targetPrice, price?.cents);
  return price ? { marketPrice: price, targetReached: reached } : { targetReached: reached };
}

/** "Nach Priorität" · "Nach Preis" (cheapest first, without price last) · "Nach Name". */
export type WishSort = "priority" | "price" | "name";

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/** Entries with reached target price come first in their own section, both parts sorted. */
export function arrangeWishlist(
  items: readonly WishItem[],
  prices: readonly PricePoint[],
  sort: WishSort,
): { reached: WishItem[]; others: WishItem[] } {
  const keyed = items.map((item) => ({ item, status: wishStatus(item, prices) }));
  type Keyed = (typeof keyed)[number];
  const byName = (a: Keyed, b: Keyed) =>
    a.item.name.localeCompare(b.item.name, "de") || a.item.id.localeCompare(b.item.id);
  const compare: Record<WishSort, (a: Keyed, b: Keyed) => number> = {
    priority: (a, b) =>
      PRIORITY_ORDER[a.item.priority] - PRIORITY_ORDER[b.item.priority] || byName(a, b),
    price: (a, b) =>
      (a.status.marketPrice?.cents ?? Number.POSITIVE_INFINITY) -
        (b.status.marketPrice?.cents ?? Number.POSITIVE_INFINITY) || byName(a, b),
    name: byName,
  };
  const sorted = keyed.sort(compare[sort]);
  return {
    reached: sorted.filter(({ status }) => status.targetReached).map(({ item }) => item),
    others: sorted.filter(({ status }) => !status.targetReached).map(({ item }) => item),
  };
}
