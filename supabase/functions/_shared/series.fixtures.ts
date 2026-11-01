// Test helpers of the series build (P12): Rebrickable's themes and sets, BrickLink's subsets, and the
// queue of the database in memory, following the rules of `series_begin`, `…_claim`, `…_finish`,
// `…_release`.

import { brickLink, brickLinkFailure, ok, type Route } from "./catalog.fixtures.ts";
import type { ClaimedSet, SeriesStore, SetOutcome } from "./seriesStore.ts";
import type { SeriesDetail, SeriesSummary } from "./seriesTypes.ts";

/**
 * The theme tree as Rebrickable sends it (`id`, `name`, `parent_id`; roots have none): "Star Wars"
 * with sub themes (one with a sub theme of its own), "Super Heroes", "Collectible Minifigures", roots
 * without sub themes, and filler roots so that the list is as long as a real one needs to look.
 */
export const THEMES = [
  { id: 1, name: "Star Wars" },
  { id: 2, name: "The Clone Wars", parent_id: 1 },
  { id: 3, name: "Battle Packs", parent_id: 1 },
  { id: 7, name: "Season 1", parent_id: 2 },
  { id: 8, name: "Episode IV/V/VI", parent_id: 1 },
  { id: 9, name: "The Mandalorian", parent_id: 1 },
  { id: 4, name: "Collectible Minifigures" },
  { id: 5, name: "The LEGO Batman Movie Series", parent_id: 4 },
  { id: 6, name: "Ninjago" },
  { id: 10, name: "Super Heroes" },
  { id: 11, name: "Spider-Man", parent_id: 10 },
  { id: 12, name: "Batman", parent_id: 10 },
  { id: 13, name: "The Lord of the Rings" },
  { id: 14, name: "Castle" },
  { id: 15, name: "Knights Kingdom", parent_id: 14 },
  ...Array.from({ length: 60 }, (_, index) => ({ id: 1000 + index, name: `Other ${index + 1}` })),
];

const set = (number: string) => ({ set_num: number, name: `Set ${number}`, year: 2020 });

/** A set with its theme, as Rebrickable's set page sends it. */
const setPage = (number: string, themeId: number) => ({
  set_num: number,
  name: `Set ${number}`,
  year: 2020,
  theme_id: themeId,
});

/** Rebrickable routes: all themes in one page, the sets of each theme, the theme of some sets. */
export function seriesRebrickableRoutes(): Route[] {
  return [
    ["/themes/?", ok({ count: THEMES.length, next: null, results: THEMES })],
    ["/lego/sets/75372-1/", ok(setPage("75372-1", 3))],
    ["/lego/sets/75345-1/", ok(setPage("75345-1", 2))],
    ["/lego/sets/7675-1/", ok(setPage("7675-1", 7))],
    ["/lego/sets/75000-1/", ok(setPage("75000-1", 3))],
    ["/lego/sets/75001-1/", ok(setPage("75001-1", 1))],
    ["theme_id=2&", ok({ results: [set("75372-1"), set("75345-1")], next: null })],
    ["theme_id=7&", ok({ results: [set("75345-1"), set("7675-1")], next: null })],
    ["theme_id=3&", ok({ results: [set("75000-1")], next: null })],
    ["theme_id=5&", ok({ results: [set("71017-1")], next: null })],
    [
      "theme_id=6&",
      ok({ results: Array.from({ length: 4 }, (_, i) => set(`9${i}-1`)), next: null }),
    ],
  ];
}

const entry = (no: string, name: string, quantity = 1) => ({
  match_no: "0",
  entries: [{ item: { no, name, type: "MINIFIG" }, quantity }],
});

/** The sets a minifig comes in, as BrickLink's supersets answer. */
const supersets = (...numbers: string[]) =>
  brickLink([
    {
      color_id: 0,
      entries: numbers.map((no) => ({ item: { no, name: `Set ${no}`, type: "SET" }, quantity: 1 })),
    },
  ]);

/** BrickLink routes: the minifigs of some sets; the other sets are unknown (404). */
export function seriesBrickLinkRoutes(): Route[] {
  return [
    // Captain Rex comes in four sets; only the first three are asked about.
    ["/items/MINIFIG/sw0194/supersets", supersets("75372-1", "75345-1", "7675-1", "75000-1")],
    ["/items/MINIFIG/sw9999/supersets", supersets("75001-1")],
    ["/items/MINIFIG/sw0000/supersets", brickLinkFailure(404, "RESOURCE_NOT_FOUND")],
    [
      "/items/SET/75372-1/subsets",
      brickLink([entry("sw0194", "Captain Rex"), entry("sw0631", "Trooper")]),
    ],
    [
      "/items/SET/75345-1/subsets",
      brickLink([entry("sw0631", "Trooper"), entry("sw0196", "Cody", 2)]),
    ],
    ["/items/SET/7675-1/subsets", brickLink([])],
    ["/items/SET/71017-1/subsets", brickLink([entry("coltlbm01", "Batman")])],
  ];
}

