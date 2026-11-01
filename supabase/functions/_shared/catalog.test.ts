// P7: the catalog functions with recorded-style answers instead of the internet (F2: number or
// name in, name, year, theme, pieces, picture, the figures of a set and the sets of a figure out).
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
  ok,
  type Route,
  rebrickableRoutes,
} from "./catalog.fixtures.ts";
import {
  type CatalogDeps,
  classifyQuery,
  loadItem,
  sameName,
  searchCatalog,
} from "./catalogService.ts";
import { CatalogError } from "./json.ts";
import { oauthHeader, percentEncode } from "./oauth.ts";
import { createRebrickable } from "./rebrickableClient.ts";

const NOW = new Date("2026-11-01T10:00:00Z");

// Published example values of the OAuth 1.0a documentation (not real keys).
const EXAMPLE_CONSUMER = "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw";
const EXAMPLE_TOKEN = "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE";

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
    now: () => NOW,
  };
}

const working = () => [...brickLinkRoutes(), ...rebrickableRoutes()];

describe("OAuth-Signatur für BrickLink (Web Crypto)", () => {
  it("signiert das Beispiel der OAuth-Dokumentation richtig", async () => {
    const header = await oauthHeader(
      "POST",
      "https://api.twitter.com/1.1/statuses/update.json",
      { include_entities: "true", status: "Hello Ladies + Gentlemen, a signed OAuth request!" },
      {
        consumerKey: "xvz1evFS4wEEPTGEFPHBog",
        consumerSecret: EXAMPLE_CONSUMER,
        tokenValue: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
        tokenSecret: EXAMPLE_TOKEN,
      },
      "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
      "1318622958",
    );
    const signature = /oauth_signature="([^"]+)"/.exec(header)?.[1];
    expect(decodeURIComponent(signature ?? "")).toBe("hCtSmYh+iHYCEqBWrE7C7hYmtUk=");
  });

  it("kodiert Sonderzeichen streng und gibt keine Geheimnisse in den Header", async () => {
    expect(percentEncode("a b!'()*~")).toBe("a%20b%21%27%28%29%2A~");
    const header = await oauthHeader("GET", "https://x.test/", {}, CREDENTIALS, "n", "1");
    expect(header).not.toContain("cs");
    expect(header).not.toContain('"ts"');
    expect(header).toContain('oauth_consumer_key="ck"');
  });
});

describe("BrickLink-Zugriff", () => {
  it("liest eine Figur mit Bild (https), Jahr und Kategorie", async () => {
    const client = deps(working()).bricklink;
    expect(await client.item("MINIFIG", "sw0194")).toEqual({
      number: "sw0194",
      name: "Captain Rex, Phase 2 Armor",
      year: 2012,
      categoryId: 65,
      imageUrl: "https://img.bricklink.com/ItemImage/MN/0/sw0194.png",
    });
  });

  it("liest die Figuren eines Sets ohne Steine, mit Stückzahl und Katalogbild", async () => {
    const figures = await deps(working()).bricklink.minifigsOfSet("75372-1");
    expect(figures.map((figure) => [figure.number, figure.quantity])).toEqual([
      ["sw1306", 2],
      ["sw1307", 1],
    ]);
    expect(figures[0]?.imageUrl).toBe("https://img.bricklink.com/ItemImage/MN/0/sw1306.png");
  });

  it("liest die Sets einer Figur", async () => {
    const sets = await deps(working()).bricklink.setsOfMinifig("sw0194");
    expect(sets.map((set) => set.number)).toEqual(["75372-1", "75345-1"]);
  });

  it("meldet 'nicht gefunden', 'zu viele Abfragen' und 'nicht erreichbar' getrennt", async () => {
    const failure = async (route: Route) =>
      deps([route])
        .bricklink.item("MINIFIG", "x")
        .catch((error: unknown) => (error as CatalogError).failure);
    expect(await failure(["/items/", brickLinkFailure(404, "RESOURCE_NOT_FOUND")])).toBe(
      "not_found",
    );
    expect(await failure(["/items/", brickLinkFailure(429, "TOO_MANY")])).toBe("limit_reached");
    expect(await failure(["/items/", brickLinkFailure(401, "BAD_OAUTH")])).toBe("unavailable");
    expect(await failure(["/items/", () => new Response("<html>", { status: 502 })])).toBe(
      "unavailable",
    );
    expect(await failure(["/items/", brickLink("kein Objekt")])).toBe("unavailable");
    expect(await failure(["/items/", brickLink({ no: "x" })])).toBe("not_found");
  });

  it("meldet ein Netzproblem als 'nicht erreichbar'", async () => {
    const client = createBricklink({
      fetch: (async () => {
        throw new Error("offline");
      }) as typeof fetch,
      credentials: CREDENTIALS,
    });
    await expect(client.item("SET", "1-1")).rejects.toMatchObject({ failure: "unavailable" });
  });

  it("ruft vor jeder Abfrage den Zähler und stoppt, wenn er ablehnt", async () => {
    let calls = 0;
    const client = createBricklink({
      fetch: fakeFetch(working()),
      credentials: CREDENTIALS,
      beforeCall: async () => {
        calls += 1;
        if (calls > 1) throw new CatalogError("limit_reached", "Tageslimit");
      },
    });
    await client.item("MINIFIG", "sw0194");
    await expect(client.item("MINIFIG", "sw0194")).rejects.toMatchObject({
      failure: "limit_reached",
    });
  });

  it("liest eine Kategorie mit Oberkategorie", async () => {
    const client = deps(working()).bricklink;
    expect(await client.category(65)).toEqual({ name: "The Clone Wars", parentId: 7 });
    expect(await client.category(7)).toEqual({ name: "Star Wars" });
    const broken = deps([["/categories/", brickLink({})]]).bricklink;
    await expect(broken.category(1)).rejects.toMatchObject({ failure: "unavailable" });
  });
});

