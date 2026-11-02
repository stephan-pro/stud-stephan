// Reads a backup file and checks all of it before anything is changed (F15): the ZIP's checksums,
// the manifest, every object by the rules of `rules.ts` (the ones the database applies), the
// types and sizes of the files, and that objects and files belong together. Only a backup that
// passes everything is offered for replacing.

import {
  checkObject,
  checkPricePoint,
  FILE_TYPES,
  MAX_FILE_BYTES,
  type ObjectKind,
  STORAGE_LIMIT_BYTES,
} from "../backend/rules";
import { SCHEMA_VERSION } from "../domain/types";
import {
  BACKUP_APP,
  BACKUP_FORMAT,
  type BackupCollection,
  BackupError,
  type BackupFile,
  type BackupManifest,
  type BackupSummary,
  DATA_ENTRY,
  isEntryName,
  remapFiles,
  sniffImageType,
  summarize,
} from "./format";
import { type ByteSource, readZipDirectory, readZipEntry, type ZipEntry, ZipError } from "./zip";

/** A stand-in owner for the checks: paths must lie in an owner's folder, whoever it is. */
const CHECK_OWNER = "00000000-0000-0000-0000-000000000000";

/** `daten.json` of a real collection is a few MB; far more than this is not a backup of ours. */
const MAX_DATA_BYTES = 64 * 1024 * 1024;
const MAX_FILES = 20_000;
const MAX_PRICES = 500_000;

