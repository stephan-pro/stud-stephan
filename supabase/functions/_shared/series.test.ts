// P12: finding a theme, what building a series costs, the build in portions with the day's limit,
// and the series calls of the function `bricklink`.
import { describe, expect, it } from "vitest";
import { createBricklink } from "./bricklinkClient.ts";
import {
  brickLink,
  brickLinkFailure,
  CREDENTIALS,
  fakeFetch,
  MemoryStore,
  noSleep,
  type Route,
} from "./catalog.fixtures.ts";
import { type BricklinkHandlerDeps, handleBricklink, parseSeriesRequest } from "./handler.ts";
import { CatalogError } from "./json.ts";
import { createRebrickable } from "./rebrickableClient.ts";
import {
  MemorySeriesStore,
  seriesBrickLinkRoutes,
  seriesRebrickableRoutes,
} from "./series.fixtures.ts";
import {
  planSeries,
  type SeriesDeps,
  searchThemes,
  startSeries,
  workOnSeries,
} from "./seriesService.ts";
import { SERIES_MAX_SETS, SERIES_WARNING_SETS } from "./seriesTypes.ts";

const NOW = new Date("2026-11-03T10:00:00Z");

function seriesDeps(
  store = new MemorySeriesStore(),
  options: {
    cap?: number;
    log?: string[];
    extra?: Parameters<typeof fakeFetch>[0];
    cache?: MemoryStore;
  } = {},
  now: () => Date = () => NOW,
): SeriesDeps & { store: MemorySeriesStore; cache: MemoryStore } {
  const cache = options.cache ?? new MemoryStore();
  const log = options.log ?? [];
  const send = fakeFetch(
    [...(options.extra ?? []), ...seriesBrickLinkRoutes(), ...seriesRebrickableRoutes()],
    log,
  );
  return {
    store,
    cache,
    rebrickable: createRebrickable({ fetch: send, key: "k", sleep: noSleep }),
    bricklink: createBricklink({
      fetch: send,
      credentials: CREDENTIALS,
      beforeCall: async () => {
        const day = now().toISOString().slice(0, 10);
        if (!(await cache.countCall("bricklink", day, options.cap ?? 1000))) {
          throw new CatalogError("limit_reached", "Tageslimit");
        }
      },
    }),
    now,
  };
}

describe("P12 Thema finden", () => {
  it("F13 Eine Reihe ist ein Unterthema oder ein Thema ohne Unterthemen, kein großes Hauptthema", async () => {
    const found = await searchThemes(seriesDeps(), "star wars");
    expect(found.map((theme) => theme.name)).toEqual([
      "Star Wars – Battle Packs",
      "Star Wars – The Clone Wars",
      "Star Wars – The Clone Wars – Season 1",
    ]);
    // The main theme "Star Wars" itself is not offered, the one without sub themes is.
    expect((await searchThemes(seriesDeps(), "ninjago")).map((theme) => theme.name)).toEqual([
      "Ninjago",
    ]);
  });

  it("F13 „Sammelserie“ findet die Sammelfiguren-Reihen, auch mit weiteren Wörtern", async () => {
    const found = await searchThemes(seriesDeps(), "LEGO Batman Movie Sammelserie");
    expect(found).toEqual([
      { id: 5, name: "Collectible Minifigures – The LEGO Batman Movie Series" },
    ]);
    expect(await searchThemes(seriesDeps(), "   ")).toEqual([]);
    expect(await searchThemes(seriesDeps(), "gibt es nicht")).toEqual([]);
  });

  it("Die Themenliste wird nur einmal bei Rebrickable geholt und 30 Tage gemerkt", async () => {
    const log: string[] = [];
    const deps = seriesDeps(undefined, { log });
    await searchThemes(deps, "star");
    await searchThemes(deps, "ninjago");
    expect(log.filter((line) => line.includes("/themes/"))).toHaveLength(1);
  });
});

