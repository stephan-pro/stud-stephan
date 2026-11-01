// What the Edge Function `catalog` answers (P7). Shared by the functions and by the app, which only
// imports the types.

export type CatalogKind = "minifig" | "legoSet";

/** One line of a search: enough to pick the right one. */
export interface CatalogHit {
  kind: CatalogKind;
  /**
   * What `item` takes to read the full entry: a BrickLink number, or for a figure found by name a
   * Rebrickable number ("fig-014663") that `item` turns into a BrickLink number if it can.
   */
  ref: string;
  /** The BrickLink number (figure) or set number; missing for a figure found by name. */
  number?: string;
  name: string;
  year?: number;
  theme?: string;
  imageUrl?: string;
}

export interface CatalogFigureInfo {
  /** BrickLink number. */
  number: string;
  name: string;
  quantity: number;
  imageUrl?: string;
}

export interface CatalogSetInfo {
  number: string;
  name: string;
}

/** The full entry the form is filled from (F2). */
export interface CatalogItem {
  kind: CatalogKind;
  /** BrickLink number of the figure or number of the set; empty if the figure could not be found at BrickLink. */
  number: string;
  name: string;
  year?: number;
  /** "Star Wars – The Clone Wars": main theme, sub theme. */
  theme?: string;
  pieceCount?: number;
  imageUrl?: string;
  /** Set: the minifigs in it (BrickLink subsets). */
  figures?: CatalogFigureInfo[];
  /** Minifig: the sets it comes in (BrickLink supersets). */
  sets?: CatalogSetInfo[];
}

export type CatalogRequest =
  | { op: "search"; kind: CatalogKind; query: string }
  | { op: "item"; kind: CatalogKind; ref: string };

export type CatalogAnswer =
  | { op: "search"; hits: CatalogHit[] }
  | { op: "item"; item: CatalogItem };

/** Why a call failed, as the app words it. */
export type CatalogFailure =
  | "bad_request"
  | "not_signed_in"
  | "not_found"
  | "limit_reached"
  | "unavailable";

/** Longest search text the function takes. */
export const MAX_QUERY_LENGTH = 100;
