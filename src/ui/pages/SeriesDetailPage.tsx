import { useEffect, useState } from "preact/hooks";
import type { Remote } from "../../backend/remote";
import {
  type SeriesBuilder,
  type SeriesDetail,
  seriesAsked,
  seriesOpen,
} from "../../backend/seriesBuilder";
import { formatDateTime } from "../../domain/dates";
import {
  catalogFiguresOf,
  filterSeries,
  type SeriesFigure,
  type SeriesFilter,
  seriesPercent,
  seriesProgress,
} from "../../domain/series";
import {
  newWishValues,
  wishForFigure,
  wishSourceOfFigure,
  wishValuesOf,
} from "../../domain/wishForm";
import { Cover } from "../components/Cover";
import { Choice } from "../components/Fields";
import { Icon } from "../components/Icon";
import { Scribbles } from "../components/Scribbles";
import { WishSheet } from "../components/WishSheet";
import { detailHash, formHash, seriesHash } from "../route";
import { TEXTS } from "../texts";
import type { LoadedCollection } from "../useCollection";
import { wishActions } from "../wishActions";

const T = TEXTS.series.detail;
const FILTERS: readonly SeriesFilter[] = ["all", "missing", "present"];

type Load =
  | { readonly status: "loading" }
  | { readonly status: "failed" }
  | { readonly status: "ready"; readonly detail: SeriesDetail | null };

/**
 * S10a: one series with how much of it is there (F13): present figures link to the figure, missing
 * ones open the wish sheet. While the series is still being built the page works on it and the list
 * grows; at the day's limit it says when it goes on.
 */