describe("Rebrickable-Zugriff", () => {
  it("wartet zwischen zwei Abfragen und versucht es nach HTTP 429 noch einmal", async () => {
    const pauses: number[] = [];
    let answers = 0;
    const client = createRebrickable({
      fetch: fakeFetch([
        [
          "/sets/",
          () =>
            ++answers === 1
              ? new Response("slow", { status: 429, headers: { "retry-after": "2" } })
              : Response.json({ results: [] }),
        ],
      ]),
      key: "k",
      sleep: async (ms) => {
        pauses.push(ms);
      },
    });
    await client.searchSets("a");
    await client.searchSets("b");
    expect(pauses).toEqual([2000, 1100, 1100]);
    expect(answers).toBe(3);
  });

  it("gibt nach zwei Mal HTTP 429 auf", async () => {
    const client = createRebrickable({
      fetch: fakeFetch([["/sets/", () => new Response("", { status: 429 })]]),
      key: "k",
      sleep: noSleep,
    });
    await expect(client.searchSets("a")).rejects.toMatchObject({ failure: "limit_reached" });
  });

  it("unterscheidet 404, Serverfehler, kein JSON und kein Netz", async () => {
    const failure = async (answer: () => Response) =>
      createRebrickable({ fetch: fakeFetch([["/", answer]]), key: "k", sleep: noSleep })
        .set("1-1")
        .catch((error: unknown) => (error as CatalogError).failure);
    expect(await failure(() => new Response("", { status: 404 }))).toBe("not_found");
    expect(await failure(() => new Response("", { status: 500 }))).toBe("unavailable");
    expect(await failure(() => new Response("kein json"))).toBe("unavailable");
    expect(await failure(() => Response.json({ foo: 1 }))).toBe("unavailable");
    const offline = createRebrickable({
      fetch: (async () => {
        throw new Error("offline");
      }) as typeof fetch,
      key: "k",
      sleep: noSleep,
    });
    await expect(offline.set("1-1")).rejects.toMatchObject({ failure: "unavailable" });
  });

  it("liest Figur, Sets der Figur und Thema; unvollständige Einträge fallen weg", async () => {
    const client = deps(working()).rebrickable;
    expect(await client.minifig("fig-014663")).toMatchObject({
      name: "Clone Trooper, 332nd Company",
    });
    expect(await client.setsOfMinifig("fig-014663")).toEqual(["75372-1"]);
    expect(await client.theme(158)).toEqual({ name: "Battle Packs", parentId: 18 });
    const odd = createRebrickable({
      fetch: fakeFetch([
        ["/minifigs/?", ok({ results: [{ set_num: "fig-1" }, "x", { name: "ohne Nummer" }] })],
        ["/themes/", ok({ id: 1 })],
        ["/minifigs/fig-1/", ok({ foo: 1 })],
      ]),
      key: "k",
      sleep: noSleep,
    });
    expect(await odd.searchMinifigs("x")).toEqual([]);
    await expect(odd.theme(1)).rejects.toMatchObject({ failure: "unavailable" });
    await expect(odd.minifig("fig-1")).rejects.toMatchObject({ failure: "unavailable" });
  });
});

