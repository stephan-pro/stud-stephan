// Replaces the collection by the content of a checked backup (F15) so that there is never half of
// the old and half of the new state:
//
//   1. The new files go to new paths of their own; the old files and objects are not touched.
//   2. The objects of the backup are saved (`saveKeeping`), then the old objects the backup does not
//      have are removed (`removeKeeping`). Both leave the files they let go of in storage.
//   3. The price points of the backup are written.
//   4. Only now the files the old objects let go of are removed.
//
// If a step fails (after tries again), everything touched is put back from the state read at the
// start: old objects saved again (their files are still there), objects that were new removed, the
// new files removed. The price points the backup added stay (market data, not part of the state
// the person built); points it overwrote are written back.

import { type Remote, RemoteError, removeReleased } from "../backend/remote";
import type { ObjectKind, ObjectOfKind, StoredFile } from "../backend/rules";
import type { Collection, PricePoint } from "../domain/types";
import { uploadFile } from "../files/upload";
import { EXTENSIONS, remapFiles } from "./format";
import type { ParsedBackup } from "./readBackup";
import { type ByteSource, readZipEntry } from "./zip";

export interface RestoreProgress {
  readonly phase: "files" | "objects" | "prices" | "cleanup";
  readonly done: number;
  readonly total: number;
}

export type RestoreStage = "files" | "objects";

/**
 * Replacing failed. `restored` says whether the old state is back (true: nothing changed for the
 * person) or the putting back failed as well (false: the automatic backup is the way out).
 */
export class RestoreError extends Error {
  constructor(
    readonly stage: RestoreStage,
    readonly restored: boolean,
    override readonly cause: unknown,
  ) {
    super(`Wiederherstellen scheiterte in ${stage}; alter Stand zurück: ${restored}`);
    this.name = "RestoreError";
  }
}

export interface RestoreDeps {
  readonly remote: Remote;
  readonly source: ByteSource;
  readonly backup: ParsedBackup;
  readonly onProgress?: (progress: RestoreProgress) => void;
  /** Pause between tries; for tests. */
  readonly sleep?: (ms: number) => Promise<void>;
  /** The part of the new file names that keeps them apart from every earlier file. */
  readonly token?: string;
}

interface Write {
  readonly kind: ObjectKind;
  readonly id: string;
  readonly object: ObjectOfKind[ObjectKind];
}

const TRIES = 3;
const UPLOADS_AT_ONCE = 3;
const PRICES_AT_ONCE = 6;

const byKind = (collection: Collection): Record<ObjectKind, { id: string }[]> => ({
  minifig: collection.minifigs,
  legoSet: collection.sets,
  specialPart: collection.specialParts,
  diorama: collection.dioramas,
  wishItem: collection.wishlist,
});

/** A call that may be repeated: tried again after a failure that can pass. */
async function retried<T>(
  call: () => Promise<T>,
  sleep: (ms: number) => Promise<void>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      if (!(error instanceof RemoteError) || error.permanent || attempt >= TRIES) throw error;
      await sleep(1000 * 2 ** (attempt - 1));
    }
  }
}

