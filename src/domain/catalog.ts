// What a catalog entry (F2) fills into a form: the fields, which of them came from the catalog
// ("Grüne Felder kommen aus dem Katalog"), and the catalog data the form does not show (the
// picture, the figures of a set). No DOM and no texts of the interface.

import type { CatalogItem, CatalogSetInfo } from "../backend/catalog";
import { emptyForm, type FieldKey, type FormValues } from "./forms";
import { shortSetNumber } from "./showcase";
import type { BricklinkType, CatalogFigure } from "./types";

/** The catalog data an object keeps without a field for it. */
export interface CatalogExtras {
  readonly imageUrl?: string;
  readonly figures?: readonly CatalogFigure[];
  /**
   * The BrickLink type and the number it was found under, for a special part (gear, set, book) and
   * for a figure that is a part (Big Fig); they give the price.
   */
  readonly bricklink?: { readonly type: BricklinkType; readonly number: string };
}

export interface CatalogForm {
  readonly values: FormValues;
  /** The fields filled from the catalog, shown highlighted. */
  readonly prefilled: readonly FieldKey[];
  readonly extras: CatalogExtras;
  /** The sets a figure comes in (hint at "Stammt aus Set"); empty for sets. */
  readonly sets: readonly CatalogSetInfo[];
  /** A figure the catalog knows by name only: its BrickLink number is for the person to type. */
  readonly numberMissing: boolean;
  /**
   * Where the entries came from: the catalog (F2), a pasted link (F3) or a wish that was fulfilled
   * (F14); it words the hints.
   */
  readonly origin: "catalog" | "link" | "wish";
}

/** The figures of a set as the object keeps them. */
export function containedFigures(item: CatalogItem): CatalogFigure[] {
  return (item.figures ?? []).map((figure) => ({
    name: figure.name,
    bricklinkId: figure.number,
    quantity: figure.quantity,
    ...(figure.imageUrl ? { imageUrl: figure.imageUrl } : {}),
    ...(figure.bricklinkType === "PART" ? { bricklinkType: "PART" as const } : {}),
  }));
}

/**
 * The form to start from for a catalog entry; the person adds condition, origin, price, photos.
 * `link` is the address the entry was reached from (F3), kept with the object.
 */
export function formFromCatalog(item: CatalogItem, link?: string): CatalogForm {
  const values = emptyForm();
  const prefilled: FieldKey[] = [];
  if (link) values.links = link;
  const fill = (field: FieldKey & keyof FormValues, value: string | number | undefined) => {
    if (value === undefined || value === "") return;
    (values[field] as string) = String(value);
    prefilled.push(field);
  };

  fill("name", item.name);
  fill("number", item.number);
  fill("theme", item.theme);
  if (item.kind === "legoSet") {
    fill("year", item.year);
    fill("pieceCount", item.pieceCount);
    if (item.figures) {
      fill(
        "minifigCount",
        item.figures.reduce((sum, figure) => sum + figure.quantity, 0),
      );
    }
  } else if (item.kind === "specialPart") {
    fill("year", item.year);
  } else if (item.sets?.length === 1 && item.sets[0]) {
    fill("fromSet", shortSetNumber(item.sets[0].number));
  }

  return {
    values,
    prefilled,
    extras: {
      ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
      ...(item.kind === "legoSet" ? { figures: containedFigures(item) } : {}),
      // The type belongs to the number: a special part's gear/set/book, a Big Fig's part.
      ...(item.kind !== "legoSet" && item.bricklinkType && item.number
        ? { bricklink: { type: item.bricklinkType, number: item.number } }
        : {}),
    },
    sets: item.kind === "minifig" ? (item.sets ?? []) : [],
    numberMissing: item.kind === "minifig" && item.number === "",
    origin: "catalog",
  };
}
