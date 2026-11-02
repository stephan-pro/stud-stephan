import { useMemo, useRef, useState } from "preact/hooks";
import { formatMoneyWhole, formatPercentChange } from "../../domain/money";
import { idsNotOnDisplay } from "../../domain/placement";
import {
  activeFilterCount,
  type CopyGroup,
  NO_FILTER,
  type ShowcaseFilter,
  type ShowcaseSort,
  type ShowcaseType,
  showcase,
  showcaseItems,
  tileFacts,
} from "../../domain/showcase";
import { totals } from "../../domain/totals";
import type { Collection } from "../../domain/types";
import { weeklyChange } from "../../domain/valueHistory";
import { CopyRow } from "../components/CopyRow";
import { FilterSheet } from "../components/FilterSheet";
import { Icon } from "../components/Icon";
import { Scribbles } from "../components/Scribbles";
import { Sheet } from "../components/Sheet";
import { Tile } from "../components/Tile";
import { today } from "../ids";
import { routeHash } from "../route";
import { TEXTS } from "../texts";
import type { LoadedCollection } from "../useCollection";

/** What the showcase shows, kept by the shell so it survives a visit to a detail page. */
export interface ShowcaseView {
  readonly filter: ShowcaseFilter;
  readonly sort: ShowcaseSort;
  /** The search field on the phone (on the PC it is always there). */
  readonly searchOpen: boolean;
}

export const INITIAL_VIEW: ShowcaseView = { filter: NO_FILTER, sort: "recent", searchOpen: false };

const TYPES: readonly ShowcaseType[] = ["all", "minifig", "legoSet", "specialPart"];
const SORTS: readonly ShowcaseSort[] = ["recent", "name", "value"];

function CollectionCard({ collection }: { readonly collection: Collection }) {
  const T = TEXTS.showcase.card;
  const { value, counts } = totals(collection);
  const week = weeklyChange(collection, today());
  return (
    <section class="collection-card" aria-labelledby="collection-card-title">
      <Scribbles id="collection-card-scribbles" />
      <div class="collection-card__content">
        <div class="collection-card__top">
          <h2 class="collection-card__brand" id="collection-card-title">
            {TEXTS.appName}
          </h2>
          {week && (
            <span class="badge">
              <Icon name={week.percent < 0 ? "trendDown" : "trendUp"} size={14} strokeWidth={3} />
              {T.week(formatPercentChange(week.percent))}
            </span>
          )}
        </div>
        <hr class="collection-card__rule" />
        <p class="collection-card__lead">{T.lead}</p>
        <p class="collection-card__value">
          <span class="collection-card__amount">{formatMoneyWhole(value)}</span>
          <span class="collection-card__worth">{T.worth}</span>
        </p>
        <ul class="pills">
          <li class="pill">{T.figures(counts.minifigs)}</li>
          <li class="pill">{T.sets(counts.sets)}</li>
          <li class="pill">{T.dioramas(counts.dioramas)}</li>
        </ul>
      </div>
    </section>
  );
}

function Skeleton() {
  return (
    <div class="skeleton" role="status" aria-label={TEXTS.showcase.loading} aria-busy="true">
      <div class="skeleton__card" />
      <div class="grid" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} class="skeleton__tile" />
        ))}
      </div>
    </div>
  );
}

