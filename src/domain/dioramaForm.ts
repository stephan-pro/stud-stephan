// The form of a diorama (F8, S8 for dioramas): what the fields hold while typing, what is wrong
// with them, and the diorama that results. Like `forms.ts`: no DOM, an error is a code.

import {
  FIELD_LIMITS,
  type FieldError,
  linesOf,
  moneyText,
  tooLong,
  trimmed,
  webAddress,
  wholeNumber,
} from "./forms";
import { parseMoney } from "./money";
import type { Diorama, Id, IsoDate, StudioFile, Timestamp } from "./types";

/** Everything the fields of the diorama form hold. */
export interface DioramaFormValues {
  name: string;
  pieceCount: string;
  /** The value Stephan estimates himself; MOCs have no market value. */
  manualValue: string;
  /** One link per line. */
  links: string;
  note: string;
  /** Paths in storage, in order; the first one is the cover. */
  photos: string[];
  studioFiles: StudioFile[];
}

/** The fields that can be wrong, in the order of the page. */
export type DioramaFieldKey = "name" | "pieceCount" | "manualValue" | "links" | "note";

export type DioramaFormErrors = Partial<Record<DioramaFieldKey, FieldError>>;

const ORDER: readonly DioramaFieldKey[] = ["name", "pieceCount", "manualValue", "links", "note"];

export function emptyDioramaForm(): DioramaFormValues {
  return {
    name: "",
    pieceCount: "",
    manualValue: "",
    links: "",
    note: "",
    photos: [],
    studioFiles: [],
  };
}

/** The form of an existing diorama, for editing. */
export function formFromDiorama(diorama: Diorama): DioramaFormValues {
  return {
    name: diorama.name,
    pieceCount: diorama.pieceCount === undefined ? "" : String(diorama.pieceCount),
    manualValue: moneyText(diorama.manualValue?.cents),
    links: diorama.links.join("\n"),
    note: diorama.note ?? "",
    photos: [...diorama.photos],
    studioFiles: diorama.studioFiles.map((file) => ({ ...file })),
  };
}

/** What is wrong with the fields; nothing wrong gives `{}`. */
export function validateDioramaForm(values: DioramaFormValues): DioramaFormErrors {
  const errors: DioramaFormErrors = {};
  if (values.name.trim() === "") errors.name = "required";
  else if (tooLong(values.name, FIELD_LIMITS.name)) errors.name = "tooLong";

  const pieces = values.pieceCount.trim();
  if (pieces !== "" && !wholeNumber(pieces, 0, 1_000_000)) errors.pieceCount = "wholeNumber";

  const value = values.manualValue.trim();
  if (value !== "" && parseMoney(value) === undefined) errors.manualValue = "money";

  const links = linesOf(values.links);
  if (links.length > FIELD_LIMITS.links || links.some((link) => link.length > FIELD_LIMITS.link)) {
    errors.links = "tooLong";
  } else if (links.some((link) => webAddress(link) === undefined)) {
    errors.links = "url";
  }
  if (tooLong(values.note, FIELD_LIMITS.note)) errors.note = "tooLong";
  return errors;
}

/** The first wrong field in the order of the page. */
export function firstDioramaError(errors: DioramaFormErrors): DioramaFieldKey | undefined {
  return ORDER.find((field) => errors[field] !== undefined);
}

export interface DioramaBuildContext {
  readonly id: Id;
  readonly createdAt: Timestamp;
  /** Today, "YYYY-MM-DD": the day a new estimated value is entered. */
  readonly today: IsoDate;
  /** The diorama being edited: it keeps its time of creation and its value's day if unchanged. */
  readonly existing?: Diorama | undefined;
}

/** The diorama a valid form makes. Fields left empty are not stored. */
export function buildDiorama(values: DioramaFormValues, context: DioramaBuildContext): Diorama {
  const { existing } = context;
  const pieces = trimmed(values.pieceCount);
  const value = trimmed(values.manualValue);
  const cents = value === undefined ? undefined : parseMoney(value);
  const note = trimmed(values.note);
  return {
    type: "diorama",
    id: context.id,
    name: values.name.trim(),
    photos: [...values.photos],
    links: linesOf(values.links),
    studioFiles: values.studioFiles.map((file) => ({ ...file })),
    createdAt: existing?.createdAt ?? context.createdAt,
    ...(pieces ? { pieceCount: Number(pieces) } : {}),
    ...(cents === undefined
      ? {}
      : {
          manualValue: {
            cents,
            enteredOn:
              existing?.manualValue?.cents === cents
                ? existing.manualValue.enteredOn
                : context.today,
          },
        }),
    ...(note ? { note } : {}),
  };
}
