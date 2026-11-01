import { useEffect, useState } from "preact/hooks";
import { type Catalog, CatalogCallError, type CatalogHit } from "../../backend/catalog";
import type { Remote } from "../../backend/remote";
import { Cover } from "../components/Cover";
import { Icon } from "../components/Icon";
import { type WishPick, WishPicker } from "../components/WishPicker";
import { formHash, routeHash, type SearchType, searchHash } from "../route";
import { TEXTS } from "../texts";
import type { LoadedCollection } from "../useCollection";

const T = TEXTS.search;

/** Shorter texts have too many matches and, for numbers, are not a number yet. */
const MIN_LENGTH = 2;
/** The wait after the last key before the catalog is asked, so typing does not send a call per key. */
const PAUSE_MS = 400;

const KINDS: readonly SearchType[] = ["minifig", "legoSet"];

type SearchState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "done"; readonly hits: readonly CatalogHit[] }
  | { readonly status: "failed"; readonly message: string };

function failureMessage(error: unknown): string {
  const failure = error instanceof CatalogCallError ? error.failure : "unavailable";
  if (failure === "offline") return T.failed.offline;
  if (failure === "limit_reached") return T.failed.limit_reached;
  if (failure === "not_signed_in") return T.failed.not_signed_in;
  return T.failed.unavailable;
}

/** "sw0194 · Star Wars – The Clone Wars · 2012": what tells the hits apart. */
function facts(hit: CatalogHit): string {
  return T.facts(
    [
      hit.number ?? T.unknownNumber,
      hit.theme,
      hit.year === undefined ? undefined : String(hit.year),
    ].filter((fact): fact is string => fact !== undefined),
  );
}

/**
 * S7b: number or name in, live hits from the catalog out; a hit opens the form filled (F2). For a
 * wish (P15, `forWish`) a hit opens the wish sheet instead.
 */
export function SearchPage({
  type: initialType,
  catalog,
  forWish = false,
  data,
  remote,
}: {
  readonly type: SearchType;
  readonly catalog: Catalog | undefined;
  readonly forWish?: boolean;
  /** The collection the wish goes into (only for a wish). */
  readonly data?: LoadedCollection | undefined;
  readonly remote?: Remote | undefined;
}) {
  const [type, setType] = useState(initialType);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  const [pick, setPick] = useState<Extract<WishPick, { kind: "catalog" }> | undefined>();

  useEffect(() => {
    const text = query.trim();
    if (text.length < MIN_LENGTH) {
      setState({ status: "idle" });
      return;
    }
    setState({ status: "loading" });
    let active = true;
    const timer = setTimeout(() => {
      const found = catalog
        ? catalog.search(type, text)
        : Promise.reject(new CatalogCallError("Kein Katalog", "unavailable"));
      found.then(
        (hits) => active && setState({ status: "done", hits }),
        (error: unknown) =>
          active && setState({ status: "failed", message: failureMessage(error) }),
      );
    }, PAUSE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [catalog, type, query, attempt]);

  const choose = (next: SearchType) => {
    setType(next);
    // The address follows the chip; the router is not told, the page stays.
    history.replaceState(null, "", searchHash(next, forWish));
  };

  return (
    <>
      <header class="page-header">
        <a class="icon-button back-link pressable" href={routeHash("capture")} aria-label={T.back}>
          <Icon name="back" />
        </a>
        <h1 class="page-title page-title--small" tabIndex={-1}>
          {forWish ? TEXTS.wishCapture.searchTitle : T.title}
        </h1>
        <span class="header-spacer" />
      </header>

      <div class="search search--page" data-open="true">
        <label class="visually-hidden" for="catalog-search">
          {T.label}
        </label>
        <input
          id="catalog-search"
          class="search__input"
          type="search"
          autoComplete="off"
          autoCapitalize="off"
          spellcheck={false}
          placeholder={T.placeholder[type]}
          value={query}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
        <span class="search__icon" aria-hidden="true">
          <Icon name="search" size={20} />
        </span>
      </div>

      <fieldset class="choice">
        <legend class="visually-hidden">{T.kindsLabel}</legend>
        <div class="chips">
          {KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              class="chip pressable"
              aria-pressed={type === kind}
              onClick={() => choose(kind)}
            >
              {T.kinds[kind]}
            </button>
          ))}
        </div>
      </fieldset>

      <section class="card search-results" aria-busy={state.status === "loading"}>
        <p class="search-results__status" role="status">
          {state.status === "idle" && T.idle}
          {state.status === "loading" && T.searching}
          {state.status === "done" &&
            (state.hits.length > 0 ? T.results(state.hits.length) : T.none)}
        </p>
        {state.status === "done" && state.hits.length === 0 && (
          <p class="card__text">{forWish ? TEXTS.wishCapture.noneHint : T.noneHint}</p>
        )}
        {state.status === "failed" && (
          <div role="alert" class="search-results__failed">
            <p class="card__text">{state.message}</p>
            <button
              type="button"
              class="button button--secondary pressable"
              onClick={() => setAttempt((count) => count + 1)}
            >
              {T.retry}
            </button>
          </div>
        )}
        {state.status === "done" && state.hits.length > 0 && (
          <ul class="search-hits">
            {state.hits.map((hit) => {
              const body = (
                <>
                  <Cover
                    image={hit.imageUrl ? { kind: "catalog", url: hit.imageUrl } : undefined}
                    alt=""
                    tintKey={hit.ref}
                    scribbleId={`hit-${hit.ref}`}
                    variant="small"
                  />
                  <span class="search-hit__text">
                    <span class="search-hit__name">{hit.name}</span>
                    <span class="search-hit__facts">{facts(hit)}</span>
                  </span>
                  <span class="visually-hidden">
                    {forWish ? TEXTS.wishCapture.pick(hit.name) : T.pick(hit.name)}
                  </span>
                  <Icon name={forWish ? "wishlist" : "plus"} size={22} />
                </>
              );
              return (
                <li key={`${hit.kind}-${hit.ref}`}>
                  {forWish ? (
                    <button
                      type="button"
                      class="search-hit pressable"
                      onClick={() =>
                        setPick({ kind: "catalog", catalogKind: hit.kind, ref: hit.ref })
                      }
                    >
                      {body}
                    </button>
                  ) : (
                    <a
                      class="search-hit pressable"
                      href={formHash({ type: hit.kind, mode: "catalog", ref: hit.ref })}
                    >
                      {body}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {forWish && pick && data && (
        <WishPicker
          key={`${pick.catalogKind}-${pick.ref}`}
          pick={pick}
          data={data}
          remote={remote}
          catalog={catalog}
          onClose={() => setPick(undefined)}
        />
      )}

      {!forWish && (
        <a
          class="button button--secondary button--flat pressable"
          href={formHash({ type, mode: "new" })}
        >
          <Icon name="edit" size={20} />
          {T.manual}
        </a>
      )}
    </>
  );
}
