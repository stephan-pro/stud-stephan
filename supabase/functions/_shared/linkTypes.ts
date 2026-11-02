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
  /**
   * An address of Rebrickable, BrickLink or a LEGO.com product page: no page is read, the catalog
   * fills the form (P7). A LEGO.com address gives `specialPart` with the plain product number; the
   * app asks for a set instead where a set is being captured.
   */
  | {
      kind: "catalog";
      source: "rebrickable" | "bricklink" | "lego";
      catalogKind: CatalogKind;
      /**
       * What the function `catalog` takes as `ref`: a set number, a figure number, a special part's
       * number with or without its BrickLink type ("GEAR:5010325").
       */
      ref: string;
    }
  /** Any other page, read once. */
  | { kind: "page"; source: "merlin" | "page"; fields: PageFields };

/**
 * The one picture of a page, for the call `{image: <address>}`: the bytes as base64 (the function
 * answers JSON like everywhere else), with the type the first bytes proved.
 */
export interface LinkImageAnswer {
  kind: "image";
  contentType: "image/jpeg" | "image/png" | "image/webp";
  /** The picture's bytes, base64. At most 3 MB, so at most about 4 MB of text. */
  data: string;
}

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
