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
  THEMES,
} from "./series.fixtures.ts";
import {
  MAX_HITS,
  planSeries,
  type SeriesDeps,
  searchThemes,
  startSeries,
  workOnSeries,
} from "./seriesService.ts";
import {
  SERIES_MAX_SETS,
  SERIES_WARNING_SETS,
  setNumberOfSingleId,
  singleSetId,
} from "./seriesTypes.ts";

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

const names = (search: { themes: { name: string }[] }) => search.themes.map((theme) => theme.name);
const choosable = (search: { themes: { name: string; selectable: boolean }[] }) =>
  search.themes.filter((theme) => theme.selectable).map((theme) => theme.name);

describe("P12 Thema finden", () => {
  it("F13 „Clone Wars“ und „Star Wars“ finden die Reihe im Baum von Rebrickable", async () => {
    expect(names(await searchThemes(seriesDeps(), "Clone Wars"))).toEqual([
      "Star Wars – The Clone Wars",
      "Star Wars – The Clone Wars – Season 1",
    ]);
    expect(choosable(await searchThemes(seriesDeps(), "star wars"))).toContain(
      "Star Wars – The Clone Wars",
    );
  });

  it("F13 Ein Hauptthema mit Unterthemen steht in der Liste, ist nicht wählbar und hat seine Unterthemen darunter", async () => {
    const found = await searchThemes(seriesDeps(), "star wars");
    expect(found.themes.map((theme) => [theme.name, theme.selectable])).toEqual([
      ["Star Wars", false],
      ["Star Wars – Battle Packs", true],
      ["Star Wars – Episode IV/V/VI", true],
      ["Star Wars – The Clone Wars", true],
      ["Star Wars – The Clone Wars – Season 1", true],
      ["Star Wars – The Mandalorian", true],
    ]);
    expect(found.more).toBe(false);
    // A root without sub themes is a series itself.
    expect((await searchThemes(seriesDeps(), "ninjago")).themes).toEqual([
      { id: 6, name: "Ninjago", selectable: true },
    ]);
  });

  it("Eine lange Trefferliste wird abgeschnitten und sagt es", async () => {
    const found = await searchThemes(seriesDeps(), "other");
    expect(found.themes).toHaveLength(MAX_HITS);
    expect(found.more).toBe(true);
  });

  it("F13 „Sammelserie“ findet die Sammelfiguren-Reihen, auch mit weiteren Wörtern", async () => {
    const found = await searchThemes(seriesDeps(), "LEGO Batman Movie Sammelserie");
    expect(found).toEqual({
      themes: [
        {
          id: 5,
          name: "Collectible Minifigures – The LEGO Batman Movie Series",
          selectable: true,
        },
      ],
      more: false,
    });
    expect((await searchThemes(seriesDeps(), "   ")).themes).toEqual([]);
    expect((await searchThemes(seriesDeps(), "gibt es nicht")).themes).toEqual([]);
  });

  it("F13 Deutsche Begriffe führen zu den englischen Namen", async () => {
    const deps = seriesDeps();
    expect(names(await searchThemes(deps, "Klonkriege"))).toContain("Star Wars – The Clone Wars");
    expect(names(await searchThemes(deps, "Krieg der Sterne Klonkrieger"))).toContain(
      "Star Wars – The Clone Wars",
    );
    expect(names(await searchThemes(deps, "Herr der Ringe"))).toEqual(["The Lord of the Rings"]);
    expect(names(await searchThemes(deps, "Superhelden Spiderman"))).toEqual([
      "Super Heroes – Spider-Man",
    ]);
    expect(names(await searchThemes(deps, "Burg"))).toEqual(["Castle", "Castle – Knights Kingdom"]);
  });

  it("Die Themenliste wird nur einmal bei Rebrickable geholt und 30 Tage gemerkt", async () => {
    const log: string[] = [];
    const deps = seriesDeps(undefined, { log });
    await searchThemes(deps, "star");
    await searchThemes(deps, "ninjago");
    expect(log.filter((line) => line.includes("/themes/"))).toHaveLength(1);
  });
});

