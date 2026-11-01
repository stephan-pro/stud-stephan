import { useEffect, useRef, useState } from "preact/hooks";
import type { Remote } from "../backend/remote";
import { withoutObject, withRestored } from "../domain/collectionEdit";
import type { Collection, ShowcaseItem } from "../domain/types";
import type { LoadedCollection } from "./useCollection";

/** How long "Rückgängig" is offered before the server really deletes (ms). */
export const UNDO_MS = 8000;

interface Pending {
  readonly item: ShowcaseItem;
  /** The collection from before the deletion, to put the links back on "Rückgängig". */
  readonly before: Collection;
}

export interface PendingRemoval {
  /** The object that is gone from the screen and can still be taken back. */
  readonly pending: ShowcaseItem | undefined;
  /** The server refused or could not be reached when the deletion became final. */
  readonly failed: boolean;
  readonly remove: (item: ShowcaseItem) => void;
  readonly undo: () => void;
}

/**
 * Deleting with a way back: the object disappears at once, but the server is only told after
 * `UNDO_MS`, when the person leaves the app, or when another object is deleted. "Rückgängig"
 * before that deletes nothing at all (so the photos are still there). If the server fails in the
 * end, the object returns and the person is told.
 */
export function usePendingRemoval(
  remote: Pick<Remote, "remove"> | undefined,
  data: LoadedCollection,
): PendingRemoval {
  const [pending, setPending] = useState<Pending | undefined>();
  const [failed, setFailed] = useState(false);
  const current = useRef<Pending | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The functions below are called from timers and listeners that outlive a render.
  const latest = useRef({ remote, data });
  latest.current = { remote, data };

  const stopTimer = () => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
  };

  const settle = () => {
    stopTimer();
    const done = current.current;
    if (!done) return;
    current.current = undefined;
    setPending(undefined);
    const { remote: server, data: collection } = latest.current;
    if (!server) return;
    server.remove(done.item.type, done.item.id).catch(() => {
      collection.update((now) => withRestored(now, done.before, done.item.type, done.item.id));
      setFailed(true);
      timer.current = setTimeout(() => setFailed(false), UNDO_MS);
    });
  };

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") settle();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      settle();
    };
    // `settle` reads everything through refs, so it never goes stale.
  }, []);

  return {
    pending: pending?.item,
    failed,
    remove: (item) => {
      const { data: collection } = latest.current;
      if (collection.state.status !== "ready") return;
      settle();
      setFailed(false);
      const next = { item, before: collection.state.collection };
      current.current = next;
      setPending(next);
      collection.update((now) => withoutObject(now, item.type, item.id));
      timer.current = setTimeout(settle, UNDO_MS);
    },
    undo: () => {
      stopTimer();
      const back = current.current;
      if (!back) return;
      current.current = undefined;
      setPending(undefined);
      latest.current.data.update((now) =>
        withRestored(now, back.before, back.item.type, back.item.id),
      );
    },
  };
}
