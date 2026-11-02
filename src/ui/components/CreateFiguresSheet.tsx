import { useState } from "preact/hooks";
import type { Remote } from "../../backend/remote";
import { withSaved } from "../../domain/collectionEdit";
import { creatableFigures, figureOfSet } from "../../domain/inSet";
import type { Collection, LegoSet, Minifig } from "../../domain/types";
import { newId } from "../ids";
import { TEXTS } from "../texts";
import type { LoadedCollection } from "../useCollection";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";

const T = TEXTS.detail.set;

/**
 * "Figuren einzeln anlegen": the figures of a complete set that are only "im Set" become figures of
 * their own (condition of the set, linked to it, standing in it, no purchase price).
 */
export function CreateFiguresSheet({
  set,
  collection,
  remote,
  update,
  onClose,
}: {
  readonly set: LegoSet;
  readonly collection: Collection;
  readonly remote: Remote | undefined;
  readonly update: LoadedCollection["update"];
  readonly onClose: () => void;
}) {
  const options = creatableFigures(collection, set);
  const [chosen, setChosen] = useState<readonly number[]>([]);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState(false);
  const valid = chosen.filter((index) => options.some((option) => option.index === index));

  const toggle = (index: number) =>
    setChosen((current) =>
      current.includes(index) ? current.filter((entry) => entry !== index) : [...current, index],
    );

  const create = async (close: () => void) => {
    if (valid.length === 0 || saving) return;
    if (!remote) {
      setFailure(true);
      return;
    }
    setSaving(true);
    setFailure(false);
    const createdAt = new Date().toISOString();
    const figures: Minifig[] = options
      .filter((option) => valid.includes(option.index))
      .flatMap((option) =>
        Array.from({ length: option.missing }, () =>
          figureOfSet(set, option.figure, { id: newId("minifig"), createdAt }),
        ),
      );
    const results = await Promise.allSettled(
      figures.map((figure) => remote.save("minifig", figure)),
    );
    const saved = figures.filter((_, position) => results[position]?.status === "fulfilled");
    update((current) => saved.reduce((sum, figure) => withSaved(sum, "minifig", figure), current));
    setSaving(false);
    if (saved.length === figures.length) {
      close();
      return;
    }
    // What did not work stays offered; an attempt for a figure with several pieces may be half done.
    setChosen([]);
    setFailure(true);
  };

  return (
    <Sheet
      id="create-figures"
      title={T.createTitle}
      closeLabel={T.createClose}
      onClose={onClose}
      footer={(close) => (
        <button
          type="button"
          class="button button--primary pressable"
          disabled={valid.length === 0 || saving}
          onClick={() => void create(close)}
        >
          <Icon name="check" size={20} />
          {T.createSubmit(valid.length)}
        </button>
      )}
    >
      <p class="card__text">{T.createText}</p>
      {failure && (
        <p class="banner banner--error" role="alert">
          {T.createFailed}
        </p>
      )}
      <ul class="check-list">
        {options.map((option) => (
          <li key={option.index}>
            <button
              type="button"
              class="button button--secondary pressable"
              aria-pressed={valid.includes(option.index)}
              onClick={() => toggle(option.index)}
            >
              {valid.includes(option.index) && <Icon name="check" size={18} strokeWidth={3} />}
              {T.createOption(option.figure.name, option.missing)}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
