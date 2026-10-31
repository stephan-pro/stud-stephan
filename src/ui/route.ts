// The pages and their addresses (hash router: "#/vitrine" …). Pure functions; the page itself
// listens to `hashchange`.

import { TEXTS } from "./texts";

export type Route = "showcase" | "dioramas" | "capture" | "wishlist" | "dashboard" | "settings";

/** Part after "#/" for each page; the addresses are German like the rest of the interface. */
export const ROUTE_PATHS: Readonly<Record<Route, string>> = {
  showcase: "vitrine",
  dioramas: "dioramen",
  capture: "erfassen",
  wishlist: "wunschliste",
  dashboard: "dashboard",
  settings: "einstellungen",
};

export const ROUTES = Object.keys(ROUTE_PATHS) as readonly Route[];

/** The showcase is the start page, also for an empty or unknown address. */
export const DEFAULT_ROUTE: Route = "showcase";

/** Entries of the phone bar, left to right; the plus for capturing sits in the middle. */
export const PHONE_NAVIGATION: readonly Route[] = [
  "showcase",
  "dioramas",
  "capture",
  "wishlist",
  "dashboard",
];

/** Entries of the PC sidebar below the "Erfassen" button; "Einstellungen" sits at the bottom. */
export const SIDEBAR_NAVIGATION: readonly Route[] = [
  "showcase",
  "dioramas",
  "wishlist",
  "dashboard",
];

/** Reads `location.hash` (e.g. "#/dioramen"); anything unknown is the start page. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, "").replace(/\/+$/, "");
  return ROUTES.find((route) => ROUTE_PATHS[route] === path) ?? DEFAULT_ROUTE;
}

/** The link target of a page, e.g. "#/dioramen". */
export function routeHash(route: Route): string {
  return `#/${ROUTE_PATHS[route]}`;
}

/** Name of the page in the navigation, as heading and in the browser tab. */
export function routeLabel(route: Route): string {
  return TEXTS.routes[route].label;
}

/** Title of the browser tab, e.g. "Dioramen – Stud Stephan". */
export function documentTitle(route: Route): string {
  return `${routeLabel(route)} – ${TEXTS.appName}`;
}
