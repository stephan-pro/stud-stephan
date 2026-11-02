// Big Figs: BrickLink lists the Rancor of 75005 "Rancor Pit" as a part (`11323pb01c01`, category
// "Animal, Land"), not as a minifig. A figure is looked up as a minifig, then as a part; its type is
// kept; sets count their Big Figs among their figures; the price run asks for the type. The answers
// for the Rancor and for 75005 are the real ones of BrickLink (`samples/bricklink-rancor-2026-11.json`,
// recorded with `npm run try:bricklink`); the rest are the shapes of the documented calls.
import { describe, expect, it, vi } from "vitest";
import { createBricklink } from "./bricklinkClient.ts";
import {
  BL_RANCOR_ANSWERS,
  brickLinkFailure,
  brickLinkRoutes,
  CREDENTIALS,
  fakeFetch,
  MemoryStore,
  noSleep,
  ok,
  type Route,
  rebrickableRoutes,
} from "./catalog.fixtures.ts";
import { type CatalogDeps, classifyQuery, loadItem, searchCatalog } from "./catalogService.ts";
import { parseFigureRef, typedRef } from "./catalogTypes.ts";
import { CatalogError } from "./json.ts";
import { guide, MemoryPriceRunStore } from "./priceRun.fixtures.ts";
import { bricklinkTarget, failureReason, priceOf, workOnPriceRuns } from "./priceRunService.ts";
import { createRebrickable } from "./rebrickableClient.ts";

function deps(routes: Route[], store = new MemoryStore(), log: string[] = []): CatalogDeps {
  const fetch = fakeFetch(routes, log);
  return {
    bricklink: createBricklink({
      fetch,
      credentials: CREDENTIALS,
      nonce: () => "n",
      timestamp: () => "1",
    }),
    rebrickable: createRebrickable({ fetch, key: "k", sleep: noSleep }),
    store,
    now: () => new Date("2026-11-07T10:00:00Z"),
  };
}

const working = () => [...brickLinkRoutes(), ...rebrickableRoutes()];

