// `SeriesBuilder` from a few example themes in memory: the demo and the end-to-end tests (the real
// build lives in the Edge Function `bricklink`). Like the real one it creates a series with the
// sets of a theme in a queue, works a few sets per call, collects the figures of the finished sets
// and can be held back by the day's BrickLink limit. The state is kept in the device's storage, if
// given, so it survives a reload like the real one.

import { classifyQuery, plain, searchWords } from "../../supabase/functions/_shared/themeQuery";
import { CatalogCallError } from "./catalog";
import {
  SERIES_MAX_SETS,
  type SeriesBuilder,
  type SeriesDetail,
  type SeriesFigureInfo,
  type SeriesPlan,
  type SeriesSearch,
  type SeriesSummary,
  type SeriesTheme,
} from "./seriesBuilder";

/** A theme of the example catalog with the numbers of its sets. */
export interface FakeTheme {
  readonly id: number;
  readonly name: string;
  readonly sets: readonly string[];
  /** A main theme with sub themes: listed by the search, but no series can be built from it. */
  readonly large?: true;
}

/** The example catalog: the themes, and the figures of each set (a set without an entry has none). */
export interface FakeSeriesCatalog {
  readonly themes: readonly FakeTheme[];
  readonly figuresOfSet: Readonly<Record<string, readonly SeriesFigureInfo[]>>;
}

/** How the fake answers when told otherwise (the fake build reads it from the device's storage). */
export type SeriesControl = "offline" | "unavailable" | "limit_reached" | undefined;

/** Where the fake keeps its state in the device's storage. */
export const FAKE_SERIES_KEY = "stud-stephan-fake:series";

interface FakeSeries {
  summary: SeriesSummary;
  /** Numbers of the sets still to do. */
  queue: string[];
  found: Record<string, SeriesFigureInfo>;
}

interface FakeState {
  nextId: number;
  series: FakeSeries[];
}

export interface FakeSeriesOptions {
  readonly control?: () => SeriesControl;
  readonly now?: () => Date;
  readonly storage?: Pick<Storage, "getItem" | "setItem"> | undefined;
  /** Sets per call (the real function does as many as fit into 20 s). */
  readonly portion?: number;
}

/** Sets of a minifig that lead to a theme (as in the real function). */
const MAX_FIGURE_SETS = 3;

export class FakeSeriesBuilder implements SeriesBuilder {
  /** Every call, newest last, to check what the page asked for. */
  readonly calls: string[] = [];
  private memory: FakeState = { nextId: 1, series: [] };

  constructor(
    private readonly catalog: FakeSeriesCatalog,
    private readonly options: FakeSeriesOptions = {},
  ) {}

  async search(query: string): Promise<SeriesSearch> {
    this.calls.push(`search ${query}`);
    this.check();
    const kind = classifyQuery(query);
    if (kind.kind !== "words") {
      const found = this.byNumber(kind.kind, kind.number);
      if (found.length > 0) return { themes: found, more: false };
    }
    const words = searchWords(query);
    if (words.length === 0) return { themes: [], more: false };
    const themes = this.catalog.themes
      .filter((theme) => words.every((word) => plain(theme.name).includes(word)))
      .sort((a, b) => a.name.localeCompare(b.name, "de"))
      .map((theme) => this.hit(theme));
    return { themes, more: false };
  }

  /** The themes of the set, or of the first sets the minifig is in. */
  private byNumber(kind: "set" | "figure", number: string): SeriesTheme[] {
    const sets =
      kind === "set"
        ? [number]
        : Object.entries(this.catalog.figuresOfSet)
            .filter(([, figures]) => figures.some((figure) => figure.number === number))
            .map(([setNumber]) => setNumber)
            .slice(0, MAX_FIGURE_SETS);
    const themes = this.catalog.themes.filter((theme) =>
      theme.sets.some((setNumber) => sets.includes(setNumber)),
    );
    return themes.map((theme) => this.hit(theme, { kind, number }));
  }

  private hit(theme: FakeTheme, via?: SeriesTheme["via"]): SeriesTheme {
    return {
      id: theme.id,
      name: theme.name,
      selectable: theme.large !== true,
      ...(via === undefined ? {} : { via }),
    };
  }

  async plan(themeId: number): Promise<SeriesPlan> {
    this.calls.push(`plan ${themeId}`);
    this.check();
    const theme = this.theme(themeId);
    return {
      theme: { id: theme.id, name: theme.name, selectable: true },
      setCount: theme.sets.length,
    };
  }

