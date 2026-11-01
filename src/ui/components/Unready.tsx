import { TEXTS } from "../texts";
import type { LoadedCollection } from "../useCollection";

const T = TEXTS.dioramas;

/**
 * What a page of the dioramas shows while the collection is not there: the loading skeleton, or the
 * failure with a button to try again. `undefined` once the collection is ready.
 */
export function Unready({ data }: { readonly data: LoadedCollection }) {
  const { state } = data;
  if (state.status === "ready") return null;
  if (state.status === "loading") {
    return (
      <div class="skeleton" role="status" aria-label={T.loading} aria-busy="true">
        <div class="skeleton__card" />
        <div class="skeleton__card" />
      </div>
    );
  }
  return (
    <section class="card" role="alert" aria-labelledby="load-failed-title">
      <h1 class="card__title" id="load-failed-title" tabIndex={-1}>
        {T.loadFailed.title}
      </h1>
      <p class="card__text">{T.loadFailed.text}</p>
      <button type="button" class="button button--secondary pressable" onClick={data.retry}>
        {T.loadFailed.retry}
      </button>
    </section>
  );
}
