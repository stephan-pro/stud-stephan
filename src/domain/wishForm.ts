// The wish sheet (S9a) and the wishes made from a series figure or a set figure (F13, F14): the
// values the sheet holds, their check, the wish a valid sheet makes, and the form "Erhalten" opens
// (S8 filled from the wish). No DOM and no texts of the interface.

import type { CatalogForm } from "./catalog";
import { emptyForm, FIELD_LIMITS, moneyText, tooLong, trimmed } from "./forms";
import { MAX_CENTS, parseMoney } from "./money";
import type { CatalogFigure, Cents, Condition, Id, Priority, Timestamp, WishItem } from "./types";

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

/** What a wish is made from: a figure of a series, a figure of a set, or a set. */
export interface WishSource {
  readonly type: WishItem["type"];
  readonly name: string;
  /** BrickLink number of the figure, or number of the set. */
  readonly number?: string | undefined;
  readonly theme?: string | undefined;
  readonly imageUrl?: string | undefined;
  /** The series it was wished from (F13). */
  readonly fromSeries?: string | undefined;
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
    manufacturer: { kind: "lego" },
    priority: values.priority,
    desiredCondition: values.condition,
    links: [],
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
