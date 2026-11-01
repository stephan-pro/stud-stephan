import { useEffect, useState } from "preact/hooks";
import type { Remote } from "../backend/remote";
import type { Collection } from "../domain/types";

export type CollectionState =
  | { readonly status: "loading" }
  | { readonly status: "failed" }
  | { readonly status: "ready"; readonly collection: Collection };

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

/**
 * The collection of the signed-in person, read once from the server and kept up to date by the
 * app's own changes (`update`). The demo shows its example data at once and never loads.
 */
export function useCollection(
  remote: Pick<Remote, "load"> | undefined,
  demo: Collection | undefined,
): LoadedCollection {
  const [state, setState] = useState<CollectionState>(
    demo ? { status: "ready", collection: demo } : { status: "loading" },
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!remote || demo) return;
    let active = true;
    setState({ status: "loading" });
    remote.load().then(
      (collection) => active && setState({ status: "ready", collection }),
      () => active && setState({ status: "failed" }),
    );
    return () => {
      active = false;
    };
  }, [remote, demo, attempt]);

  return {
    state,
    retry: () => setAttempt((count) => count + 1),
    update: (change) =>
      setState((current) =>
        current.status === "ready"
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