interface QueueSet {
  seriesId: number;
  owner: string;
  setNumber: string;
  state: "open" | "working" | "done" | "failed";
  attempts: number;
  figures: { number: string; name: string; imageUrl?: string }[];
}

interface QueueSeries {
  summary: SeriesSummary;
  owner: string;
}

/** The queue in memory: series of several owners. */
export class MemorySeriesStore implements SeriesStore {
  readonly sets: QueueSet[] = [];
  readonly series: QueueSeries[] = [];
  readonly outcomes: { key: string; outcome: SetOutcome }[] = [];
  pausedUntil: string | undefined;
  private next = 1;

  async begin(
    owner: string,
    theme: { id: number; name: string },
    sets: readonly { number: string; name: string }[],
  ) {
    const known = this.series.find((s) => s.owner === owner && s.summary.themeId === theme.id);
    if (known) return known.summary;
    const summary: SeriesSummary = {
      id: this.next++,
      themeId: theme.id,
      name: theme.name,
      total: sets.length,
      done: 0,
      failed: 0,
      figureCount: 0,
      createdAt: "2026-11-03T08:00:00Z",
      openedAt: "2026-11-03T08:00:00Z",
    };
    this.series.push({ summary, owner });
    for (const { number } of sets) {
      this.sets.push({
        seriesId: summary.id,
        owner,
        setNumber: number,
        state: "open",
        attempts: 0,
        figures: [],
      });
    }
    return summary;
  }

  async claim(owner: string | undefined, limit: number): Promise<ClaimedSet[]> {
    if (this.pausedUntil !== undefined) return [];
    const open = this.sets.filter(
      (entry) => entry.state === "open" && (owner === undefined || entry.owner === owner),
    );
    return open.slice(0, limit).map((entry) => {
      entry.state = "working";
      entry.attempts += 1;
      return { seriesId: entry.seriesId, setNumber: entry.setNumber, attempts: entry.attempts };
    });
  }

  async finish(item: ClaimedSet, outcome: SetOutcome) {
    const entry = this.find(item);
    if (entry.state !== "working") throw new Error(`${this.key(item)} wurde nicht genommen`);
    entry.state = outcome.kind === "retry" ? "open" : outcome.kind;
    if (outcome.kind === "done") entry.figures = [...outcome.figures];
    this.outcomes.push({ key: this.key(item), outcome });
    this.refresh(item.seriesId);
  }

  async release(items: readonly ClaimedSet[], pausedUntil?: string) {
    for (const item of items) {
      const entry = this.find(item);
      if (entry.state !== "working") continue;
      entry.state = "open";
      entry.attempts = Math.max(entry.attempts - 1, 0);
    }
    if (pausedUntil !== undefined) this.pausedUntil = pausedUntil;
  }

  async summaries(owner: string) {
    return this.series.filter((s) => s.owner === owner).map((s) => s.summary);
  }

  async summary(owner: string, id: number) {
    return this.series.find((s) => s.owner === owner && s.summary.id === id)?.summary ?? null;
  }

  async detail(owner: string, id: number, touch: boolean): Promise<SeriesDetail | null> {
    const found = this.series.find((s) => s.owner === owner && s.summary.id === id);
    if (!found) return null;
    if (touch) found.summary.openedAt = "2026-11-03T09:00:00Z";
    const figures = new Map<string, { number: string; name: string; imageUrl?: string }>();
    for (const entry of this.sets.filter((s) => s.seriesId === id && s.state === "done")) {
      for (const figure of entry.figures) {
        figures.set(figure.number, figure);
      }
    }
    return { summary: found.summary, figures: [...figures.values()] };
  }

  async remove(owner: string, id: number) {
    const index = this.series.findIndex((s) => s.owner === owner && s.summary.id === id);
    if (index >= 0) this.series.splice(index, 1);
  }

  state(key: string): QueueSet["state"] | undefined {
    return this.sets.find((entry) => `${entry.seriesId}|${entry.setNumber}` === key)?.state;
  }

  key(item: Pick<ClaimedSet, "seriesId" | "setNumber">): string {
    return `${item.seriesId}|${item.setNumber}`;
  }

  private find(item: ClaimedSet): QueueSet {
    const entry = this.sets.find(
      (candidate) => candidate.seriesId === item.seriesId && candidate.setNumber === item.setNumber,
    );
    if (!entry) throw new Error(`${this.key(item)} ist nicht in der Warteschlange`);
    return entry;
  }

  /** Counts and the closing of the series, as `series_summary` and `series_settle` do. */
  private refresh(seriesId: number): void {
    const found = this.series.find((s) => s.summary.id === seriesId);
    if (!found) return;
    const mine = this.sets.filter((s) => s.seriesId === seriesId);
    found.summary.done = mine.filter((s) => s.state === "done").length;
    found.summary.failed = mine.filter((s) => s.state === "failed").length;
    if (!mine.some((s) => s.state === "open" || s.state === "working")) {
      found.summary.finishedAt = "2026-11-03T10:00:00Z";
    }
  }
}