export interface ParsedBackup {
  readonly manifest: BackupManifest;
  readonly summary: BackupSummary;
  /** The ZIP's entries by name, to read the files from when replacing. */
  readonly entries: ReadonlyMap<string, ZipEntry>;
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isWhole(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

/** Optional text, whole number … : missing is fine, a wrong type is not. */
function optional(value: unknown, test: (value: unknown) => boolean): boolean {
  return value === undefined || test(value);
}

const LISTS = ["minifigs", "sets", "specialParts", "dioramas", "wishlist", "prices"] as const;

const CONDITIONS = ["new", "used"];
const POSITIONS = ["head", "torso", "arms", "hands", "legs", "headgear", "accessory", "other"];
const SET_STATUS = ["complete", "figuresRemoved", "disassembled"];
const SPECIAL_KINDS = ["gwp", "coin", "other"];
const PRIORITIES = ["high", "medium", "low"];

function isManufacturer(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (value.kind === "lego" || value.kind === "bluebrixx") return true;
  return (value.kind === "other" || value.kind === "custom") && typeof value.name === "string";
}

function isTextList(value: unknown): boolean {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isManualValue(value: unknown): boolean {
  return isObject(value) && isWhole(value.cents) && typeof value.enteredOn === "string";
}

/** The first thing that is wrong with the fields the app relies on, or nothing. */
function wrongField(kind: ObjectKind, object: Json): string | undefined {
  const typeOf = (field: string, test: (value: unknown) => boolean) =>
    test(object[field]) ? undefined : field;
  const missing = (field: string, test: (value: unknown) => boolean) =>
    optional(object[field], test) ? undefined : field;
  const checks: (string | undefined)[] = [
    typeOf("name", isText),
    typeOf("links", isTextList),
    typeOf("createdAt", isText),
  ];
  if (kind === "diorama") {
    checks.push(
      missing("pieceCount", isWhole),
      missing("manualValue", isManualValue),
      missing("note", (v) => typeof v === "string"),
    );
  } else {
    checks.push(typeOf("manufacturer", isManufacturer));
    if (kind === "wishItem") {
      checks.push(
        typeOf("priority", (v) => PRIORITIES.includes(v as string)),
        typeOf("desiredCondition", (v) => CONDITIONS.includes(v as string)),
        missing("targetPrice", isWhole),
      );
    } else {
      checks.push(
        typeOf("condition", (v) => CONDITIONS.includes(v as string)),
        missing("purchasePrice", isWhole),
        missing("manualValue", isManualValue),
        missing("theme", (v) => typeof v === "string"),
        missing("note", (v) => typeof v === "string"),
      );
    }
    if (kind === "minifig") {
      checks.push(
        typeOf(
          "mods",
          (v) =>
            Array.isArray(v) &&
            v.every(
              (mod) =>
                isObject(mod) &&
                isText(mod.id) &&
                POSITIONS.includes(mod.position as string) &&
                typeof mod.description === "string" &&
                optional(mod.price, isWhole),
            ),
        ),
        missing("fromSet", isObject),
        missing("dioramaId", isText),
        missing("standsInSetId", isText),
      );
    }
    if (kind === "legoSet") {
      checks.push(
        typeOf("status", (v) => SET_STATUS.includes(v as string)),
        typeOf("containedFigures", Array.isArray),
      );
    }
    if (kind === "specialPart") {
      checks.push(typeOf("kind", (v) => SPECIAL_KINDS.includes(v as string)));
    }
  }
  return checks.find((field) => field !== undefined);
}

function zipProblem(error: unknown): never {
  if (error instanceof ZipError) {
    throw new BackupError(
      error.problem === "notZip"
        ? "notZip"
        : error.problem === "unsupported"
          ? "unsupportedZip"
          : error.problem === "tooLarge"
            ? "tooBig"
            : "damaged",
    );
  }
  throw error;
}

function readManifest(raw: unknown, schemaVersion: number): BackupManifest {
  if (!isObject(raw) || raw.app !== BACKUP_APP || !isWhole(raw.format)) {
    throw new BackupError("notBackup");
  }
  if (raw.format > BACKUP_FORMAT) throw new BackupError("tooNew");
  if (raw.format < 1) throw new BackupError("notBackup");
  if (!isWhole(raw.schemaVersion) || raw.schemaVersion < 1) throw new BackupError("notBackup");
  if (raw.schemaVersion > schemaVersion) throw new BackupError("tooNew");
  // Once the data shape changes, an older backup is converted here instead of being refused.
  if (raw.schemaVersion < schemaVersion) throw new BackupError("tooOld");
  if (typeof raw.exportedAt !== "string" || Number.isNaN(Date.parse(raw.exportedAt))) {
    throw new BackupError("invalidData", { reason: "exportedAt" });
  }
  const { collection, files } = raw;
  if (!isObject(collection) || !Array.isArray(files)) {
    throw new BackupError("invalidData", { reason: "collection" });
  }
  for (const list of LISTS) {
    if (!Array.isArray(collection[list])) {
      throw new BackupError("invalidData", { reason: list });
    }
  }
  return raw as unknown as BackupManifest;
}

function readFileList(files: readonly unknown[]): BackupFile[] {
  if (files.length > MAX_FILES) throw new BackupError("tooBig");
  const seen = new Set<string>();
  let total = 0;
  return files.map((file) => {
    if (
      !isObject(file) ||
      !isText(file.entry) ||
      (file.bucket !== "photos" && file.bucket !== "studio-files")
    ) {
      throw new BackupError("invalidData", { reason: "files" });
    }
    const entry = file.entry;
    if (!isEntryName(entry, file.bucket) || seen.has(entry)) {
      throw new BackupError("badFile", { entry });
    }
    seen.add(entry);
    if (
      typeof file.contentType !== "string" ||
      !FILE_TYPES[file.bucket].includes(file.contentType) ||
      !isWhole(file.bytes) ||
      file.bytes <= 0 ||
      file.bytes > MAX_FILE_BYTES[file.bucket]
    ) {
      throw new BackupError("badFile", { entry });
    }
    total += file.bytes;
    if (total > STORAGE_LIMIT_BYTES) throw new BackupError("tooBig");
    return file as unknown as BackupFile;
  });
}

const KINDS: readonly [(typeof LISTS)[number], ObjectKind][] = [
  ["minifigs", "minifig"],
  ["sets", "legoSet"],
  ["specialParts", "specialPart"],
  ["dioramas", "diorama"],
  ["wishlist", "wishItem"],
];

/** Every list holds objects, and the lists of files are lists, so the files can be re-pointed. */
function guardShape(collection: BackupCollection): void {
  for (const [list, kind] of KINDS) {
    for (const object of collection[list] as unknown[]) {
      if (!isObject(object)) throw new BackupError("invalidData", { kind, reason: "object" });
      const id = typeof object.id === "string" ? object.id : undefined;
      const problem = (reason: string) =>
        new BackupError("invalidData", { kind, ...(id ? { id } : {}), reason });
      if (kind === "wishItem") continue;
      if (!isTextList(object.photos)) throw problem("photos");
      if (kind === "diorama") {
        const files = object.studioFiles;
        if (
          !Array.isArray(files) ||
          !files.every((file) => isObject(file) && typeof file.path === "string")
        ) {
          throw problem("studioFiles");
        }
      }
    }
  }
}

/** Checks the objects by the database's rules; every file entry may be listed once. */
function checkCollection(
  collection: BackupCollection,
  files: readonly BackupFile[],
  schemaVersion: number,
): void {
  guardShape(collection);
  const bucketOf = new Map(files.map((file) => [file.entry, file.bucket]));
  const used = new Set<string>();
  const standIn = remapFiles(collection, (bucket, entry) => {
    if (bucketOf.get(entry) !== bucket || used.has(entry)) {
      throw new BackupError("badFile", { entry });
    }
    used.add(entry);
    return `${CHECK_OWNER}/${entry}`;
  });

  const ids = new Map<ObjectKind, Set<string>>();
  for (const [list, kind] of KINDS) {
    const seen = new Set<string>();
    ids.set(kind, seen);
    for (const object of standIn[list] as unknown[]) {
      const id = isObject(object) && typeof object.id === "string" ? object.id : undefined;
      const checked = checkObject(CHECK_OWNER, kind, object, schemaVersion);
      if (typeof checked === "string") {
        throw new BackupError("invalidData", { kind, ...(id ? { id } : {}), reason: checked });
      }
      const field = wrongField(kind, object as Json);
      if (field !== undefined)
        throw new BackupError("invalidData", { kind, id: checked.id, reason: field });
      if (seen.has(checked.id)) {
        throw new BackupError("invalidData", { kind, id: checked.id, reason: "duplicate" });
      }
      seen.add(checked.id);
    }
  }

  // Links between objects must lead somewhere (deleting in the app keeps them in order).
  for (const figure of collection.minifigs) {
    if (figure.dioramaId !== undefined && !ids.get("diorama")?.has(figure.dioramaId)) {
      throw new BackupError("invalidData", { kind: "minifig", id: figure.id, reason: "dioramaId" });
    }
    if (figure.standsInSetId !== undefined && !ids.get("legoSet")?.has(figure.standsInSetId)) {
      throw new BackupError("invalidData", {
        kind: "minifig",
        id: figure.id,
        reason: "standsInSetId",
      });
    }
    if (figure.fromSet?.setId !== undefined && !ids.get("legoSet")?.has(figure.fromSet.setId)) {
      throw new BackupError("invalidData", { kind: "minifig", id: figure.id, reason: "fromSet" });
    }
  }
  const studioIds = new Set<string>();
  for (const diorama of collection.dioramas) {
    for (const file of diorama.studioFiles) {
      if (studioIds.has(file.id)) {
        throw new BackupError("invalidData", {
          kind: "diorama",
          id: diorama.id,
          reason: "studioFiles",
        });
      }
      studioIds.add(file.id);
    }
  }

  if (collection.prices.length > MAX_PRICES) throw new BackupError("tooBig");
  const keys = new Set<string>();
  for (const point of collection.prices) {
    const checked = checkPricePoint(point);
    if (typeof checked === "string") {
      throw new BackupError("invalidData", { kind: "price", reason: checked });
    }
    const key = `${checked.itemType}|${checked.bricklinkId}|${checked.date}`;
    if (keys.has(key))
      throw new BackupError("invalidData", { kind: "price", id: key, reason: "duplicate" });
    keys.add(key);
  }
}

/**
 * Reads and checks the whole backup: every file's checksum and type are verified here, one file
 * at a time. Throws a `BackupError` for the first problem found. `schemaVersion` is the data
 * version this app works with (a parameter for the tests of the older and newer cases).
 */
export async function readBackup(
  source: ByteSource,
  schemaVersion = SCHEMA_VERSION,
): Promise<ParsedBackup> {
  let directory: ZipEntry[];
  try {
    directory = await readZipDirectory(source);
  } catch (error) {
    return zipProblem(error);
  }
  const entries = new Map(directory.map((entry) => [entry.name, entry]));
  const dataEntry = entries.get(DATA_ENTRY);
  if (dataEntry === undefined) throw new BackupError("notBackup");
  if (dataEntry.size > MAX_DATA_BYTES) throw new BackupError("tooBig");

  let raw: unknown;
  try {
    const bytes = await readZipEntry(source, dataEntry);
    raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof ZipError) return zipProblem(error);
    throw new BackupError("notBackup");
  }
  const manifest = readManifest(raw, schemaVersion);
  const files = readFileList(manifest.files);
  checkCollection(manifest.collection, files, schemaVersion);

  for (const file of files) {
    const entry = entries.get(file.entry);
    if (entry === undefined) throw new BackupError("missingFile", { entry: file.entry });
    if (entry.size !== file.bytes) throw new BackupError("badFile", { entry: file.entry });
    let bytes: Uint8Array;
    try {
      bytes = await readZipEntry(source, entry);
    } catch (error) {
      if (error instanceof ZipError) throw new BackupError("damaged", { entry: file.entry });
      throw error;
    }
    if (file.bucket === "photos" && sniffImageType(bytes) !== file.contentType) {
      throw new BackupError("badFile", { entry: file.entry });
    }
  }
  return { manifest: { ...manifest, files }, summary: summarize({ ...manifest, files }), entries };
}