/** The BrickLink calls of a log, in order: "MINIFIG/sw0194", "SET/75005-1/subsets", "categories/147". */
function calls(log: string[]): string[] {
  return log.flatMap((line) => {
    const match =
      /\/v1\/(items\/(?:[A-Z]+\/[^/?\s]+(?:\/[a-z]+)?)|categories(?:\/\d+)?)(?:$|\?)/.exec(line);
    return match?.[1] ? [match[1].replace(/^items\//, "")] : [];
  });
}

const RANCOR_IMAGE = "https://img.bricklink.com/PL/11323pb01c01.jpg";

describe("Big Figs: Nummer erkennen", () => {
  it("eine Teilenummer wie 11323pb01c01 ist eine Nummer, ein Verweis mit Typ bleibt erhalten", () => {
    expect(classifyQuery("minifig", "11323pb01c01")).toEqual({ by: "number", ref: "11323pb01c01" });
    expect(classifyQuery("minifig", " 973C01 ")).toEqual({ by: "number", ref: "973c01" });
    expect(classifyQuery("minifig", "973pb0123c01")).toEqual({
      by: "number",
      ref: "973pb0123c01",
    });
    expect(classifyQuery("minifig", "3626cpb0001")).toEqual({ by: "number", ref: "3626cpb0001" });
    expect(classifyQuery("minifig", "part:11323PB01C01")).toEqual({
      by: "number",
      ref: "PART:11323pb01c01",
    });
    expect(classifyQuery("minifig", "MINIFIG:SW0194")).toEqual({
      by: "number",
      ref: "MINIFIG:sw0194",
    });
    // Names and plain digits stay what they were.
    expect(classifyQuery("minifig", "Rancor")).toEqual({ by: "name", text: "Rancor" });
    expect(classifyQuery("minifig", "75005")).toEqual({ by: "name", text: "75005" });
    expect(classifyQuery("minifig", "sw0194")).toEqual({ by: "number", ref: "sw0194" });
  });

  it("Verweis einer Figur: nur MINIFIG und PART sind Typen", () => {
    expect(typedRef("PART", "11323pb01c01")).toBe("PART:11323pb01c01");
    expect(parseFigureRef("PART:11323pb01c01")).toEqual({ type: "PART", number: "11323pb01c01" });
    expect(parseFigureRef("minifig:sw0194")).toEqual({ type: "MINIFIG", number: "sw0194" });
    expect(parseFigureRef("GEAR:5010325")).toBeUndefined();
    expect(parseFigureRef("sw0194")).toBeUndefined();
  });
});

describe("Big Figs: Suche nach Nummer (Rancor, echte Antworten)", () => {
  it("11323pb01c01 → erst Minifigur (nicht gefunden), dann Teil: ein Treffer mit Name, Jahr, Bild und Typ PART", async () => {
    const log: string[] = [];
    const hits = await searchCatalog(
      deps(working(), new MemoryStore(), log),
      "minifig",
      "11323pb01c01",
    );
    expect(hits).toEqual([
      {
        kind: "minifig",
        ref: "PART:11323pb01c01",
        number: "11323pb01c01",
        bricklinkType: "PART",
        name: "Rancor",
        year: 2013,
        imageUrl: RANCOR_IMAGE,
      },
    ]);
    expect(calls(log)).toEqual(["MINIFIG/11323pb01c01", "PART/11323pb01c01"]);
  });

  it("eine Minifigur wird als Minifigur gefunden, ohne Typ im Treffer und ohne Frage nach dem Teil", async () => {
    const log: string[] = [];
    const hits = await searchCatalog(deps(working(), new MemoryStore(), log), "minifig", "sw0194");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.ref).toBe("sw0194");
    expect(hits[0]).not.toHaveProperty("bricklinkType");
    expect(calls(log)).toEqual(["MINIFIG/sw0194"]);
  });

  it("ein Verweis mit Typ fragt nur diesen Typ", async () => {
    const log: string[] = [];
    const hits = await searchCatalog(
      deps(working(), new MemoryStore(), log),
      "minifig",
      "PART:11323pb01c01",
    );
    expect(hits[0]?.bricklinkType).toBe("PART");
    expect(calls(log)).toEqual(["PART/11323pb01c01"]);
    expect(await searchCatalog(deps(working()), "minifig", "MINIFIG:11323pb01c01")).toEqual([]);
  });

  it("eine Nummer, die BrickLink weder als Minifigur noch als Teil kennt, gibt keinen Treffer", async () => {
    const log: string[] = [];
    expect(
      await searchCatalog(deps(working(), new MemoryStore(), log), "minifig", "sw9999"),
    ).toEqual([]);
    expect(calls(log)).toEqual(["MINIFIG/sw9999", "PART/sw9999"]);
  });

  it("das Tageslimit bricht die Suche ab, statt es beim Teil noch einmal zu versuchen", async () => {
    const log: string[] = [];
    const limited: Route[] = [["/items/MINIFIG/", brickLinkFailure(429, "TOO_MANY")], ...working()];
    await expect(
      searchCatalog(deps(limited, new MemoryStore(), log), "minifig", "11323pb01c01"),
    ).rejects.toMatchObject({ failure: "limit_reached" });
    expect(calls(log)).toEqual(["MINIFIG/11323pb01c01"]);
  });
});

describe("Big Figs: Katalogeintrag", () => {
  it("Rancor: Name, Jahr, Kategorie „Animal, Land“, Bild, Typ PART und das Set, in dem er liegt", async () => {
    const log: string[] = [];
    const item = await loadItem(
      deps(working(), new MemoryStore(), log),
      "minifig",
      "PART:11323pb01c01",
    );
    expect(item).toEqual({
      kind: "minifig",
      number: "11323pb01c01",
      bricklinkType: "PART",
      name: "Rancor",
      year: 2013,
      theme: "Animal, Land",
      imageUrl: RANCOR_IMAGE,
      sets: [{ number: "75005-1", name: "Rancor Pit" }],
    });
    expect(calls(log)).toContain("PART/11323pb01c01/supersets");
    expect(calls(log)).not.toContain("MINIFIG/11323pb01c01/supersets");
  });

  it("eine nackte Nummer wird als Minifigur, dann als Teil gelesen; im Zwischenspeicher liegt der Eintrag mit Typ", async () => {
    const store = new MemoryStore();
    const log: string[] = [];
    const item = await loadItem(deps(working(), store, log), "minifig", "11323pb01c01");
    expect(item.bricklinkType).toBe("PART");
    const first = log.length;
    await loadItem(deps(working(), store, log), "minifig", "11323pb01c01");
    expect(log).toHaveLength(first);
  });

  it("ein Minifigur-Eintrag hat keinen Typ und fragt die Sets der Minifigur", async () => {
    const log: string[] = [];
    const item = await loadItem(deps(working(), new MemoryStore(), log), "minifig", "sw0194");
    expect(item).not.toHaveProperty("bricklinkType");
    expect(calls(log)).toContain("MINIFIG/sw0194/supersets");
  });

  it("eine unbekannte Nummer ist „nicht gefunden“", async () => {
    await expect(loadItem(deps(working()), "minifig", "sw9999")).rejects.toMatchObject({
      failure: "not_found",
    });
  });

  it("eine Figur von Rebrickable wird auch dann gefunden, wenn BrickLink sie im Set als Teil führt", async () => {
    const routes: Route[] = [
      ["/minifigs/fig-099999/sets/", () => Response.json({ results: [{ set_num: "75005-1" }] })],
      [
        "/minifigs/fig-099999/",
        () => Response.json({ set_num: "fig-099999", name: "Rancor", num_parts: 1 }),
      ],
      ...working(),
    ];
    const item = await loadItem(deps(routes), "minifig", "fig-099999");
    expect(item).toMatchObject({ number: "11323pb01c01", bricklinkType: "PART" });
  });
});

describe("Big Figs in Sets (75005 „Rancor Pit“, echte Antwort)", () => {
  it("die Subsets haben 97 Einträge, vier Minifiguren und den Rancor als Teil ohne besondere Kategorie", () => {
    const data = (BL_RANCOR_ANSWERS.subsets75005 as { data: { entries: { item: unknown }[] }[] })
      .data;
    expect(data.flatMap((group) => group.entries)).toHaveLength(97);
  });

  it("Luke, Malakili und die anderen Minifiguren und der Rancor sind die Figuren; Steine, Köpfe und Scharniere nicht", async () => {
    const item = await loadItem(deps(working()), "legoSet", "75005");
    expect(item.figures?.map((figure) => [figure.number, figure.quantity])).toEqual([
      ["sw0405", 1],
      ["sw0433", 1],
      ["sw0434", 1],
      ["gen047", 1],
      ["11323pb01c01", 1],
    ]);
    // Names come without BrickLink's HTML characters; the Big Fig has no picture and says it is a part.
    expect(item.figures?.[1]).toEqual({
      number: "sw0433",
      name: "Luke Skywalker (Dark Bluish Gray Jedi Robe, Dual Sided Head)",
      quantity: 1,
      imageUrl: "https://img.bricklink.com/ItemImage/MN/0/sw0433.png",
    });
    expect(item.figures?.[4]).toEqual({
      number: "11323pb01c01",
      name: "Rancor",
      quantity: 1,
      bricklinkType: "PART",
    });
  });

  it("nur die Kategorie des Rancors wird nachgeschlagen (ein Aufruf), die Teile mit pb/c01 in anderen Kategorien nicht", async () => {
    const log: string[] = [];
    const client = deps(working(), new MemoryStore(), log).bricklink;
    await client.contentsOfSet("75005-1");
    expect(calls(log)).toEqual(["SET/75005-1/subsets", "categories/147"]);
  });

  it("die Kategorie wird je Client nur einmal geholt, auch wenn mehrere Sets sie brauchen", async () => {
    const log: string[] = [];
    const client = deps(working(), new MemoryStore(), log).bricklink;
    await client.contentsOfSet("75005-1");
    await client.contentsOfSet("75005-1");
    expect(calls(log).filter((call) => call === "categories/147")).toHaveLength(1);
  });

  it("ein Set ohne Teile, die nach Figuren aussehen, fragt keine Kategorie", async () => {
    const log: string[] = [];
    const { minifigs } = await deps(working(), new MemoryStore(), log).bricklink.contentsOfSet(
      "75372-1",
    );
    expect(minifigs.map((figure) => figure.number)).toEqual(["sw1306", "sw1307"]);
    expect(calls(log)).toEqual(["SET/75372-1/subsets"]);
  });

  it("ein Teil mit pb…c… in einer anderen Kategorie ist keine Big Fig (ein Torso mit Armen)", async () => {
    const routes: Route[] = [
      ["/categories/147", ok(categoryAnswer(147, "Minifigure, Torso"))],
      ...working(),
    ];
    const { minifigs } = await deps(routes).bricklink.contentsOfSet("75005-1");
    expect(minifigs.map((figure) => figure.number)).toEqual([
      "sw0405",
      "sw0433",
      "sw0434",
      "gen047",
    ]);
  });

  it("eine Big Fig in der Kategorie „Large Figure“ zählt auch, ein Pferd ohne Aufdruck in der Nummer nicht", async () => {
    const subsets = (entries: unknown[]) => ({
      meta: { code: 200, message: "OK", description: "OK" },
      data: entries.map((entry) => ({ match_no: 0, entries: [entry] })),
    });
    const part = (no: string, name: string, category: number) => ({
      item: { no, name, type: "PART", category_id: category },
      color_id: 1,
      quantity: 1,
    });
    const routes: Route[] = [
      [
        "/items/SET/9-1/subsets",
        ok(subsets([part("hulkpb01c01", "Hulk", 900), part("4493c01", "Horse", 147)])),
      ],
      ["/categories/900", ok(categoryAnswer(900, "Large Figure"))],
      ...working(),
    ];
    const { minifigs } = await deps(routes).bricklink.contentsOfSet("9-1");
    expect(minifigs.map((figure) => [figure.number, figure.bricklinkType])).toEqual([
      ["hulkpb01c01", "PART"],
    ]);
  });

  it("gelingt die Kategorie des Teils nicht, ist der Eintrag des Sets unvollständig und wird nicht gemerkt", async () => {
    const store = new MemoryStore();
    const routes: Route[] = [
      ["/categories/147", () => new Response("kaputt", { status: 500 })],
      ...working(),
    ];
    const item = await loadItem(deps(routes, store), "legoSet", "75005-1");
    expect(item.name).toBe("Rancor Pit");
    expect(item.figures).toBeUndefined();
    expect(store.values.has("item:legoSet:v2:75005-1")).toBe(false);
  });
});

function categoryAnswer(id: number, name: string) {
  return {
    meta: { code: 200, message: "OK", description: "OK" },
    data: { category_id: id, category_name: name, parent_id: 0 },
  };
}

describe("Big Figs im Preisabruf (Preisguide des Rancors, echte Antworten)", () => {
  const figure = (bricklinkId: string, attempts = 1) => ({
    runId: 1,
    itemType: "minifig" as const,
    bricklinkId,
    attempts,
  });

  it("der Schlüssel „PART:Nummer“ fragt BrickLink als Teil, ein einfacher Schlüssel als Minifigur", () => {
    expect(bricklinkTarget(figure("PART:11323pb01c01"))).toEqual({
      type: "PART",
      number: "11323pb01c01",
    });
    expect(bricklinkTarget(figure("sw0194"))).toEqual({ type: "MINIFIG", number: "sw0194" });
    expect(bricklinkTarget(figure("MINIFIG:sw0194"))).toEqual({
      type: "MINIFIG",
      number: "sw0194",
    });
  });

  it("der Preisguide des Teils braucht keine Farbe: ohne color_id kommen neu und gebraucht an", async () => {
    const log: string[] = [];
    const client = createBricklink({
      fetch: fakeFetch(
        [
          [
            "/items/PART/11323pb01c01/price?guide_type=sold&new_or_used=N",
            ok(BL_RANCOR_ANSWERS.priceNew),
          ],
          [
            "/items/PART/11323pb01c01/price?guide_type=sold&new_or_used=U",
            ok(BL_RANCOR_ANSWERS.priceUsed),
          ],
        ],
        log,
      ),
      credentials: CREDENTIALS,
    });
    expect(await priceOf(client, figure("PART:11323pb01c01"))).toEqual({
      kind: "priced",
      cents: { new: 13157, used: 10270 },
      soldCount: { new: 17, used: 70 },
    });
    expect(calls(log)).toEqual(["PART/11323pb01c01/price", "PART/11323pb01c01/price"]);
    expect(log.some((line) => line.includes("color_id"))).toBe(false);
  });

  it("ohne Typ im Schlüssel fragt der Abruf erst als Minifigur und, wenn BrickLink sie so nicht kennt, als Teil", async () => {
    const log: string[] = [];
    const client = createBricklink({
      fetch: fakeFetch(
        [
          [
            "/items/PART/11323pb01c01/price?guide_type=sold&new_or_used=N",
            ok(BL_RANCOR_ANSWERS.priceNew),
          ],
          [
            "/items/PART/11323pb01c01/price?guide_type=sold&new_or_used=U",
            ok(BL_RANCOR_ANSWERS.priceUsed),
          ],
          ["/items/MINIFIG/", brickLinkFailure(404, "RESOURCE_NOT_FOUND")],
        ],
        log,
      ),
      credentials: CREDENTIALS,
    });
    expect(await priceOf(client, figure("11323pb01c01"))).toMatchObject({
      kind: "priced",
      cents: { new: 13157, used: 10270 },
    });
    expect(calls(log)).toEqual([
      "MINIFIG/11323pb01c01/price",
      "PART/11323pb01c01/price",
      "PART/11323pb01c01/price",
    ]);
  });

  it("kennt BrickLink die Nummer weder als Minifigur noch als Teil, steht beides im Grund", async () => {
    const client = createBricklink({
      fetch: fakeFetch([
        ["/items/MINIFIG/", brickLinkFailure(404, "RESOURCE_NOT_FOUND")],
        ["/items/PART/", brickLinkFailure(404, "RESOURCE_NOT_FOUND")],
      ]),
      credentials: CREDENTIALS,
    });
    const error = await priceOf(client, figure("sw9999")).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CatalogError);
    expect((error as CatalogError).failure).toBe("not_found");
    expect((error as CatalogError).message).toContain("als Teil");
    // A special part or a set is not asked as a part.
    const log: string[] = [];
    const sets = createBricklink({
      fetch: fakeFetch([["/items/SET/", brickLinkFailure(404, "RESOURCE_NOT_FOUND")]], log),
      credentials: CREDENTIALS,
    });
    await expect(
      priceOf(sets, { runId: 1, itemType: "legoSet", bricklinkId: "1-1", attempts: 1 }),
    ).rejects.toMatchObject({ failure: "not_found" });
    expect(calls(log)).toEqual(["SET/1-1/price"]);
  });

  it("ein Lauf mit Minifigur und Big Fig schreibt für beide einen Stand", async () => {
    const store = new MemoryPriceRunStore();
    store.add("stephan", [
      ["minifig", "sw0194"],
      ["minifig", "PART:11323pb01c01"],
    ]);
    const client = createBricklink({
      fetch: fakeFetch([
        ["/items/PART/11323pb01c01/price", guide("50.0000", 4)],
        ["/items/MINIFIG/sw0194/price", guide("10.0000", 9)],
      ]),
      credentials: CREDENTIALS,
    });
    let time = new Date("2026-11-07T02:00:00Z").getTime();
    const result = await workOnPriceRuns(
      { store, bricklink: client, now: () => new Date(time++) },
      { budgetMs: 50_000 },
    );
    expect(result).toEqual({ processed: 2, paused: false });
    expect(store.outcomes.map((entry) => entry.key).sort()).toEqual([
      "minifig:PART:11323pb01c01",
      "minifig:sw0194",
    ]);
  });
});

