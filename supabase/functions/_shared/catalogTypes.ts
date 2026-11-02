// What the Edge Function `catalog` answers (P7). Shared by the functions and by the app, which only
// imports the types.

export type CatalogKind = "minifig" | "legoSet" | "specialPart";

/**
 * The BrickLink types a special part (GWP, Insiders reward, coin) can be: gear, a set (polybag,
 * promo set) or a book. A number alone does not say which; the catalog tries them in this order.
 */
export type SpecialPartType = "GEAR" | "SET" | "BOOK";

export const SPECIAL_PART_TYPES: readonly SpecialPartType[] = ["GEAR", "SET", "BOOK"];

/**
 * The BrickLink types a figure can be: a minifig, or a part (Big Figs such as the Rancor of 75005
 * are "Large Figure" parts, `11323pb01c01`). The catalog tries them in this order. A figure without
 * a stored type is a minifig.
 */
export type FigureType = "MINIFIG" | "PART";

export const FIGURE_TYPES: readonly FigureType[] = ["MINIFIG", "PART"];

/** Every kind of BrickLink item the app keeps for an object. */
export type BricklinkItemType = FigureType | SpecialPartType;

/** One line of a search: enough to pick the right one. */
export interface CatalogHit {
  kind: CatalogKind;
  /**
   * What `item` takes to read the full entry: a BrickLink number, or for a figure found by name a
   * Rebrickable number ("fig-014663") that `item` turns into a BrickLink number if it can. For a
   * special part and for a figure that is a BrickLink part the type goes first ("GEAR:5010325",
   * "PART:11323pb01c01"), so the entry is read with one call.
   */
  ref: string;
  /** The BrickLink type the number was found under: always for a special part, for a figure only a part. */
  bricklinkType?: BricklinkItemType;
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
  /** `PART` for a Big Fig (a "Large Figure" part); none for a minifig. */
  bricklinkType?: FigureType;
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
  /** The BrickLink type the number was found under (special part; figure: only `PART`); it belongs to `number`. */
  bricklinkType?: BricklinkItemType;
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

/** "GEAR:5010325", "PART:11323pb01c01": a reference with its BrickLink type; a plain number has none. */
export function typedRef(type: BricklinkItemType, number: string): string {
  return `${type}:${number}`;
}

/** The type and number of a reference "GEAR:5010325" if the type is one of `types`; nothing for a plain number. */
export function parseTypedRef<T extends string>(
  ref: string,
  types: readonly T[],
): { type: T; number: string } | undefined {
  const [prefix, ...rest] = ref.split(":");
  const type = types.find((candidate) => candidate === prefix?.toUpperCase());
  const number = rest.join(":");
  return type && number !== "" ? { type, number } : undefined;
}

export const specialPartRef = (type: SpecialPartType, number: string) => typedRef(type, number);

export const parseSpecialPartRef = (ref: string) => parseTypedRef(ref, SPECIAL_PART_TYPES);

/** A figure's reference: "PART:11323pb01c01" or "MINIFIG:sw0194"; a plain number gives nothing. */
export const parseFigureRef = (ref: string) => parseTypedRef(ref, FIGURE_TYPES);

/** Longest search text the function takes. */
export const MAX_QUERY_LENGTH = 100;
