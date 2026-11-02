// Special parts in the catalog: GWPs and Insiders rewards ("5010325 The Mandalorian and Grogu Metal
// Card") are gear, promotional sets or books at BrickLink, and a number does not say which. The
// answers are the shapes BrickLink's documented item calls send (see `catalog.fixtures.ts`).
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
import { parseSpecialPartRef, specialPartRef } from "./catalogTypes.ts";
import { parseCatalogRequest } from "./handler.ts";
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
    now: () => new Date("2026-11-06T10:00:00Z"),
  };
}

const working = () => [...brickLinkRoutes(), ...rebrickableRoutes()];

/** The BrickLink item calls of a log, in order: "GEAR/5010325". */
function itemCalls(log: string[]): string[] {
  return log.flatMap((line) => {
    const match = /\/items\/(GEAR|SET|BOOK|MINIFIG)\/([^/?\s]+)(?:$|\?)/.exec(line);
    return match ? [`${match[1]}/${match[2]}`] : [];
  });
}

describe("Sonderteile: Nummer erkennen", () => {
  it("eine Nummer mit Ziffer ist eine Nummer, ein Name nicht, ein Verweis mit Typ bleibt erhalten", () => {
    expect(classifyQuery("specialPart", " 5010325 ")).toEqual({ by: "number", ref: "5010325" });
    expect(classifyQuery("specialPart", "5008889-1")).toEqual({ by: "number", ref: "5008889-1" });
    expect(classifyQuery("specialPart", "gear012")).toEqual({ by: "number", ref: "gear012" });
    expect(classifyQuery("specialPart", "Metal Card")).toEqual({ by: "name", text: "Metal Card" });
    expect(classifyQuery("specialPart", "Mandalorian")).toEqual({
      by: "name",
      text: "Mandalorian",
    });
    expect(classifyQuery("specialPart", "gear:5010325")).toEqual({
      by: "number",
      ref: "GEAR:5010325",
    });
  });

  it("Verweis mit Typ: zusammensetzen und lesen, nur bekannte Typen", () => {
    expect(specialPartRef("BOOK", "5000001")).toBe("BOOK:5000001");
    expect(parseSpecialPartRef("SET:5008889-1")).toEqual({ type: "SET", number: "5008889-1" });
    expect(parseSpecialPartRef("gear:5010325")).toEqual({ type: "GEAR", number: "5010325" });
    expect(parseSpecialPartRef("PART:3001")).toBeUndefined();
    expect(parseSpecialPartRef("GEAR:")).toBeUndefined();
    expect(parseSpecialPartRef("5010325")).toBeUndefined();
  });
});

describe("Sonderteile: Suche nach Nummer", () => {
  it("5010325 → Gear mit Name, Bild und Jahr; nach dem ersten Treffer wird nicht weiter gefragt", async () => {
    const log: string[] = [];
    const hits = await searchCatalog(
      deps(working(), new MemoryStore(), log),
      "specialPart",
      "5010325",
    );
    expect(hits).toEqual([
      {
        kind: "specialPart",
        ref: "GEAR:5010325",
        number: "5010325",
        bricklinkType: "GEAR",
        name: "The Mandalorian and Grogu Metal Card",
        year: 2026,
        imageUrl: "https://img.bricklink.com/ItemImage/GN/0/5010325.png",
      },
    ]);
    expect(itemCalls(log)).toEqual(["GEAR/5010325"]);
  });

  it("die Typen werden nacheinander geprüft: Gear, dann Set (mit „-1“), dann Buch", async () => {
    const setLog: string[] = [];
    const set = await searchCatalog(
      deps(working(), new MemoryStore(), setLog),
      "specialPart",
      "5008889",
    );
    expect(set[0]).toMatchObject({
      ref: "SET:5008889-1",
      number: "5008889-1",
      bricklinkType: "SET",
      name: "Promo Polybag",
    });
    expect(itemCalls(setLog)).toEqual(["GEAR/5008889", "SET/5008889-1"]);

    const bookLog: string[] = [];
    const book = await searchCatalog(
      deps(working(), new MemoryStore(), bookLog),
      "specialPart",
      "5000001",
    );
    expect(book[0]).toMatchObject({ ref: "BOOK:5000001", bricklinkType: "BOOK" });
    expect(book[0]?.imageUrl).toBeUndefined();
    expect(itemCalls(bookLog)).toEqual(["GEAR/5000001", "SET/5000001-1", "BOOK/5000001"]);
  });

  it("eine Nummer mit „-1“ wird als Set gefunden, ohne dass sie ein zweites Mal „-1“ bekommt", async () => {
    const log: string[] = [];
    const hits = await searchCatalog(
      deps(working(), new MemoryStore(), log),
      "specialPart",
      "5008889-1",
    );
    expect(hits[0]?.bricklinkType).toBe("SET");
    expect(itemCalls(log)).toEqual(["GEAR/5008889-1", "SET/5008889-1"]);
  });

  it("ein Verweis mit Typ fragt nur diesen Typ", async () => {
    const log: string[] = [];
    const hits = await searchCatalog(
      deps(working(), new MemoryStore(), log),
      "specialPart",
      "GEAR:5010325",
    );
    expect(hits).toHaveLength(1);
    expect(itemCalls(log)).toEqual(["GEAR/5010325"]);
    const wrongType = await searchCatalog(deps(working()), "specialPart", "BOOK:5010325");
    expect(wrongType).toEqual([]);
  });

  it("eine Nummer, die BrickLink in keinem der Typen kennt, gibt keinen Treffer", async () => {
    const log: string[] = [];
    expect(
      await searchCatalog(deps(working(), new MemoryStore(), log), "specialPart", "99999"),
    ).toEqual([]);
    expect(itemCalls(log)).toEqual(["GEAR/99999", "SET/99999-1", "BOOK/99999"]);
  });

  it("ein Name gibt keinen Treffer und fragt weder BrickLink noch Rebrickable", async () => {
    const log: string[] = [];
    expect(
      await searchCatalog(deps(working(), new MemoryStore(), log), "specialPart", "Metal Card"),
    ).toEqual([]);
    expect(log).toEqual([]);
  });

  it("das Tageslimit von BrickLink und jede andere Störung brechen die Suche ab, statt zum nächsten Typ zu gehen", async () => {
    const log: string[] = [];
    const limited: Route[] = [["/items/GEAR/", brickLinkFailure(429, "TOO_MANY")], ...working()];
    await expect(
      searchCatalog(deps(limited, new MemoryStore(), log), "specialPart", "5008889"),
    ).rejects.toMatchObject({ failure: "limit_reached" });
    expect(itemCalls(log)).toEqual(["GEAR/5008889"]);

    const broken: Route[] = [["/items/GEAR/", brickLinkFailure(401, "BAD_OAUTH")], ...working()];
    await expect(searchCatalog(deps(broken), "specialPart", "5008889")).rejects.toMatchObject({
      failure: "unavailable",
    });
  });
});

