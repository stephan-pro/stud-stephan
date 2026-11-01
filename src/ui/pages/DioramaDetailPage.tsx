import { useRef, useState } from "preact/hooks";
import type { Remote } from "../../backend/remote";
import { LIMITS } from "../../backend/rules";
import { withSaved } from "../../domain/collectionEdit";
import { formatDate } from "../../domain/dates";
import { dioramaImages, figuresInDiorama } from "../../domain/dioramas";
import { formatMoney } from "../../domain/money";
import { galleryImages } from "../../domain/showcase";
import type { Diorama } from "../../domain/types";
import { Cover } from "../components/Cover";
import { BackBar, NoteAndLinks, Section } from "../components/DetailParts";
import { Gallery } from "../components/Gallery";
import { Icon } from "../components/Icon";
import { RemoveSheet } from "../components/RemoveSheet";
import { StudioList, StudioPicker } from "../components/StudioFiles";
import { Unready } from "../components/Unready";
import { ReadOnlyNote, WriteLink } from "../components/WriteLink";
import { detailHash, dioramaHash, routeHash } from "../route";
import { TEXTS } from "../texts";
import { type LoadedCollection, useWritable } from "../useCollection";
import { Title } from "./DetailPage";

const T = TEXTS.dioramas;

/** What the detail page of a diorama is called (the tab title); undefined while unknown. */
export function dioramaName(data: LoadedCollection, id: string): string | undefined {
  return data.state.status === "ready"
    ? data.state.collection.dioramas.find((diorama) => diorama.id === id)?.name
    : undefined;
}

/** The Studio files: the list to download from and the button to add more (saved at once). */
function StudioSection({
  diorama,
  data,
  remote,
}: {
  readonly diorama: Diorama;
  readonly data: LoadedCollection;
  readonly remote: Remote | undefined;
}) {
  // Files that arrive together are entered one after the other, each on top of the one before.
  const latest = useRef(diorama);
  latest.current = diorama;
  const queue = useRef<Promise<void>>(Promise.resolve());

  const add = (entry: Diorama["studioFiles"][number]) => {
    const run = queue.current.then(async () => {
      if (!remote) throw new Error("Kein Server");
      const base = latest.current;
      const next: Diorama = { ...base, studioFiles: [...base.studioFiles, entry] };
      await remote.save("diorama", next);
      latest.current = next;
      data.update((collection) => withSaved(collection, "diorama", next));
    });
    queue.current = run.catch(() => {});
    return run;
  };

  return (
    <Section id="studio" title={T.studio.title}>
      {diorama.studioFiles.length === 0 && <p class="card__text">{T.studio.none}</p>}
      <StudioList files={diorama.studioFiles} remote={remote} />
      <StudioPicker
        remote={remote}
        dioramaId={diorama.id}
        room={LIMITS.studioFilesPerDiorama - diorama.studioFiles.length}
        onAdded={add}
      />
      <ReadOnlyNote />
    </Section>
  );
}

function Detail({
  diorama,
  data,
  remote,
}: {
  readonly diorama: Diorama;
  readonly data: LoadedCollection;
  readonly remote: Remote | undefined;
}) {
  if (data.state.status !== "ready") return null;
  const { collection } = data.state;
  const figures = figuresInDiorama(collection, diorama.id);
  const meta = diorama.pieceCount === undefined ? "" : T.pieces(diorama.pieceCount);
  const value = diorama.manualValue;

  return (
    <>
      <Gallery images={dioramaImages(diorama)} name={diorama.name} id={diorama.id} />
      <Title
        name={diorama.name}
        meta={meta}
        chips={[{ text: T.figures(figures.length), pop: true }]}
      />
      {value && (
        <Section id="value" title={T.detail.value}>
          <p class="card__text">
            <strong>{formatMoney(value.cents)}</strong> ·{" "}
            {T.detail.valueSince(formatDate(value.enteredOn))}
          </p>
        </Section>
      )}
      <Section id="figures" title={T.detail.figuresTitle}>
        {figures.length === 0 ? (
          <p class="card__text">{T.detail.noFigures}</p>
        ) : (
          <ul class="figure-grid figure-grid--round">
            {figures.map((figure) => (
              <li key={figure.id}>
                <a
                  class="figure-tile pressable"
                  href={detailHash({ type: "minifig", id: figure.id })}
                >
                  <Cover
                    image={galleryImages(figure)[0]}
                    alt=""
                    tintKey={figure.id}
                    scribbleId={`diorama-figure-${figure.id}`}
                    variant="small"
                  />
                  <span class="figure-tile__name">{figure.name}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        <WriteLink
          class="button button--pop pressable"
          href={dioramaHash({ kind: "assign", id: diorama.id })}
        >
          <Icon name="plus" size={20} />
          {T.detail.assign}
        </WriteLink>
      </Section>
      <StudioSection diorama={diorama} data={data} remote={remote} />
      <NoteAndLinks item={diorama} />
    </>
  );
}

/** S6: the detail page of a diorama (photos, figures, Studio files, note and links). */
export function DioramaDetailPage({
  data,
  id,
  remote,
  onRemove,
}: {
  readonly data: LoadedCollection;
  readonly id: string;
  readonly remote: Remote | undefined;
  /** Called when the person has confirmed deleting the diorama. */
  readonly onRemove: (diorama: Diorama) => void;
}) {
  const [asking, setAsking] = useState(false);
  const writable = useWritable();
  const back = { href: routeHash("dioramas"), label: T.back };
  if (data.state.status !== "ready") {
    return (
      <>
        <BackBar {...back} />
        <Unready data={data} />
      </>
    );
  }
  const diorama = data.state.collection.dioramas.find((candidate) => candidate.id === id);
  if (!diorama) {
    return (
      <>
        <BackBar {...back} />
        <section class="card" aria-labelledby="not-found-title">
          <h1 class="card__title" id="not-found-title" tabIndex={-1}>
            {T.notFound.title}
          </h1>
          <p class="card__text">{T.notFound.text}</p>
          <a class="button button--secondary pressable" href={back.href}>
            {T.back}
          </a>
        </section>
      </>
    );
  }
  return (
    <>
      <BackBar {...back}>
        <WriteLink
          class="icon-button pressable"
          href={dioramaHash({ kind: "edit", id: diorama.id })}
          label={TEXTS.actions.edit}
        >
          <Icon name="edit" />
        </WriteLink>
        <button
          type="button"
          class="icon-button pressable"
          aria-label={
            writable ? TEXTS.actions.remove : `${TEXTS.actions.remove} – ${TEXTS.readOnlyShort}`
          }
          title={writable ? undefined : TEXTS.readOnlyShort}
          disabled={!writable}
          onClick={() => setAsking(true)}
        >
          <Icon name="trash" />
        </button>
      </BackBar>
      {asking && (
        <RemoveSheet
          item={diorama}
          onConfirm={() => onRemove(diorama)}
          onClose={() => setAsking(false)}
        />
      )}
      <Detail diorama={diorama} data={data} remote={remote} />
    </>
  );
}
