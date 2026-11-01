// The export (F15): all data and all files into one ZIP, written piece by piece. The files are
// read from storage one at a time, so the memory holds one file (at most 25 MB) plus what the
// sink has not yet taken, however large the backup becomes.

import { type Remote, RemoteError } from "../backend/remote";
import { MAX_FILE_BYTES } from "../backend/rules";
import type { Collection } from "../domain/types";
import { SCHEMA_VERSION } from "../domain/types";
import {
  BACKUP_APP,
  BACKUP_FORMAT,
  BackupError,
  type BackupFile,
  type BackupManifest,
  type BackupSummary,
  DATA_ENTRY,
  EXTENSIONS,
  listedFiles,
  remapFiles,
  sniffImageType,
  summarize,
} from "./format";
import { ZipWriter } from "./zip";

export interface ExportProgress {
  /** Files written so far, of those the objects list. */
  readonly done: number;
  readonly total: number;
}

export interface ExportDeps {
  readonly remote: Pick<Remote, "load" | "getFile">;
  /** Takes the pieces of the ZIP in order. */
  readonly write: (chunk: Uint8Array) => void | Promise<void>;
  readonly now: Date;
  readonly onProgress?: (progress: ExportProgress) => void;
  /** Pause between tries; for tests. */
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface ExportResult {
  readonly summary: BackupSummary;
  /** Files the objects list but storage did not have (or that were no usable picture); the
   * backup leaves them out of their objects. */
  readonly skipped: number;
  /** Bytes of the ZIP. */
  readonly bytes: number;
}

const TRIES = 3;

/** Reads a file; a failure that may pass (no connection …) is tried again. */
async function readFile(
  remote: Pick<Remote, "getFile">,
  bucket: BackupFile["bucket"],
  path: string,
  sleep: (ms: number) => Promise<void>,
): Promise<Uint8Array | "missing"> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await remote.getFile(bucket, path);
    } catch (error) {
      if (error instanceof RemoteError && error.permanent && error.reason === "not_found") {
        return "missing";
      }
      if (!(error instanceof RemoteError) || error.permanent || attempt >= TRIES) {
        throw new BackupError("fileTrouble", { entry: path });
      }
      await sleep(1000 * 2 ** (attempt - 1));
    }
  }
}

/** What the export would write, roughly: the files plus the data and a little for the ZIP itself. */
export function estimateBackupBytes(collection: Collection, storageBytes: number): number {
  const { schemaVersion: _, ...data } = collection;
  const fileCount = listedFiles(data).length;
  return (
    storageBytes + new TextEncoder().encode(JSON.stringify(data)).length + fileCount * 200 + 1000
  );
}

/**
 * Writes the backup of the signed-in person. Fails with a `BackupError` ("fileTrouble") when a
 * file cannot be read for a reason that is not "it is gone"; nothing is half-written to the
 * person then, because the sink's result is only offered after this returns.
 */
export async function exportBackup(deps: ExportDeps): Promise<ExportResult> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  const { schemaVersion: _, ...data } = await deps.remote.load();
  const wanted = listedFiles(data);
  let written = 0;
  const writer = new ZipWriter((chunk) => {
    written += chunk.length;
    return deps.write(chunk);
  }, deps.now);

  const files: BackupFile[] = [];
  const entries = new Map<string, string>();
  let skipped = 0;
  const counts = { photos: 0, "studio-files": 0 };
  for (const [index, { bucket, path }] of wanted.entries()) {
    deps.onProgress?.({ done: index, total: wanted.length });
    const bytes = await readFile(deps.remote, bucket, path, sleep);
    const contentType =
      bytes === "missing"
        ? undefined
        : bucket === "photos"
          ? sniffImageType(bytes)
          : "application/octet-stream";
    if (
      bytes === "missing" ||
      contentType === undefined ||
      bytes.length === 0 ||
      bytes.length > MAX_FILE_BYTES[bucket]
    ) {
      skipped++;
      continue;
    }
    counts[bucket]++;
    const entry = `${bucket === "photos" ? "fotos" : "studio"}/${String(counts[bucket]).padStart(6, "0")}.${EXTENSIONS[contentType]}`;
    await writer.add(entry, bytes);
    files.push({ entry, bucket, contentType, bytes: bytes.length });
    entries.set(`${bucket}|${path}`, entry);
  }
  deps.onProgress?.({ done: wanted.length, total: wanted.length });

  const manifest: BackupManifest = {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: deps.now.toISOString(),
    collection: remapFiles(data, (bucket, path) => entries.get(`${bucket}|${path}`)),
    files,
  };
  await writer.add(DATA_ENTRY, new TextEncoder().encode(JSON.stringify(manifest)));
  await writer.finish();
  return { summary: summarize(manifest), skipped, bytes: written };
}
