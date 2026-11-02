// `link-preview` (P9, F3): what a pasted address gives. Rebrickable, BrickLink and LEGO.com product
// addresses are not fetched at all: the number in the address goes to the catalog (P7), which fills
// the form (BrickLink gear and books and LEGO.com products are special parts or sets). The
// Merlins Steine page is read once; any other page gives its title and picture (Open Graph).
// Nothing of a page is passed on except the few fields below; the page itself is never returned.

import { specialPartRef } from "./catalogTypes.ts";
import type { LinkAnswer, PageFields } from "./linkTypes.ts";
import { extractPreview, extractSetPage } from "./pageParser.ts";
import {
  checkAddress,
  type FetchedImage,
  fetchImage,
  fetchPage,
  type PageDeps,
} from "./safeFetch.ts";

/** The longest texts the form takes (`FIELD_LIMITS` in `src/domain/forms.ts`): a longer one would be refused there. */
const FIELD_LIMITS = { name: 200, short: 100, link: 500 } as const;

function hostIs(url: URL, domain: string): boolean {
  const host = url.hostname.toLowerCase();
  return host === domain || host === `www.${domain}`;
}

const SET_NUMBER = /^[A-Za-z0-9]{1,12}-\d{1,3}$/;
const BRICKLINK_NUMBER = /^[A-Za-z0-9._-]{1,50}$/;

/**
 * The catalog entry a Rebrickable or BrickLink address names, if it is one of those. Only the
 * address is read: `/sets/75372-1/…`, `/minifigs/fig-014663/…` (Rebrickable) and `?S=75372-1` or
 * `?M=sw0194` (BrickLink catalog page).
 */
export function catalogLink(url: URL): Extract<LinkAnswer, { kind: "catalog" }> | undefined {
  if (hostIs(url, "rebrickable.com")) {
    const [section, id] = url.pathname.split("/").filter(Boolean);
    if (section === "sets" && id && SET_NUMBER.test(id)) {
      return { kind: "catalog", source: "rebrickable", catalogKind: "legoSet", ref: id };
    }
    if (section === "minifigs" && id && /^fig-\d+$/i.test(id)) {
      return { kind: "catalog", source: "rebrickable", catalogKind: "minifig", ref: id };
    }
    return undefined;
  }
  if (hostIs(url, "bricklink.com") && /catalogitem\.(page|asp)$/i.test(url.pathname)) {
    const set = url.searchParams.get("S");
    const figure = url.searchParams.get("M");
    const gear = url.searchParams.get("G");
    const book = url.searchParams.get("B");
    if (set && BRICKLINK_NUMBER.test(set)) {
      // BrickLink writes "75372-1"; a number without the part after the dash means the first.
      const ref = set.includes("-") ? set : `${set}-1`;
      return { kind: "catalog", source: "bricklink", catalogKind: "legoSet", ref };
    }
    if (figure && BRICKLINK_NUMBER.test(figure)) {
      return { kind: "catalog", source: "bricklink", catalogKind: "minifig", ref: figure };
    }
    // Gear and books are special parts; the address says the type, so the catalog asks that one.
    if (gear && BRICKLINK_NUMBER.test(gear)) {
      return {
        kind: "catalog",
        source: "bricklink",
        catalogKind: "specialPart",
        ref: specialPartRef("GEAR", gear),
      };
    }
    if (book && BRICKLINK_NUMBER.test(book)) {
      return {
        kind: "catalog",
        source: "bricklink",
        catalogKind: "specialPart",
        ref: specialPartRef("BOOK", book),
      };
    }
  }
  if (hostIs(url, "lego.com")) {
    // A product page ends in the product number: ".../product/the-mandalorian-and-grogu-metal-card-5010325".
    // It does not say whether it is gear, a set or a book: the plain number goes to the catalog,
    // which tries the BrickLink types (the app turns it into a set number for a set).
    const parts = url.pathname.split("/").filter(Boolean);
    const slug = parts[parts.indexOf("product") + 1];
    const number =
      parts.includes("product") && slug ? /(?:^|-)(\d{4,7})$/.exec(slug)?.[1] : undefined;
    if (number) {
      return { kind: "catalog", source: "lego", catalogKind: "specialPart", ref: number };
    }
  }
  return undefined;
}

/** Only an https picture address goes on, and only a sensible one; the picture is not fetched. */
function secureImage(address: string | undefined): string | undefined {
  if (address === undefined || address.length > FIELD_LIMITS.link) return undefined;
  try {
    const url = new URL(address);
    return url.protocol === "https:" && url.username === "" && url.password === ""
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

/** A text cut to the form's limit; nothing for an empty one. */
function limited(text: string | undefined, max: number): string | undefined {
  const trimmed = text?.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function cleaned(fields: {
  name?: string | undefined;
  manufacturer?: string | undefined;
  setNumber?: string | undefined;
  pieceCount?: number | undefined;
  imageUrl?: string | undefined;
}): PageFields {
  const result: PageFields = {};
  const name = limited(fields.name, FIELD_LIMITS.name);
  const manufacturer = limited(fields.manufacturer, FIELD_LIMITS.short);
  const setNumber = limited(fields.setNumber, FIELD_LIMITS.short);
  const imageUrl = secureImage(fields.imageUrl);
  if (name) result.name = name;
  if (manufacturer) result.manufacturer = manufacturer;
  if (setNumber) result.setNumber = setNumber;
  if (fields.pieceCount !== undefined && fields.pieceCount <= 1_000_000) {
    result.pieceCount = fields.pieceCount;
  }
  if (imageUrl) result.imageUrl = imageUrl;
  return result;
}

/**
 * The picture at an address (a page's `og:image`), under the same checks as a page: sign-in done by
 * the handler, public addresses only, redirects checked, 10 s, at most 3 MB, JPEG, PNG or WebP.
 * Throws `LinkError` for an address or picture that is not usable.
 */
export async function fetchLinkImage(deps: PageDeps, address: string): Promise<FetchedImage> {
  return fetchImage(deps, checkAddress(address));
}

/** What the pasted address gives; throws `LinkError` for an address or page that is not usable. */
export async function previewLink(deps: PageDeps, address: string): Promise<LinkAnswer> {
  const url = checkAddress(address);
  const known = catalogLink(url);
  if (known) return known;

  const { html, url: page } = await fetchPage(deps, url);
  if (hostIs(page, "merlinssteine.de")) {
    return {
      kind: "page",
      source: "merlin",
      fields: cleaned(extractSetPage(html, page.href).fields),
    };
  }
  return { kind: "page", source: "page", fields: cleaned(extractPreview(html, page.href)) };
}
