// The rules of the stored collection: which objects there are, what a saved object may look like,
// where files go and how large they may be. The fake (`fakeStore.ts`) checks them here; the
// database (`supabase/migrations/…_collection.sql`) follows the same rules in SQL. One series of
// contract tests (`remote.contract.ts`) runs against both.

import type {
  Diorama,
  LegoSet,
  Minifig,
  PricePoint,
  SpecialPart,
  StudioFile,
  WishItem,
} from "../domain/types";

/** What the server stores, one table each. A wish item is a `wishItem` (its `type` is the kind
 * of thing wished for). */
export type ObjectKind = "minifig" | "legoSet" | "specialPart" | "diorama" | "wishItem";

export interface ObjectOfKind {
  minifig: Minifig;
  legoSet: LegoSet;
  specialPart: SpecialPart;
  diorama: Diorama;
  wishItem: WishItem;
}

export type StoredObject = ObjectOfKind[ObjectKind];

export const OBJECT_KINDS: readonly ObjectKind[] = [
  "minifig",
  "legoSet",
  "specialPart",
  "diorama",
  "wishItem",
];

/** The two private storage buckets. */
export type Bucket = "photos" | "studio-files";

export const BUCKETS: readonly Bucket[] = ["photos", "studio-files"];

/** A file in storage, e.g. one an object no longer lists. */
export interface StoredFile {
  readonly bucket: Bucket;
  readonly path: string;
}

export const LIMITS = {
  idLength: 100,
  /** The object as JSON, without photos and Studio files. */
  objectBytes: 32 * 1024,
  pricePointBytes: 4 * 1024,
  photosPerObject: 20,
  studioFilesPerDiorama: 20,
  fileNameLength: 200,
  pathLength: 300,
} as const;

/** Largest file per bucket (P4c makes photos ≤ 400 KB; 2 MB leaves room). */
export const MAX_FILE_BYTES: Readonly<Record<Bucket, number>> = {
  photos: 2 * 1024 * 1024,
  "studio-files": 25 * 1024 * 1024,
};

/** The content types a bucket takes (Studio files are sent as plain bytes). */
export const FILE_TYPES: Readonly<Record<Bucket, readonly string[]>> = {
  photos: ["image/webp", "image/jpeg", "image/png"],
  "studio-files": ["application/octet-stream"],
};

/** Why the server refuses a call for good (the message of the database's exception). */
export type RefusalReason =
  | "not_signed_in"
  | "invalid_object"
  | "invalid_path"
  | "too_many_photos"
  | "too_many_files"
  | "too_large"
  | "file_type"
  | "file_too_large"
  | "not_found";

export const REFUSAL_REASONS: readonly RefusalReason[] = [
  "not_signed_in",
  "invalid_object",
  "invalid_path",
  "too_many_photos",
  "too_many_files",
  "too_large",
  "file_type",
  "file_too_large",
  "not_found",
];

export function isRefusalReason(value: unknown): value is RefusalReason {
  return REFUSAL_REASONS.includes(value as RefusalReason);
}

const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

/** A file name inside the owner's folder: letters, digits, `._-`, folders with `/`, no `..`. */
export function isValidFileName(name: string): boolean {
  return name.length <= LIMITS.fileNameLength && FILE_NAME.test(name);
}

/** Whether the path lies in the owner's folder (`<owner>/…`). */
export function isOwnPath(owner: string, path: string): boolean {
  return (
    path.startsWith(`${owner}/`) &&
    path.length > owner.length + 1 &&
    path.length <= LIMITS.pathLength
  );
}

/** Size of a value as JSON in UTF-8 bytes. */
export function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= max;
}

function hasDuplicates(values: readonly unknown[]): boolean {
  return new Set(values).size !== values.length;
}

function isStudioFile(value: unknown): value is StudioFile {
  return (
    isObject(value) &&
    isText(value.id, LIMITS.idLength) &&
    isText(value.fileName, LIMITS.fileNameLength) &&
    isText(value.uploadedAt, 40) &&
    typeof value.path === "string" &&
    typeof value.sizeBytes === "number" &&
    Number.isInteger(value.sizeBytes) &&
    value.sizeBytes >= 0 &&
    value.sizeBytes <= MAX_FILE_BYTES["studio-files"]
  );
}

/** An object as the server keeps it: the data, and apart from it the photos and Studio files. */
export interface SplitObject {
  readonly id: string;
  readonly data: Json;
  readonly photos: readonly string[];
  readonly studioFiles: readonly StudioFile[];
}

/**
 * Checks an object the owner saves, in the order the database does, and splits it; a string is
 * the reason for refusing it.
 */
export function checkObject(
  owner: string,
  kind: string,
  object: unknown,
  schemaVersion: unknown,
): SplitObject | RefusalReason {
  if (
    !OBJECT_KINDS.includes(kind as ObjectKind) ||
    !isObject(object) ||
    typeof object.id !== "string" ||
    typeof schemaVersion !== "number" ||
    !Number.isInteger(schemaVersion) ||
    schemaVersion < 1
  ) {
    return "invalid_object";
  }
  const type = typeof object.type === "string" ? object.type : "";
  if (
    !isText(object.id, LIMITS.idLength) ||
    (kind === "wishItem" ? type !== "minifig" && type !== "legoSet" : type !== kind)
  ) {
    return "invalid_object";
  }
  const { photos: rawPhotos, studioFiles: rawFiles, ...rest } = object;
  let data: Json = object;
  let photos: string[] = [];
  let studioFiles: StudioFile[] = [];

  if (kind !== "wishItem") {
    const { photos: _, ...withoutPhotos } = object;
    data = withoutPhotos;
    const list = rawPhotos ?? [];
    if (!Array.isArray(list)) return "invalid_object";
    if (list.length > LIMITS.photosPerObject) return "too_many_photos";
    if (list.some((path) => typeof path !== "string") || hasDuplicates(list)) {
      return "invalid_object";
    }
    if (list.some((path) => !isOwnPath(owner, path as string))) return "invalid_path";
    photos = list as string[];
  }

  if (kind === "diorama") {
    data = rest;
    const list = rawFiles ?? [];
    if (!Array.isArray(list)) return "invalid_object";
    if (list.length > LIMITS.studioFilesPerDiorama) return "too_many_files";
    if (
      !list.every(isStudioFile) ||
      hasDuplicates(list.map((file) => file.id)) ||
      hasDuplicates(list.map((file) => file.path))
    ) {
      return "invalid_object";
    }
    if (list.some((file) => !isOwnPath(owner, file.path))) return "invalid_path";
    studioFiles = list;
  }

  if (jsonBytes(data) > LIMITS.objectBytes) return "too_large";
  return { id: object.id, data, photos, studioFiles };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function isDay(value: unknown): value is string {
  if (typeof value !== "string" || !DAY.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Checks a price point the owner saves; a string is the reason for refusing it. */
export function checkPricePoint(point: unknown): PricePoint | RefusalReason {
  if (
    !isObject(point) ||
    !["minifig", "legoSet", "specialPart"].includes(point.itemType as string) ||
    !isText(point.bricklinkId, LIMITS.idLength) ||
    !isDay(point.date) ||
    point.source !== "bricklink" ||
    !isObject(point.cents)
  ) {
    return "invalid_object";
  }
  if (jsonBytes(point) > LIMITS.pricePointBytes) return "too_large";
  return point as unknown as PricePoint;
}
