// A backup file as the person gets it: made by the export, then read back and checked like an
// import would, so a file that could not be restored is never handed out. And the import's two
// parts in order: the automatic backup of the current state first, then replacing.

import type { Remote } from "../backend/remote";
import { BlobSink } from "./blobSink";
import {
  type ExportDeps,
  type ExportProgress,
  type ExportResult,
  exportBackup,
} from "./exportBackup";
import { BackupError, backupFileName } from "./format";
import { type ParsedBackup, readBackup } from "./readBackup";
import { type RestoreProgress, restoreBackup } from "./restoreBackup";
import { type ByteSource, blobSource } from "./zip";

export interface MadeBackup {
  readonly blob: Blob;
  readonly result: ExportResult;
}

/** Exports and checks the file; a `BackupError` ("selfCheck" for a file that fails the check). */
export async function makeBackup(deps: Omit<ExportDeps, "write">): Promise<MadeBackup> {
  const sink = new BlobSink();
  const result = await exportBackup({ ...deps, write: sink.write });
  const blob = sink.toBlob();
  try {
    await readBackup(blobSource(blob));
  } catch (error) {
    if (error instanceof BackupError) {
      throw new BackupError("selfCheck", { ...error.params, reason: error.code });
    }
    throw error;
  }
  return { blob, result };
}

export type ImportProgress =
  | ({ readonly step: "backup" } & ExportProgress)
  | ({ readonly step: "replace" } & RestoreProgress);

export interface ImportDeps {
  readonly remote: Remote;
  readonly source: ByteSource;
  readonly backup: ParsedBackup;
  readonly now: Date;
  /** Hands the automatic backup of the current state to the person (a download). */
  readonly deliver: (blob: Blob, fileName: string) => void;
  readonly onProgress?: (progress: ImportProgress) => void;
  readonly sleep?: (ms: number) => Promise<void>;
}

/**
 * Backs up the current state and offers it for download, and only then replaces it. If the backup
 * fails, nothing is changed (the `BackupError` is thrown); replacing throws a `RestoreError`.
 */
export async function importBackup(deps: ImportDeps): Promise<void> {
  const { blob } = await makeBackup({
    remote: deps.remote,
    now: deps.now,
    ...(deps.sleep ? { sleep: deps.sleep } : {}),
    onProgress: (progress) => deps.onProgress?.({ step: "backup", ...progress }),
  });
  deps.deliver(blob, backupFileName(`${deps.now.toISOString().slice(0, 10)}-vor-import`));
  await restoreBackup({
    remote: deps.remote,
    source: deps.source,
    backup: deps.backup,
    ...(deps.sleep ? { sleep: deps.sleep } : {}),
    onProgress: (progress) => deps.onProgress?.({ step: "replace", ...progress }),
  });
}
