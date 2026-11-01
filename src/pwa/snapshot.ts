// The copy of the collection kept on the device for reading offline (P15): the last collection the
// server gave, with the time it was kept and whose it is. Nothing of the session goes in (no token,
// no address): only the collection. Pure functions; `snapshotStore.ts` keeps it in the browser.

import { type Collection, SCHEMA_VERSION } from "../domain/types";

export interface Snapshot {
  /** The account it belongs to; a copy of another account is never shown. */
  readonly userId: string;
  /** When it was kept (ISO time). */
  readonly savedAt: string;
  readonly collection: Collection;
}

export function makeSnapshot(userId: string, collection: Collection, now: Date): Snapshot {
  return { userId, savedAt: now.toISOString(), collection };
}

const LISTS = ["minifigs", "sets", "specialParts", "dioramas", "wishlist", "prices"] as const;

/**
 * The kept copy, if it is one of this account and of the data layout the app reads today. Anything
 * else (another account, an older app's layout, damaged data) counts as no copy.
 */
export function readSnapshot(value: unknown, userId: string): Snapshot | undefined {
  const snapshot = value as Partial<Snapshot> | null | undefined;
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    snapshot.userId !== userId ||
    typeof snapshot.savedAt !== "string" ||
    Number.isNaN(Date.parse(snapshot.savedAt))
  ) {
    return undefined;
  }
  const collection = snapshot.collection as Partial<Collection> | undefined;
  if (
    typeof collection !== "object" ||
    collection === null ||
    collection.schemaVersion !== SCHEMA_VERSION ||
    !LISTS.every((list) => Array.isArray(collection[list]))
  ) {
    return undefined;
  }
  return { userId, savedAt: snapshot.savedAt, collection: collection as Collection };
}

/** Where the app keeps the copy (`snapshotStore.ts` in the browser, memory in tests and the demo). */
export interface SnapshotStore {
  read(userId: string): Promise<Snapshot | undefined>;
  write(snapshot: Snapshot): Promise<void>;
  /** On signing out: the copy leaves the device. */
  clear(): Promise<void>;
}

/** A store in memory (tests). */
export class MemorySnapshotStore implements SnapshotStore {
  private value: unknown;

  async read(userId: string): Promise<Snapshot | undefined> {
    return readSnapshot(this.value, userId);
  }

  async write(snapshot: Snapshot): Promise<void> {
    this.value = structuredClone(snapshot);
  }

  async clear(): Promise<void> {
    this.value = undefined;
  }
}
