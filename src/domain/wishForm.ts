// The wish sheet (S9a) and the wishes made from a series figure or a set figure (F13, F14): the
// values the sheet holds, their check, the wish a valid sheet makes, and the form "Erhalten" opens
// (S8 filled from the wish). No DOM and no texts of the interface.

import type { CatalogItem } from "../backend/catalog";
import type { PageFields } from "../backend/linkPreview";
import { type CatalogForm, formFromCatalog } from "./catalog";
import { emptyForm, FIELD_LIMITS, moneyText, tooLong, trimmed } from "./forms";
import { manufacturerFromName } from "./linkForm";
import { MAX_CENTS, parseMoney } from "./money";
import { shortSetNumber } from "./showcase";
import type {
  CatalogFigure,
  Cents,
  Condition,
  Id,
  Manufacturer,
  Priority,
  Timestamp,
  WishItem,
} from "./types";

/** Everything the sheet holds while typing. */
export interface WishValues {
  priority: Priority;
  /** "20,00" or "20,00 €"; empty = no target price. */
  targetPrice: string;
  condition: Condition;
  note: string;
}

export type WishField = "targetPrice" | "note";
export type WishError = "money" | "tooLong";
export type WishErrors = Partial<Record<WishField, WishError>>;

export const PRIORITIES: readonly Priority[] = ["high", "medium", "low"];

/** What a new wish starts with: medium, and the condition most people want (sets new, figures used). */
export function newWishValues(type: WishItem["type"]): WishValues {
  return {
    priority: "medium",
    targetPrice: "",
    condition: type === "legoSet" ? "new" : "used",
    note: "",
  };
}

export function wishValuesOf(wish: WishItem): WishValues {
  return {
    priority: wish.priority,
    targetPrice: moneyText(wish.targetPrice),
    condition: wish.desiredCondition,
    note: wish.note ?? "",
  };
}

/** The target price as cents; nothing for an empty text or one that is not an amount. */
export function targetCents(values: WishValues): Cents | undefined {
  const text = trimmed(values.targetPrice);
  return text === undefined ? undefined : parseMoney(text);
}

/** What is wrong with the sheet; nothing wrong gives `{}`. An empty target price is fine. */
export function validateWish(values: WishValues): WishErrors {
  const errors: WishErrors = {};
  const price = trimmed(values.targetPrice);
  if (price !== undefined) {
    const cents = parseMoney(price);
    if (cents === undefined || cents > MAX_CENTS) errors.targetPrice = "money";
  }
  if (tooLong(values.note, FIELD_LIMITS.note)) errors.note = "tooLong";
  return errors;
}

/** The wish with the values of a valid sheet; the rest of the wish stays as it was. */
export function withWishValues(wish: WishItem, values: WishValues): WishItem {
  const { targetPrice: _, note: __, ...rest } = wish;
  const cents = targetCents(values);
  const note = trimmed(values.note);
  return {
    ...rest,
    priority: values.priority,
    desiredCondition: values.condition,
    ...(cents === undefined ? {} : { targetPrice: cents }),
    ...(note ? { note } : {}),
  };
}

/**
 * What a wish is made from: a figure of a series, a figure of a set, a set, or (P15) a catalog entry
 * or a page found by number, search or link in the capture sheet.
 */
export interface WishSource {
  readonly type: WishItem["type"];
  readonly name: string;
  /** BrickLink number of the figure, or number of the set. */
  readonly number?: string | undefined;
  readonly theme?: string | undefined;
  readonly imageUrl?: string | undefined;
  /** The series it was wished from (F13). */
  readonly fromSeries?: string | undefined;
  /** LEGO unless a page named another manufacturer. */
  readonly manufacturer?: Manufacturer | undefined;
  /** The pasted link the wish was found by. */
  readonly links?: readonly string[] | undefined;
}

/** A catalog entry (number or search, F2) as a wish; `link` when it was reached by a pasted link. */
export function wishSourceOfItem(item: CatalogItem, link?: string): WishSource {
  return {
    type: item.kind,
    name: item.name,
    number: item.number === "" ? undefined : item.number,
    theme: item.theme,
    imageUrl: item.imageUrl,
    links: link ? [link] : [],
  };
}

/**
 * What a page (F3) gave, as a wish. Without a name the page's host stands in (the wish needs one);
 * a number on the page counts for sets only, as in the form.
 */
export function wishSourceOfPage(
  type: WishItem["type"],
  fields: PageFields,
  link: string,
): WishSource {
  let host = link;
  try {
    host = new URL(link).hostname;
  } catch {
    // The link stays the name.
  }
  return {
    type,
    name: fields.name ?? host,
    number: type === "legoSet" ? fields.setNumber : undefined,
    imageUrl: fields.imageUrl,
    manufacturer: fields.manufacturer ? manufacturerFromName(fields.manufacturer) : undefined,
    links: [link],
  };
}

