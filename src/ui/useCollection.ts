import { createContext } from "preact";
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import type { Remote } from "../backend/remote";
import type { Collection } from "../domain/types";
import { makeSnapshot, type SnapshotStore } from "../pwa/snapshot";

export type CollectionState =
  | { readonly status: "loading" }
  | { readonly status: "failed" }
  | {
      readonly status: "ready";
      readonly collection: Collection;
      /**
       * Set when the server could not be reached and the copy kept on the device is shown (P15):
       * when that copy was kept (ISO time). Reading works, changing does not.
       */
      readonly savedAt?: string;
    };

export interface LoadedCollection {
  readonly state: CollectionState;
  /** Asks the server again after a failure. */
  readonly retry: () => void;
  /**
   * Shows a change the app has made (saved or deleted an object) without asking the server again.
   * Nothing happens while the collection is not loaded.
   */
  readonly update: (change: (collection: Collection) => Collection) => void;
}

/** The copy for offline reading (P15) and whose it is; missing in the demo. */
export interface OfflineCopy {
  readonly store: SnapshotStore;
  readonly userId: string;
}

/** How long changes settle before the copy on the device is written again. */
const WRITE_DELAY_MS = 1000;

/**
 * The collection of the signed-in person, read once from the server and kept up to date by the
 * app's own changes (`update`). Every collection from the server (and every own change) is also kept
 * on the device; if the server cannot be reached, that copy is shown instead, until a new attempt
 * works. The demo shows its example data at once and never loads.
 */
export function useCollection(
  remote: Pick<Remote, "load"> | undefined,
  demo: Collection | undefined,
  offline?: OfflineCopy,
): LoadedCollection {
  const [state, setState] = useState<CollectionState>(
    demo ? { status: "ready", collection: demo } : { status: "loading" },
  );
  const [attempt, setAttempt] = useState(0);
  const copy = useRef(offline);
  copy.current = offline;

  useEffect(() => {
    if (!remote || demo) return;
    let active = true;
    // A copy stays on screen while the server is asked again.
    setState((current) =>
      current.status === "ready" && current.savedAt ? current : { status: "loading" },
    );
    remote.load().then(
      (collection) => active && setState({ status: "ready", collection }),
      async () => {
        const kept = await copy.current?.store.read(copy.current.userId);
        if (!active) return;
        setState(
          kept
            ? { status: "ready", collection: kept.collection, savedAt: kept.savedAt }
            : { status: "failed" },
        );
      },
    );
    return () => {
      active = false;
    };
  }, [remote, demo, attempt]);

  // Keep what the server gave (and the own changes since) for the next start without a connection.
  const fresh = state.status === "ready" && !state.savedAt ? state.collection : undefined;
  useEffect(() => {
    const target = copy.current;
    if (!fresh || !target) return;
    const timer = setTimeout(
      () => void target.store.write(makeSnapshot(target.userId, fresh, new Date())),
      WRITE_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [fresh]);

  return {
    state,
    retry: () => setAttempt((count) => count + 1),
    update: (change) =>
      setState((current) =>
        current.status === "ready" && !current.savedAt
          ? { status: "ready", collection: change(current.collection) }
          : current,
      ),
  };
}

/** Whether the device says it has a connection (changes with the browser's online and offline events). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    addEventListener("online", update);
    addEventListener("offline", update);
    return () => {
      removeEventListener("online", update);
      removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/**
 * Whether the app may change anything (P15): only with a connection and with the collection from the
 * server, not with the copy kept for offline reading. Capturing and changing are switched off
 * otherwise, with a hint. `true` outside the shell (tests of single parts).
 */
export const WritableContext = createContext(true);

export function useWritable(): boolean {
  return useContext(WritableContext);
}