describe("P12 Themenliste: nie unvollständig benutzt oder gemerkt", () => {
  const short = [
    ["/themes/?", () => Response.json({ count: 2, next: null, results: THEMES.slice(0, 3) })],
  ] satisfies Route[];

  it("Eine zu kurze Liste von Rebrickable ist ein Fehler, keine leere Suche, und wird nicht gemerkt", async () => {
    const deps = seriesDeps(undefined, { extra: short });
    await expect(searchThemes(deps, "star wars")).rejects.toMatchObject({
      failure: "unavailable",
      message: expect.stringContaining("nur 3 Themen"),
    });
    expect(deps.cache.values.has("series:themes2")).toBe(false);
  });

  it("Eine zu kurze oder alte Liste im Zwischenspeicher wird nicht benutzt, sondern neu geholt", async () => {
    const cache = new MemoryStore();
    // What the first version may have kept: an empty list and a cut-off one, under the old key and the new.
    cache.values.set("series:themes", { value: [], fetchedAt: NOW.toISOString() });
    cache.values.set("series:themes2", {
      value: [{ id: 6, name: "Ninjago" }],
      fetchedAt: NOW.toISOString(),
    });
    const log: string[] = [];
    const deps = seriesDeps(undefined, { cache, log });
    expect(names(await searchThemes(deps, "Clone Wars"))).toContain("Star Wars – The Clone Wars");
    expect(log.filter((line) => line.includes("/themes/"))).toHaveLength(1);
    expect(cache.values.get("series:themes2")?.value).toHaveLength(THEMES.length);
  });

  it("Endet die Liste nicht in wenigen Seiten, wird sie nicht abgeschnitten benutzt", async () => {
    const endless = [
      ["/themes/?", () => Response.json({ next: "https://x/next", results: THEMES })],
    ] satisfies Route[];
    await expect(
      searchThemes(seriesDeps(undefined, { extra: endless }), "star"),
    ).rejects.toMatchObject({
      failure: "unavailable",
    });
  });

  it("Die Liste über mehrere Seiten wird ganz gelesen", async () => {
    const half = Math.ceil(THEMES.length / 2);
    const pages = [
      ["page=2", () => Response.json({ next: null, results: THEMES.slice(half) })],
      [
        "/themes/?",
        () => Response.json({ next: "https://x/page=2", results: THEMES.slice(0, half) }),
      ],
    ] satisfies Route[];
    const found = await searchThemes(seriesDeps(undefined, { extra: pages }), "Clone Wars");
    expect(names(found)).toContain("Star Wars – The Clone Wars");
  });
});