export function wishSourceOfFigure(
  figure: CatalogFigure,
  context: { readonly theme?: string | undefined; readonly fromSeries?: string | undefined } = {},
): WishSource {
  return {
    type: "minifig",
    name: figure.name,
    number: figure.bricklinkId,
    imageUrl: figure.imageUrl,
    theme: context.theme,
    fromSeries: context.fromSeries,
  };
}

/** A new wish for a source with the values of a valid sheet. */
export function newWish(
  source: WishSource,
  values: WishValues,
  context: { readonly id: Id; readonly createdAt: Timestamp },
): WishItem {
  const number = trimmed(source.number ?? "");
  const wish: WishItem = {
    id: context.id,
    type: source.type,
    name: source.name,
    manufacturer: source.manufacturer ?? { kind: "lego" },
    priority: values.priority,
    desiredCondition: values.condition,
    links: [...(source.links ?? [])],
    createdAt: context.createdAt,
    ...(number === undefined
      ? {}
      : source.type === "minifig"
        ? { bricklinkId: number }
        : { setNumber: number }),
    ...(source.theme ? { theme: source.theme } : {}),
    ...(source.imageUrl ? { imageUrl: source.imageUrl } : {}),
    ...(source.fromSeries ? { fromSeries: source.fromSeries } : {}),
  };
  return withWishValues(wish, values);
}

const same = (a: string | undefined, b: string | undefined) =>
  a !== undefined && b !== undefined && a.trim().toLowerCase() === b.trim().toLowerCase();

/** The wish for this figure (by BrickLink number), if there is one. */
export function wishForFigure(
  wishlist: readonly WishItem[],
  bricklinkId: string | undefined,
): WishItem | undefined {
  return wishlist.find((wish) => wish.type === "minifig" && same(wish.bricklinkId, bricklinkId));
}

/**
 * The wish a new one from `source` would repeat: the same kind and number (a set number with or
 * without "-1"). Without a number nothing counts as the same.
 */
export function wishForSource(
  wishlist: readonly WishItem[],
  source: WishSource,
): WishItem | undefined {
  if (source.type === "minifig") return wishForFigure(wishlist, source.number);
  const number = source.number === undefined ? undefined : shortSetNumber(source.number);
  return wishlist.find(
    (wish) =>
      wish.type === "legoSet" &&
      wish.setNumber !== undefined &&
      same(shortSetNumber(wish.setNumber), number),
  );
}

/** The form "Erhalten" opens (S8): the wish's data in the fields, shown as taken over. */
export function formFromWish(wish: WishItem): CatalogForm {
  const values = emptyForm();
  const prefilled: CatalogForm["prefilled"][number][] = [];
  const fill = (field: "name" | "number" | "theme" | "links" | "note", value: string) => {
    if (value === "") return;
    values[field] = value;
    prefilled.push(field);
  };
  fill("name", wish.name);
  fill("number", (wish.type === "minifig" ? wish.bricklinkId : wish.setNumber) ?? "");
  fill("theme", wish.theme ?? "");
  fill("links", wish.links.join("\n"));
  fill("note", wish.note ?? "");
  values.condition = wish.desiredCondition;
  values.manufacturerKind = wish.manufacturer.kind;
  values.manufacturerName = "name" in wish.manufacturer ? wish.manufacturer.name : "";
  return {
    values,
    prefilled,
    extras: wish.imageUrl ? { imageUrl: wish.imageUrl } : {},
    sets: [],
    numberMissing: false,
    origin: "wish",
  };
}

/**
 * "Erhalten" for a set (P15): the form from the wish plus what the catalog adds like for a set from
 * the catalog: its figures (F7), year, pieces, number of figures and, if the wish has none, the
 * picture. What the wish says (name, number, theme, links, note) stays.
 */
export function withCatalogEntry(form: CatalogForm, item: CatalogItem): CatalogForm {
  const catalog = formFromCatalog(item);
  const values = { ...form.values };
  const prefilled = [...form.prefilled];
  for (const field of ["year", "pieceCount", "minifigCount", "fromSet"] as const) {
    if (values[field] === "" && catalog.values[field] !== "") {
      values[field] = catalog.values[field];
      prefilled.push(field);
    }
  }
  return {
    ...form,
    values,
    prefilled,
    extras: {
      ...catalog.extras,
      ...form.extras,
    },
    sets: catalog.sets,
  };
}
