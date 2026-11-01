import { useEffect, useState } from "preact/hooks";
import type { Catalog, SourceId, SourceState } from "../../backend/catalog";
import { TEXTS } from "../texts";

type Sources = Record<SourceId, SourceState>;

const ORDER: readonly SourceId[] = ["rebrickable", "bricklink", "brickognize", "merlin"];

/**
 * S12, card "Datenquellen" (P14, as in the click dummy): a dot, the name and a line with the
 * state for each of the four sources. A source that needs the person's attention gets a small
 * label. The state comes from the function `catalog`; no key is ever sent or shown.
 */
export function SourcesCard({ catalog }: { readonly catalog: Pick<Catalog, "sources"> }) {
  const T = TEXTS.sources;
  /** `undefined` while loading, `null` when asking failed. */
  const [sources, setSources] = useState<Sources | null | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setSources(undefined);
    catalog.sources().then(
      (found) => active && setSources(found),
      () => active && setSources(null),
    );
    return () => {
      active = false;
    };
  }, [catalog, attempt]);

  return (
    <section class="card" aria-labelledby="sources-title">
      <h2 class="card__title" id="sources-title">
        {T.title}
      </h2>
      {sources === undefined && (
        <p class="card__text" role="status">
          {T.loading}
        </p>
      )}
      {sources === null && (
        <>
          <p class="card__text" role="alert">
            {T.failed}
          </p>
          <button
            class="button button--secondary pressable"
            type="button"
            onClick={() => setAttempt(attempt + 1)}
          >
            {T.retry}
          </button>
        </>
      )}
      {sources && (
        <>
          <ul class="sources">
            {ORDER.map((id) => {
              const state = sources[id];
              return (
                <li class="sources__row" key={id}>
                  <span
                    class={`sources__dot sources__dot--${state === "ok" ? "ok" : "problem"}`}
                    aria-hidden="true"
                  />
                  <div class="sources__text">
                    <span class="sources__name">{T.names[id]}</span>
                    <span class="sources__line">{T.lines[id][state]}</span>
                  </div>
                  {(state === "missingKeys" || state === "refused") && (
                    <span class="sources__chip">{T.chips[state]}</span>
                  )}
                </li>
              );
            })}
          </ul>
          <p class="note">{T.note}</p>
        </>
      )}
    </section>
  );
}
