import type { Route } from "../route";
import { TEXTS } from "../texts";

/** Card of a page that has no content yet: says what will come. */
export function ComingSoon({ route }: { readonly route: Route }) {
  return (
    <section class="card" aria-labelledby="coming-soon-title">
      <h2 class="card__title" id="coming-soon-title">
        {TEXTS.comingSoonTitle}
      </h2>
      <p class="card__text">{TEXTS.routes[route].comingSoon}</p>
    </section>
  );
}
