import { useState } from "preact/hooks";
import {
  buildMod,
  emptyMod,
  firstModError,
  MOD_POSITIONS,
  type ModDraft,
  type ModErrors,
  type ModField,
  modDraftOf,
  validateMod,
} from "../../domain/forms";
import type { ModPart } from "../../domain/types";
import { TEXTS } from "../texts";
import { Choice, fieldId, TextField } from "./Fields";
import { Sheet } from "./Sheet";

const T = TEXTS.mod;
const PREFIX = "mod";

interface ModSheetProps {
  /** The part being changed; none adds a new one. */
  readonly part?: ModPart | undefined;
  /** Makes the id of a new part. */
  readonly newId: () => string;
  readonly onSave: (part: ModPart) => void;
  readonly onClose: () => void;
}

function focusField(field: ModField): void {
  const element = document.getElementById(fieldId(PREFIX, field));
  const target = field === "position" ? element?.querySelector("button") : element;
  (target as HTMLElement | null | undefined)?.focus();
}

/**
 * S8a: one swapped part of a figure (position, description, vendor, link, price, where the
 * original went). A bottom sheet on the phone, a side panel on the PC.
 */
export function ModSheet({ part, newId, onSave, onClose }: ModSheetProps) {
  const [draft, setDraft] = useState<ModDraft>(part ? modDraftOf(part) : emptyMod());
  const [errors, setErrors] = useState<ModErrors>({});
  const set = (fields: Partial<ModDraft>) => setDraft((current) => ({ ...current, ...fields }));
  const message = (field: ModField) => {
    const error = errors[field];
    if (!error) return undefined;
    return field === "position" ? T.positionRequired : TEXTS.form.errors[error];
  };

  return (
    <Sheet
      id="mod"
      title={part ? T.titleEdit : T.titleNew}
      closeLabel={T.close}
      onClose={onClose}
      footer={(close) => (
        <>
          <button type="button" class="button button--secondary pressable" onClick={close}>
            {T.cancel}
          </button>
          <button
            type="button"
            class="button button--primary pressable"
            onClick={() => {
              const found = validateMod(draft);
              setErrors(found);
              const first = firstModError(found);
              if (first) {
                focusField(first);
                return;
              }
              onSave(buildMod(draft, part?.id ?? newId()));
              close();
            }}
          >
            {part ? T.apply : T.add}
          </button>
        </>
      )}
    >
      <Choice
        id={fieldId(PREFIX, "position")}
        legend={T.position}
        options={MOD_POSITIONS.map((value) => ({ value, label: TEXTS.modPositions[value] }))}
        value={draft.position}
        onChange={(position) => set({ position })}
        error={message("position")}
      />
      <TextField
        id={fieldId(PREFIX, "description")}
        label={T.description}
        value={draft.description}
        onInput={(description) => set({ description })}
        error={message("description")}
      />
      <TextField
        id={fieldId(PREFIX, "vendor")}
        label={T.vendor}
        value={draft.vendor}
        onInput={(vendor) => set({ vendor })}
        error={message("vendor")}
      />
      <TextField
        id={fieldId(PREFIX, "url")}
        label={T.url}
        value={draft.url}
        inputMode="url"
        placeholder="https://"
        onInput={(url) => set({ url })}
        error={message("url")}
      />
      <TextField
        id={fieldId(PREFIX, "price")}
        label={T.price}
        value={draft.price}
        inputMode="decimal"
        placeholder={TEXTS.form.fields.pricePlaceholder}
        onInput={(price) => set({ price })}
        error={message("price")}
      />
      <TextField
        id={fieldId(PREFIX, "originalPart")}
        label={T.originalPart}
        value={draft.originalPart}
        onInput={(originalPart) => set({ originalPart })}
        error={message("originalPart")}
      />
    </Sheet>
  );
}
