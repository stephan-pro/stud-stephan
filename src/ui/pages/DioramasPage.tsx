import { dioramaImages, figuresInDiorama, figuresWithoutDiorama } from "../../domain/dioramas";
import type { Diorama } from "../../domain/types";
import { Cover } from "../components/Cover";
import { Icon } from "../components/Icon";
import { Scribbles } from "../components/Scribbles";
import { Unready } from "../components/Unready";
import { dioramaHash } from "../route";
import { TEXTS } from "../texts";
import type { LoadedCollection } from "../useCollection";

const T = TEXTS.dioramas;

/** "6 Figuren · 1.240 Teile": what the card of a diorama says under its name. */
function factsOf(diorama: Diorama, figures: number): string {
  return [
    T.figures(figures),
    diorama.pieceCount === undefined ? undefined : T.pieces(diorama.pieceCount),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * S5: the dioramas as big picture cards, with a banner on top that counts the figures that stand in
 * none and opens the showcase filtered to them.
 */
export function DioramasPage({
  data,
  onShowWithoutDiorama,
}: {
  readonly data: LoadedCollection;
  /** Shows the showcase with the filter "ohne Diorama". */
  readonly onShowWithoutDiorama: () => void;
}) {
  if (data.state.status !== "ready") return <Unready data={data} />;
  const { collection } = data.state;
  const without = figuresWithoutDiorama(collection).length;

  return (
    <>
      {without > 0 && (
        <button type="button" class="without-banner pressable" onClick={onShowWithoutDiorama}>
          <Scribbles id="without-banner-scribbles" />
          <span class="without-banner__text">
            <span class="without-banner__count">{T.withoutBanner.count(without)}</span>
            <span class="without-banner__label">{T.withoutBanner.text(without)}</span>
          </span>
          <span class="without-banner__action">{T.withoutBanner.action}</span>
        </button>
      )}
      {collection.dioramas.length === 0 ? (
        <section class="card" aria-labelledby="no-dioramas-title">
          <h2 class="card__title" id="no-dioramas-title">
            {T.empty.title}
          </h2>
          <p class="card__text">{T.empty.text}</p>
          <a class="button button--primary pressable" href={dioramaHash({ kind: "new" })}>
            <Icon name="plus" size={20} />
            {T.empty.action}
          </a>
        </section>
      ) : (
        <ul class="diorama-list">
          {collection.dioramas.map((diorama) => (
            <li key={diorama.id}>
              <a
                class="diorama-card pressable"
                href={dioramaHash({ kind: "detail", id: diorama.id })}
              >
                <Cover
                  image={dioramaImages(diorama)[0]}
                  alt=""
                  tintKey={diorama.id}
                  scribbleId={`diorama-${diorama.id}`}
                  variant="banner"
                />
                <span class="diorama-card__body">
                  <span class="diorama-card__text">
                    <span class="diorama-card__name">{diorama.name}</span>
                    <span class="tile__meta">
                      {factsOf(diorama, figuresInDiorama(collection, diorama.id).length)}
                    </span>
                  </span>
                  <Icon name="next" />
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
