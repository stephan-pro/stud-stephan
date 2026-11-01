import type { RemovableObject } from "../../domain/types";
import { TEXTS } from "../texts";
import { Sheet } from "./Sheet";

const T = TEXTS.remove;

/** Asks before an object is deleted; the deleting itself can be taken back for a few seconds. */
export function RemoveSheet({
  item,
  onConfirm,
  onClose,
}: {
  readonly item: RemovableObject;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}) {
  return (
    <Sheet
      id="remove"
      title={T.title(item.name)}
      closeLabel={T.close}
      onClose={onClose}
      footer={(close) => (
        <>
          <button type="button" class="button button--secondary pressable" onClick={close}>
            {T.cancel}
          </button>
          <button
            type="button"
            class="button button--danger pressable"
            onClick={() => {
              onConfirm();
              close();
            }}
          >
            {T.confirm}
          </button>
        </>
      )}
    >
      <p class="card__text">{T.text[item.type]}</p>
    </Sheet>
  );
}
