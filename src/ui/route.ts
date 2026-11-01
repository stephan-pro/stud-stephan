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

/** What a detail page shows (S2 figure, S3 set, S4 special part). */
export type DetailType = "minifig" | "legoSet" | "specialPart";

export interface DetailRef {
  readonly type: DetailType;
  readonly id: string;
}

/** Part of the address for each kind of detail page: "#/vitrine/figur/<id>". */
export const DETAIL_PATHS: Readonly<Record<DetailType, string>> = {
  minifig: "figur",
  legoSet: "set",
  specialPart: "sonderteil",
};

/** Part of the address for each form: "#/erfassen/figur" (new), "…/figur/kopie/<id>" (copy). */
export const FORM_PATHS: Readonly<Record<DetailType, string>> = DETAIL_PATHS;

/** Part of the address of the edit form below a detail page: "#/vitrine/figur/<id>/bearbeiten". */
export const EDIT_PATH = "bearbeiten";
const COPY_PATH = "kopie";

/**
 * A form (S8): `new` enters an object, `copy` enters another copy of the figure `id`, `edit`
 * changes the object `id`.
 */
export type FormRef =
  | { readonly type: DetailType; readonly mode: "new" }
  | {
      readonly type: "minifig" | "legoSet";
      readonly mode: "catalog";
      readonly ref: string;
      /** The pasted address the entry was reached from (F3); kept with the object. */
      readonly link?: string;
    }
  /** A form started from a pasted address (F3): filled from the page again, or empty but for the link. */
  | { readonly type: DetailType; readonly mode: "link"; readonly link: string }
  | { readonly type: DetailType; readonly mode: "copy"; readonly id: string }
  | { readonly type: DetailType; readonly mode: "edit"; readonly id: string };

/** The kinds the catalog knows (S7b): figures and sets. */
export type SearchType = "minifig" | "legoSet";

const SEARCH_PATH = "suche";
const CATALOG_PATH = "katalog";

function isSearchType(type: DetailType | undefined): type is SearchType {
  return type === "minifig" || type === "legoSet";
}

/**
 * A page of the dioramas: the detail (S6, "#/dioramen/<id>"), assigning figures (S6a,
 * "#/dioramen/<id>/zuordnen"), editing ("…/bearbeiten") and entering a new one ("#/erfassen/diorama",
 * below "Erfassen").
 */
export type DioramaPage =
  | { readonly kind: "detail"; readonly id: string }
  | { readonly kind: "assign"; readonly id: string }
  | { readonly kind: "edit"; readonly id: string }
  | { readonly kind: "new" };

const ASSIGN_PATH = "zuordnen";
const DIORAMA_PATH = "diorama";

/**
 * A page, a detail page below the showcase (which stays the current entry of the navigation), a
 * form (entering lies below "Erfassen", editing below the showcase) or the catalog search (S7b,
 * below "Erfassen").
 */
export interface PageLocation {
  readonly route: Route;
  readonly detail?: DetailRef;
  readonly form?: FormRef;
  readonly search?: SearchType;
  /** The photo recognition (S7a, "#/erfassen/foto"), also below "Erfassen". */
  readonly photo?: true;
  /** Capture by link (S7c, "#/erfassen/link/set"), also below "Erfassen". */
  readonly link?: DetailType;
  /** A page of the dioramas (P10). */
  readonly diorama?: DioramaPage;
}

const PHOTO_PATH = "foto";
const LINK_PATH = "link";

function decode(segment: string): string | undefined {
  try {
    return decodeURIComponent(segment);
  } catch {
    return undefined;
  }
}

function typeOf(path: string | undefined): DetailType | undefined {
  return (Object.keys(DETAIL_PATHS) as DetailType[]).find(
    (candidate) => DETAIL_PATHS[candidate] === path,
  );
}

