// What the Edge Function `catalog` answers (P7). Shared by the functions and by the app, which only
// imports the types.

export type CatalogKind = "minifig" | "legoSet" | "specialPart";

/**
 * The BrickLink types a special part (GWP, Insiders reward, coin) can be: gear, a set (polybag,
 * promo set) or a book. A number alone does not say which; the catalog tries them in this order.
 */
export type SpecialPartType = "GEAR" | "SET" | "BOOK";

export const SPECIAL_PART_TYPES: readonly SpecialPartType[] = ["GEAR", "SET", "BOOK"];

/** One line of a search: enough to pick the right one. */
export interface CatalogHit {
  kind: CatalogKind;
  /**
   * What `item` takes to read the full entry: a BrickLink number, or for a figure found by name a
   * Rebrickable number ("fig-014663") that `item` turns into a BrickLink number if it can. For a
   * special part the type goes first ("GEAR:5010325"), so the entry is read with one call.
   */
  ref: string;
  /** Special part: the BrickLink type the number was found under. */
  bricklinkType?: SpecialPartType;
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
  /** Special part: the BrickLink type the number was found under; it belongs to `number`. */
  bricklinkType?: SpecialPartType;
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

/** "GEAR:5010325": a special part's reference with its type; a plain number has none. */
export function specialPartRef(type: SpecialPartType, number: string): string {
  return `${type}:${number}`;
}

/** The type and number of a reference "GEAR:5010325"; nothing for a plain number. */
export function parseSpecialPartRef(
  ref: string,
): { type: SpecialPartType; number: string } | undefined {
  const [prefix, ...rest] = ref.split(":");
  const type = SPECIAL_PART_TYPES.find((candidate) => candidate === prefix?.toUpperCase());
  const number = rest.join(":");
  return type && number !== "" ? { type, number } : undefined;
}

/** Longest search text the function takes. */
export const MAX_QUERY_LENGTH = 100;
