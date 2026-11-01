// Days as the interface shows them. Days are "YYYY-MM-DD" everywhere else (types.ts).

import type { IsoDate, Timestamp } from "./types";

const MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
] as const;

function parts(day: IsoDate): { year: string; month: number; date: string } | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!match) return undefined;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return undefined;
  return { year: match[1] as string, month, date: match[3] as string };
}

/** "2026-10-27" → "27.10.2026"; text that is no day stays as it is. */
export function formatDate(day: IsoDate): string {
  const found = parts(day);
  return found ? `${found.date}.${String(found.month).padStart(2, "0")}.${found.year}` : day;
}

// Stephan lives in Germany; the server counts in UTC.
const GERMAN_TIME = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "2026-11-02T02:00:00Z" → "02.11.2026, 03:00" (German time); text that is no time stays. */
export function formatDateTime(time: Timestamp): string {
  const date = new Date(time);
  return Number.isNaN(date.getTime()) ? time : GERMAN_TIME.format(date);
}

/** "2025-03-14" → "März 2025" ("Erworben"); text that is no day stays as it is. */
export function formatMonth(day: IsoDate): string {
  const found = parts(day);
  return found ? `${MONTHS[found.month - 1]} ${found.year}` : day;
}
