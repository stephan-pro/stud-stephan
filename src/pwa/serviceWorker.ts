// The service worker of the app (P15), built to `sw.js` by `vitePlugin.ts`, which puts the list of
// the app's files and the version in place of `__PRECACHE__` and `__SW_VERSION__`.
//
// - Install: keeps exactly the app's files (index.html, scripts, styles, fonts, icons, manifest) in
//   a cache of this version, each fetched fresh from the server (not from the browser's cache).
// - A new version does not take over by itself while an old one runs: it waits until the page says
//   so ("Neue Version verfügbar – neu laden"), then the page reloads.
// - Requests: see `swPolicy.ts`. Data, photos, sign-in and functions are never cached here; the
//   collection for reading offline is kept by the app itself (`snapshotStore.ts`).

import { cacheName, precacheUrls, SKIP_WAITING, staleCaches, strategyFor } from "./swPolicy";

declare const __PRECACHE__: readonly string[];
declare const __SW_VERSION__: string;

// The few parts of the service worker's world used here (the WebWorker types of TypeScript cannot
// be mixed with the DOM types of the app in one project).
interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}
interface FetchEvent extends ExtendableEvent {
  readonly request: Request;
  respondWith(response: Promise<Response>): void;
}
interface MessageEventLike extends ExtendableEvent {
  readonly data: unknown;
}
interface ServiceWorkerScope {
  readonly registration: { readonly scope: string };
  skipWaiting(): Promise<void>;
  addEventListener(type: "install" | "activate", listener: (event: ExtendableEvent) => void): void;
  addEventListener(type: "fetch", listener: (event: FetchEvent) => void): void;
  addEventListener(type: "message", listener: (event: MessageEventLike) => void): void;
}

const worker = self as unknown as ServiceWorkerScope;
const scope = worker.registration.scope;
const cache = cacheName(__SW_VERSION__);
const files = precacheUrls(__PRECACHE__, scope);
const kept = new Set(files);
const shell = new URL("./", scope).href;

worker.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(cache)
      .then((open) => open.addAll(files.map((url) => new Request(url, { cache: "reload" })))),
  );
});

worker.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(staleCaches(names, __SW_VERSION__).map((name) => caches.delete(name))),
      ),
  );
});

worker.addEventListener("message", (event) => {
  if (event.data === SKIP_WAITING) void worker.skipWaiting();
});

/** From this version's cache; the network only if the file is missing there. */
async function fromCache(request: Request, key: string): Promise<Response> {
  const open = await caches.open(cache);
  return (await open.match(key)) ?? fetch(request);
}

worker.addEventListener("fetch", (event) => {
  const { request } = event;
  const strategy = strategyFor(request, scope, kept);
  if (strategy === "network") return;
  const key = strategy === "shell" ? shell : (request.url.split(/[?#]/)[0] ?? request.url);
  event.respondWith(fromCache(request, key));
});
