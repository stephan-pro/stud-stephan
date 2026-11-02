// What the Edge Function `recognize` answers (P8, extended to sets, big figs and special parts).
// Shared by the function and by the app, which only imports the types.

/** What the photo shows, as the person said when they chose the way: the function asks accordingly. */
export type RecognizeKind = "minifig" | "legoSet" | "specialPart";

export const RECOGNIZE_KINDS: readonly RecognizeKind[] = ["minifig", "legoSet", "specialPart"];

/** The header of the request that says the kind; a request without it is about a figure (P8). */
export const RECOGNIZE_KIND_HEADER = "x-recognize-kind";

/** One guess of the photo recognition: enough to pick the right one. */
export interface Suggestion {
  /** BrickLink number, e.g. "coltlbm28" (figure), "75005-1" (set) or "5010325" (special part). */
  number: string;
  name: string;
  /** How sure the service is, 0 to 1. */
  score: number;
  imageUrl?: string;
  /**
   * What opens the catalog entry when it is more than the number: "PART:11323pb01c01" for a part
   * BrickLink lists as a part (a Big Fig), "SET:5010325-1" for a special part that is a set.
   */
  ref?: string;
  /** Set where BrickLink lists the figure as a part (Big Fig such as the Rancor). */
  bricklinkType?: "PART";
}

export interface RecognizeAnswer {
  /** Best first, at most `MAX_SUGGESTIONS`; empty if nothing was recognized. */
  suggestions: Suggestion[];
}

/** The most suggestions the app shows (S7a). Brickognize answered with one in P2, so fewer is normal. */
export const MAX_SUGGESTIONS = 5;

/** A figure guess below this is not good: the function also asks for parts (Big Figs). */
export const GOOD_SCORE = 0.5;

/** The app sends the photo made small (a few hundred KB); anything far bigger is not from the app. */
export const MAX_PHOTO_BYTES = 3_000_000;