describe("P12 Vor dem Anlegen: Sets und Abfragen", () => {
  it("F13 Der Plan zählt die Sets des Themas und seiner Unterthemen, jedes Set einmal", async () => {
    const plan = await planSeries(seriesDeps(), 2);
    expect(plan).toEqual({
      theme: { id: 2, name: "Star Wars – The Clone Wars" },
      setCount: 3,
    });
  });

  it("Ein Hauptthema mit Unterthemen und ein unbekanntes Thema gibt es nicht als Reihe", async () => {
    await expect(planSeries(seriesDeps(), 1)).rejects.toMatchObject({ failure: "not_found" });
    await expect(planSeries(seriesDeps(), 999)).rejects.toMatchObject({ failure: "not_found" });
  });

  it("Die Sets eines Themas kommen nach dem ersten Mal aus dem Zwischenspeicher", async () => {
    const log: string[] = [];
    const deps = seriesDeps(undefined, { log });
    await planSeries(deps, 2);
    const first = log.length;
    await planSeries(deps, 2);
    expect(log).toHaveLength(first);
  });

  it("Eine Warnung gibt es ab mehr als 300 Sets; mehr als 1.000 sind zu viel", () => {
    expect(SERIES_WARNING_SETS).toBe(300);
    expect(SERIES_MAX_SETS).toBe(1000);
  });
});