/** Runs `work` for the items, `limit` at once; the first failure stops starting more and is thrown. */
async function inParallel<T>(
  items: readonly T[],
  limit: number,
  work: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  let failure: { error: unknown } | undefined;
  const worker = async () => {
    while (failure === undefined && next < items.length) {
      const index = next++;
      try {
        await work(items[index] as T, index);
      } catch (error) {
        failure ??= { error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (failure !== undefined) throw failure.error;
}

const priceKey = (point: PricePoint) => `${point.itemType}|${point.bricklinkId}|${point.date}`;

export async function restoreBackup(deps: RestoreDeps): Promise<void> {
  const { remote, source, backup } = deps;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  const token = deps.token ?? crypto.randomUUID().slice(0, 8);
  const progress = deps.onProgress ?? (() => {});

  let before: Collection;
  try {
    before = await retried(() => remote.load(), sleep);
  } catch (error) {
    throw new RestoreError("files", true, error);
  }

  // 1. New files, new paths.
  const uploaded: StoredFile[] = [];
  const paths = new Map<string, string>();
  const removeUploaded = () => removeReleased(remote, uploaded);
  try {
    const files = backup.manifest.files;
    let done = 0;
    progress({ phase: "files", done, total: files.length });
    await inParallel(files, UPLOADS_AT_ONCE, async (file, index) => {
      const entry = backup.entries.get(file.entry);
      if (entry === undefined) throw new Error(`Eintrag fehlt: ${file.entry}`);
      const bytes = await readZipEntry(source, entry);
      const name = `wiederherstellung-${token}/${String(index + 1).padStart(6, "0")}.${EXTENSIONS[file.contentType]}`;
      const path = await uploadFile(remote, file.bucket, name, bytes, file.contentType, { sleep });
      uploaded.push({ bucket: file.bucket, path });
      paths.set(file.entry, path);
      progress({ phase: "files", done: ++done, total: files.length });
    });
  } catch (error) {
    await removeUploaded();
    throw new RestoreError("files", true, error);
  }

  // The backup's objects with their new paths; Studio files get new ids as well.
  const { dioramas, ...others } = remapFiles(backup.manifest.collection, (_, entry) =>
    paths.get(entry),
  );
  const imported: Collection = {
    ...before,
    ...others,
    dioramas: dioramas.map((diorama) => ({
      ...diorama,
      studioFiles: diorama.studioFiles.map((file) => ({
        ...file,
        id: `studio-${crypto.randomUUID()}`,
      })),
    })),
  };

  const writes: Write[] = [];
  const order: [ObjectKind, readonly object[]][] = [
    ["legoSet", imported.sets],
    ["specialPart", imported.specialParts],
    ["diorama", imported.dioramas],
    ["minifig", imported.minifigs],
    ["wishItem", imported.wishlist],
  ];
  for (const [kind, list] of order) {
    for (const object of list as { id: string }[]) {
      writes.push({ kind, id: object.id, object: object as ObjectOfKind[ObjectKind] });
    }
  }
  const oldKinds = byKind(before);
  const newIds = new Set(writes.map((write) => `${write.kind}|${write.id}`));
  const removals = (Object.keys(oldKinds) as ObjectKind[]).flatMap((kind) =>
    oldKinds[kind]
      .filter((old) => !newIds.has(`${kind}|${old.id}`))
      .map((old) => ({ kind, id: old.id })),
  );
  const known = new Map(before.prices.map((point) => [priceKey(point), point]));
  const pricesToWrite = imported.prices.filter(
    (point) => JSON.stringify(known.get(priceKey(point))) !== JSON.stringify(point),
  );

  // 2. and 3. Objects, then price points. Everything touched is noted before the call.
  const touched: { kind: ObjectKind; id: string }[] = [];
  const letGo: StoredFile[] = [];
  const touchedPrices: PricePoint[] = [];
  try {
    const total = writes.length + removals.length;
    let done = 0;
    progress({ phase: "objects", done, total });
    for (const write of writes) {
      touched.push({ kind: write.kind, id: write.id });
      letGo.push(
        ...(await retried(() => remote.saveKeeping(write.kind, write.object as never), sleep)),
      );
      progress({ phase: "objects", done: ++done, total });
    }
    for (const removal of removals) {
      touched.push(removal);
      letGo.push(...(await retried(() => remote.removeKeeping(removal.kind, removal.id), sleep)));
      progress({ phase: "objects", done: ++done, total });
    }
    let written = 0;
    progress({ phase: "prices", done: written, total: pricesToWrite.length });
    await inParallel(pricesToWrite, PRICES_AT_ONCE, async (point) => {
      const old = known.get(priceKey(point));
      if (old) touchedPrices.push(old);
      await retried(() => remote.savePrice(point), sleep);
      progress({ phase: "prices", done: ++written, total: pricesToWrite.length });
    });
  } catch (error) {
    throw new RestoreError(
      "objects",
      await putBack({ remote, before, touched, touchedPrices, uploaded, sleep }),
      error,
    );
  }

  // 4. Committed: the old files nobody lists any more can go (a leftover costs space, nothing else).
  progress({ phase: "cleanup", done: 0, total: letGo.length });
  await removeReleased(remote, letGo);
  progress({ phase: "cleanup", done: letGo.length, total: letGo.length });
}

/** Brings the state read at the start back; true if all of it worked. */
async function putBack(args: {
  remote: Remote;
  before: Collection;
  touched: readonly { kind: ObjectKind; id: string }[];
  touchedPrices: readonly PricePoint[];
  uploaded: readonly StoredFile[];
  sleep: (ms: number) => Promise<void>;
}): Promise<boolean> {
  const { remote, before, touched, touchedPrices, uploaded, sleep } = args;
  const old = byKind(before);
  let complete = true;
  for (const { kind, id } of touched) {
    const previous = old[kind].find((object) => object.id === id);
    try {
      await retried(
        () =>
          previous ? remote.saveKeeping(kind, previous as never) : remote.removeKeeping(kind, id),
        sleep,
      );
    } catch {
      complete = false;
    }
  }
  for (const point of touchedPrices) {
    try {
      await retried(() => remote.savePrice(point), sleep);
    } catch {
      complete = false;
    }
  }
  // Only when everything is back no object can still list a new file.
  if (complete) await removeReleased(remote, uploaded);
  return complete;
}