export function SeriesDetailPage({
  id,
  data,
  builder,
  remote,
}: {
  readonly id: number;
  readonly data: LoadedCollection;
  readonly builder: SeriesBuilder | undefined;
  readonly remote: Remote | undefined;
}) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [workFailed, setWorkFailed] = useState(false);
  const [filter, setFilter] = useState<SeriesFilter>("all");
  const [picked, setPicked] = useState<SeriesFigure | undefined>();
  const [sure, setSure] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (!builder) {
      setLoad({ status: "failed" });
      return;
    }
    let active = true;
    setLoad({ status: "loading" });
    setWorkFailed(false);
    const show = (detail: SeriesDetail | null) => active && setLoad({ status: "ready", detail });
    (async () => {
      let detail = await builder.get(id, true);
      show(detail);
      // Works on the build while this page is open; the cron job goes on without it.
      while (active && detail && seriesOpen(detail.summary)) {
        const before = seriesAsked(detail.summary);
        let next: Awaited<ReturnType<SeriesBuilder["work"]>>;
        try {
          next = await builder.work(id);
        } catch {
          if (active) setWorkFailed(true);
          return;
        }
        detail = await builder.get(id, false);
        show(detail);
        if (seriesAsked(next) <= before) return;
      }
    })().catch(() => active && setLoad({ status: "failed" }));
    return () => {
      active = false;
    };
  }, [builder, id, attempt]);

  const back = (
    <header class="page-header">
      <a
        class="icon-button back-link pressable"
        href={seriesHash({ kind: "list" })}
        aria-label={TEXTS.series.back}
      >
        <Icon name="back" />
      </a>
      <h1 class="page-title page-title--small" tabIndex={-1}>
        {T.title}
      </h1>
      <span class="header-spacer" />
    </header>
  );

  if (load.status === "loading" || data.state.status === "loading") {
    return (
      <>
        {back}
        <div class="skeleton" role="status" aria-label={TEXTS.series.loading} aria-busy="true">
          <div class="skeleton__card" />
          <div class="skeleton__card" />
        </div>
      </>
    );
  }
  if (load.status === "failed" || data.state.status === "failed") {
    return (
      <>
        {back}
        <section class="card" role="alert" aria-labelledby="series-failed-title">
          <h2 class="card__title" id="series-failed-title">
            {TEXTS.series.loadFailed}
          </h2>
          <button
            type="button"
            class="button button--secondary pressable"
            onClick={() =>
              data.state.status === "failed" ? data.retry() : setAttempt(attempt + 1)
            }
          >
            {TEXTS.series.retry}
          </button>
        </section>
      </>
    );
  }
  if (load.detail === null) {
    return (
      <>
        {back}
        <section class="card" aria-labelledby="series-missing-title">
          <h2 class="card__title" id="series-missing-title">
            {T.notFound.title}
          </h2>
          <p class="card__text">{T.notFound.text}</p>
        </section>
      </>
    );
  }

  const { summary, figures } = load.detail;
  const { collection } = data.state;
  const progress = seriesProgress(
    catalogFiguresOf(figures),
    collection.minifigs,
    collection.wishlist,
  );
  const shown = filterSeries(progress.figures, filter);
  const open = seriesOpen(summary);
  const pickedWish = picked
    ? wishForFigure(collection.wishlist, picked.figure.bricklinkId)
    : undefined;

  const remove = async () => {
    if (!builder) return;
    setRemoving(true);
    try {
      await builder.remove(id);
      location.hash = seriesHash({ kind: "list" });
    } catch {
      setRemoving(false);
      setWorkFailed(true);
    }
  };

  return (
    <>
      {back}
      <section class="series-hero" aria-labelledby="series-hero-name">
        <Scribbles id="series-hero-scribbles" />
        <span class="tile__meta" id="series-hero-name">
          {summary.name}
        </span>
        <div class="series-hero__count">
          <span class="series-hero__number">{progress.present}</span>
          <span>{T.figuresOf(progress.total)}</span>
        </div>
        <div
          class="progress-bar"
          role="img"
          aria-label={TEXTS.series.progressLabel(progress.present, progress.total)}
        >
          <div class="progress-bar__fill" style={{ width: `${seriesPercent(progress)}%` }} />
        </div>
        <span class="card__text">
          {progress.total === 0
            ? T.noFigures
            : progress.missing === 0
              ? T.allThere
              : T.missingLine(progress.missing, progress.wished)}
        </span>
      </section>

      {open && (
        <p class="banner" role="status">
          {T.building(seriesAsked(summary), summary.total)}
        </p>
      )}
      {!open && summary.finishedAt === undefined && summary.pausedUntil !== undefined && (
        <p class="banner" role="status">
          {T.paused(formatDateTime(summary.pausedUntil))}
        </p>
      )}
      {summary.failed > 0 && <p class="note">{T.failedSets(summary.failed)}</p>}
      {workFailed && (
        <p class="banner banner--error" role="alert">
          {T.workFailed}
        </p>
      )}

      {progress.total > 0 && (
        <>
          <Choice
            legend={T.filterLabel}
            hideLegend
            options={FILTERS.map((value) => ({ value, label: T.filters[value] }))}
            value={filter}
            onChange={setFilter}
          />
          <p class="series-legend">
            <span>{T.legend.present}</span>
            <span>{T.legend.wished}</span>
            <span>{T.legend.missing}</span>
          </p>
          {shown.length === 0 ? (
            <p class="card__text">{T.nothingShown}</p>
          ) : (
            <ul class="figure-grid figure-grid--round">
              {shown.map(({ figure, status, copies }, index) => {
                const key = `${figure.bricklinkId ?? figure.name}-${index}`;
                const first = copies[0];
                const body = (
                  <>
                    <span class="series-tile__cover">
                      <Cover
                        image={
                          figure.imageUrl ? { kind: "catalog", url: figure.imageUrl } : undefined
                        }
                        alt=""
                        tintKey={key}
                        scribbleId={`series-${id}-${index}`}
                        variant="small"
                      />
                      {status !== "missing" && (
                        <span class="series-tile__badge" aria-hidden="true">
                          <Icon
                            name={status === "present" ? "check" : "wishlist"}
                            size={14}
                            strokeWidth={3}
                          />
                        </span>
                      )}
                    </span>
                    <span class="figure-tile__name">{figure.name}</span>
                    <span class={status === "missing" ? "series-tile__hint" : "visually-hidden"}>
                      {status === "missing"
                        ? T.addToWishlist
                        : status === "present"
                          ? T.statusPresent
                          : T.statusWished}
                    </span>
                  </>
                );
                return (
                  <li key={key}>
                    {first ? (
                      <a
                        class="figure-tile pressable"
                        href={detailHash({ type: "minifig", id: first.id })}
                      >
                        {body}
                      </a>
                    ) : (
                      <button
                        type="button"
                        class={`figure-tile series-tile pressable${status === "missing" ? " series-tile--missing" : ""}`}
                        onClick={() => setPicked(progress.figures.find((f) => f.figure === figure))}
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {sure ? (
        <div class="card">
          <p class="card__text">{T.removeSure}</p>
          <div class="choice-row">
            <button
              type="button"
              class="button button--danger pressable"
              disabled={removing}
              onClick={() => void remove()}
            >
              {T.removeConfirm}
            </button>
            <button
              type="button"
              class="button button--secondary pressable"
              onClick={() => setSure(false)}
            >
              {T.removeKeep}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          class="button button--secondary button--flat pressable"
          onClick={() => setSure(true)}
        >
          <Icon name="trash" size={20} />
          {T.remove}
        </button>
      )}

      {picked && (
        <WishSheet
          source={wishSourceOfFigure(picked.figure, {
            theme: summary.name,
            fromSeries: summary.name,
          })}
          initial={pickedWish ? wishValuesOf(pickedWish) : newWishValues("minifig")}
          existing={pickedWish}
          prices={collection.prices}
          actions={wishActions(remote, data.update)}
          onClose={() => setPicked(undefined)}
          onReceived={
            pickedWish
              ? () => {
                  location.hash = formHash({ type: "minifig", mode: "wish", id: pickedWish.id });
                }
              : undefined
          }
        />
      )}
    </>
  );
}