describe("P12 Thema über eine Set- oder Figurennummer finden", () => {
  it("F13 Eine Setnummer führt zum Thema des Sets, mit oder ohne „-1“", async () => {
    for (const typed of ["75372", "75372-1"]) {
      const found = await searchThemes(seriesDeps(), typed);
      expect(found.themes, typed).toEqual([
        {
          id: singleSetId("75372-1"),
          name: "75372-1",
          selectable: true,
          onlySet: { number: "75372-1", figureCount: 2 },
        },
        {
          id: 3,
          name: "Star Wars – Battle Packs",
          selectable: true,
          via: { kind: "set", number: "75372-1" },
        },
      ]);
    }
  });

  it("F13 Gehört das Set zu einem Hauptthema, ist es nicht wählbar und seine Unterthemen folgen", async () => {
    const found = await searchThemes(seriesDeps(), "75001-1");
    expect(found.themes[0]).toMatchObject({ name: "Star Wars", selectable: false });
    expect(found.themes.slice(1).every((theme) => theme.selectable)).toBe(true);
    expect(found.themes).toHaveLength(6);
  });

  it("F13 Eine Figurennummer führt zu den Themen der ersten drei Sets, mit höchstens vier Abfragen", async () => {
    const log: string[] = [];
    const found = await searchThemes(seriesDeps(undefined, { log }), "SW0194");
    expect(found.themes.map((theme) => [theme.id, theme.via])).toEqual([
      [3, { kind: "figure", number: "sw0194" }],
      [2, { kind: "figure", number: "sw0194" }],
      [7, { kind: "figure", number: "sw0194" }],
    ]);
    expect(log.filter((line) => line.includes("bricklink"))).toHaveLength(1);
    expect(log.filter((line) => line.includes("/lego/sets/"))).toHaveLength(3);
  });

  it("Nummern werden nach dem ersten Mal aus dem Zwischenspeicher gelesen", async () => {
    const log: string[] = [];
    const deps = seriesDeps(undefined, { log });
    await searchThemes(deps, "sw0194");
    const first = log.length;
    await searchThemes(deps, "sw0194");
    // The set of the minifig was asked about on the way, so its theme is known, too.
    await searchThemes(deps, "75372");
    const second = log.length;
    await searchThemes(deps, "75372");
    expect(log).toHaveLength(second);
    expect(first).toBeLessThan(second);
  });

  it("Nur dieses Set: der Treffer steht vor den Themen, mit der Zahl der Figuren, ohne Mehrfachabfragen", async () => {
    const log: string[] = [];
    const deps = seriesDeps(undefined, { log });
    const found = await searchThemes(deps, "75345");
    expect(found.themes[0]).toEqual({
      id: singleSetId("75345-1"),
      name: "75345-1",
      selectable: true,
      onlySet: { number: "75345-1", figureCount: 2 },
    });
    expect(found.themes[1]?.via).toEqual({ kind: "set", number: "75345-1" });
    // One counted BrickLink call for the set; a second search reads everything from the cache.
    expect(log.filter((line) => line.includes("/items/SET/75345-1/subsets"))).toHaveLength(1);
    const asked = log.length;
    await searchThemes(deps, "75345-1");
    expect(log).toHaveLength(asked);
  });

  it("Nur dieses Set fehlt bei einem Set ohne Figuren, einem unbekannten und bei verbrauchtem Tageslimit", async () => {
    // 7675-1 has no minifigs, 75000-1 is unknown to BrickLink here.
    for (const typed of ["7675", "75000"]) {
      const found = await searchThemes(seriesDeps(), typed);
      expect(
        found.themes.some((theme) => theme.onlySet !== undefined),
        typed,
      ).toBe(false);
      expect(found.themes.length, typed).toBeGreaterThan(0);
    }
    const limited = await searchThemes(
      seriesDeps(undefined, { cap: 0 }, () => NOW),
      "75372",
    ).catch((error: unknown) => error);
    // The theme of the set is found without BrickLink; the set hit is simply left out.
    expect(limited).toMatchObject({ themes: [{ id: 3 }] });
  });

  it("Die Kennung eines einzelnen Sets lässt sich lesen und verwechselt sich nie mit einem Thema", () => {
    expect(singleSetId("75455-1")).toBe(1_000_754_550);
    expect(setNumberOfSingleId(1_000_754_550)).toBe("75455-1");
    expect(setNumberOfSingleId(singleSetId("10000-3") ?? 0)).toBe("10000-3");
    expect(setNumberOfSingleId(2)).toBeUndefined();
    expect(singleSetId("COMCON001-1")).toBeUndefined();
    expect(singleSetId("123456789-1")).toBeUndefined();
    expect(singleSetId("99999999-9")).toBeLessThan(2_147_483_647);
  });

  it("Plan und Anlegen für ein einzelnes Set: ein Set, eine Abfrage, eine Reihe mit seinem Namen", async () => {
    const deps = seriesDeps();
    const id = singleSetId("75372-1") ?? 0;
    expect(await planSeries(deps, id)).toEqual({
      theme: { id, name: "75372-1 Set 75372-1", selectable: true },
      setCount: 1,
    });
    const summary = await startSeries(deps, "owner-1", id);
    expect(summary).toMatchObject({ themeId: id, name: "75372-1 Set 75372-1", total: 1 });
    const again = await startSeries(deps, "owner-1", id);
    expect(again.id).toBe(summary.id);
    await workOnSeries(deps, { owner: "owner-1", budgetMs: 10_000 });
    expect(deps.store.sets).toMatchObject([{ setNumber: "75372-1", state: "done" }]);
    expect(deps.store.sets[0]?.figures).toHaveLength(2);
    // A set Rebrickable does not know is named by its number.
    const unknown = await planSeries(seriesDeps(), singleSetId("99999-1") ?? 0);
    expect(unknown.theme.name).toBe("99999-1");
  });

  it("Eine unbekannte Nummer gibt keine Treffer, kein Fehler", async () => {
    const deps = seriesDeps();
    expect((await searchThemes(deps, "99999")).themes).toEqual([]);
    expect((await searchThemes(deps, "sw0000")).themes).toEqual([]);
  });

  it("Ist das Tageslimit von BrickLink verbraucht, sagt die Suche nach einer Figur es", async () => {
    await expect(searchThemes(seriesDeps(undefined, { cap: 0 }), "sw0194")).rejects.toMatchObject({
      failure: "limit_reached",
    });
  });
});