describe("Katalog: Nummer erkennen", () => {
  it("erkennt BrickLink-Figurennummern, Setnummern und Namen", () => {
    expect(classifyQuery("minifig", "SW0194")).toEqual({ by: "number", ref: "sw0194" });
    expect(classifyQuery("minifig", "coltlbm28")).toEqual({ by: "number", ref: "coltlbm28" });
    expect(classifyQuery("minifig", "fig-014663")).toEqual({ by: "number", ref: "fig-014663" });
    expect(classifyQuery("minifig", "Clone Trooper")).toEqual({
      by: "name",
      text: "Clone Trooper",
    });
    expect(classifyQuery("legoSet", "75372")).toEqual({ by: "number", ref: "75372-1" });
    expect(classifyQuery("legoSet", "75372-2")).toEqual({ by: "number", ref: "75372-2" });
    expect(classifyQuery("legoSet", " Battle Pack ")).toEqual({ by: "name", text: "Battle Pack" });
  });

  it("vergleicht Namen ohne Groß-/Kleinschreibung, Akzente und Satzzeichen", () => {
    expect(sameName("Clone Trooper, 332nd (Phase 2)", "clone trooper 332nd phase 2")).toBe(true);
    expect(sameName("Clone Trooper", "Clone Pilot")).toBe(false);
    expect(sameName("", "")).toBe(false);
  });
});

describe("Katalog: Suche (F2)", () => {
  it("Figurennummer sw0194 → ein Treffer mit Name, Jahr und Bild", async () => {
    const hits = await searchCatalog(deps(working()), "minifig", "sw0194");
    expect(hits).toEqual([
      {
        kind: "minifig",
        ref: "sw0194",
        number: "sw0194",
        name: "Captain Rex, Phase 2 Armor",
        year: 2012,
        imageUrl: "https://img.bricklink.com/ItemImage/MN/0/sw0194.png",
      },
    ]);
  });

  it("Setnummer ohne '-1' wird ergänzt; eine unbekannte Nummer gibt keinen Treffer", async () => {
    const hits = await searchCatalog(deps(working()), "legoSet", "75372");
    expect(hits[0]).toMatchObject({
      ref: "75372-1",
      name: "Clone Trooper & Battle Droid Battle Pack",
    });
    expect(await searchCatalog(deps(working()), "minifig", "sw9999")).toEqual([]);
  });

  it("eine andere Störung bei der Nummernsuche wird weitergegeben", async () => {
    const broken = deps([["/items/", brickLinkFailure(401, "BAD_OAUTH")]]);
    await expect(searchCatalog(broken, "minifig", "sw0194")).rejects.toMatchObject({
      failure: "unavailable",
    });
  });

  it("Name bei Sets → Treffer von Rebrickable mit Nummer und Jahr", async () => {
    const hits = await searchCatalog(deps(working()), "legoSet", "Battle Pack");
    expect(hits).toEqual([
      {
        kind: "legoSet",
        ref: "75372-1",
        number: "75372-1",
        name: "Clone Trooper & Battle Droid Battle Pack",
        year: 2024,
        imageUrl: "https://cdn.rebrickable.com/media/sets/75372-1.jpg",
      },
    ]);
  });

  it("Name bei Figuren → Treffer mit Rebrickable-Nummer als Verweis und ohne BrickLink-Nummer", async () => {
    const hits = await searchCatalog(deps(working()), "minifig", "Clone Trooper");
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ ref: "fig-014663", name: "Clone Trooper, 332nd Company" });
    expect(hits[0]?.number).toBeUndefined();
    expect(hits[1]?.imageUrl).toBeUndefined();
  });
});

