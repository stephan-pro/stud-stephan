import { useState } from "preact/hooks";
import type { Remote } from "../../backend/remote";
import { withSaved } from "../../domain/collectionEdit";
import {
  assignableFigures,
  figuresToMove,
  figuresToSave,
  placeName,
  placeOf,
  type Target,
} from "../../domain/placement";
import { galleryImages } from "../../domain/showcase";
import type { Id, Minifig } from "../../domain/types";
import { Cover } from "../components/Cover";
import { Choice, TextField } from "../components/Fields";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { Unready } from "../components/Unready";
import { ReadOnlyNote } from "../components/WriteLink";
import { detailHash, dioramaHash, routeHash } from "../route";
import { TEXTS } from "../texts";
import { type LoadedCollection, useWritable } from "../useCollection";

const T = TEXTS.dioramas.assign;

type Which = "without" | "all";

/**
 * S6a: puts figures into a diorama or into an own set ("Steht in"). The list offers the figures
 * that are displayed nowhere (or all of them); a figure that stands elsewhere says so ("steht in:
 * …") and is moved only after the person confirmed. A figure stands in one place at most (F8).
 */
export function AssignPage({
  data,
  kind,
  id,
  remote,
}: {
  readonly data: LoadedCollection;
  readonly kind: Target["kind"];
  readonly id: string;
  readonly remote: Remote | undefined;
}) {
  const target: Target = { kind, id };
  const [which, setWhich] = useState<Which>("without");
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<readonly Id[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();
  const writable = useWritable();

  const back =
    kind === "diorama" ? dioramaHash({ kind: "detail", id }) : detailHash({ type: "legoSet", id });
  const closeLink = (
    <a class="icon-button back-link pressable" href={back} aria-label={T.close}>
      <Icon name="close" />
    </a>
  );

  if (data.state.status !== "ready") {
    return (
      <>
        <header class="page-header">{closeLink}</header>
        <Unready data={data} />
      </>
    );
  }
  const { collection } = data.state;
  const exists =
    kind === "diorama"
      ? collection.dioramas.some((candidate) => candidate.id === id)
      : collection.sets.some((candidate) => candidate.id === id);
  if (!exists) {
    return (
      <>
        <header class="page-header">{closeLink}</header>
        <section class="card" aria-labelledby="not-found-title">
          <h1 class="card__title" id="not-found-title" tabIndex={-1}>
            {TEXTS.dioramas.notFound.title}
          </h1>
          <p class="card__text">
            {kind === "diorama" ? TEXTS.dioramas.notFound.text : TEXTS.detail.notFound.text}
          </p>
          <a
            class="button button--secondary pressable"
            href={routeHash(kind === "diorama" ? "dioramas" : "showcase")}
          >
            {kind === "diorama" ? TEXTS.dioramas.back : TEXTS.detail.stand.backToShowcase}
          </a>
        </section>
      </>
    );
  }

  const shown = assignableFigures(collection, target, { onlyWithout: which === "without", query });
  const nameOfPlace = (figure: Minifig) => {
    const place = placeOf(collection, figure);
    return place ? placeName(place) : undefined;
  };
  // A figure chosen earlier may have left the list by a new filter; it stays chosen.
  const valid = chosen.filter((figureId) =>
    collection.minifigs.some(
      (figure) =>
        figure.id === figureId && figuresToSave(collection, target, [figureId]).length === 1,
    ),
  );
  const moves = figuresToMove(collection, target, valid);

  const toggle = (figureId: Id) =>
    setChosen((current) =>
      current.includes(figureId)
        ? current.filter((candidate) => candidate !== figureId)
        : [...current, figureId],
    );

  const assign = async () => {
    setConfirming(false);
    if (!remote) {
      setFailure(T.failed);
      return;
    }
    setSaving(true);
    setFailure(undefined);
    const toSave = figuresToSave(collection, target, valid);
    const results = await Promise.allSettled(
      toSave.map((figure) => remote.save("minifig", figure)),
    );
    const saved = toSave.filter((_, index) => results[index]?.status === "fulfilled");
    data.update((current) =>
      saved.reduce((sum, figure) => withSaved(sum, "minifig", figure), current),
    );
    setSaving(false);
    if (saved.length === toSave.length) {
      location.hash = back;
      return;
    }
    setChosen((current) => current.filter((figureId) => !saved.some((f) => f.id === figureId)));
    setFailure(saved.length === 0 ? T.failed : T.partly);
  };

  const submit = () => {
    if (valid.length === 0 || saving) return;
    if (moves.length > 0) setConfirming(true);
    else void assign();
  };

  return (
    <>
      <header class="page-header">
        {closeLink}
        <h1 class="page-title page-title--small" tabIndex={-1}>
          {T.title}
        </h1>
        <span class="header-spacer" />
      </header>
      <TextField
        id="assign-search"
        label={T.searchLabel}
        value={query}
        onInput={setQuery}
        placeholder={T.searchLabel}
      />
      <Choice<Which>
        segmented
        hideLegend
        legend={T.filterGroup}
        options={[
          { value: "without", label: T.onlyWithout },
          { value: "all", label: T.all },
        ]}
        value={which}
        onChange={setWhich}
      />
      {failure && (
        <p class="banner banner--error" role="alert">
          {failure}
        </p>
      )}
      {shown.length === 0 ? (
        <p class="card__text">
          {which === "without" && query.trim() === "" ? T.noneWithout : T.none}
        </p>
      ) : (
        <ul class="pick-grid">
          {shown.map((figure) => {
            const picked = valid.includes(figure.id);
            const elsewhere = nameOfPlace(figure);
            return (
              <li key={figure.id}>
                <button
                  type="button"
                  class="pick pressable"
                  aria-pressed={picked}
                  onClick={() => toggle(figure.id)}
                >
                  <Cover
                    image={galleryImages(figure)[0]}
                    alt=""
                    tintKey={figure.id}
                    scribbleId={`pick-${figure.id}`}
                    variant="small"
                  >
                    {picked && (
                      <span class="pick__check" aria-hidden="true">
                        <Icon name="check" size={18} strokeWidth={3} />
                      </span>
                    )}
                  </Cover>
                  <span class="figure-tile__name">{figure.name}</span>
                  {elsewhere && <span class="tile__meta">{T.standsIn(elsewhere)}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div class="form-bar">
        <ReadOnlyNote />
        <button
          type="button"
          class="button button--primary pressable"
          disabled={valid.length === 0 || saving || !writable}
          onClick={submit}
        >
          <Icon name="check" size={20} />
          {saving ? T.saving : valid.length === 0 ? T.submitNone : T.submit(valid.length)}
        </button>
      </div>
      {confirming && (
        <Sheet
          id="assign-move"
          title={T.move.title(moves.length)}
          closeLabel={T.move.close}
          onClose={() => setConfirming(false)}
          footer={(close) => (
            <>
              <button type="button" class="button button--secondary pressable" onClick={close}>
                {T.move.cancel}
              </button>
              <button
                type="button"
                class="button button--primary pressable"
                onClick={() => {
                  void assign();
                  close();
                }}
              >
                {T.move.confirm}
              </button>
            </>
          )}
        >
          <p class="card__text">
            {T.move.text(
              moves.map(({ minifig, from }) => `${minifig.name} (${from.name})`).join(", "),
            )}
          </p>
        </Sheet>
      )}
    </>
  );
}