describe("P12 Aufbau in Portionen", () => {
  async function started() {
    const deps = seriesDeps();
    const summary = await startSeries(deps, "stephan", 2);
    return { deps, summary };
  }

  it("F13 Der Aufbau fragt je Set einmal BrickLink und sammelt die Figuren, jede einmal", async () => {
    const { deps, summary } = await started();
    expect(summary).toMatchObject({ name: "Star Wars – The Clone Wars", total: 3, done: 0 });
    expect(await workOnSeries(deps, { budgetMs: 50_000 })).toEqual({ processed: 3, paused: false });
    const detail = await deps.store.detail("stephan", summary.id, false);
    expect(detail?.figures.map((figure) => figure.number).sort()).toEqual([
      "sw0194",
      "sw0196",
      "sw0631",
    ]);
    expect(detail?.summary).toMatchObject({ done: 3, failed: 0 });
    expect(detail?.summary.finishedAt).toBeDefined();
    // One counted call per set.
    expect([...deps.cache.counts.values()]).toEqual([3]);
  });

  it("Die Figuren eines Sets kommen beim nächsten Aufbau aus dem Zwischenspeicher, ohne Abfrage", async () => {
    const { deps } = await started();
    await workOnSeries(deps, { budgetMs: 50_000 });
    const second = seriesDeps(new MemorySeriesStore(), { cache: deps.cache });
    await startSeries(second, "anna", 2);
    await workOnSeries(second, { budgetMs: 50_000 });
    // Only the set without figures is asked again (an empty answer is not remembered).
    expect([...deps.cache.counts.values()]).toEqual([4]);
  });

  it("F13 Ist das Tageslimit verbraucht, wartet der Aufbau und geht am nächsten Tag weiter", async () => {
    let time = NOW;
    const store = new MemorySeriesStore();
    const deps = seriesDeps(store, { cap: 2 }, () => time);
    const summary = await startSeries(deps, "stephan", 2);
    expect(await workOnSeries(deps, { budgetMs: 50_000 })).toEqual({ processed: 2, paused: true });
    expect(store.pausedUntil).toBe("2026-11-04T00:05:00.000Z");
    expect(store.state(`${summary.id}|75345-1`)).toBe("done");
    // Nothing taken is lost: the set that was not asked is open again, without an attempt used.
    const open = store.sets.filter((entry) => entry.state === "open");
    expect(open).toHaveLength(1);
    expect(open[0]?.attempts).toBe(0);

    // The next day: the pause is over and the build finishes.
    time = new Date("2026-11-04T00:10:00Z");
    store.pausedUntil = undefined;
    expect(await workOnSeries(deps, { budgetMs: 50_000 })).toEqual({ processed: 1, paused: false });
    expect((await store.summary("stephan", summary.id))?.finishedAt).toBeDefined();
  });

  it("Ein Set, das BrickLink nicht kennt, ist fehlgeschlagen; ein gestörter Dienst wird wiederholt", async () => {
    const down: Route = ["/items/SET/75345-1/subsets", brickLinkFailure(500, "Fehler")];
    const store = new MemorySeriesStore();
    const deps = seriesDeps(store, {
      extra: [down, ["/items/SET/75372-1/subsets", brickLinkFailure(404, "RESOURCE_NOT_FOUND")]],
    });
    const summary = await startSeries(deps, "stephan", 2);
    await workOnSeries(deps, { budgetMs: 50_000 });
    expect(store.state(`${summary.id}|75372-1`)).toBe("failed");
    expect(store.state(`${summary.id}|75345-1`)).toBe("open");
    expect(store.state(`${summary.id}|7675-1`)).toBe("done");
  });

  it("F13 Eine Sammelserie enthält ein Set je Figur; die Figuren werden eine Ebene tiefer gelesen", async () => {
    const inner = (no: string, type: string, name: string) => ({
      match_no: "0",
      entries: [{ item: { no, name, type }, quantity: 1 }],
    });
    const store = new MemorySeriesStore();
    const deps = seriesDeps(store, {
      extra: [
        [
          "/items/SET/71017-1/subsets",
          brickLink([
            inner("coltlbm-1", "SET", "Batman Set"),
            inner("coltlbm-2", "SET", "Glam Set"),
          ]),
        ],
        [
          "/items/SET/coltlbm-1/subsets",
          brickLink([inner("coltlbm01", "MINIFIG", "Lobster-Lovin' Batman")]),
        ],
        [
          "/items/SET/coltlbm-2/subsets",
          brickLink([inner("coltlbm02", "MINIFIG", "Glam Metal Batman")]),
        ],
      ],
    });
    const summary = await startSeries(deps, "stephan", 5);
    await workOnSeries(deps, { budgetMs: 50_000 });
    const detail = await store.detail("stephan", summary.id, false);
    expect(detail?.figures.map((figure) => figure.number)).toEqual(["coltlbm01", "coltlbm02"]);
    // The set and its two inner sets: three counted calls.
    expect([...deps.cache.counts.values()]).toEqual([3]);
  });

  it("Namen von BrickLink kommen ohne HTML-Zeichen an", async () => {
    const entities = brickLink([
      {
        match_no: "0",
        entries: [
          {
            item: {
              no: "coltlbm08",
              type: "MINIFIG",
              name: "Lobster Lovin&#39; Batman &#40;Only&#41; &amp; Co",
            },
            quantity: 1,
          },
        ],
      },
    ]);
    const store = new MemorySeriesStore();
    const deps = seriesDeps(store, { extra: [["/items/SET/75372-1/subsets", entities]] });
    const summary = await startSeries(deps, "stephan", 2);
    await workOnSeries(deps, { budgetMs: 50_000 });
    const detail = await store.detail("stephan", summary.id, false);
    expect(detail?.figures.map((figure) => figure.name)).toContain(
      "Lobster Lovin' Batman (Only) & Co",
    );
  });

  it("Eine Person arbeitet nur an ihren Reihen", async () => {
    const store = new MemorySeriesStore();
    const deps = seriesDeps(store);
    await startSeries(deps, "stephan", 2);
    await startSeries(deps, "anna", 5);
    await workOnSeries(deps, { owner: "anna", budgetMs: 50_000 });
    expect(
      store.sets.filter((entry) => entry.owner === "stephan" && entry.state !== "open"),
    ).toEqual([]);
  });

  it("Dieselbe Reihe zweimal anlegen gibt die vorhandene zurück", async () => {
    const { deps, summary } = await started();
    expect((await startSeries(deps, "stephan", 2)).id).toBe(summary.id);
    expect(deps.store.series).toHaveLength(1);
  });
});