  async start(themeId: number): Promise<SeriesSummary> {
    this.calls.push(`start ${themeId}`);
    this.check();
    const theme = this.theme(themeId);
    if (theme.sets.length > SERIES_MAX_SETS) {
      throw new CatalogCallError("Zu viele Sets", "bad_request");
    }
    const state = this.lifted(this.read());
    const known = state.series.find((series) => series.summary.themeId === themeId);
    if (known) return structuredClone(known.summary);
    const now = this.now().toISOString();
    const series: FakeSeries = {
      summary: {
        id: state.nextId++,
        themeId,
        name: theme.name,
        total: theme.sets.length,
        done: 0,
        failed: 0,
        figureCount: 0,
        createdAt: now,
        openedAt: now,
      },
      queue: [...theme.sets],
      found: {},
    };
    if (series.queue.length === 0) series.summary.finishedAt = now;
    state.series.push(series);
    this.write(state);
    return structuredClone(series.summary);
  }

  async work(id: number): Promise<SeriesSummary> {
    this.calls.push(`work ${id}`);
    const control = this.control();
    this.check();
    const state = this.read();
    const series = this.find(state, id);
    const now = this.now();
    if (series.summary.finishedAt === undefined) {
      if (control === "limit_reached") {
        const tomorrow = new Date(now);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(0, 5, 0, 0);
        series.summary.pausedUntil = tomorrow.toISOString();
      } else {
        // The next day has come: the build goes on.
        delete series.summary.pausedUntil;
        this.workPortion(series, now);
      }
    }
    this.write(state);
    return structuredClone(series.summary);
  }

  async list(): Promise<SeriesSummary[]> {
    this.calls.push("list");
    this.check();
    return this.lifted(this.read())
      .series.map((series) => structuredClone(series.summary))
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt) || b.id - a.id);
  }

  async get(id: number, touch: boolean): Promise<SeriesDetail | null> {
    this.calls.push(`get ${id} ${touch}`);
    this.check();
    const state = this.lifted(this.read());
    const series = state.series.find((candidate) => candidate.summary.id === id);
    if (!series) return null;
    if (touch) {
      series.summary.openedAt = this.now().toISOString();
      this.write(state);
    }
    return {
      summary: structuredClone(series.summary),
      figures: Object.values(series.found).sort(
        (a, b) => a.name.localeCompare(b.name, "de") || a.number.localeCompare(b.number),
      ),
    };
  }

  async remove(id: number): Promise<void> {
    this.calls.push(`remove ${id}`);
    this.check();
    const state = this.read();
    state.series = state.series.filter((series) => series.summary.id !== id);
    this.write(state);
  }

  private workPortion(series: FakeSeries, now: Date): void {
    for (const number of series.queue.splice(0, this.options.portion ?? 2)) {
      for (const figure of this.catalog.figuresOfSet[number] ?? []) {
        series.found[figure.number] ??= { ...figure };
      }
      series.summary.done += 1;
    }
    series.summary.figureCount = Object.keys(series.found).length;
    if (series.queue.length === 0) series.summary.finishedAt = now.toISOString();
  }

  private theme(themeId: number): FakeTheme {
    const theme = this.catalog.themes.find((candidate) => candidate.id === themeId);
    // A main theme with sub themes is no series, as in the real function.
    if (!theme || theme.large === true) throw new CatalogCallError("Thema unbekannt", "not_found");
    return theme;
  }

  private find(state: FakeState, id: number): FakeSeries {
    const series = state.series.find((candidate) => candidate.summary.id === id);
    if (!series) throw new CatalogCallError("Reihe unbekannt", "not_found");
    return series;
  }

  /** Without the limit the day is over: a paused series is not paused any more (as the database says). */
  private lifted(state: FakeState): FakeState {
    if (this.control() !== "limit_reached") {
      for (const series of state.series) delete series.summary.pausedUntil;
    }
    return state;
  }

  private control(): SeriesControl {
    return this.options.control?.();
  }

  private check(): void {
    const control = this.control();
    if (control === "offline") throw new CatalogCallError("Keine Verbindung", "offline");
    if (control === "unavailable") throw new CatalogCallError("Dienst gestört", "unavailable");
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }

  private read(): FakeState {
    const { storage } = this.options;
    if (!storage) return structuredClone(this.memory);
    try {
      const stored = storage.getItem(FAKE_SERIES_KEY);
      return stored ? (JSON.parse(stored) as FakeState) : { nextId: 1, series: [] };
    } catch {
      return structuredClone(this.memory);
    }
  }

  private write(state: FakeState): void {
    this.memory = structuredClone(state);
    try {
      this.options.storage?.setItem(FAKE_SERIES_KEY, JSON.stringify(state));
    } catch {
      // The state stays in memory.
    }
  }
}