describe("P12 Vor dem Anlegen: Sets und Abfragen", () => {
  it("F13 Der Plan zählt die Sets des Themas und seiner Unterthemen, jedes Set einmal", async () => {
    const plan = await planSeries(seriesDeps(), 2);
    expect(plan).toEqual({
      theme: { id: 2, name: "Star Wars – The Clone Wars", selectable: true },
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

  it("Eine Big Fig (Teil der Kategorie Large Figure) zählt zu den Figuren der Reihe, mit ihrem Typ in der Nummer", async () => {
    const store = new MemorySeriesStore();
    const deps = seriesDeps(store, {
      extra: [
        [
          "/items/SET/75372-1/subsets",
          brickLink([
            {
              match_no: "0",
              entries: [
                { item: { no: "sw0434", name: "Luke Skywalker", type: "MINIFIG" }, quantity: 1 },
                {
                  item: {
                    no: "11323pb01c01",
                    name: "Large Figure, Rancor",
                    type: "PART",
                    category_id: 1081,
                  },
                  quantity: 1,
                },
                {
                  item: { no: "3001", name: "Brick 2 x 4", type: "PART", category_id: 5 },
                  quantity: 9,
                },
              ],
            },
          ]),
        ],
        [
          "/categories",
          brickLink([
            { category_id: 5, category_name: "Brick" },
            { category_id: 1081, category_name: "Large Figure" },
          ]),
        ],
      ],
    });
    const summary = await startSeries(deps, "stephan", 2);
    await workOnSeries(deps, { budgetMs: 50_000 });
    const detail = await store.detail("stephan", summary.id, false);
    const numbers = detail?.figures.map((figure) => figure.number) ?? [];
    expect(numbers).toContain("sw0434");
    expect(numbers).toContain("PART:11323pb01c01");
    expect(numbers).not.toContain("3001");
    expect(numbers.some((number) => number.includes("3001"))).toBe(false);
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
    // The id of a single set has ten digits (Nur dieses Set) but must still fit the database column.
    for (const action of ["plan", "start"] as const) {
      expect(
        parseSeriesRequest({ op: "series", action, themeId: singleSetId("75455-1") }),
      ).toMatchObject({ themeId: 1_000_754_550 });
      expect(parseSeriesRequest({ op: "series", action, themeId: 2_147_483_648 })).toBeUndefined();
    }
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

    expect(await json({ op: "series", action: "search", query: "batman movie" })).toEqual({
      action: "search",
      themes: [
        {
          id: 5,
          name: "Collectible Minifigures – The LEGO Batman Movie Series",
          selectable: true,
        },
      ],
      more: false,
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