describe("P12 Aufrufe der App", () => {
  function handlerDeps(
    series: (SeriesDeps & { store: MemorySeriesStore }) | undefined,
    signedIn = true,
  ): BricklinkHandlerDeps {
    return {
      signedIn: async () => signedIn,
      user: async () => (signedIn ? "stephan" : undefined),
      client: () => undefined,
      priceRun: () => undefined,
      series: () => series,
      runSecret: undefined,
    };
  }

  const call = (body: unknown) =>
    new Request("https://x/functions/v1/bricklink", {
      method: "POST",
      headers: { Authorization: "Bearer t", apikey: "k" },
      body: JSON.stringify(body),
    });

  it("Die Anfragen werden gelesen, Unsinn wird abgelehnt", () => {
    expect(parseSeriesRequest({ op: "series", action: "search", query: " clone " })).toEqual({
      op: "series",
      action: "search",
      query: "clone",
    });
    expect(parseSeriesRequest({ op: "series", action: "plan", themeId: 2 })).toMatchObject({
      themeId: 2,
    });
    expect(parseSeriesRequest({ op: "series", action: "get", id: 4, touch: false })).toMatchObject({
      touch: false,
    });
    for (const bad of [
      { op: "series", action: "search", query: "" },
      { op: "series", action: "plan", themeId: "2" },
      { op: "series", action: "plan", themeId: -1 },
      { op: "series", action: "get", id: 4 },
      { op: "series", action: "löschen" },
      { op: "other" },
      null,
    ]) {
      expect(parseSeriesRequest(bad), JSON.stringify(bad)).toBeUndefined();
    }
  });

  it("Ohne Anmeldung gibt es keine Antwort und keine Abfrage", async () => {
    const log: string[] = [];
    const deps = handlerDeps(seriesDeps(undefined, { log }), false);
    const response = await handleBricklink(call({ op: "series", action: "list" }), deps);
    expect(response.status).toBe(401);
    expect(log).toEqual([]);
  });

  it("Plan, Anlegen, Arbeiten, Lesen und Löschen laufen für die angemeldete Person", async () => {
    const deps = seriesDeps();
    const handler = handlerDeps(deps);
    const json = async (body: unknown) => (await handleBricklink(call(body), handler)).json();

    expect(await json({ op: "series", action: "search", query: "batman" })).toEqual({
      action: "search",
      themes: [{ id: 5, name: "Collectible Minifigures – The LEGO Batman Movie Series" }],
    });
    expect(await json({ op: "series", action: "plan", themeId: 5 })).toMatchObject({
      plan: { setCount: 1 },
    });
    const started = (await json({ op: "series", action: "start", themeId: 5 })) as {
      summary: { id: number };
    };
    const id = started.summary.id;
    expect(await json({ op: "series", action: "work", id })).toMatchObject({
      summary: { done: 1, total: 1 },
    });
    const opened = (await json({ op: "series", action: "get", id, touch: true })) as {
      detail: { figures: { number: string }[] };
    };
    expect(opened.detail.figures.map((figure) => figure.number)).toEqual(["coltlbm01"]);
    expect(deps.store.series[0]?.summary.openedAt).toBe("2026-11-03T09:00:00Z");
    expect(await json({ op: "series", action: "list" })).toMatchObject({ series: [{ id }] });
    expect(await json({ op: "series", action: "remove", id })).toEqual({ action: "remove" });
    expect(deps.store.series).toEqual([]);
  });

  it("Ein Thema mit mehr als 1.000 Sets wird nicht angelegt; fehlende Teile sind 'nicht erreichbar'", async () => {
    const big = Array.from({ length: SERIES_MAX_SETS + 1 }, (_, i) => ({
      set_num: `${i}-1`,
      name: "x",
    }));
    const deps = seriesDeps(undefined, {
      extra: [["theme_id=6&", () => Response.json({ results: big, next: null })]],
    });
    const response = await handleBricklink(
      call({ op: "series", action: "start", themeId: 6 }),
      handlerDeps(deps),
    );
    expect(response.status).toBe(400);
    expect(deps.store.series).toEqual([]);
    const without = await handleBricklink(
      call({ op: "series", action: "list" }),
      handlerDeps(undefined),
    );
    expect(without.status).toBe(502);
  });
});
