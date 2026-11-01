// The words for the chart of the total value, made from its points: what a person who cannot see
// the line gets read out (role="img" and aria-label).

import { formatDate, formatMonthShort } from "../domain/dates";
import { formatMoney } from "../domain/money";
import type { ValuePoint } from "../domain/valueHistory";
import { TEXTS } from "./texts";

/** The description of the chart; empty if there are fewer than two points (no chart then). */
export function describeChart(points: readonly ValuePoint[]): string {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last || points.length < 2) return "";
  let high = first;
  let low = first;
  for (const point of points) {
    if (point.cents > high.cents) high = point;
    if (point.cents < low.cents) low = point;
  }
  const direction = last.cents > first.cents ? "up" : last.cents < first.cents ? "down" : "same";
  return TEXTS.dashboard.chart(
    formatDate(first.date),
    formatDate(last.date),
    formatMoney(first.cents),
    formatMoney(last.cents),
    direction,
    formatMoney(high.cents),
    formatDate(high.date),
    formatMoney(low.cents),
    formatDate(low.date),
    points.length,
  );
}

const DAY_MS = 86_400_000;

/**
 * The marks under the line: first, middle (in time) and last day, as months when the chart spans
 * about a quarter or more, else as days; no middle mark for a span under two weeks.
 */
export function chartMarks(points: readonly ValuePoint[]): string[] {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return [];
  const start = Date.parse(first.date);
  const span = Date.parse(last.date) - start;
  const label = (date: string) => (span >= 90 * DAY_MS ? formatMonthShort(date) : formatDate(date));
  const middle = new Date(start + span / 2).toISOString().slice(0, 10);
  return [label(first.date), ...(span >= 14 * DAY_MS ? [label(middle)] : []), label(last.date)];
}
