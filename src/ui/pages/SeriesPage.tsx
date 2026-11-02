import { useEffect, useRef, useState } from "preact/hooks";
import { CatalogCallError } from "../../backend/catalog";
import {
  SERIES_MAX_SETS,
  SERIES_WARNING_SETS,
  type SeriesBuilder,
  type SeriesPlan,
  type SeriesSummary,
  type SeriesTheme,
} from "../../backend/seriesBuilder";
import { formatDateTime } from "../../domain/dates";
import { catalogFiguresOf, seriesPercent, seriesProgress } from "../../domain/series";
import type { Collection } from "../../domain/types";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { seriesHash } from "../route";
import { TEXTS } from "../texts";
import { type LoadedCollection, useWritable } from "../useCollection";
import { WishSwitch } from "./WishlistPage";

const T = TEXTS.series;
/** The search starts this long after the last key. */
const SEARCH_DELAY_MS = 400;

type Problem = keyof typeof T.searchFailed;

function problemOf(error: unknown): Problem {
  const failure = error instanceof CatalogCallError ? error.failure : "unavailable";
  return failure === "offline" || failure === "limit_reached" ? failure : "unavailable";
}

/** The name of a hit: "Nur dieses Set: 75455-1 (4 Figuren)" for a single set, else the theme's. */
function themeLabel(theme: SeriesTheme): string {
  return theme.onlySet ? T.onlySet(theme.onlySet.number, theme.onlySet.figureCount) : theme.name;
}

/** Whether the theme is one of the sub themes listed below a main theme that cannot be chosen. */
function isBelowMain(themes: readonly SeriesTheme[], index: number): boolean {
  const name = themes[index]?.name ?? "";
  return themes
    .slice(0, index)
    .some((main) => !main.selectable && name.startsWith(`${main.name} – `));
}

/** A series with how much of it the collection has. */
interface Entry {
  readonly summary: SeriesSummary;
  readonly present: number;
  readonly total: number;
}

type Loaded =
  | { readonly status: "loading" }
  | { readonly status: "failed" }
  | { readonly status: "ready"; readonly entries: readonly Entry[] };

/** Reads the series and, per series, its figures (without counting as opened) to show the progress. */
async function loadEntries(builder: SeriesBuilder, collection: Collection): Promise<Entry[]> {
  const summaries = await builder.list();
  return Promise.all(
    summaries.map(async (summary): Promise<Entry> => {
      const detail = await builder.get(summary.id, false);
      const progress = seriesProgress(
        catalogFiguresOf(detail?.figures ?? []),
        collection.minifigs,
        collection.wishlist,
        collection.sets,
      );
      return { summary, present: progress.present, total: progress.total };
    }),
  );
}

/** "wird aufgebaut: 3 von 47 Sets", "Pause bis …", or nothing for a finished series. */
export function buildState(summary: SeriesSummary): string | undefined {
  if (summary.finishedAt !== undefined) return undefined;
  if (summary.pausedUntil !== undefined) return T.paused(formatDateTime(summary.pausedUntil));
  return T.building(summary.done + summary.failed, summary.total);
}

/** What building costs and the button to create the series; warns above `SERIES_WARNING_SETS`. */
function PlanSheet({
  builder,
  theme,
  onClose,
}: {
  readonly builder: SeriesBuilder;
  readonly theme: SeriesTheme;
  readonly onClose: () => void;
}) {
  const P = T.plan;
  const [plan, setPlan] = useState<SeriesPlan | undefined>();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const writable = useWritable();

  useEffect(() => {
    let active = true;
    builder.plan(theme.id).then(
      (found) => active && setPlan(found),
      () => active && setFailed(true),
    );
    return () => {
      active = false;
    };
  }, [builder, theme.id]);

  const create = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const summary = await builder.start(theme.id);
      location.hash = seriesHash({ kind: "detail", id: summary.id });
    } catch {
      setBusy(false);
      setFailed(true);
    }
  };

  const count = plan?.setCount ?? 0;
  const tooBig = count > SERIES_MAX_SETS;
  const warn = count > SERIES_WARNING_SETS;

  return (
    <Sheet
      id="series-plan"
      title={P.title}
      closeLabel={P.close}
      onClose={onClose}
      footer={() => (
        <button
          class="button button--primary pressable"
          type="button"
          disabled={plan === undefined || busy || tooBig || !writable}
          onClick={() => void create()}
        >
          {busy ? P.creating : warn ? P.createAnyway : P.create}
        </button>
      )}
    >
      <p class="card__text">
        <strong>{themeLabel(theme)}</strong>
      </p>
      {plan === undefined && !failed && (
        <p class="card__text" role="status">
          {P.loading}
        </p>
      )}
      {plan !== undefined && (
        <>
          <p class="plan-count" role="status">
            {P.summary(P.sets(count), P.calls(count))}
          </p>
          {warn && !tooBig && (
            <p class="banner banner--error" role="alert">
              {P.warning(SERIES_WARNING_SETS)}
            </p>
          )}
          {tooBig && (
            <p class="banner banner--error" role="alert">
              {P.tooBig(SERIES_MAX_SETS)}
            </p>
          )}
          <p class="note">{P.explain}</p>
        </>
      )}
      {failed && (
        <p class="banner banner--error" role="alert">
          {P.failed}
        </p>
      )}
    </Sheet>
  );
}

