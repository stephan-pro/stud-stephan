// What the service worker (P15) does with a request: only the app's own files are kept and served
// from its cache. Everything else (sign-in, functions, data, photos, every write) goes to the network
// untouched and is never stored. Pure functions, used by `serviceWorker.ts` and tested alone.

/** What the service worker sees of a request. */
export interface RequestFacts {
  readonly method: string;
  readonly url: string;
  /** `Request.mode`: "navigate" when a page is opened. */
  readonly mode: string;
}

/**
 * - `shell`: opening the app (a page in the scope) is answered with the kept `index.html`, so the app
 *   starts offline and a new version waits until it is loaded on purpose.
 * - `file`: one of the app's own files (scripts, styles, fonts, icons, manifest) from the cache.
 * - `network`: not touched; the browser asks the network as if there were no service worker.
 */
export type Strategy = "shell" | "file" | "network";

/**
 * Paths that are never answered from or written to the cache, wherever they are: sign-in, the
 * functions, the data and the file storage of Supabase (and of the fake server of the tests).
 */
export const NEVER_CACHED = [
  "/auth/",
  "/functions/",
  "/rest/",
  "/storage/",
  "/realtime/",
  "/test/",
];

/** The addresses to keep: `files` are paths relative to the scope ("./", "assets/index-….js"). */
export function precacheUrls(files: readonly string[], scope: string): string[] {
  return [...new Set(files.map((file) => new URL(file, scope).href))];
}

export function strategyFor(
  request: RequestFacts,
  scope: string,
  kept: ReadonlySet<string>,
): Strategy {
  // Only reading; a write (POST, PATCH, PUT, DELETE …) is never cached or answered from a cache.
  if (request.method !== "GET") return "network";
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return "network";
  }
  const base = new URL(scope);
  // Other servers (Supabase, catalogue pictures, the fake server) are never touched.
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return "network";
  const path = url.pathname.slice(base.pathname.length - 1);
  if (NEVER_CACHED.some((part) => path.includes(part))) return "network";
  if (request.mode === "navigate") return "shell";
  url.search = "";
  url.hash = "";
  return kept.has(url.href) ? "file" : "network";
}

/** Caches of this app (`stud-stephan-<version>`); an old version's cache is removed on activation. */
export const CACHE_PREFIX = "stud-stephan-";

export function cacheName(version: string): string {
  return `${CACHE_PREFIX}${version}`;
}

/** The caches an activated version deletes: the app's others, never those of another app. */
export function staleCaches(names: readonly string[], version: string): string[] {
  return names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== cacheName(version));
}

/** The message the page sends to the waiting new version: "take over now" (after "neu laden"). */
export const SKIP_WAITING = "stud-stephan:skip-waiting";
