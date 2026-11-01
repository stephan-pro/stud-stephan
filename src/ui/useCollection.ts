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
}

/**
 * The collection of the signed-in person, read once from the server (P6 will keep it up to date
 * when something is saved). The demo has no server and shows its example data at once.
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
    if (!remote) return;
    let active = true;
    setState({ status: "loading" });
    remote.load().then(
      (collection) => active && setState({ status: "ready", collection }),
      () => active && setState({ status: "failed" }),
    );
    return () => {
      active = false;
    };
  }, [remote, attempt]);

  return { state, retry: () => setAttempt((count) => count + 1) };
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