/**
 * S10: search for a theme (Rebrickable sub themes), the plan before a series is created, and "Meine
 * Reihen" with their progress, the latest opened first.
 */
export function SeriesPage({
  data,
  builder,
}: {
  readonly data: LoadedCollection;
  readonly builder: SeriesBuilder | undefined;
}) {
  const [query, setQuery] = useState("");
  const [themes, setThemes] = useState<readonly SeriesTheme[] | undefined>();
  const [more, setMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [problem, setProblem] = useState<Problem | undefined>();
  const [chosen, setChosen] = useState<SeriesTheme | undefined>();
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const run = useRef(0);
  const collection = data.state.status === "ready" ? data.state.collection : undefined;

  useEffect(() => {
    const text = query.trim();
    const mine = ++run.current;
    if (!builder || text.length < 2) {
      setThemes(undefined);
      setSearching(false);
      setProblem(undefined);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      builder.search(text).then(
        (found) => {
          if (run.current !== mine) return;
          setThemes(found.themes);
          setMore(found.more);
          setProblem(undefined);
          setSearching(false);
        },
        (error: unknown) => {
          if (run.current !== mine) return;
          setProblem(problemOf(error));
          setThemes(undefined);
          setSearching(false);
        },
      );
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [builder, query]);

  useEffect(() => {
    if (!builder || !collection) return;
    let active = true;
    setLoaded({ status: "loading" });
    loadEntries(builder, collection).then(
      (entries) => active && setLoaded({ status: "ready", entries }),
      () => active && setLoaded({ status: "failed" }),
    );
    return () => {
      active = false;
    };
    // The collection changes while the page is open (wishes); the entries are read once per visit.
  }, [builder, collection !== undefined, attempt]);

  return (
    <>
      <WishSwitch current="series" />
      <div class="field">
        <label class="visually-hidden" for="series-search">
          {T.searchLabel}
        </label>
        <div class="search search--page" data-open="true">
          <input
            id="series-search"
            class="search__input"
            type="search"
            placeholder={T.searchPlaceholder}
            value={query}
            onInput={(event) => setQuery(event.currentTarget.value)}
            aria-describedby="series-search-hint"
          />
          <span class="search__icon" aria-hidden="true">
            <Icon name="search" size={20} />
          </span>
        </div>
        <p class="field__hint" id="series-search-hint">
          {T.searchHint}
        </p>
      </div>

      {searching && (
        <p class="card__text" role="status">
          {T.searching}
        </p>
      )}
      {problem && (
        <p class="banner banner--error" role="alert">
          {T.searchFailed[problem]}
        </p>
      )}
      {themes && !searching && themes.length === 0 && (
        <p class="card__text" role="status">
          {T.noThemes}
        </p>
      )}
      {themes && themes.length > 0 && (
        <ul class="series-results">
          {themes.map((theme, index) => (
            <li key={theme.id}>
              {theme.selectable ? (
                <button
                  type="button"
                  class="series-result pressable"
                  data-below-main={isBelowMain(themes, index) || undefined}
                  onClick={() => setChosen(theme)}
                >
                  <span class="series-result__text">
                    {themeLabel(theme)}
                    {theme.onlySet && <span class="series-result__note">{T.onlySetNote}</span>}
                    {theme.via && (
                      <span class="series-result__note">
                        {T.foundBy[theme.via.kind](theme.via.number)}
                      </span>
                    )}
                  </span>
                  <Icon name="plus" size={20} />
                </button>
              ) : (
                <div class="series-result series-result--main">
                  <span class="series-result__text">
                    {theme.name}
                    <span class="series-result__note">{T.tooBigTheme}</span>
                    {theme.via && (
                      <span class="series-result__note">
                        {T.foundBy[theme.via.kind](theme.via.number)}
                      </span>
                    )}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {more && !searching && <p class="note">{T.moreHits}</p>}

      <h2 class="section-title">{T.mine}</h2>
      {loaded.status === "loading" && (
        <p class="card__text" role="status">
          {T.loading}
        </p>
      )}
      {loaded.status === "failed" && (
        <>
          <p class="card__text" role="alert">
            {T.loadFailed}
          </p>
          <button
            type="button"
            class="button button--secondary pressable"
            onClick={() => setAttempt(attempt + 1)}
          >
            {T.retry}
          </button>
        </>
      )}
      {loaded.status === "ready" && loaded.entries.length === 0 && (
        <p class="card__text">{T.empty}</p>
      )}
      {loaded.status === "ready" && loaded.entries.length > 0 && (
        <ul class="series-list">
          {loaded.entries.map(({ summary, present, total }) => (
            <li key={summary.id}>
              <a
                class="series-card pressable"
                href={seriesHash({ kind: "detail", id: summary.id })}
              >
                <span class="series-card__head">
                  <span class="series-card__name">{summary.name}</span>
                  <span class="series-card__count">{T.progress(present, total)}</span>
                </span>
                <span class="progress-bar" role="img" aria-label={T.progressLabel(present, total)}>
                  <span
                    class="progress-bar__fill"
                    style={{ display: "block", width: `${seriesPercent({ present, total })}%` }}
                  />
                </span>
                {buildState(summary) && <span class="tile__meta">{buildState(summary)}</span>}
              </a>
            </li>
          ))}
        </ul>
      )}

      {chosen && builder && (
        <PlanSheet builder={builder} theme={chosen} onClose={() => setChosen(undefined)} />
      )}
    </>
  );
}
