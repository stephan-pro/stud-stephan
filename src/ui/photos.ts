import { createContext } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";
import type { Remote } from "../backend/remote";

/** What the pictures need from the server: the address that shows a private photo. */
export type PhotoSource = Pick<Remote, "signedUrl">;

/** The server's files; none in the demo, where objects have no own photos. */
export const PhotoSourceContext = createContext<PhotoSource | undefined>(undefined);

/** Signed addresses last an hour on the server; keep one a little shorter than that. */
const KEEP_MS = 50 * 60 * 1000;

interface Cached {
  readonly url: Promise<string>;
  readonly until: number;
}

const caches = new WeakMap<PhotoSource, Map<string, Cached>>();

/** One request per photo and a while, however many tiles and pages ask for it. */
export function photoUrl(source: PhotoSource, path: string, now = Date.now()): Promise<string> {
  const cache = caches.get(source) ?? new Map<string, Cached>();
  caches.set(source, cache);
  const cached = cache.get(path);
  if (cached && cached.until > now) return cached.url;
  const url = source.signedUrl("photos", path);
  cache.set(path, { url, until: now + KEEP_MS });
  // A failed request is not kept, the next try asks again.
  url.catch(() => cache.delete(path));
  return url;
}

/**
 * The address of a photo of the collection: `undefined` while it is fetched, `null` if it cannot
 * be (no server, a missing file, no connection), where the tile shows its placeholder.
 */
export function usePhotoUrl(path: string | undefined): string | null | undefined {
  const source = useContext(PhotoSourceContext);
  const [result, setResult] = useState<{ path: string; url: string | null } | undefined>();

  useEffect(() => {
    if (!source || !path) return;
    let active = true;
    photoUrl(source, path).then(
      (url) => active && setResult({ path, url }),
      () => active && setResult({ path, url: null }),
    );
    return () => {
      active = false;
    };
  }, [source, path]);

  if (!path || !source) return null;
  return result?.path === path ? result.url : undefined;
}
