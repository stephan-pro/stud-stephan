// Registers the service worker (P15, `serviceWorker.ts`) and tells the page when a new version is
// ready. The new version never takes over by itself: the page shows "Neue Version verfügbar – neu
// laden", and only that button lets it take over and reloads the page. Browser only; the dev server
// and the demo have no service worker.

/**
 * The message to the waiting new version: "take over now" (after "neu laden"). The same text as
 * `SKIP_WAITING` in `swPolicy.ts` (checked by `register.test.ts`); not imported from there, or the
 * build would put the shared code into a chunk that `sw.js` had to import, which a service worker
 * of the classic kind cannot.
 */
export const SKIP_WAITING_MESSAGE = "stud-stephan:skip-waiting";

/** How often an open app looks for a new version (besides each time it comes to the front). */
const LOOK_EVERY_MS = 60 * 60 * 1000;

let waiting: ServiceWorker | undefined;
let reloading = false;
const listeners = new Set<() => void>();

function setWaiting(worker: ServiceWorker): void {
  waiting = worker;
  for (const listener of listeners) listener();
}

/** Whether a new version is installed and waits for "neu laden". */
export function updateWaiting(): boolean {
  return waiting !== undefined;
}

/** Called when a new version starts waiting; returns the function that stops listening. */
export function onUpdateWaiting(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** "Neu laden": the waiting version takes over, then the page reloads with it. */
export function applyUpdate(): void {
  if (!waiting) {
    location.reload();
    return;
  }
  reloading = true;
  waiting.postMessage(SKIP_WAITING_MESSAGE);
}

/**
 * A worker that finished installing is a waiting update only while another version controls this
 * page; on the very first visit it simply becomes active (nothing to reload).
 */
function watch(worker: ServiceWorker | null): void {
  if (!worker) return;
  const check = () => {
    if (worker.state === "installed" && navigator.serviceWorker.controller) setWaiting(worker);
  };
  check();
  worker.addEventListener("statechange", check);
}

export function registerServiceWorker(base: string): void {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Only after "neu laden"; never in the middle of the work.
    if (reloading) location.reload();
  });
  navigator.serviceWorker
    .register(`${base}sw.js`, { scope: base, updateViaCache: "none" })
    .then((registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        setWaiting(registration.waiting);
      }
      watch(registration.installing);
      registration.addEventListener("updatefound", () => watch(registration.installing));
      const look = () => {
        registration.update().catch(() => {
          // Offline or the server is away: the next look tries again.
        });
      };
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") look();
      });
      setInterval(look, LOOK_EVERY_MS);
    })
    .catch(() => {
      // Without a service worker the app works as before, only not offline.
    });
}
