import { useState } from "preact/hooks";
import { formatDate } from "../../domain/dates";
import { formatMoney } from "../../domain/money";
import { marketPrice } from "../../domain/prices";
import type { PricePoint, WishItem } from "../../domain/types";
import {
  newWish,
  PRIORITIES,
  validateWish,
  type WishSource,
  type WishValues,
  withWishValues,
} from "../../domain/wishForm";
import { targetReached } from "../../domain/wishlist";
import { newId } from "../ids";
import { TEXTS } from "../texts";
import { useWritable } from "../useCollection";
import type { WishActions } from "../wishActions";
import { Choice, TextField } from "./Fields";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { ReadOnlyNote } from "./WriteLink";

const T = TEXTS.wishSheet;

interface WishSheetProps {
  /** What the wish is about: name and number under the title. */
  readonly source: WishSource;
  /** Starting values. */
  readonly initial: WishValues;
  /** The wish being changed; none = a new one from `source`. */
  readonly existing?: WishItem | undefined;
  readonly prices: readonly PricePoint[];
  readonly actions: WishActions;
  readonly onClose: () => void;
  /** "Erhalten": opens the form filled from the wish (only when changing one). */
  readonly onReceived?: (() => void) | undefined;
}

/**
 * S9a: priority, target price, wished condition and note of a wish, as a bottom sheet. Changing a
 * wish also offers "Erhalten" and "Von der Wunschliste entfernen"; a new wish (from a series or a
 * set) says "Auf die Wunschliste setzen".
 */
export function WishSheet({
  source,
  initial,
  existing,
  prices,
  actions,
  onClose,
  onReceived,
}: WishSheetProps) {
  const [values, setValues] = useState<WishValues>(initial);
  const [errors, setErrors] = useState(validateWish(initial));
  const [busy, setBusy] = useState<"save" | "remove" | undefined>();
  const [failure, setFailure] = useState(false);
  const [sure, setSure] = useState(false);
  // Without a connection (P15) the sheet can be read but not saved.
  const off = !useWritable();
  const set = (change: Partial<WishValues>) => setValues((current) => ({ ...current, ...change }));

  // The market price of the wished condition, as the list shows it.
  const draft: WishItem = existing
    ? withWishValues(existing, values)
    : newWish(source, values, { id: "draft", createdAt: "" });
  const price = marketPrice(draft, values.condition, prices);
  const reached = targetReached(draft.targetPrice, price?.cents);

  const submit = async (event: Event) => {
    event.preventDefault();
    if (busy) return;
    const found = validateWish(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.getElementById(found.targetPrice ? "wish-target" : "wish-note")?.focus();
      return;
    }
    setBusy("save");
    setFailure(false);
    try {
      await actions.save(
        existing
          ? withWishValues(existing, values)
          : newWish(source, values, { id: newId("wish"), createdAt: new Date().toISOString() }),
      );
      onClose();
    } catch {
      setBusy(undefined);
      setFailure(true);
    }
  };

  const remove = async () => {
    if (!existing || busy) return;
    setBusy("remove");
    setFailure(false);
    try {
      await actions.remove(existing.id);
      onClose();
    } catch {
      setBusy(undefined);
      setFailure(true);
    }
  };

  const meta = [source.number, source.theme].filter(Boolean).join(" · ");

  return (
    <Sheet
      id="wish"
      title={existing ? T.titleEdit : T.titleNew}
      closeLabel={T.close}
      onClose={onClose}
      footer={() => (
        <>
          <button
            class="button button--primary pressable"
            type="submit"
            form="wish-form"
            disabled={busy !== undefined || off}
          >
            {busy === "save" ? T.saving : existing ? T.save : T.add}
          </button>
          {existing && onReceived && (
            <button
              class="button button--secondary pressable"
              type="button"
              disabled={busy !== undefined || off}
              onClick={onReceived}
            >
              <Icon name="check" size={20} />
              {T.received}
            </button>
          )}
          {existing &&
            (sure ? (
              <fieldset class="choice-row">
                <legend class="visually-hidden">{T.removeSure}</legend>
                <button
                  class="button button--danger pressable"
                  type="button"
                  disabled={busy !== undefined || off}
                  onClick={() => void remove()}
                >
                  {busy === "remove" ? T.removing : T.removeConfirm}
                </button>
                <button
                  class="button button--secondary pressable"
                  type="button"
                  onClick={() => setSure(false)}
                >
                  {T.removeKeep}
                </button>
              </fieldset>
            ) : (
              <button
                class="button button--danger pressable"
                type="button"
                disabled={busy !== undefined || off}
                onClick={() => setSure(true)}
              >
                <Icon name="trash" size={20} />
                {T.remove}
              </button>
            ))}
        </>
      )}
    >
      <form id="wish-form" class="form" noValidate onSubmit={(event) => void submit(event)}>
        <p class="card__text">
          <strong>{source.name}</strong>
          {meta && <> · {meta}</>}
        </p>
        <p class={reached ? "banner banner--catalog" : "note"} role="status">
          {price
            ? reached
              ? T.reachedNote(formatMoney(price.cents))
              : T.marketNote(formatMoney(price.cents), formatDate(price.date))
            : T.noMarketNote}
        </p>
        <Choice
          legend={T.priority}
          segmented
          options={PRIORITIES.map((value) => ({
            value,
            label: TEXTS.wishlist.priorityChoices[value],
          }))}
          value={values.priority}
          onChange={(priority) => set({ priority })}
        />
        <TextField
          id="wish-target"
          label={T.targetPrice}
          hint={T.targetPriceHint}
          value={values.targetPrice}
          inputMode="decimal"
          onInput={(targetPrice) => set({ targetPrice })}
          error={errors.targetPrice ? T.errors[errors.targetPrice] : undefined}
        />
        <Choice
          legend={T.condition}
          segmented
          options={[
            { value: "new", label: TEXTS.conditions.new },
            { value: "used", label: TEXTS.conditions.used },
          ]}
          value={values.condition}
          onChange={(condition) => set({ condition })}
        />
        <TextField
          id="wish-note"
          label={T.note}
          value={values.note}
          onInput={(note) => set({ note })}
          error={errors.note ? T.errors[errors.note] : undefined}
        />
        {failure && (
          <p class="banner banner--error" role="alert">
            {T.failed}
          </p>
        )}
        <ReadOnlyNote />
      </form>
    </Sheet>
  );
}
