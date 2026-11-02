// BrickLink market prices (F10): looking up the latest price and recording a weekly run.
// Copies of the same figure share one BrickLink number and therefore one price per run. Special
// parts taken from the catalog have a price too, kept under their BrickLink type and number.

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

/**
 * The number an object's price is kept under (`PricePoint.bricklinkId`). For a special part it is
 * the BrickLink type and the number in one text ("GEAR:5010325"), because the number alone does
 * not say what to ask BrickLink for; a part that was not taken from the catalog has no type and
 * therefore no price.
 */
export function priceNumber(item: Priceable): string | undefined {
  if (item.type !== "specialPart") return itemNumber(item);
  const number = item.number?.trim();
  return number && item.bricklinkType ? `${item.bricklinkType}:${number}` : undefined;
}

/** "minifig:sw0194"; case and surrounding spaces of the number do not matter. */
export function catalogKey(itemType: PricedType, bricklinkId: string): string {
  return `${itemType}:${bricklinkId.trim().toLowerCase()}`;
}

/** Only official LEGO items with a BrickLink number get a market value; everything else is estimated. */
export function hasMarketPrice(item: Priceable): boolean {
  return item.manufacturer.kind === "lego" && priceNumber(item) !== undefined;
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
  const number = priceNumber(item);
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

/** One day's market price in one condition. */
export interface PriceStep {
  date: IsoDate;
  cents: number;
}

/**
 * The market price in one condition over the runs, oldest first (the mini chart of the value card,
 * F10). Runs without a price in that condition are left out.
 */
export function priceHistory(
  item: Priceable,
  condition: Condition,
  prices: readonly PricePoint[],
): PriceStep[] {
  const number = priceNumber(item);
  if (!hasMarketPrice(item) || number === undefined) return [];
  const points = priceIndex(prices).get(catalogKey(item.type, number)) ?? [];
  return points
    .flatMap((point) => {
      const cents = point.cents[condition];
      return cents === undefined ? [] : [{ date: point.date, cents }];
    })
    .reverse();
}

/**
 * What the price run counts as skipped when it has no number (P11): official figures and sets of
 * the collection and of the wishlist. Special parts are not among them: one without a BrickLink
 * type was not taken from the catalog and keeps its own value or purchase price, without a note.
 */
function numberedCandidates(collection: Collection): Priceable[] {
  return [...collection.minifigs, ...collection.sets, ...collection.wishlist];
}

/**
 * Every catalog item a price run has to ask BrickLink for, each once (as the database's
 * `price_run_begin` does): the figures, sets and wishes with a number, and the special parts with a
 * BrickLink type.
 */
export function itemsToPrice(collection: Collection): CatalogItem[] {
  const items = new Map<string, CatalogItem>();
  for (const item of [...numberedCandidates(collection), ...collection.specialParts]) {
    const bricklinkId = priceNumber(item);
    if (!hasMarketPrice(item) || bricklinkId === undefined) continue;
    const key = catalogKey(item.type, bricklinkId);
    if (!items.has(key)) items.set(key, { itemType: item.type, bricklinkId });
  }
  return [...items.values()];
}

/** Official figures, sets and wishes without a number: the run skips them (`skipped`). */
export function itemsWithoutNumber(collection: Collection): number {
  return numberedCandidates(collection).filter(
    (item) => item.manufacturer.kind === "lego" && itemNumber(item) === undefined,
  ).length;
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
