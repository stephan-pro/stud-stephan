import { useState } from "preact/hooks";
import type { Remote } from "../../backend/remote";
import { withSaved } from "../../domain/collectionEdit";
import { dioramaImages, figureWithoutDiorama } from "../../domain/dioramas";
import type { Collection, Diorama, Minifig } from "../../domain/types";
import { dioramaHash } from "../route";
import { TEXTS } from "../texts";
import type { LoadedCollection } from "../useCollection";
import { Cover } from "./Cover";
import { Section } from "./DetailParts";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";

const T = TEXTS.detail.diorama;
const S = TEXTS.dioramas.figureSection;

function DioramaCover({ diorama }: { readonly diorama: Diorama }) {
  return (
    <Cover
      image={dioramaImages(diorama)[0]}
      alt=""
      tintKey={diorama.id}
      scribbleId={`diorama-${diorama.id}`}
      variant="small"
    />
  );
}

/**
 * "Diorama" on the page of a figure (S2): which diorama it stands in, linked both ways (F8), a
 * button to take it out, or to put it into one.
 */
export function FigureDiorama({
  minifig,
  diorama,
  collection,
  remote,
  update,
}: {
  readonly minifig: Minifig;
  readonly diorama: Diorama | undefined;
  readonly collection: Collection;
  readonly remote: Remote | undefined;
  readonly update: LoadedCollection["update"];
}) {
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const store = async (next: Minifig) => {
    if (!remote || busy) {
      setFailed(true);
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      await remote.save("minifig", next);
      update((current) => withSaved(current, "minifig", next));
    } catch {
      setFailed(true);
    }
    setBusy(false);
  };

  return (
    <Section id="diorama" title={T.title}>
      {diorama ? (
        <>
          <a class="diorama-row pressable" href={dioramaHash({ kind: "detail", id: diorama.id })}>
            <DioramaCover diorama={diorama} />
            <span class="copy-row__name">{diorama.name}</span>
            <span class="visually-hidden">{S.open}</span>
            <Icon name="next" size={20} />
          </a>
          <button
            type="button"
            class="button button--secondary pressable"
            disabled={busy}
            onClick={() => void store(figureWithoutDiorama(minifig))}
          >
            {S.take}
          </button>
        </>
      ) : (
        <>
          <p class="card__text">{T.none}</p>
          <button
            type="button"
            class="button button--secondary pressable"
            disabled={busy}
            onClick={() => setChoosing(true)}
          >
            <Icon name="plus" size={20} />
            {S.assign}
          </button>
        </>
      )}
      {failed && (
        <p class="field__error" role="alert">
          {S.failed}
        </p>
      )}
      {choosing && (
        <Sheet
          id="choose-diorama"
          title={S.chooseTitle}
          closeLabel={S.chooseClose}
          onClose={() => setChoosing(false)}
        >
          {collection.dioramas.length === 0 ? (
            <>
              <p class="card__text">{S.chooseNone}</p>
              <a class="button button--primary pressable" href={dioramaHash({ kind: "new" })}>
                {S.chooseCreate}
              </a>
            </>
          ) : (
            <ul class="copy-list">
              {collection.dioramas.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    class="copy-row pressable choose-row"
                    onClick={() => {
                      setChoosing(false);
                      void store({ ...minifig, dioramaId: candidate.id });
                    }}
                  >
                    <DioramaCover diorama={candidate} />
                    <span class="copy-row__name">{candidate.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      )}
    </Section>
  );
}