describe("Katalog: Eintrag (F2)", () => {
  it("Set: Name, Jahr, Thema, Teile, Bild und die enthaltenen Figuren", async () => {
    const item = await loadItem(deps(working()), "legoSet", "75372");
    expect(item).toMatchObject({
      kind: "legoSet",
      number: "75372-1",
      name: "Clone Trooper & Battle Droid Battle Pack",
      year: 2024,
      theme: "Star Wars – Battle Packs",
      pieceCount: 215,
      imageUrl: "https://img.bricklink.com/ItemImage/SN/0/75372-1.png",
    });
    expect(item.figures?.map((figure) => [figure.number, figure.quantity])).toEqual([
      ["sw1306", 2],
      ["sw1307", 1],
    ]);
  });

  it("Figur: Name, Jahr, Thema (Oberthema – Unterthema), Bild und die Sets", async () => {
    const item = await loadItem(deps(working()), "minifig", "sw0194");
    expect(item).toMatchObject({
      number: "sw0194",
      year: 2012,
      theme: "Star Wars – The Clone Wars",
      imageUrl: "https://img.bricklink.com/ItemImage/MN/0/sw0194.png",
    });
    expect(item.sets).toEqual([
      { number: "75372-1", name: "Battle Pack" },
      { number: "75345-1", name: "501st Battle Pack" },
    ]);
  });

  it("Figur von Rebrickable → BrickLink-Nummer über die Figuren des Sets, nach dem Namen", async () => {
    const item = await loadItem(deps(working()), "minifig", "fig-014663");
    expect(item).toMatchObject({ number: "sw1306", name: "Clone Trooper, 332nd Company" });
  });

  it("Figur von Rebrickable ohne Treffer im Set → Eintrag ohne Nummer, die der Nutzer ergänzt", async () => {
    const item = await loadItem(deps(working()), "minifig", "fig-000001");
    expect(item).toEqual({ kind: "minifig", number: "", name: "Unknown Person" });
  });

  it("Eine Nummer, die es nicht gibt, ist 'nicht gefunden'; ein Name ist kein Verweis", async () => {
    await expect(loadItem(deps(working()), "legoSet", "99999")).rejects.toMatchObject({
      failure: "not_found",
    });
    await expect(loadItem(deps(working()), "minifig", "kein Verweis")).rejects.toMatchObject({
      failure: "not_found",
    });
  });

  it("Ohne Rebrickable bleibt der BrickLink-Teil; Thema kommt von BrickLink, nichts wird gemerkt", async () => {
    const store = new MemoryStore();
    const rebrickableDown: Route = ["rebrickable.com", () => new Response("", { status: 500 })];
    const item = await loadItem(
      deps([...brickLinkRoutes(), rebrickableDown], store),
      "legoSet",
      "75372-1",
    );
    expect(item).toMatchObject({
      name: "Clone Trooper & Battle Droid Battle Pack",
      theme: "Star Wars – The Clone Wars",
    });
    expect(item.pieceCount).toBeUndefined();
    expect(store.values.has("item:legoSet:75372-1")).toBe(false);
  });

  it("Ein Thema ohne Oberthema bleibt einstufig", async () => {
    const routes: Route[] = [
      ...brickLinkRoutes().filter(([match]) => !match.startsWith("/categories/")),
      ["/categories/65", brickLink({ category_name: "Town" })],
      ...rebrickableRoutes(),
    ];
    const item = await loadItem(deps(routes), "minifig", "sw0194");
    expect(item.theme).toBe("Town");
  });
});

describe("Katalog: Zwischenspeicher 30 Tage", () => {
  it("die zweite Anfrage geht nicht mehr zu BrickLink oder Rebrickable", async () => {
    const store = new MemoryStore();
    const log: string[] = [];
    await loadItem(deps(working(), store, log), "legoSet", "75372-1");
    const first = log.length;
    expect(first).toBeGreaterThan(2);
    const again = await loadItem(deps(working(), store, log), "legoSet", "75372-1");
    expect(log).toHaveLength(first);
    expect(again.name).toBe("Clone Trooper & Battle Droid Battle Pack");
  });

  it("nach 30 Tagen wird neu geholt", async () => {
    const store = new MemoryStore();
    const log: string[] = [];
    await loadItem(deps(working(), store, log), "minifig", "sw0194");
    const first = log.length;
    for (const entry of store.values.values()) entry.fetchedAt = "2026-09-01T00:00:00.000Z";
    await loadItem(deps(working(), store, log), "minifig", "sw0194");
    expect(log.length).toBeGreaterThan(first);
  });
});
