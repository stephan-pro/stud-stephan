// Series (P12, F13) as the function `bricklink` answers them. Shared by the functions and by the
// app, which only imports the types.
//
// A series is a theme of Rebrickable (a sub theme like "Star Wars – The Clone Wars", not a main
// theme). Building it asks Rebrickable for the sets of the theme and BrickLink for the minifigs of
// every set (one call per set, within the day's limit), so the build goes on over several calls and,
// if the day's limit is reached, on the next day.

/** A theme the person can build a series from. */
export interface SeriesTheme {
  /** Rebrickable's theme id. */
  id: number;
  /** "Main theme – sub theme". */
  name: string;
  /**
   * `false` for a main theme with sub themes: it is shown as a heading ("sehr groß – wähle ein
   * Unterthema"), its sub themes follow it, and no series is built from it.
   */
  selectable: boolean;
  /** The set or minifig number the theme was found by (the person typed a number). */
  via?: { kind: "set" | "figure"; number: string };
  /**
   * "Nur dieses Set": a series of this one set instead of a theme (the person typed its number).
   * `id` is then `singleSetId(number)`, not a theme id of Rebrickable.
   */
  onlySet?: { number: string; figureCount: number };
}

/**
 * Series ids of a single set share the id column of themes: `SINGLE_SET_BASE` + number * 10 +
 * (variant - 1) for "75455-1". Rebrickable's theme ids are far below the base. A set number of
 * another shape ("COMCON001-1") has no such id and so no "Nur dieses Set".
 */
export const SINGLE_SET_BASE = 1_000_000_000;

export function singleSetId(setNumber: string): number | undefined {
  const match = /^(\d{1,8})-([1-9])$/.exec(setNumber);
  if (!match) return undefined;
  return SINGLE_SET_BASE + Number(match[1]) * 10 + Number(match[2]) - 1;
}

/** The set number a `singleSetId` stands for; nothing for a theme id. */
export function setNumberOfSingleId(id: number): string | undefined {
  if (!Number.isInteger(id) || id < SINGLE_SET_BASE) return undefined;
  const rest = id - SINGLE_SET_BASE;
  return `${Math.floor(rest / 10)}-${(rest % 10) + 1}`;
}

/** The answer to a search: the themes, and whether more fit than were taken. */
export interface SeriesSearch {
  themes: SeriesTheme[];
  more: boolean;
}

/** What building a series costs, shown before it is created. */
export interface SeriesPlan {
  theme: SeriesTheme;
  /** Sets of the theme (and of its sub themes), each one is one BrickLink call. */
  setCount: number;
}

/** From this many sets on the app warns before creating a series (one BrickLink call per set). */
export const SERIES_WARNING_SETS = 300;

/** The most sets one series may have; a bigger theme is refused ("bad_request"). */
export const SERIES_MAX_SETS = 1000;

/** One series of the person with the state of its build. */
export interface SeriesSummary {
  id: number;
  themeId: number;
  name: string;
  /** Sets to ask BrickLink about. */
  total: number;
  /** Sets whose figures are known. */
  done: number;
  /** Sets BrickLink did not answer for (or does not know). */
  failed: number;
  /** Different figures found so far. */
  figureCount: number;
  /** ISO 8601. */
  createdAt: string;
  /** The last time the person opened the series ("Meine Reihen" lists the latest first). */
  openedAt: string;
  /** Missing while sets are left. */
  finishedAt?: string;
  /** The day's BrickLink calls are used up; the build goes on after this time. */
  pausedUntil?: string;
}

/** A figure of a series: BrickLink number, name, picture. */
export interface SeriesFigureInfo {
  number: string;
  name: string;
  imageUrl?: string;
}

export interface SeriesDetail {
  summary: SeriesSummary;
  /** Every figure found so far, once, sorted by name. */
  figures: SeriesFigureInfo[];
}

export type SeriesRequest =
  | { op: "series"; action: "search"; query: string }
  | { op: "series"; action: "plan"; themeId: number }
  | { op: "series"; action: "start"; themeId: number }
  | { op: "series"; action: "work"; id: number }
  | { op: "series"; action: "list" }
  /** `touch`: opening the series counts as "zuletzt geöffnet" (not when the list only reads it). */
  | { op: "series"; action: "get"; id: number; touch: boolean }
  | { op: "series"; action: "remove"; id: number };

export type SeriesAnswer =
  | ({ action: "search" } & SeriesSearch)
  | { action: "plan"; plan: SeriesPlan }
  | { action: "start" | "work"; summary: SeriesSummary }
  | { action: "list"; series: SeriesSummary[] }
  | { action: "get"; detail: SeriesDetail | null }
  | { action: "remove" };