/** The reason of a failed outcome; empty for anything else. */
function reasonOf(outcome: { kind: string; reason?: string } | undefined): string {
  return outcome?.kind === "failed" ? (outcome.reason ?? "") : "";
}

describe("Fehlergrund beim Preisabruf", () => {
  const unknownRun = () => {
    const store = new MemoryPriceRunStore();
    store.add("stephan", [["minifig", "sw9999"]]);
    const client = createBricklink({
      fetch: fakeFetch([
        ["/items/MINIFIG/", brickLinkFailure(404, "RESOURCE_NOT_FOUND")],
        ["/items/PART/", brickLinkFailure(404, "RESOURCE_NOT_FOUND")],
      ]),
      credentials: CREDENTIALS,
    });
    let time = new Date("2026-11-07T02:00:00Z").getTime();
    return { store, deps: { store, bricklink: client, now: () => new Date(time++) } };
  };

  it("ein fehlgeschlagener Eintrag bekommt den Grund von BrickLink (Code und Meldung) und steht im Protokoll", async () => {
    const { store, deps: run } = unknownRun();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await workOnPriceRuns(run, { budgetMs: 50_000 });
    const failed = store.outcomes.find((entry) => entry.outcome.kind === "failed");
    expect(failed?.outcome).toMatchObject({ kind: "failed" });
    const reason = reasonOf(failed?.outcome);
    expect(reason).toContain("BrickLink: nicht gefunden");
    expect(reason).toContain("RESOURCE_NOT_FOUND");
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]?.[0])).toContain("minifig sw9999");
    expect(String(log.mock.calls[0]?.[0])).toContain(reason);
    log.mockRestore();
  });

  it("ein Fehler von BrickLink wird beim Wiederholen protokolliert und beim letzten Versuch mit Grund gespeichert", async () => {
    const store = new MemoryPriceRunStore();
    store.add("stephan", [["minifig", "sw0194"]]);
    const client = createBricklink({
      fetch: fakeFetch([["/items/MINIFIG/", brickLinkFailure(500, "INTERNAL_ERROR")]]),
      credentials: CREDENTIALS,
    });
    let time = new Date("2026-11-07T02:00:00Z").getTime();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    for (let call = 0; call < 3; call++) {
      await workOnPriceRuns(
        { store, bricklink: client, now: () => new Date(time++) },
        { budgetMs: 50_000 },
      );
    }
    const kinds = store.outcomes.map((entry) => entry.outcome.kind);
    expect(kinds).toEqual(["retry", "retry", "failed"]);
    expect(reasonOf(store.outcomes[2]?.outcome)).toContain("Code 500");
    expect(log).toHaveBeenCalledTimes(3);
    expect(String(log.mock.calls[0]?.[0])).toContain("wird wiederholt");
    expect(String(log.mock.calls[2]?.[0])).toContain("fehlgeschlagen");
    log.mockRestore();
  });

  it("der Grund ist kurz und enthält nichts, was nach OAuth-Daten aussieht", () => {
    expect(
      failureReason(new CatalogError("unavailable", "BrickLink: Code 500 INTERNAL_ERROR")),
    ).toBe("BrickLink: Code 500 INTERNAL_ERROR");
    expect(
      failureReason(
        new CatalogError(
          "unavailable",
          'BrickLink nicht erreichbar: Fehler oauth_consumer_key="abc" oauth_signature=xyz%2F ende',
        ),
      ),
    ).toBe("BrickLink nicht erreichbar: Fehler ende");
    expect(failureReason(new CatalogError("unavailable", "x".repeat(500)))).toHaveLength(160);
    expect(failureReason(new TypeError("kaputt"))).toBe("unerwarteter Fehler: TypeError: kaputt");
  });
});
