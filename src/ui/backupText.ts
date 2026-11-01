// Words for what a backup holds and why one is refused; the texts themselves are in `texts.ts`.

import { BackupError, type BackupSummary } from "../backup/format";
import { TEXTS } from "./texts";

type Counted = keyof typeof TEXTS.backup.counts;

/** "3 Figuren" / "1 Set": the count with the matching form of the noun. */
export function counted(key: Counted, count: number): string {
  const [one, many] = TEXTS.backup.counts[key];
  return `${count.toLocaleString("de-DE")} ${count === 1 ? one : many}`;
}

const SUMMARY_KEYS: readonly Counted[] = [
  "minifigs",
  "sets",
  "specialParts",
  "dioramas",
  "wishlist",
  "prices",
  "photos",
  "studioFiles",
];

/** "286 Figuren, 26 Sets, …, 340 Fotos"; what is zero is left out ("leer" if all are). */
export function summaryText(summary: BackupSummary): string {
  const parts = SUMMARY_KEYS.filter((key) => summary[key] > 0).map((key) =>
    counted(key, summary[key]),
  );
  return parts.length > 0 ? parts.join(", ") : "keine Einträge";
}

/**
 * What a refused or failed backup says to the person. With `unchanged` it adds that nothing was
 * changed (for everything that happens before the collection is touched).
 */
export function problemText(error: unknown, unchanged = false): string {
  const T = TEXTS.backup.problems;
  if (!(error instanceof BackupError)) return T.unknown;
  const { kind, id, entry, reason } = error.params;
  const what = [kind ? TEXTS.backup.kinds[kind] : undefined, id, reason]
    .filter((part) => part !== undefined)
    .join(" · ");
  const text = {
    notZip: T.notZip,
    damaged: T.damaged,
    unsupportedZip: T.unsupportedZip,
    notBackup: T.notBackup,
    tooNew: T.tooNew,
    tooOld: T.tooOld,
    invalidData: T.invalidData(what),
    missingFile: T.missingFile(entry ?? "?"),
    badFile: T.badFile(entry),
    tooBig: T.tooBig,
    fileTrouble: T.fileTrouble,
    selfCheck: T.selfCheck(reason ?? "?"),
  }[error.code];
  return unchanged ? `${text} ${T.nothingChanged}` : text;
}
