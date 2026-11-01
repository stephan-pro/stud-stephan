// The install hint (P15): Chrome on Android and on the PC offers to install the app with the event
// `beforeinstallprompt`. It is caught as early as possible (main.tsx) and kept, so the settings can
// show "App installieren" with a button that opens the browser's own question. Browser only.

/** What Chrome hands over (not in the DOM types of TypeScript yet). */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ readonly outcome: "accepted" | "dismissed" }>;
}

let offer: InstallPromptEvent | undefined;
let installed = false;
const listeners = new Set<() => void>();

function changed(): void {
  for (const listener of listeners) listener();
}

export type InstallState = "installed" | "offered" | "manual";

/**
 * - `installed`: the app runs as an installed app (own window, no browser bar), or was just installed.
 * - `offered`: the browser offers installing; the button opens its question.
 * - `manual`: no offer (another browser, already installed, or Chrome has not decided yet): the
 *   settings say where the browser's menu has it.
 */
export function installState(): InstallState {
  if (installed || matchMedia("(display-mode: standalone)").matches) return "installed";
  return offer ? "offered" : "manual";
}

export function onInstallChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Opens the browser's question; the offer can be used once. */
export async function install(): Promise<void> {
  const current = offer;
  if (!current) return;
  offer = undefined;
  await current.prompt();
  const choice = await current.userChoice;
  if (choice.outcome === "accepted") installed = true;
  changed();
}

export function catchInstallOffer(): void {
  addEventListener("beforeinstallprompt", (event) => {
    // No mini bar of the browser: the settings offer it calmly instead.
    event.preventDefault();
    offer = event as InstallPromptEvent;
    changed();
  });
  addEventListener("appinstalled", () => {
    installed = true;
    offer = undefined;
    changed();
  });
}