/** Reads `location.hash` (e.g. "#/dioramen"); anything unknown is the start page. */
export function parseLocation(hash: string): PageLocation {
  const segments = hash.replace(/^#\/?/, "").replace(/\/+$/, "").split("/");
  const [first, second, third, fourth, fifth, sixth] = segments;
  const route = ROUTES.find((candidate) => ROUTE_PATHS[candidate] === first);
  const type = typeOf(second);
  if (route === "showcase" && segments.length === 3) {
    const id = decode(third ?? "");
    if (type && id) return { route, detail: { type, id } };
    return { route: DEFAULT_ROUTE };
  }
  if (route === "showcase" && segments.length === 4 && fourth === EDIT_PATH) {
    const id = decode(third ?? "");
    if (type && id) return { route, form: { type, mode: "edit", id } };
    return { route: DEFAULT_ROUTE };
  }
  if (route === "capture" && segments.length === 2 && type) {
    return { route, form: { type, mode: "new" } };
  }
  if (route === "capture" && segments.length === 2 && second === DIORAMA_PATH) {
    return { route, diorama: { kind: "new" } };
  }
  if (route === "dioramas" && (segments.length === 2 || segments.length === 3)) {
    const id = decode(second ?? "");
    if (!id) return { route: DEFAULT_ROUTE };
    if (segments.length === 2) return { route, diorama: { kind: "detail", id } };
    if (third === ASSIGN_PATH) return { route, diorama: { kind: "assign", id } };
    if (third === EDIT_PATH) return { route, diorama: { kind: "edit", id } };
    return { route: DEFAULT_ROUTE };
  }
  if (route === "capture" && segments.length === 2 && second === PHOTO_PATH) {
    return { route, photo: true };
  }
  if (route === "capture" && segments.length === 3 && second === SEARCH_PATH) {
    const searchType = typeOf(third);
    if (isSearchType(searchType)) return { route, search: searchType };
    return { route: DEFAULT_ROUTE };
  }
  if (route === "capture" && segments.length === 3 && second === LINK_PATH) {
    const linkType = typeOf(third);
    if (linkType) return { route, link: linkType };
    return { route: DEFAULT_ROUTE };
  }
  if (route === "capture" && segments.length === 4 && type && third === LINK_PATH) {
    const link = decode(fourth ?? "");
    if (link) return { route, form: { type, mode: "link", link } };
    return { route: DEFAULT_ROUTE };
  }
  if (route === "capture" && segments.length === 4 && third === CATALOG_PATH) {
    const ref = decode(fourth ?? "");
    if (isSearchType(type) && ref) return { route, form: { type, mode: "catalog", ref } };
    return { route: DEFAULT_ROUTE };
  }
  if (
    route === "capture" &&
    segments.length === 6 &&
    third === CATALOG_PATH &&
    fifth === LINK_PATH
  ) {
    const ref = decode(fourth ?? "");
    const link = decode(sixth ?? "");
    if (isSearchType(type) && ref && link) {
      return { route, form: { type, mode: "catalog", ref, link } };
    }
    return { route: DEFAULT_ROUTE };
  }
  if (route === "capture" && segments.length === 4 && type === "minifig" && third === COPY_PATH) {
    const id = decode(fourth ?? "");
    if (id) return { route, form: { type, mode: "copy", id } };
    return { route: DEFAULT_ROUTE };
  }
  return { route: segments.length === 1 && route ? route : DEFAULT_ROUTE };
}

/** The page of an address, a detail page counting as the showcase. */
export function parseRoute(hash: string): Route {
  return parseLocation(hash).route;
}

/** The link target of a page, e.g. "#/dioramen". */
export function routeHash(route: Route): string {
  return `#/${ROUTE_PATHS[route]}`;
}

/** The link target of a detail page, e.g. "#/vitrine/figur/minifig-rex". */
export function detailHash(detail: DetailRef): string {
  return `${routeHash("showcase")}/${DETAIL_PATHS[detail.type]}/${encodeURIComponent(detail.id)}`;
}

/** The link target of a form, e.g. "#/erfassen/figur" or "#/vitrine/figur/minifig-rex/bearbeiten". */
export function formHash(form: FormRef): string {
  const type = FORM_PATHS[form.type];
  if (form.mode === "new") return `${routeHash("capture")}/${type}`;
  if (form.mode === "catalog") {
    const base = `${routeHash("capture")}/${type}/${CATALOG_PATH}/${encodeURIComponent(form.ref)}`;
    return form.link ? `${base}/${LINK_PATH}/${encodeURIComponent(form.link)}` : base;
  }
  if (form.mode === "link") {
    return `${routeHash("capture")}/${type}/${LINK_PATH}/${encodeURIComponent(form.link)}`;
  }
  const id = encodeURIComponent(form.id);
  return form.mode === "copy"
    ? `${routeHash("capture")}/${type}/${COPY_PATH}/${id}`
    : `${routeHash("showcase")}/${type}/${id}/${EDIT_PATH}`;
}

/** The link target of the catalog search, e.g. "#/erfassen/suche/figur". */
export function searchHash(type: SearchType): string {
  return `${routeHash("capture")}/${SEARCH_PATH}/${DETAIL_PATHS[type]}`;
}

/** The link target of the photo recognition: "#/erfassen/foto". */
export function photoHash(): string {
  return `${routeHash("capture")}/${PHOTO_PATH}`;
}

/** The link target of capture by link for a kind of thing: "#/erfassen/link/set". */
export function linkHash(type: DetailType): string {
  return `${routeHash("capture")}/${LINK_PATH}/${DETAIL_PATHS[type]}`;
}

/** The link target of a diorama page, e.g. "#/dioramen/diorama-umbara/zuordnen". */
export function dioramaHash(page: DioramaPage): string {
  if (page.kind === "new") return `${routeHash("capture")}/${DIORAMA_PATH}`;
  const base = `${routeHash("dioramas")}/${encodeURIComponent(page.id)}`;
  if (page.kind === "assign") return `${base}/${ASSIGN_PATH}`;
  return page.kind === "edit" ? `${base}/${EDIT_PATH}` : base;
}

/** The normal spelling of an address; differing spellings are rewritten to it. */
export function locationHash(page: PageLocation): string {
  if (page.diorama) return dioramaHash(page.diorama);
  if (page.form) return formHash(page.form);
  if (page.link) return linkHash(page.link);
  if (page.search) return searchHash(page.search);
  if (page.photo) return photoHash();
  return page.detail ? detailHash(page.detail) : routeHash(page.route);
}

/** Name of the page in the navigation, as heading and in the browser tab. */
export function routeLabel(route: Route): string {
  return TEXTS.routes[route].label;
}

/** Title of the browser tab, e.g. "Dioramen – Stud Stephan"; a detail page uses its object's name. */
export function documentTitle(route: Route, detailName?: string): string {
  return `${detailName ?? routeLabel(route)} – ${TEXTS.appName}`;
}
