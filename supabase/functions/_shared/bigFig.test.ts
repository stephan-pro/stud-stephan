// Big Figs: BrickLink lists the Rancor of 75005 "Rancor Pit" as a part (`11323pb01c01`, category
// "Large Figure"), not as a minifig. A figure is looked up as a minifig, then as a part; its type is
// kept; sets count their Big Figs among their figures; the price run asks for the type. The answers
// are the shapes BrickLink's documented calls send (see `catalog.fixtures.ts`).
import { describe, expect, it } from "vitest";
import { createBricklink } from "./bricklinkClient.ts";
import {
  brickLink,
  brickLinkFailure,
  brickLinkRoutes,
  CREDENTIALS,
  fakeFetch,
  MemoryStore,
  noSleep,
  type Route,
  rebrickableRoutes,
} from "./catalog.fixtures.ts";
import { type CatalogDeps, classifyQuery, loadItem, searchCatalog } from "./catalogService.ts";
import { parseFigureRef, typedRef } from "./catalogTypes.ts";
import { guide, MemoryPriceRunStore } from "./priceRun.fixtures.ts";
import { bricklinkTarget, priceOf, workOnPriceRuns } from "./priceRunService.ts";
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

/** The BrickLink calls of a log, in order: "MINIFIG/sw0194", "SET/75005-1/subsets", "categories". */
function calls(log: string[]): string[] {
  return log.flatMap((line) => {
    const match =
      /\/v1\/(items\/(?:[A-Z]+\/[^/?\s]+(?:\/[a-z]+)?)|categories(?:\/\d+)?)(?:$|\?)/.exec(line);
    return match?.[1] ? [match[1].replace(/^items\//, "")] : [];
  });
}

describe("Big Figs: Nummer erkennen", () => {
  it("eine Teilenummer wie 11323pb01c01 ist eine Nummer, ein Verweis mit Typ bleibt erhalten", () => {
    expect(classifyQuery("minifig", "11323pb01c01")).toEqual({ by: "number", ref: "11323pb01c01" });
    expect(classifyQuery("minifig", " 973C01 ")).toEqual({ by: "number", ref: "973c01" });
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

describe("Big Figs: Suche nach Nummer (Rancor)", () => {
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
        name: "Large Figure, Rancor",
        year: 2013,
        imageUrl: "https://img.bricklink.com/ItemImage/PN/0/11323pb01c01.png",
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
  it("Rancor: Name, Jahr, Kategorie, Bild, Typ PART und das Set, in dem er liegt", async () => {
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
      name: "Large Figure, Rancor",
      year: 2013,
      theme: "Large Figure",
      imageUrl: "https://img.bricklink.com/ItemImage/PN/0/11323pb01c01.png",
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
        () => Response.json({ set_num: "fig-099999", name: "Large Figure, Rancor", num_parts: 1 }),
      ],
      ...working(),
    ];
    const item = await loadItem(deps(routes), "minifig", "fig-099999");
    expect(item).toMatchObject({ number: "11323pb01c01", bricklinkType: "PART" });
  });
});

describe("Big Figs in Sets", () => {
  it("Rancor Pit: Luke und der Rancor sind die Figuren, die Steine nicht; der Rancor trägt Typ PART und kein Bild", async () => {
    const item = await loadItem(deps(working()), "legoSet", "75005");
    expect(item.figures).toEqual([
      {
        number: "sw0434",
        name: "Luke Skywalker",
        quantity: 1,
        imageUrl: "https://img.bricklink.com/ItemImage/MN/0/sw0434.png",
      },
      { number: "11323pb01c01", name: "Large Figure, Rancor", quantity: 1, bricklinkType: "PART" },
    ]);
  });

  it("die Kategorien werden nur einmal geholt, auch wenn mehrere Sets Teile haben", async () => {
    const log: string[] = [];
    const client = deps(working(), new MemoryStore(), log).bricklink;
    await client.contentsOfSet("75005-1");
    await client.contentsOfSet("75372-1");
    expect(calls(log).filter((call) => call === "categories")).toHaveLength(1);
  });

  it("ein Set ohne Teile fragt die Kategorien nicht", async () => {
    const log: string[] = [];
    const routes: Route[] = [
      [
        "/items/SET/1-1/subsets",
        brickLink([
          {
            match_no: 0,
            entries: [{ item: { no: "sw1", name: "Figur", type: "MINIFIG" }, quantity: 1 }],
          },
        ]),
      ],
      ...working(),
    ];
    const { minifigs } = await deps(routes, new MemoryStore(), log).bricklink.contentsOfSet("1-1");
    expect(minifigs.map((figure) => figure.number)).toEqual(["sw1"]);
    expect(calls(log)).toEqual(["SET/1-1/subsets"]);
  });

  it("ohne Kategorie „Large Figure“ zählen Teile nicht als Figuren", async () => {
    const routes: Route[] = [
      ["/categories", brickLink([{ category_id: 5, category_name: "Brick" }])],
      ...working(),
    ];
    const { minifigs } = await deps(routes).bricklink.contentsOfSet("75005-1");
    expect(minifigs.map((figure) => figure.number)).toEqual(["sw0434"]);
  });

  it("gelingt die Kategorienliste nicht, ist der Eintrag des Sets unvollständig und wird nicht gemerkt", async () => {
    const store = new MemoryStore();
    const routes: Route[] = [
      ["/categories", () => new Response("kaputt", { status: 500 })],
      ...working(),
    ];
    const item = await loadItem(deps(routes, store), "legoSet", "75005-1");
    expect(item.name).toBe("Rancor Pit");
    expect(item.figures).toBeUndefined();
    expect(store.values.has("item:legoSet:75005-1")).toBe(false);
  });
});

describe("Big Figs im Preisabruf", () => {
  const figure = (bricklinkId: string) => ({
    runId: 1,
    itemType: "minifig" as const,
    bricklinkId,
    attempts: 1,
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

  it("der Preisguide des Rancors kommt aus dem Teil, neu und gebraucht", async () => {
    const log: string[] = [];
    const client = createBricklink({
      fetch: fakeFetch(
        [
          ["/items/PART/11323pb01c01/price?guide_type=sold&new_or_used=N", guide("120.5000", 6)],
          ["/items/PART/11323pb01c01/price?guide_type=sold&new_or_used=U", guide("80.0000", 11)],
        ],
        log,
      ),
      credentials: CREDENTIALS,
    });
    expect(await priceOf(client, figure("PART:11323pb01c01"))).toEqual({
      kind: "priced",
      cents: { new: 12050, used: 8000 },
      soldCount: { new: 6, used: 11 },
    });
    expect(calls(log)).toEqual(["PART/11323pb01c01/price", "PART/11323pb01c01/price"]);
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