describe("Sonderteile: Katalogeintrag", () => {
  it("Gear: Name, Jahr, Kategorie (Oberkategorie – Unterkategorie), Bild und der BrickLink-Typ", async () => {
    const item = await loadItem(deps(working()), "specialPart", "5010325");
    expect(item).toEqual({
      kind: "specialPart",
      number: "5010325",
      bricklinkType: "GEAR",
      name: "The Mandalorian and Grogu Metal Card",
      year: 2026,
      theme: "Gear – Miscellaneous",
      imageUrl: "https://img.bricklink.com/ItemImage/GN/0/5010325.png",
    });
  });

  it("ein Verweis mit Typ („SET:5008889“) liest genau diesen Typ und setzt „-1“ an", async () => {
    const log: string[] = [];
    const item = await loadItem(
      deps(working(), new MemoryStore(), log),
      "specialPart",
      "SET:5008889",
    );
    expect(item).toMatchObject({
      number: "5008889-1",
      bricklinkType: "SET",
      theme: "Star Wars – The Clone Wars",
    });
    expect(itemCalls(log)).toEqual(["SET/5008889-1"]);
  });

  it("Buch ohne Bild: Eintrag ohne Bild", async () => {
    const item = await loadItem(deps(working()), "specialPart", "5000001");
    expect(item).toMatchObject({ bricklinkType: "BOOK", name: "Sample Book", theme: "Books" });
    expect(item.imageUrl).toBeUndefined();
  });

  it("eine unbekannte Nummer ist „nicht gefunden“, ein Name ist kein Verweis", async () => {
    await expect(loadItem(deps(working()), "specialPart", "99999")).rejects.toMatchObject({
      failure: "not_found",
    });
    await expect(loadItem(deps(working()), "specialPart", "Metal Card")).rejects.toMatchObject({
      failure: "not_found",
    });
  });

  it("die zweite Anfrage kommt aus dem Zwischenspeicher; ohne Kategorie wird nichts gemerkt", async () => {
    const store = new MemoryStore();
    const log: string[] = [];
    await loadItem(deps(working(), store, log), "specialPart", "5010325");
    const first = log.length;
    await loadItem(deps(working(), store, log), "specialPart", "5010325");
    expect(log).toHaveLength(first);

    const withoutCategory = new MemoryStore();
    const routes: Route[] = [["/categories/", brickLink({})], ...working()];
    const item = await loadItem(deps(routes, withoutCategory), "specialPart", "5010325");
    expect(item.name).toBe("The Mandalorian and Grogu Metal Card");
    expect(item.theme).toBeUndefined();
    expect(withoutCategory.values.has("item:specialPart:5010325")).toBe(false);
  });
});

describe("Sonderteile: Anfrage an die Funktion", () => {
  it("die Art „specialPart“ wird angenommen, der Verweis darf einen Typ tragen (nur dort)", () => {
    expect(parseCatalogRequest({ op: "search", kind: "specialPart", query: "5010325" })).toEqual({
      op: "search",
      kind: "specialPart",
      query: "5010325",
    });
    expect(parseCatalogRequest({ op: "item", kind: "specialPart", ref: "GEAR:5010325" })).toEqual({
      op: "item",
      kind: "specialPart",
      ref: "GEAR:5010325",
    });
    expect(
      parseCatalogRequest({ op: "item", kind: "minifig", ref: "GEAR:5010325" }),
    ).toBeUndefined();
    expect(parseCatalogRequest({ op: "item", kind: "specialPart", ref: "a b" })).toBeUndefined();
    expect(parseCatalogRequest({ op: "item", kind: "gear", ref: "5010325" })).toBeUndefined();
  });
});
