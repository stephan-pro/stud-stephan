// The weekly price run as the settings show it (P11, S12): when it runs next and in which state
// the latest run is. The run itself is done on the server (`supabase/functions/`, migration
// `…_price_run.sql`).

import type { PriceRunStatus } from "../backend/priceRun";
import type { Timestamp } from "./types";

/** The cron job's time (migration `…_price_run.sql`): Monday 02:00 UTC = 03:00 German winter time. */
export const WEEKLY_RUN_UTC = { weekday: 1, hour: 2 } as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The next start of the weekly run after `now`. */
export function nextPriceRun(now: Timestamp): Timestamp {
  const date = new Date(now);
  const daysToRunDay = (WEEKLY_RUN_UTC.weekday - date.getUTCDay() + 7) % 7;
  let next = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + daysToRunDay,
    WEEKLY_RUN_UTC.hour,
  );
  if (next <= date.getTime()) next += 7 * DAY_MS;
  return new Date(next).toISOString();
}

/** none = no run yet; running = items left; paused = BrickLink's day used up; done = finished. */
export type PriceRunState = "none" | "running" | "paused" | "done";

export function priceRunState(status: PriceRunStatus | null, now: Timestamp): PriceRunState {
  if (status === null) return "none";
  if (status.finishedAt !== undefined) return "done";
  if (status.pausedUntil !== undefined && Date.parse(status.pausedUntil) > Date.parse(now)) {
    return "paused";
  }
  return "running";
}

/** Items of the run already asked for (priced, without sale or failed). */
export function priceRunDone(status: PriceRunStatus): number {
  return Math.max(status.total - status.open, 0);
}
