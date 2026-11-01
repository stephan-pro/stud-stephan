// What the Edge Function `recognize` answers (P8). Shared by the function and by the app, which only
// imports the types.

/** One guess of the photo recognition: enough to pick the right figure. */
export interface Suggestion {
  /** BrickLink number of the figure, e.g. "coltlbm28"; it opens the catalog entry. */
  number: string;
  name: string;
  /** How sure the service is, 0 to 1. */
  score: number;
  imageUrl?: string;
}

export interface RecognizeAnswer {
  /** Best first, at most `MAX_SUGGESTIONS`; empty if nothing was recognized. */
  suggestions: Suggestion[];
}

/** The most suggestions the app shows (S7a). Brickognize answered with one in P2, so fewer is normal. */
export const MAX_SUGGESTIONS = 5;

/** The app sends the photo made small (a few hundred KB); anything far bigger is not from the app. */
export const MAX_PHOTO_BYTES = 3_000_000;
