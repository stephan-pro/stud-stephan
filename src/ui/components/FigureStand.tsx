import { useState } from "preact/hooks";
import type { Remote } from "../../backend/remote";
import { withSaved } from "../../domain/collectionEdit";
import { dioramaImages } from "../../domain/dioramas";
import { figureAt, figureWithoutPlace, type Place, placeOf } from "../../domain/placement";
import { galleryImages, normalize } from "../../domain/showcase";
import type { Collection, Diorama, LegoSet, Minifig } from "../../domain/types";
import { detailHash, dioramaHash, formHash } from "../route";
import { TEXTS } from "../texts";
import { type LoadedCollection, useWritable } from "../useCollection";
import { Cover } from "./Cover";
import { Section } from "./DetailParts";
import { Choice, TextField } from "./Fields";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { ReadOnlyNote } from "./WriteLink";

const T = TEXTS.detail.stand;

type Kind = "diorama" | "set";

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

function SetCover({ set }: { readonly set: LegoSet }) {
  return (
    <Cover
      image={galleryImages(set)[0]}
      alt=""
      tintKey={set.id}
      scribbleId={`set-${set.id}`}
      variant="small"
    />
  );
}

/** The place at hand as a row: picture, name, what it is, and a link to it (both ways, F8). */
function PlaceRow({ place }: { readonly place: Place }) {
  const diorama = place.kind === "diorama";
  const href = diorama
    ? dioramaHash({ kind: "detail", id: place.diorama.id })
    : detailHash({ type: "legoSet", id: place.set.id });
  const kind = diorama ? T.kinds.diorama : place.automatic ? T.automatic : T.kinds.set;
  return (
    <a class="diorama-row pressable" href={href}>
      {diorama ? <DioramaCover diorama={place.diorama} /> : <SetCover set={place.set} />}
      <span class="diorama-row__text">
        <span class="copy-row__name">{diorama ? place.diorama.name : place.set.name}</span>
        <span class="tile__meta">{kind}</span>
      </span>
      <span class="visually-hidden">{diorama ? T.openDiorama : T.openSet}</span>
      <Icon name="next" size={20} />
    </a>
  );
}

/**
 * "Steht in" on the page of a figure (S2): the diorama or the own set the figure is displayed in,
 * linked both ways, a button to take it out, or to put it into one. A figure out of a complete set
 * stands in that set by itself ("automatisch") until it gets a place of its own.
 */
export function FigureStand({
  minifig,
  collection,
  remote,
  update,
}: {
  readonly minifig: Minifig;
  readonly collection: Collection;
  readonly remote: Remote | undefined;
  readonly update: LoadedCollection["update"];
}) {
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // Without a connection (P15) neither taking out nor assigning works.
  const off = !useWritable();
  const place = placeOf(collection, minifig);

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

  const automatic = place?.kind === "set" && place.automatic;

  return (
    <Section id="stand" title={T.title}>
      {place ? <PlaceRow place={place} /> : <p class="card__text">{T.none}</p>}
      {automatic && <p class="card__text">{T.automaticHint}</p>}
      {place && !automatic && (
        <button
          type="button"
          class="button button--secondary pressable"
          disabled={busy || off}
          onClick={() => void store(figureWithoutPlace(minifig))}
        >
          {place.kind === "diorama" ? T.takeFromDiorama : T.takeFromSet}
        </button>
      )}
      {(!place || automatic) && (
        <button
          type="button"
          class="button button--secondary pressable"
          disabled={busy || off}
          onClick={() => setChoosing(true)}
        >
          <Icon name="plus" size={20} />
          {automatic ? T.chooseElsewhere : T.choose}
        </button>
      )}
      <ReadOnlyNote />
      {failed && (
        <p class="field__error" role="alert">
          {T.failed}
        </p>
      )}
      {choosing && (
        <ChooseSheet
          collection={collection}
          onClose={() => setChoosing(false)}
          onChoose={(target) => {
            setChoosing(false);
            void store(figureAt(minifig, target));
          }}
        />
      )}
    </Section>
  );
}

/** The list of dioramas or of the own sets (with a picture and a search) to put the figure into. */
function ChooseSheet({
  collection,
  onClose,
  onChoose,
}: {
  readonly collection: Collection;
  readonly onClose: () => void;
  readonly onChoose: (target: { kind: Kind; id: string }) => void;
}) {
  const [kind, setKind] = useState<Kind>("diorama");
  const [query, setQuery] = useState("");
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const sets = collection.sets.filter((set) => {
    const text = normalize([set.name, set.setNumber].filter(Boolean).join(" "));
    return words.every((word) => text.includes(word));
  });

  return (
    <Sheet id="choose-stand" title={T.sheetTitle} closeLabel={T.sheetClose} onClose={onClose}>
      <Choice<Kind>
        segmented
        hideLegend
        legend={T.kindGroup}
        options={[
          { value: "diorama", label: T.kinds.diorama },
          { value: "set", label: T.kinds.set },
        ]}
        value={kind}
        onChange={setKind}
      />
      {kind === "diorama" &&
        (collection.dioramas.length === 0 ? (
          <>
            <p class="card__text">{T.noDioramas}</p>
            <a class="button button--primary pressable" href={dioramaHash({ kind: "new" })}>
              {T.createDiorama}
            </a>
          </>
        ) : (
          <ul class="copy-list">
            {collection.dioramas.map((candidate) => (
              <li key={candidate.id}>
                <button
                  type="button"
                  class="copy-row pressable choose-row"
                  onClick={() => onChoose({ kind: "diorama", id: candidate.id })}
                >
                  <DioramaCover diorama={candidate} />
                  <span class="copy-row__name">{candidate.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ))}
      {kind === "set" &&
        (collection.sets.length === 0 ? (
          <>
            <p class="card__text">{T.noSets}</p>
            <a
              class="button button--primary pressable"
              href={formHash({ type: "legoSet", mode: "new" })}
            >
              {T.createSet}
            </a>
          </>
        ) : (
          <>
            <TextField
              id="choose-set-search"
              label={T.searchSets}
              value={query}
              onInput={setQuery}
              placeholder={T.searchSets}
            />
            {sets.length === 0 ? (
              <p class="card__text">{T.noSetMatch(query.trim())}</p>
            ) : (
              <ul class="copy-list">
                {sets.map((candidate) => (
                  <li key={candidate.id}>
                    <button
                      type="button"
                      class="copy-row pressable choose-row"
                      onClick={() => onChoose({ kind: "set", id: candidate.id })}
                    >
                      <SetCover set={candidate} />
                      <span class="copy-row__name">{candidate.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ))}
    </Sheet>
  );
}
