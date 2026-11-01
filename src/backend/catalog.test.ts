import { describe, expect, it } from "vitest";
import { DEMO_CATALOG } from "../demo/catalog";
import { CatalogCallError, type CatalogHit, SupabaseCatalog } from "./catalog";
import { FakeCatalog } from "./fakeCatalog";

// The real function is tested in `supabase/functions/_shared/`; here how the app calls it and
// reads its answers, and the example catalog of the demo.

type Invoke = (
  name: string,
  options: { body: unknown },
) => Promise<{ data: unknown; error: unknown }>;

function catalogWith(invoke: Invoke): SupabaseCatalog {
  return new SupabaseCatalog({ functions: { invoke } } as never);
}

const HIT: CatalogHit = { kind: "minifig", ref: "sw0194", number: "sw0194", name: "Captain Rex" };

describe("P7 F2 Der Katalog der App ruft die Funktion catalog", () => {
  it("P7 F2 Die Suche schickt Art und Text und liefert die Treffer", async () => {
    const calls: unknown[] = [];
    const catalog = catalogWith(async (name, options) => {
      calls.push([name, options.body]);
      return { data: { op: "search", hits: [HIT] }, error: null };
    });
    expect(await catalog.search("minifig", "sw0194")).toEqual([HIT]);
    expect(calls).toEqual([["catalog", { op: "search", kind: "minifig", query: "sw0194" }]]);
  });

  it("P7 F2 Ein Eintrag wird über seinen Verweis geholt", async () => {
    const item = { kind: "minifig", number: "sw0194", name: "Captain Rex" };
    const catalog = catalogWith(async () => ({ data: { op: "item", item }, error: null }));
    expect(await catalog.item("minifig", "sw0194")).toEqual(item);
  });

  it("P7 F2 Die Antwort der Funktion mit einem Grund wird zum Grund des Fehlers", async () => {
    for (const failure of ["not_found", "limit_reached", "unavailable", "not_signed_in"]) {
      const catalog = catalogWith(async () => ({
        data: null,
        error: { context: Response.json({ failure }, { status: 500 }) },
      }));
      await expect(catalog.search("minifig", "sw")).rejects.toMatchObject({ failure });
    }
  });

  it("P7 F2 Eine Antwort ohne Grund ist 'nicht verfügbar', ein Netzfehler 'offline'", async () => {
    const odd = catalogWith(async () => ({
      data: null,
      error: { context: new Response("kaputt", { status: 500 }) },
    }));
    await expect(odd.item("legoSet", "1-1")).rejects.toMatchObject({ failure: "unavailable" });
    const offline = catalogWith(async () => ({
      data: null,
      error: new TypeError("Failed to fetch"),
    }));
    await expect(offline.item("legoSet", "1-1")).rejects.toMatchObject({ failure: "offline" });
  });

  it("P14 S12 Der Stand der Datenquellen kommt von der Funktion catalog, ohne Schlüssel", async () => {
    const calls: unknown[] = [];
    const sources = {
      rebrickable: "ok",
      bricklink: "missingKeys",
      brickognize: "ok",
      merlin: "unreachable",
    };
    const catalog = catalogWith(async (name, options) => {
      calls.push([name, options.body]);
      return { data: { op: "sources", sources }, error: null };
    });

    expect(await catalog.sources()).toEqual(sources);
    expect(calls).toEqual([["catalog", { op: "sources" }]]);
  });

  it("P14 S12 Ein Fehler oder eine unvollständige Antwort der Datenquellen wird zum Fehler", async () => {
    const failing = catalogWith(async () => ({
      data: null,
      error: { context: Response.json({ failure: "not_signed_in" }, { status: 401 }) },
    }));
    await expect(failing.sources()).rejects.toMatchObject({ failure: "not_signed_in" });
    for (const data of [null, { op: "search" }, { op: "sources", sources: { merlin: "ok" } }]) {
      const odd = catalogWith(async () => ({ data, error: null }));
      await expect(odd.sources()).rejects.toMatchObject({ failure: "unavailable" });
    }
  });

  it("P14 S12 Der Beispielkatalog meldet alles in Ordnung, ein Test kann einzelne Quellen ändern", async () => {
    expect(await new FakeCatalog(DEMO_CATALOG).sources()).toEqual({
      rebrickable: "ok",
      bricklink: "ok",
      brickognize: "ok",
      merlin: "ok",
    });
    const changed = new FakeCatalog(
      DEMO_CATALOG,
      () => undefined,
      () => ({ bricklink: "missingKeys" }),
    );
    expect((await changed.sources()).bricklink).toBe("missingKeys");
    const offline = new FakeCatalog(DEMO_CATALOG, () => "offline");
    await expect(offline.sources()).rejects.toMatchObject({ failure: "offline" });
  });

  it("P7 F2 Eine unlesbare oder falsche Antwort ist 'nicht verfügbar'", async () => {
    for (const data of [null, { op: "boom" }]) {
      const catalog = catalogWith(async () => ({ data, error: null }));
      await expect(catalog.search("minifig", "sw")).rejects.toBeInstanceOf(CatalogCallError);
    }
    const wrong = catalogWith(async () => ({ data: { op: "item", item: {} }, error: null }));
    await expect(wrong.search("minifig", "sw")).rejects.toMatchObject({ failure: "unavailable" });
    const wrongItem = catalogWith(async () => ({ data: { op: "search", hits: [] }, error: null }));
    await expect(wrongItem.item("minifig", "sw")).rejects.toMatchObject({ failure: "unavailable" });
  });
});

describe("P7 Der Beispielkatalog der Vorschau", () => {
  const catalog = new FakeCatalog(DEMO_CATALOG);

  it("P7 F2 sw063 findet vier Figuren wie im Klick-Dummy", async () => {
    const hits = await catalog.search("minifig", "sw063");
    expect(hits.map((hit) => hit.number)).toEqual(["sw0631", "sw0632", "sw0634", "sw0636"]);
  });

  it("P7 F2 Sets findet er mit und ohne '-1' und nach dem Namen", async () => {
    expect((await catalog.search("legoSet", "75372")).map((hit) => hit.number)).toEqual([
      "75372-1",
    ]);
    expect((await catalog.search("legoSet", "75372-1")).length).toBe(1);
    expect((await catalog.search("legoSet", "battle pack")).length).toBe(2);
    expect(await catalog.search("legoSet", "sw0194")).toEqual([]);
  });

  it("P7 F2 Einen Eintrag gibt es nur für eine bekannte Nummer der Art", async () => {
    expect((await catalog.item("minifig", "sw0194")).name).toBe("Captain Rex");
    await expect(catalog.item("legoSet", "sw0194")).rejects.toMatchObject({ failure: "not_found" });
  });

  it("P7 F2 Ohne Verbindung oder bei Störung scheitern die Aufrufe mit Grund", async () => {
    const broken = new FakeCatalog(DEMO_CATALOG);
    broken.online = false;
    await expect(broken.search("minifig", "sw")).rejects.toMatchObject({ failure: "offline" });
    broken.online = true;
    broken.failure = "limit_reached";
    await expect(broken.item("minifig", "sw0194")).rejects.toMatchObject({
      failure: "limit_reached",
    });
    expect(broken.calls).toEqual(["search minifig sw", "item minifig sw0194"]);
  });
});
