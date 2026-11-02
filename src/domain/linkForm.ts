// What a pasted link (F3) fills into a form: the fields read from the page, which of them are
// shown highlighted, and what the page does not give ("bitte ergänzen"). No DOM and no texts of
// the interface.

import type { CatalogKind } from "../backend/catalog";
import type { LinkAnswer, PageFields } from "../backend/linkPreview";
import type { CatalogForm } from "./catalog";
import { emptyForm, type FieldKey, type FormType, type FormValues, fieldsOf } from "./forms";
import type { Manufacturer } from "./types";

/** The rows of the card "Erkannt" (S7c), in order. */
export type LinkRowKey = "name" | "manufacturer" | "number" | "pieceCount" | "image";

export interface LinkRow {
  readonly key: LinkRowKey;
  /** What was read, as text; nothing if the page did not give it ("bitte ergänzen"). */
  readonly value: string | undefined;
}

/** The catalog entry a recognised address leads to. */
export interface CatalogTarget {
  readonly catalogKind: CatalogKind;
  /** What the function `catalog` takes as `ref`. */
  readonly ref: string;
}

/** "75372" → "75372-1": both catalogs number the first edition of a set with "-1". */
function setRef(number: string): string {
  return number.includes("-") ? number : `${number}-1`;
}

/**
 * Where a recognised Rebrickable, BrickLink or LEGO.com address leads, given what is being captured
 * (`type`) and whether it is for a wish. The address alone does not always say: a LEGO.com product
 * page is a set where a set is captured (or wished) and a special part otherwise; a BrickLink set
 * address (`?S=`) is a special part where one is captured, because GWPs and promotional polybags
 * are sets at BrickLink.
 */
export function catalogTarget(
  answer: Extract<LinkAnswer, { kind: "catalog" }>,
  type: FormType,
  forWish = false,
): CatalogTarget {
  if (answer.source === "lego") {
    return forWish || type === "legoSet"
      ? { catalogKind: "legoSet", ref: setRef(answer.ref) }
      : { catalogKind: "specialPart", ref: answer.ref };
  }
  if (answer.source === "bricklink" && answer.catalogKind === "legoSet" && type === "specialPart") {
    return { catalogKind: "specialPart", ref: `SET:${answer.ref}` };
  }
  return { catalogKind: answer.catalogKind, ref: answer.ref };
}

/** The number of a reference without its BrickLink type: "GEAR:5010325" → "5010325". */
export function numberOfRef(ref: string): string {
  const colon = ref.indexOf(":");
  return colon < 0 ? ref : ref.slice(colon + 1);
}

/** The rows for `type`: only what the form of that kind has a field for. */
export function linkRows(type: FormType, fields: PageFields): LinkRow[] {
  const shown = fieldsOf(type);
  const rows: LinkRow[] = [
    { key: "name", value: fields.name },
    { key: "manufacturer", value: fields.manufacturer },
  ];
  if (shown.includes("number")) rows.push({ key: "number", value: fields.setNumber });
  if (shown.includes("pieceCount")) {
    rows.push({
      key: "pieceCount",
      value: fields.pieceCount?.toLocaleString("de-DE"),
    });
  }
  rows.push({ key: "image", value: fields.imageUrl });
  return rows;
}

/** Whether the page gave anything at all. */
export function hasFields(fields: PageFields): boolean {
  return (
    fields.name !== undefined ||
    fields.manufacturer !== undefined ||
    fields.setNumber !== undefined ||
    fields.pieceCount !== undefined ||
    fields.imageUrl !== undefined
  );
}

/** The manufacturer for a name from a page: the known ones by kind, else named. */
export function manufacturerFromName(name: string): Manufacturer {
  if (/^bluebrixx$/i.test(name.trim())) return { kind: "bluebrixx" };
  if (/^lego$/i.test(name.trim())) return { kind: "lego" };
  return { kind: "other", name };
}

/** The same as the two fields of the form. */
function manufacturerOf(name: string): Pick<FormValues, "manufacturerKind" | "manufacturerName"> {
  const manufacturer = manufacturerFromName(name);
  return {
    manufacturerKind: manufacturer.kind,
    manufacturerName: "name" in manufacturer ? manufacturer.name : "",
  };
}

/**
 * The form to start from for a link. The address always ends up in the links of the object; what
 * the page gave fills the fields (highlighted), the rest stays empty for the person to enter.
 * `fields` is empty where the page could not be read: the form is empty but for the link.
 */
export function formFromLink(type: FormType, address: string, fields: PageFields): CatalogForm {
  const values = emptyForm();
  const prefilled: FieldKey[] = [];
  const shown = fieldsOf(type);
  values.links = address;

  if (fields.name) {
    values.name = fields.name;
    prefilled.push("name");
  }
  if (fields.manufacturer) {
    Object.assign(values, manufacturerOf(fields.manufacturer));
    if (values.manufacturerKind === "other") prefilled.push("manufacturerName");
  }
  if (fields.setNumber && shown.includes("number")) {
    values.number = fields.setNumber;
    prefilled.push("number");
  }
  if (fields.pieceCount !== undefined && shown.includes("pieceCount")) {
    values.pieceCount = String(fields.pieceCount);
    prefilled.push("pieceCount");
  }
  return {
    values,
    prefilled,
    extras: fields.imageUrl ? { imageUrl: fields.imageUrl } : {},
    sets: [],
    numberMissing: false,
    origin: "link",
  };
}
