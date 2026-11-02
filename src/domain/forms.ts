// The forms for entering and editing by hand (F4, S8): what the fields hold while typing (texts),
// what is wrong with them, and the object that results. No DOM and no texts of the interface: an
// error is a code that the page turns into words.

import type { CatalogExtras } from "./catalog";
import { originSetFor } from "./inSet";
import { parseMoney } from "./money";
import { cleanFocus } from "./photoFocus";
import { shortSetNumber } from "./showcase";
import type {
  BricklinkType,
  Cents,
  Condition,
  FromSet,
  Id,
  IsoDate,
  LegoSet,
  Manufacturer,
  ManufacturerKind,
  Minifig,
  ModPart,
  ModPosition,
  PhotoFocus,
  SetStatus,
  ShowcaseItem,
  SpecialPart,
  SpecialPartKind,
  Timestamp,
} from "./types";

/** The objects a form enters (dioramas come with P10, wishes with P12). */
export type FormType = ShowcaseItem["type"];

export const FORM_TYPES: readonly FormType[] = ["minifig", "legoSet", "specialPart"];

/** Longest texts the fields take (the whole object may be 32 KB, `rules.ts`). */
export const FIELD_LIMITS = {
  name: 200,
  short: 100,
  theme: 200,
  source: 500,
  note: 5000,
  link: 500,
  links: 20,
} as const;

export const MOD_POSITIONS: readonly ModPosition[] = [
  "head",
  "torso",
  "arms",
  "hands",
  "legs",
  "headgear",
  "accessory",
  "other",
];

/** Everything the fields of every form hold; a form uses the ones its object type has. */
export interface FormValues {
  name: string;
  /** BrickLink number of a figure, set number of a set, number of a special part. */
  number: string;
  manufacturerKind: ManufacturerKind;
  /** The free name of "Andere" and "Custom". */
  manufacturerName: string;
  theme: string;
  condition: Condition;
  status: SetStatus;
  kind: SpecialPartKind;
  year: string;
  pieceCount: string;
  minifigCount: string;
  source: string;
  /** "MM.JJJJ" or "TT.MM.JJJJ". */
  acquired: string;
  purchasePrice: string;
  /** "Stammt aus Set": the set number, linked to the own set that has it. */
  fromSet: string;
  manualValue: string;
  /** One link per line. */
  links: string;
  note: string;
  /** Paths in storage, in order; the first one is the cover. */
  photos: string[];
  /** The point of each photo that matters, by path; none means the middle. */
  photoFocus: Record<string, PhotoFocus>;
  mods: ModPart[];
}

/** The fields that can be wrong, in the order of the page (the focus goes to the first one). */
export type FieldKey =
  | "name"
  | "number"
  | "manufacturerName"
  | "theme"
  | "year"
  | "pieceCount"
  | "minifigCount"
  | "fromSet"
  | "source"
  | "acquired"
  | "purchasePrice"
  | "manualValue"
  | "links"
  | "note";

export type FieldError =
  | "required"
  | "tooLong"
  | "money"
  | "month"
  | "wholeNumber"
  | "year"
  | "url";

export type FormErrors = Partial<Record<FieldKey, FieldError>>;

const ORDER: Readonly<Record<FormType, readonly FieldKey[]>> = {
  minifig: [
    "name",
    "number",
    "manufacturerName",
    "theme",
    "fromSet",
    "source",
    "acquired",
    "purchasePrice",
    "manualValue",
    "links",
    "note",
  ],
  legoSet: [
    "name",
    "number",
    "manufacturerName",
    "theme",
    "year",
    "pieceCount",
    "minifigCount",
    "source",
    "acquired",
    "purchasePrice",
    "manualValue",
    "links",
    "note",
  ],
  specialPart: [
    "name",
    "number",
    "manufacturerName",
    "theme",
    "year",
    "source",
    "acquired",
    "purchasePrice",
    "manualValue",
    "links",
    "note",
  ],
};

/** The fields of a form in page order. */
export function fieldsOf(type: FormType): readonly FieldKey[] {
  return ORDER[type];
}

