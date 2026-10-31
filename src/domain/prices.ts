// BrickLink market prices (F10): looking up the latest price and recording a weekly run.
// Copies of the same figure share one BrickLink number and therefore one price per run.

import type {
  Collection,
  Condition,
  IsoDate,
  PricedType,
  PricePoint,
  ShowcaseItem,
  WishItem,
} from "./types";

/** Owned objects and wishes: everything that can carry a BrickLink number. */
type Priceable = ShowcaseItem | WishItem;

export interface CatalogItem {
  itemType: PricedType;
  bricklinkId: string;
}

export interface MarketPrice {
  cents: number;
  date: IsoDate;
  soldCount?: number;
}

/** The number of an object: BrickLink number of a figure, set number, number of a special part. */
export function itemNumber(item: Priceable): string | undefined {
  let number: string | undefined;
  if (item.type === "minifig") number = item.bricklinkId;
  else if (item.type === "legoSet") number = item.setNumber;
  else if (item.type === "specialPart") number = item.number;
  return number?.trim() || undefined;
}

/** "minifig:sw0194"; case and surrounding spaces of the number do not matter. */
export function catalogKey(itemType: PricedType, bricklinkId: string): string {
  return `${itemType}:${bricklinkId.trim().toLowerCase()}`;
}

/** Only official LEGO items with a number get a market value; everything else is estimated. */
export function hasMarketPrice(item: Priceable): boolean {
  return item.manufacturer.kind === "lego" && itemNumber(item) !== undefined;
}

export function otherCondition(condition: Condition): Condition {
  return condition === "new" ? "used" : "new";
}

// Price points per catalog key, newest first. Cached per array: the domain never changes arrays,
// it always returns new ones.
const indexes = new WeakMap<readonly PricePoint[], Map<string, PricePoint[]>>();

function priceIndex(prices: readonly PricePoint[]): Map<string, PricePoint[]> {
  const cached = indexes.get(prices);
  if (cached) return cached;
  const index = new Map<string, PricePoint[]>();
  for (const point of prices) {
    const key = catalogKey(point.itemType, point.bricklinkId);
    index.set(key, [...(index.get(key) ?? []), point]);
  }
  for (const points of index.values()) points.sort((a, b) => b.date.localeCompare(a.date));
  indexes.set(prices, index);
  return index;
}

/**
 * The latest known market price of an item in one condition. A run that brought no price leaves
 * the older one in place, so a failed run never overwrites a value (F10).
 */
export function marketPrice(
  item: Priceable,
  condition: Condition,
  prices: readonly PricePoint[],
): MarketPrice | undefined {
  const number = itemNumber(item);
  if (!hasMarketPrice(item) || number === undefined) return undefined;
  for (const point of priceIndex(prices).get(catalogKey(item.type, number)) ?? []) {
    const cents = point.cents[condition];
    if (cents === undefined) continue;
    const soldCount = point.soldCount?.[condition];
    return soldCount === undefined
      ? { cents, date: point.date }
      : { cents, date: point.date, soldCount };
  }
  return undefined;
}

/** Every catalog item a price run has to ask BrickLink for, each once: owned objects and wishes. */
export function itemsToPrice(collection: Collection): CatalogItem[] {
  const items = new Map<string, CatalogItem>();
  const all: Priceable[] = [
    ...collection.minifigs,
    ...collection.sets,
    ...collection.specialParts,
    ...collection.wishlist,
  ];
  for (const item of all) {
    const bricklinkId = itemNumber(item);
    if (!hasMarketPrice(item) || bricklinkId === undefined) continue;
    const key = catalogKey(item.type, bricklinkId);
    if (!items.has(key)) items.set(key, { itemType: item.type, bricklinkId });
  }
  return [...items.values()];
}

/** What a price run brought back for one catalog item. */
export type PriceResult =
  | (CatalogItem & {
      ok: true;
      cents: Partial<Record<Condition, number>>;
      soldCount?: Partial<Record<Condition, number>>;
    })
  | (CatalogItem & { ok: false });

/**
 * Adds the result of one run (F10): exactly one new price point per item that brought a price,
 * dated `today`. A second run on the same day replaces that day's point. Failed items and items
 * without any sale add nothing, so their older value stays.
 */
export function recordPriceRun(
  prices: readonly PricePoint[],
  results: readonly PriceResult[],
  today: IsoDate,
): PricePoint[] {
  const fresh = new Map<string, PricePoint>();
  for (const result of results) {
    if (!result.ok) continue;
    if (result.cents.new === undefined && result.cents.used === undefined) continue;
    const point: PricePoint = {
      itemType: result.itemType,
      bricklinkId: result.bricklinkId.trim(),
      date: today,
      source: "bricklink",
      cents: { ...result.cents },
    };
    if (result.soldCount) point.soldCount = { ...result.soldCount };
    fresh.set(catalogKey(result.itemType, result.bricklinkId), point);
  }
  const kept = prices.filter(
    (point) => point.date !== today || !fresh.has(catalogKey(point.itemType, point.bricklinkId)),
  );
  return [...kept, ...fresh.values()];
}
