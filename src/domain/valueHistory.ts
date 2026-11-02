// The history of the total value (F12) and its change over a week. It is built from the price
// points of the price runs (P11) and nothing else: one point per run day, never an invented one.
// On a day only the objects that were already in the collection count, each with the value that
// held that day: market value, else the own value (if it was entered by then), else purchase price.

import { countsOnItsOwn } from "./inSet";
import { showcaseItems } from "./showcase";
import type { Cents, Collection, Diorama, IsoDate, ShowcaseItem } from "./types";
import { valueOfItem } from "./value";

export type ValuePeriod = "threeMonths" | "year" | "all";

export const VALUE_PERIODS: readonly ValuePeriod[] = ["threeMonths", "year", "all"];

/** The total value on one day. */
export interface ValuePoint {
  date: IsoDate;
  cents: Cents;
}

export interface ValueTrend {
  /** Oldest first. Fewer than two points are no history yet. */
  points: ValuePoint[];
  /** The first day with a price: the history cannot start earlier. */
  since?: IsoDate;
  /** The period reaches back further than the prices ("Verlauf ab …"). */
  partial: boolean;
  /** Last value minus first value; only with two points or more. */
  change?: Cents;
}

export interface WeeklyChange {
  cents: Cents;
  /** 2.5 for +2,5 %. */
  percent: number;
}

const DAY_MS = 86_400_000;

function toMs(day: IsoDate): number {
  return Date.parse(`${day}T00:00:00Z`);
}

function toDay(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(day: IsoDate, days: number): IsoDate {
  return toDay(toMs(day) + days * DAY_MS);
}

/** Calendar months back, the day of the month kept as far as the month has it. */
function monthsBack(day: IsoDate, months: number): IsoDate {
  const date = new Date(toMs(day));
  const dayOfMonth = date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(dayOfMonth, lastDay));
  return toDay(target.getTime());
}

/** First day of a period that ends today; "all" has none (it starts with the first price). */
export function periodStart(period: ValuePeriod, today: IsoDate): IsoDate | undefined {
  if (period === "threeMonths") return monthsBack(today, 3);
  if (period === "year") return monthsBack(today, 12);
  return undefined;
}

/** Days with a price, oldest first. */
export function priceDates(collection: Collection, today: IsoDate): IsoDate[] {
  return [...new Set(collection.prices.map((point) => point.date))]
    .filter((date) => date <= today)
    .sort();
}

/** The day an object counts as part of the collection: bought on, else entered on. */
function ownedSince(item: ShowcaseItem | Diorama, today: IsoDate): IsoDate {
  const bought = "acquiredOn" in item ? item.acquiredOn : undefined;
  const day = bought || item.createdAt.slice(0, 10);
  // A purchase date in the future counts from today, so that today's value is the total value.
  return day > today ? today : day;
}

/** The total value on a day, as the prices and entries were known then. */
export function valueAt(collection: Collection, day: IsoDate, today: IsoDate): Cents {
  const prices = collection.prices.filter((point) => point.date <= day);
  let sum = 0;
  for (const item of [...showcaseItems(collection), ...collection.dioramas]) {
    if (ownedSince(item, today) > day) continue;
    if (item.type !== "diorama" && !countsOnItsOwn(collection, item)) continue;
    const known = { ...item };
    if (known.manualValue && known.manualValue.enteredOn > day) delete known.manualValue;
    sum += valueOfItem(known, prices).cents;
  }
  return sum;
}

/**
 * The points of a period: every run day in it, the start of the period if prices existed already
 * then, and today if the collection changed since the last run. Without prices there is no history.
 */
export function valueTrend(
  collection: Collection,
  period: ValuePeriod,
  today: IsoDate,
): ValueTrend {
  const dates = priceDates(collection, today);
  const since = dates[0];
  if (since === undefined) return { points: [], partial: false };
  const start = periodStart(period, today) ?? since;
  const days = dates.filter((date) => date >= start);
  if (since <= start && days[0] !== start) days.unshift(start);
  const points = days.map((date) => ({ date, cents: valueAt(collection, date, today) }));
  const last = points.at(-1);
  if (last && last.date < today) {
    const now = valueAt(collection, today, today);
    if (now !== last.cents) points.push({ date: today, cents: now });
  }
  const first = points[0];
  const end = points.at(-1);
  const trend: ValueTrend = { points, since, partial: start < since };
  if (first && end && points.length >= 2) trend.change = end.cents - first.cents;
  return trend;
}

/**
 * Today's value against the value a week ago (the "+2,5 % Woche" of the collection card). Without
 * a price from before that day, or with a value of 0 € then, there is nothing to compare.
 */
export function weeklyChange(collection: Collection, today: IsoDate): WeeklyChange | undefined {
  const since = priceDates(collection, today)[0];
  const weekAgo = addDays(today, -7);
  if (since === undefined || since > weekAgo) return undefined;
  const then = valueAt(collection, weekAgo, today);
  if (then <= 0) return undefined;
  const now = valueAt(collection, today, today);
  return { cents: now - then, percent: ((now - then) / then) * 100 };
}