export function emptyForm(): FormValues {
  return {
    name: "",
    number: "",
    manufacturerKind: "lego",
    manufacturerName: "",
    theme: "",
    condition: "new",
    status: "complete",
    kind: "gwp",
    year: "",
    pieceCount: "",
    minifigCount: "",
    source: "",
    acquired: "",
    purchasePrice: "",
    fromSet: "",
    manualValue: "",
    links: "",
    note: "",
    photos: [],
    photoFocus: {},
    mods: [],
  };
}

/** The address if it is a web address (http or https), else nothing. */
export function webAddress(text: string | undefined): string | undefined {
  if (!text) return undefined;
  try {
    const url = new URL(text.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** "03.2025" → "2025-03-01", "14.03.2025" → "2025-03-14"; anything else (or no real day) nothing. */
export function parseAcquired(text: string): IsoDate | undefined {
  const match = /^(?:(\d{1,2})\.)?(\d{1,2})\.(\d{4})$/.exec(text.trim());
  if (!match) return undefined;
  const day = match[1] === undefined ? 1 : Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < 1900 || year > 2100) return undefined;
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : undefined;
}

/** "2025-03-01" → "03.2025"; a day other than the first keeps it: "14.03.2025". */
export function acquiredText(day: IsoDate | undefined): string {
  const match = day ? /^(\d{4})-(\d{2})-(\d{2})/.exec(day) : null;
  if (!match) return day ?? "";
  return match[3] === "01" ? `${match[2]}.${match[1]}` : `${match[3]}.${match[2]}.${match[1]}`;
}

export function moneyText(cents: Cents | undefined): string {
  if (cents === undefined) return "";
  const euros = Math.floor(cents / 100);
  return `${euros},${String(cents % 100).padStart(2, "0")}`;
}

function manufacturerFields(
  manufacturer: Manufacturer,
): Pick<FormValues, "manufacturerKind" | "manufacturerName"> {
  return {
    manufacturerKind: manufacturer.kind,
    manufacturerName: "name" in manufacturer ? manufacturer.name : "",
  };
}

/** The form of an existing object, for editing. `sets` resolves "Stammt aus Set" for a figure. */
export function formFromItem(item: ShowcaseItem, sets: readonly LegoSet[] = []): FormValues {
  const form: FormValues = {
    ...emptyForm(),
    name: item.name,
    ...manufacturerFields(item.manufacturer),
    theme: item.theme ?? "",
    condition: item.condition,
    source: item.source ?? "",
    acquired: acquiredText(item.acquiredOn),
    purchasePrice: moneyText(item.purchasePrice),
    manualValue: moneyText(item.manualValue?.cents),
    links: item.links.join("\n"),
    note: item.note ?? "",
    photos: [...item.photos],
    photoFocus: { ...item.photoFocus },
  };
  if (item.type === "minifig") {
    const own = sets.find((set) => set.id === item.fromSet?.setId);
    return {
      ...form,
      number: item.bricklinkId ?? "",
      fromSet: item.fromSet?.label ?? (own?.setNumber ? shortSetNumber(own.setNumber) : ""),
      mods: item.mods.map((mod) => ({ ...mod })),
    };
  }
  if (item.type === "legoSet") {
    return {
      ...form,
      number: item.setNumber ?? "",
      status: item.status,
      year: item.year === undefined ? "" : String(item.year),
      pieceCount: item.pieceCount === undefined ? "" : String(item.pieceCount),
      minifigCount: item.minifigCount === undefined ? "" : String(item.minifigCount),
    };
  }
  return {
    ...form,
    number: item.number ?? "",
    kind: item.kind,
    year: item.year === undefined ? "" : String(item.year),
  };
}

/**
 * The form for "Weiteres Exemplar anlegen" (F5): the catalog data of the figure, but not what is
 * special to the copy (condition, origin, price, photos, mods, note).
 */
export function formForCopy(minifig: Minifig, sets: readonly LegoSet[] = []): FormValues {
  const own = formFromItem(minifig, sets);
  return {
    ...emptyForm(),
    name: own.name,
    number: own.number,
    manufacturerKind: own.manufacturerKind,
    manufacturerName: own.manufacturerName,
    theme: own.theme,
    fromSet: own.fromSet,
  };
}

export function tooLong(text: string, max: number): boolean {
  return text.trim().length > max;
}

export function wholeNumber(text: string, min: number, max: number): boolean {
  return /^\d{1,9}$/.test(text.trim()) && Number(text) >= min && Number(text) <= max;
}

/** The links of the field: one per line, empty lines dropped. */
export function linesOf(text: string): string[] {
  return [...new Set(text.split(/\r?\n/).map((line) => line.trim()))].filter((line) => line !== "");
}

/** What is wrong with the fields of the form of this type; nothing wrong gives `{}`. */
export function validateForm(type: FormType, values: FormValues): FormErrors {
  const errors: FormErrors = {};
  const has = (field: FieldKey) => ORDER[type].includes(field);
  const needMoney = (field: "purchasePrice" | "manualValue") => {
    const text = values[field].trim();
    if (text !== "" && parseMoney(text) === undefined) errors[field] = "money";
  };

  if (values.name.trim() === "") errors.name = "required";
  else if (tooLong(values.name, FIELD_LIMITS.name)) errors.name = "tooLong";

  if (tooLong(values.number, FIELD_LIMITS.short)) errors.number = "tooLong";

  const named = values.manufacturerKind === "other" || values.manufacturerKind === "custom";
  if (named && values.manufacturerName.trim() === "") errors.manufacturerName = "required";
  else if (named && tooLong(values.manufacturerName, FIELD_LIMITS.short)) {
    errors.manufacturerName = "tooLong";
  }

  if (tooLong(values.theme, FIELD_LIMITS.theme)) errors.theme = "tooLong";

  if (has("year") && values.year.trim() !== "" && !wholeNumber(values.year, 1900, 2100)) {
    errors.year = "year";
  }
  if (
    has("pieceCount") &&
    values.pieceCount.trim() !== "" &&
    !wholeNumber(values.pieceCount, 0, 1_000_000)
  ) {
    errors.pieceCount = "wholeNumber";
  }
  if (
    has("minifigCount") &&
    values.minifigCount.trim() !== "" &&
    !wholeNumber(values.minifigCount, 0, 1000)
  ) {
    errors.minifigCount = "wholeNumber";
  }

  if (has("fromSet") && tooLong(values.fromSet, FIELD_LIMITS.short)) errors.fromSet = "tooLong";
  if (tooLong(values.source, FIELD_LIMITS.source)) errors.source = "tooLong";
  if (values.acquired.trim() !== "" && parseAcquired(values.acquired) === undefined) {
    errors.acquired = "month";
  }
  needMoney("purchasePrice");
  needMoney("manualValue");

  const links = linesOf(values.links);
  if (links.length > FIELD_LIMITS.links || links.some((link) => link.length > FIELD_LIMITS.link)) {
    errors.links = "tooLong";
  } else if (links.some((link) => webAddress(link) === undefined)) {
    errors.links = "url";
  }
  if (tooLong(values.note, FIELD_LIMITS.note)) errors.note = "tooLong";

  // Only the fields the form shows can be wrong.
  for (const field of Object.keys(errors) as FieldKey[]) {
    if (!has(field)) delete errors[field];
  }
  return errors;
}

/** The first wrong field in the order of the page. */
export function firstError(type: FormType, errors: FormErrors): FieldKey | undefined {
  return ORDER[type].find((field) => errors[field] !== undefined);
}

export interface BuildContext {
  readonly id: Id;
  readonly createdAt: Timestamp;
  /** Today, "YYYY-MM-DD": the day a new estimated value is entered. */
  readonly today: IsoDate;
  /** The own sets, to link "Stammt aus Set". */
  readonly sets: readonly LegoSet[];
  /** The set chosen when several own sets carry the number of "Stammt aus Set". */
  readonly originSetId?: Id | undefined;
  /** The object being edited: what the form does not show (diorama, catalog data …) stays. */
  readonly existing?: ShowcaseItem | undefined;
  /** The catalog data of a new object made from a catalog entry (F2), kept without a field. */
  readonly catalog?: CatalogExtras | undefined;
}

export function trimmed(text: string): string | undefined {
  const value = text.trim();
  return value === "" ? undefined : value;
}

function manufacturerOf(values: FormValues): Manufacturer {
  const kind = values.manufacturerKind;
  return kind === "other" || kind === "custom"
    ? { kind, name: values.manufacturerName.trim() }
    : { kind };
}

/**
 * The object a valid form makes. Fields left empty are not stored. Editing keeps `id`, the time
 * it was created, the estimated value's day if the value is unchanged, and what the form does not
 * show (the diorama of a figure, the catalog's image and figures).
 */
export function buildItem(type: FormType, values: FormValues, context: BuildContext): ShowcaseItem {
  const { existing } = context;
  const purchase = trimmed(values.purchasePrice);
  const manual = trimmed(values.manualValue);
  const manualCents = manual === undefined ? undefined : parseMoney(manual);
  const acquiredOn = trimmed(values.acquired) && parseAcquired(values.acquired);
  const number = trimmed(values.number);
  const theme = trimmed(values.theme);
  const source = trimmed(values.source);
  const note = trimmed(values.note);
  const purchaseCents = purchase === undefined ? undefined : parseMoney(purchase);
  const catalogImageUrl = existing?.catalogImageUrl ?? context.catalog?.imageUrl;
  const photoFocus = cleanFocus(values.photoFocus, values.photos);

  const base = {
    id: context.id,
    name: values.name.trim(),
    manufacturer: manufacturerOf(values),
    condition: values.condition,
    photos: [...values.photos],
    ...(photoFocus ? { photoFocus } : {}),
    links: linesOf(values.links),
    createdAt: existing?.createdAt ?? context.createdAt,
    ...(theme ? { theme } : {}),
    ...(source ? { source } : {}),
    ...(acquiredOn ? { acquiredOn } : {}),
    ...(purchaseCents === undefined ? {} : { purchasePrice: purchaseCents }),
    ...(manualCents === undefined
      ? {}
      : {
          manualValue: {
            cents: manualCents,
            enteredOn:
              existing?.manualValue?.cents === manualCents
                ? existing.manualValue.enteredOn
                : context.today,
          },
        }),
    ...(catalogImageUrl ? { catalogImageUrl } : {}),
    ...(note ? { note } : {}),
  };

  if (type === "minifig") {
    const previous = existing?.type === "minifig" ? existing : undefined;
    const label = trimmed(values.fromSet);
    const own =
      label === undefined
        ? undefined
        : originSetFor(context.sets, label, {
            chosen: context.originSetId,
            current: previous?.fromSet?.setId,
          });
    const fromSet: FromSet | undefined =
      label === undefined ? undefined : { label, ...(own ? { setId: own.id } : {}) };
    // Only a part (a Big Fig) is stored; no type means a minifig. It belongs to the number.
    const bricklinkType = typeOfNumber(number, context.catalog?.bricklink, {
      number: previous?.bricklinkId,
      type: previous?.bricklinkType,
    });
    return {
      ...base,
      type: "minifig",
      mods: values.mods.map((mod) => ({ ...mod })),
      ...(number ? { bricklinkId: number } : {}),
      ...(bricklinkType === "PART" ? { bricklinkType } : {}),
      ...(fromSet ? { fromSet } : {}),
      ...(previous?.dioramaId ? { dioramaId: previous.dioramaId } : {}),
      ...(previous?.standsInSetId !== undefined ? { standsInSetId: previous.standsInSetId } : {}),
    };
  }
  if (type === "legoSet") {
    const previous = existing?.type === "legoSet" ? existing : undefined;
    const year = trimmed(values.year);
    const pieceCount = trimmed(values.pieceCount);
    const minifigCount = trimmed(values.minifigCount);
    return {
      ...base,
      type: "legoSet",
      status: values.status,
      containedFigures: previous?.containedFigures ?? [...(context.catalog?.figures ?? [])],
      ...(number ? { setNumber: number } : {}),
      ...(year ? { year: Number(year) } : {}),
      ...(pieceCount ? { pieceCount: Number(pieceCount) } : {}),
      ...(minifigCount ? { minifigCount: Number(minifigCount) } : {}),
    };
  }
  const previous = existing?.type === "specialPart" ? existing : undefined;
  const year = trimmed(values.year);
  // The BrickLink type belongs to the number it was found under: another number drops it.
  const found = typeOfNumber(number, context.catalog?.bricklink, {
    number: previous?.number,
    type: previous?.bricklinkType,
  });
  const bricklinkType = SPECIAL_TYPES.find((candidate) => candidate === found);
  return {
    ...base,
    type: "specialPart",
    kind: values.kind,
    ...(number ? { number } : {}),
    ...(bricklinkType ? { bricklinkType } : {}),
    ...(year ? { year: Number(year) } : {}),
  };
}

const SPECIAL_TYPES: readonly NonNullable<SpecialPart["bricklinkType"]>[] = ["GEAR", "SET", "BOOK"];

/** Whether two numbers are the same one, without case and surrounding spaces; empty never is. */
function sameNumber(a: string | undefined, b: string | undefined): boolean {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * The BrickLink type for `number`: the one the catalog found it under, or the one the object had,
 * each only as long as the number is the one it was found under. Another number has none.
 */
function typeOfNumber(
  number: string | undefined,
  fromCatalog: { readonly type: BricklinkType; readonly number: string } | undefined,
  previous: { readonly number: string | undefined; readonly type: BricklinkType | undefined },
): BricklinkType | undefined {
  if (sameNumber(fromCatalog?.number, number)) return fromCatalog?.type;
  return sameNumber(previous.number, number) ? previous.type : undefined;
}

/**
 * What "Weiteres Exemplar" keeps of the catalog's data: the BrickLink type of the figure (a Big Fig
 * stays a part), which the form has no field for.
 */
export function extrasForCopy(minifig: Minifig): CatalogExtras | undefined {
  return minifig.bricklinkType && minifig.bricklinkId
    ? { bricklink: { type: minifig.bricklinkType, number: minifig.bricklinkId } }
    : undefined;
}

/** What a part of the mod sheet (S8a) holds while typing. */
export interface ModDraft {
  position: ModPosition | "";
  description: string;
  vendor: string;
  url: string;
  price: string;
  originalPart: string;
}

export type ModField = "position" | "description" | "vendor" | "url" | "price" | "originalPart";
export type ModErrors = Partial<Record<ModField, FieldError>>;

export const MOD_FIELDS: readonly ModField[] = [
  "position",
  "description",
  "vendor",
  "url",
  "price",
  "originalPart",
];

export function emptyMod(): ModDraft {
  return { position: "", description: "", vendor: "", url: "", price: "", originalPart: "" };
}

export function modDraftOf(part: ModPart): ModDraft {
  return {
    position: part.position,
    description: part.description,
    vendor: part.vendor ?? "",
    url: part.url ?? "",
    price: moneyText(part.price),
    originalPart: part.originalPart ?? "",
  };
}

export function validateMod(draft: ModDraft): ModErrors {
  const errors: ModErrors = {};
  if (draft.position === "") errors.position = "required";
  if (draft.description.trim() === "") errors.description = "required";
  else if (tooLong(draft.description, FIELD_LIMITS.name)) errors.description = "tooLong";
  if (tooLong(draft.vendor, FIELD_LIMITS.short)) errors.vendor = "tooLong";
  const url = draft.url.trim();
  if (url !== "" && (url.length > FIELD_LIMITS.link || webAddress(url) === undefined)) {
    errors.url = url.length > FIELD_LIMITS.link ? "tooLong" : "url";
  }
  const price = draft.price.trim();
  if (price !== "" && parseMoney(price) === undefined) errors.price = "money";
  if (tooLong(draft.originalPart, FIELD_LIMITS.short)) errors.originalPart = "tooLong";
  return errors;
}

export function firstModError(errors: ModErrors): ModField | undefined {
  return MOD_FIELDS.find((field) => errors[field] !== undefined);
}

/** The part a valid draft makes; empty fields are not stored. */
export function buildMod(draft: ModDraft, id: Id): ModPart {
  const vendor = trimmed(draft.vendor);
  const url = trimmed(draft.url);
  const price = trimmed(draft.price);
  const priceCents = price === undefined ? undefined : parseMoney(price);
  const originalPart = trimmed(draft.originalPart);
  return {
    id,
    position: draft.position === "" ? "other" : draft.position,
    description: draft.description.trim(),
    ...(vendor ? { vendor } : {}),
    ...(url ? { url } : {}),
    ...(priceCents === undefined ? {} : { price: priceCents }),
    ...(originalPart ? { originalPart } : {}),
  };
}
