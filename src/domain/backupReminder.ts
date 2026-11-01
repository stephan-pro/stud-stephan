// When the last backup was made and when the settings gently remind of the next one (P14, F15).
// The date is kept on the device (the backup file is, too), so it names this device's last backup.

import type { IsoDate } from "./types";

/** After this many days without a backup the settings suggest making one. */
export const REMINDER_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from `from` to `to`; both "YYYY-MM-DD" (a later `from` gives a negative number). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** never = no backup known; recent = within 30 days; due = 30 days or more ago. */
export type BackupNotice =
  | { readonly kind: "never" }
  | { readonly kind: "recent" | "due"; readonly date: IsoDate; readonly days: number };

export function backupNotice(last: IsoDate | undefined, today: IsoDate): BackupNotice {
  if (last === undefined) return { kind: "never" };
  // A date in the future (wrong clock then) counts as today.
  const days = Math.max(0, daysBetween(last, today));
  return { kind: days >= REMINDER_DAYS ? "due" : "recent", date: last, days };
}

/** The day kept on the device, or nothing if there is none or it is no day. */
export function parseBackupDay(stored: string | null | undefined): IsoDate | undefined {
  if (typeof stored !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(stored)) return undefined;
  const date = new Date(`${stored}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === stored
    ? stored
    : undefined;
}
