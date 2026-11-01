// Keeps the copy of the collection (`snapshot.ts`) in the browser's IndexedDB, which holds more than
// localStorage (a collection with thousands of objects is several MB) and does not block the page.
// One entry per device; signing out deletes it. Browser only (end-to-end test `offline.spec.ts`).

import { readSnapshot, type Snapshot, type SnapshotStore } from "./snapshot";

const DATABASE = "stud-stephan-offline";
const STORE = "snapshot";
const KEY = "collection";

function request<T>(call: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    call.onsuccess = () => resolve(call.result);
    call.onerror = () => reject(call.error);
  });
}

function open(): Promise<IDBDatabase> {
  const opening = indexedDB.open(DATABASE, 1);
  opening.onupgradeneeded = () => opening.result.createObjectStore(STORE);
  return request(opening);
}

async function inStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await open();
  try {
    return await request(work(database.transaction(STORE, mode).objectStore(STORE)));
  } finally {
    database.close();
  }
}

/**
 * The browser's store. Every failure (private window, storage full or switched off) is swallowed:
 * the app then simply has no copy for offline, as before P15.
 */
export class BrowserSnapshotStore implements SnapshotStore {
  async read(userId: string): Promise<Snapshot | undefined> {
    try {
      return readSnapshot(await inStore("readonly", (store) => store.get(KEY)), userId);
    } catch {
      return undefined;
    }
  }

  async write(snapshot: Snapshot): Promise<void> {
    try {
      await inStore("readwrite", (store) => store.put(snapshot, KEY));
    } catch {
      // see above
    }
  }

  async clear(): Promise<void> {
    try {
      await inStore("readwrite", (store) => store.delete(KEY));
    } catch {
      // see above
    }
  }
}