/** The sheet that lets Stephan pick one of several copies of a figure (the "×3" tile). */
function CopyChooser({
  group,
  collection,
  onClose,
}: {
  readonly group: CopyGroup;
  readonly collection: Collection;
  readonly onClose: () => void;
}) {
  const T = TEXTS.showcase.copies;
  return (
    <Sheet
      id="copy-chooser"
      title={T.title(group.copies[0]?.name ?? "")}
      closeLabel={T.close}
      onClose={onClose}
    >
      <p class="card__text">{T.text(group.copies.length)}</p>
      <ul class="copy-list">
        {group.copies.map((copy) => (
          <li key={copy.id}>
            <CopyRow copy={copy} prices={collection.prices} />
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

interface ShowcasePageProps {
  readonly data: LoadedCollection;
  readonly view: ShowcaseView;
  readonly onView: (view: ShowcaseView) => void;
}

/** S1: the collection card, search, chips, sort and filter, and the grid of tiles. */
export function ShowcasePage({ data, view, onView }: ShowcasePageProps) {
  const T = TEXTS.showcase;
  const [filterOpen, setFilterOpen] = useState(false);
  const [chosen, setChosen] = useState<CopyGroup | undefined>();
  // What opened a sheet gets the focus back when it closes. Safari does not focus a button on a
  // click, so the browser's own "back to where it was" lands on nothing there.
  const opener = useRef<HTMLElement | null>(null);
  const closeSheet = (close: () => void) => () => {
    close();
    opener.current?.focus();
  };
  const { state } = data;
  const collection = state.status === "ready" ? state.collection : undefined;
  const notOnDisplay = useMemo(
    () => (collection ? idsNotOnDisplay(collection) : new Set<string>()),
    [collection],
  );

  const entries = useMemo(
    () => (collection ? showcase(collection, view.filter, view.sort) : []),
    [collection, view.filter, view.sort],
  );

  if (state.status === "loading") return <Skeleton />;
  if (!collection) {
    return (
      <section class="card" role="alert" aria-labelledby="load-failed-title">
        <h2 class="card__title" id="load-failed-title">
          {T.loadFailed.title}
        </h2>
        <p class="card__text">{T.loadFailed.text}</p>
        <button type="button" class="button button--secondary pressable" onClick={data.retry}>
          {T.loadFailed.retry}
        </button>
      </section>
    );
  }

  const setFilter = (filter: ShowcaseFilter) => onView({ ...view, filter });
  const activeFilters = activeFilterCount(view.filter);
  const narrowed =
    activeFilters > 0 || view.filter.query.trim() !== "" || view.filter.type !== "all";

  return (
    <>
      <CollectionCard collection={collection} />
      {showcaseItems(collection).length === 0 ? (
        <section class="card" aria-labelledby="empty-title">
          <h2 class="card__title" id="empty-title">
            {T.empty.title}
          </h2>
          <p class="card__text">{T.empty.text}</p>
          <a class="button button--primary pressable" href={routeHash("capture")}>
            {T.empty.action}
          </a>
        </section>
      ) : (
        <>
          <div class="controls">
            <fieldset class="chips">
              <legend class="visually-hidden">{T.typeGroup}</legend>
              {TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  class="chip pressable"
                  aria-pressed={view.filter.type === type}
                  onClick={() => setFilter({ ...view.filter, type })}
                >
                  {T.types[type]}
                </button>
              ))}
            </fieldset>
            <div class="toolbar">
              <label class="sort">
                <span class="visually-hidden">{T.sortLabel}</span>
                <select
                  class="sort__select"
                  value={view.sort}
                  onChange={(event) =>
                    onView({ ...view, sort: event.currentTarget.value as ShowcaseSort })
                  }
                >
                  {SORTS.map((sort) => (
                    <option key={sort} value={sort}>
                      {T.sorts[sort]}
                    </option>
                  ))}
                </select>
                <Icon name="chevron" size={16} strokeWidth={2.4} />
              </label>
              <button
                type="button"
                class="chip chip--filter pressable"
                aria-haspopup="dialog"
                aria-label={activeFilters > 0 ? T.filterButtonActive(activeFilters) : undefined}
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  setFilterOpen(true);
                }}
              >
                <Icon name="filter" size={18} />
                {T.filterButton}
                {activeFilters > 0 && (
                  <span class="chip__count" aria-hidden="true">
                    {activeFilters}
                  </span>
                )}
              </button>
            </div>
          </div>
          <p class="visually-hidden" role="status">
            {T.results(entries.length)}
          </p>
          {entries.length === 0 ? (
            <section class="card" aria-labelledby="no-results-title">
              <h2 class="card__title" id="no-results-title">
                {T.noResults.title}
              </h2>
              <p class="card__text">{T.noResults.text}</p>
              {narrowed && (
                <button
                  type="button"
                  class="button button--secondary pressable"
                  onClick={() => setFilter(NO_FILTER)}
                >
                  {T.noResults.reset}
                </button>
              )}
            </section>
          ) : (
            <div class="grid">
              {entries.map((entry) => (
                <Tile
                  key={entry.key}
                  entry={entry}
                  facts={tileFacts(entry, collection.prices, notOnDisplay)}
                  onChooseCopy={(group, element) => {
                    opener.current = element;
                    setChosen(group);
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
      {filterOpen && (
        <FilterSheet
          collection={collection}
          filter={view.filter}
          sort={view.sort}
          onChange={setFilter}
          onClose={closeSheet(() => setFilterOpen(false))}
        />
      )}
      {chosen && (
        <CopyChooser
          group={chosen}
          collection={collection}
          onClose={closeSheet(() => setChosen(undefined))}
        />
      )}
    </>
  );
}
