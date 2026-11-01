// The server as the app sees it: the collection of the signed-in person and their files.
// Implementations: `FakeRemote` (in memory, unit tests), `FakeHttpRemote` (against the fake server
// of the end-to-end tests) and `SupabaseRemote` (the real one). They all follow the same rules
// (`rules.ts`), and one series of contract tests (`remote.contract.ts`) runs against each.

import type { Collection, Id, PricePoint, ShowcaseItem } from "../domain/types";
import type { Bucket, ObjectKind, ObjectOfKind, RefusalReason, StoredFile } from "./rules";

export type { Bucket, ObjectKind, ObjectOfKind, RefusalReason, StoredFile };

/**
 * A call failed. Without `permanent` the server could not be reached or failed, and the same call
 * may work later. With `permanent` the server refused it (`reason` says why, e.g. too many photos);
 * trying the same again will not help.
 */
export class RemoteError extends Error {
  constructor(
    message: string,
    readonly permanent = false,
    readonly reason?: RefusalReason,
  ) {
    super(message);
    this.name = "RemoteError";
  }
}

/**
 * Whether a failed call may work later, by the HTTP status of the answer (0 = no answer): no
 * connection, a timeout, an expired session, too many calls or a server failure.
 */
export function isTemporaryStatus(status: number): boolean {
  return status === 0 || status === 401 || status === 408 || status === 429 || status >= 500;
}

export interface Remote {
  /** Everything of the signed-in person; every list sorted by id, photos in their order. */
  load(): Promise<Collection>;
  /**
   * Saves a new object or replaces the one with its id, with its photos (and a diorama's Studio
   * files). Files it no longer lists are removed from storage.
   */
  save<K extends ObjectKind>(kind: K, object: ObjectOfKind[K]): Promise<void>;
  /**
   * Deletes an object and its files. A diorama's figures stay ("ohne Diorama", F8); a set's
   * figures keep the catalog's "Stammt aus Set", only the link to the own set goes.
   */
  remove(kind: ObjectKind, id: Id): Promise<void>;
  /** A second point for the same item and day replaces the first. */
  savePrice(point: PricePoint): Promise<void>;
  /**
   * Stores a file in the person's folder (`name` e.g. "minifig-1/photo-1.webp"; an existing file
   * of that name is replaced) and answers its path, which objects list.
   */
  putFile(bucket: Bucket, name: string, bytes: Uint8Array, contentType: string): Promise<string>;
  /** The file's bytes, exactly as stored. Someone else's file is `not_found`. */
  getFile(bucket: Bucket, path: string): Promise<Uint8Array>;
  /** Removes the file; nothing happens if it is missing or someone else's. */
  removeFile(bucket: Bucket, path: string): Promise<void>;
  /**
   * An address that shows the file (an `<img>`, a download link) for a while without signing in
   * again; the files are private. Someone else's or a missing file is `not_found`.
   */
  signedUrl(bucket: Bucket, path: string): Promise<string>;
  /** Bytes of all the person's files (photos and Studio files). */
  storageUsage(): Promise<number>;
}

/** Saves an object of the showcase, whichever kind it is. */
export function saveItem(remote: Pick<Remote, "save">, item: ShowcaseItem): Promise<void> {
  if (item.type === "minifig") return remote.save("minifig", item);
  if (item.type === "legoSet") return remote.save("legoSet", item);
  return remote.save("specialPart", item);
}

/** Removes files an object no longer lists; a failure leaves the file behind, nothing else. */
export async function removeReleased(
  remote: Pick<Remote, "removeFile">,
  files: readonly StoredFile[],
): Promise<void> {
  await Promise.all(files.map((file) => remote.removeFile(file.bucket, file.path).catch(() => {})));
}
