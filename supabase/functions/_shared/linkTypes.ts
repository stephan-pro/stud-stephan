// What the Edge Function `link-preview` answers (P9). Shared by the function and by the app, which
// only imports the types.

import type { CatalogKind } from "./catalogTypes.ts";

/** What was read from a page: only what could be recognised; every field may be missing. */
export interface PageFields {
  name?: string;
  manufacturer?: string;
  setNumber?: string;
  pieceCount?: number;
  /** An https address of a picture; the page is not downloaded further, the picture never. */
  imageUrl?: string;
}

export type LinkAnswer =
  /** An address of Rebrickable or BrickLink: no page is read, the catalog fills the form (P7). */
  | {
      kind: "catalog";
      source: "rebrickable" | "bricklink";
      catalogKind: CatalogKind;
      /** What the function `catalog` takes as `ref`: a set number or a figure number. */
      ref: string;
    }
  /** Any other page, read once. */
  | { kind: "page"; source: "merlin" | "page"; fields: PageFields };

/**
 * Why a call failed. `blocked` = the address is not one the function may fetch (not a public web
 * page), `unreachable` = the page did not answer in the allowed time, size or form.
 */
export type LinkFailure =
  | "bad_request"
  | "not_signed_in"
  | "blocked"
  | "unreachable"
  | "unavailable";

/** A call that failed in a way the person can be told about. */
export class LinkError extends Error {
  constructor(
    readonly failure: "blocked" | "unreachable",
    message: string,
  ) {
    super(message);
    this.name = "LinkError";
  }
}

/** Longest address the function takes. */
export const MAX_LINK_LENGTH = 2000;
