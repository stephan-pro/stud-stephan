// What a backup file (F15) is: a ZIP with `daten.json` (the data and a list of the files) and
// the photos and Studio files themselves. Names in the ZIP are made by the export and never used
// as storage paths: the import gives every file a new path.

import type { Bucket, ObjectKind } from "../backend/rules";
import type { Collection } from "../domain/types";

export const BACKUP_APP = "stud-stephan";
/** The layout of the ZIP (names, `daten.json`); the data's own version is `schemaVersion`. */
export const BACKUP_FORMAT = 1;
export const DATA_ENTRY = "daten.json";

/** The data of a backup: a collection without its version (which the manifest carries). */
export type BackupCollection = Omit<Collection, "schemaVersion">;

/** One file in the ZIP, as `daten.json` lists it. */
export interface BackupFile {
  /** Name in the ZIP: `fotos/000001.webp` or `studio/000001.io`. */
  readonly entry: string;
  readonly bucket: Bucket;
  readonly contentType: string;
  readonly bytes: number;
}

export interface BackupManifest {
  readonly app: typeof BACKUP_APP;
  readonly format: number;
  readonly schemaVersion: number;
  /** ISO 8601. */
  readonly exportedAt: string;
  /** Objects whose `photos` and Studio files' `path` name entries of the ZIP, not storage paths. */
  readonly collection: BackupCollection;
  readonly files: readonly BackupFile[];
}

/** What a backup holds, for the questions before replacing and the message after exporting. */
export interface BackupSummary {
  readonly minifigs: number;
  readonly sets: number;
  readonly specialParts: number;
  readonly dioramas: number;
  readonly wishlist: number;
  readonly prices: number;
  readonly photos: number;
  readonly studioFiles: number;
  /** Bytes of the photos and Studio files together. */
  readonly bytes: number;
  readonly exportedAt: string;
}

export type BackupProblem =
  /** Not a ZIP, or cut off. */
  | "notZip"
  | "damaged"
  /** A ZIP of a kind this code does not read (packed entries, ZIP64 …). */
  | "unsupportedZip"
  | "notBackup"
  | "tooNew"
  | "tooOld"
  | "invalidData"
  | "missingFile"
  | "badFile"
  | "tooBig"
  /** Export: a file could not be read from storage. */
  | "fileTrouble"
  /** Export: the finished file failed the check an import makes (`params.reason` says which). */
  | "selfCheck";

export interface BackupParams {
  readonly kind?: ObjectKind | "price";
  readonly id?: string;
  readonly entry?: string;
  /** The rule that was broken, e.g. a refusal reason of `rules.ts` or "name". */
  readonly reason?: string;
}

/** A backup cannot be made or is refused; `code` and `params` tell the page what to say. */
export class BackupError extends Error {
  constructor(
    readonly code: BackupProblem,
    readonly params: BackupParams = {},
  ) {
    super(`${code} ${JSON.stringify(params)}`);
    this.name = "BackupError";
  }
}

/** The extension an entry gets for a content type. */
export const EXTENSIONS: Readonly<Record<string, string>> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/octet-stream": "io",
};

const ENTRY = /^(fotos\/\d{1,6}\.(webp|jpg|png)|studio\/\d{1,6}\.io)$/;

/** Whether the name has the shape the export gives entries (and fits the bucket). */
export function isEntryName(entry: string, bucket: Bucket): boolean {
  return ENTRY.test(entry) && entry.startsWith(bucket === "photos" ? "fotos/" : "studio/");
}

/** The picture type the first bytes tell, or nothing if it is none of WebP, JPEG, PNG. */
export function sniffImageType(bytes: Uint8Array): string | undefined {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((value, index) => bytes[index] === value)) return "image/png";
  const text = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 12 && text(0, 4) === "RIFF" && text(8, 12) === "WEBP") return "image/webp";
  return undefined;
}

/**
 * The collection with every file path replaced by `map(bucket, path)`. A file the map answers
 * nothing for is dropped from its object.
 */
export function remapFiles(
  collection: BackupCollection,
  map: (bucket: Bucket, path: string) => string | undefined,
): BackupCollection {
  const photos = (paths: readonly string[]) =>
    paths.flatMap((path) => {
      const mapped = map("photos", path);
      return mapped === undefined ? [] : [mapped];
    });
  return {
    ...collection,
    minifigs: collection.minifigs.map((object) => ({ ...object, photos: photos(object.photos) })),
    sets: collection.sets.map((object) => ({ ...object, photos: photos(object.photos) })),
    specialParts: collection.specialParts.map((object) => ({
      ...object,
      photos: photos(object.photos),
    })),
    dioramas: collection.dioramas.map((object) => ({
      ...object,
      photos: photos(object.photos),
      studioFiles: object.studioFiles.flatMap((file) => {
        const path = map("studio-files", file.path);
        return path === undefined ? [] : [{ ...file, path }];
      }),
    })),
  };
}

/** Every file path an object of the collection lists, photos first, in the objects' order. */
export function listedFiles(
  collection: BackupCollection,
): { readonly bucket: Bucket; readonly path: string }[] {
  const files: { bucket: Bucket; path: string }[] = [];
  const add = (bucket: Bucket, path: string) => {
    if (!files.some((file) => file.bucket === bucket && file.path === path)) {
      files.push({ bucket, path });
    }
  };
  for (const list of [collection.minifigs, collection.sets, collection.specialParts]) {
    for (const object of list) for (const path of object.photos) add("photos", path);
  }
  for (const diorama of collection.dioramas) {
    for (const path of diorama.photos) add("photos", path);
    for (const file of diorama.studioFiles) add("studio-files", file.path);
  }
  return files;
}

export function summarize(manifest: BackupManifest): BackupSummary {
  const { collection, files } = manifest;
  return {
    minifigs: collection.minifigs.length,
    sets: collection.sets.length,
    specialParts: collection.specialParts.length,
    dioramas: collection.dioramas.length,
    wishlist: collection.wishlist.length,
    prices: collection.prices.length,
    photos: files.filter((file) => file.bucket === "photos").length,
    studioFiles: files.filter((file) => file.bucket === "studio-files").length,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    exportedAt: manifest.exportedAt,
  };
}

/** The name of the file the person downloads, e.g. `stud-stephan-sicherung-2026-11-02.zip`. */
export function backupFileName(day: string): string {
  return `stud-stephan-sicherung-${day}.zip`;
}
