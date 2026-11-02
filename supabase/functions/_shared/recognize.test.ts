// P8 (F1): the function `recognize` — the photo goes to Brickognize, up to five suggestions with a
// BrickLink number come back; sign-in, bad bodies and failures of the service. The answers are in
// the shape Brickognize sent in P2 (docs/DATENQUELLEN.md).
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BRICKOGNIZE_ANY_URL,
  BRICKOGNIZE_SETS_URL,
  BRICKOGNIZE_URL,
  createBrickognize,
  parseAnySuggestions,
  parseSetSuggestions,
  parseSuggestions,
} from "./brickognizeClient.ts";
import { fakeFetch, ok, type Route } from "./catalog.fixtures.ts";
import { recognizeHandlerDeps } from "./environment.ts";
import { handleRecognize } from "./handler.ts";
import { MAX_PHOTO_BYTES, RECOGNIZE_KIND_HEADER, type Suggestion } from "./recognizeTypes.ts";

const ENV: Record<string, string> = { SUPABASE_URL: "https://projekt.supabase.co" };
const AUTH: Route = ["/auth/v1/user", ok({ id: "u" })];

/** One entry as Brickognize sends it (P2: Hugo Strange, 78 %). */
function entry(id: string, name: string, score: number, sites: string[] = ["bricklink"]) {
  return {
    id,
    name,
    img_url: `https://img.bricklink.com/ItemImage/MN/0/${id}.png`,
    category: "Minifigures",
    score,
    external_sites: sites.map((site) => ({ name: site, url: `https://${site}.example/${id}` })),
  };
}

const HUGO = ok({ items: [entry("coltlbm28", "Hugo Strange, Series 1", 0.78)] });

function photo(
  headers: Record<string, string> = { "Content-Type": "image/webp" },
  body: BodyInit = new Uint8Array([1, 2, 3, 4]),
  auth = true,
): Request {
  return new Request("https://projekt.supabase.co/functions/v1/recognize", {
    method: "POST",
    headers: { ...(auth ? { Authorization: "Bearer jwt", apikey: "pk" } : {}), ...headers },
    body,
  });
}

function deps(routes: Route[], log: string[] = []) {
  return recognizeHandlerDeps((name) => ENV[name], fakeFetch([AUTH, ...routes], log));
}

/** An entry of the general endpoint, which also says what it is (`type`). */
function typed(type: string, id: string, name: string, score: number) {
  return { ...entry(id, name, score), type };
}

// The three endpoints; the general one is last, its address is the start of the others.
const FIGS_URL = "/predict/figs/";
const SETS_URL = "/predict/sets/";
const ANY_URL = "api.brickognize.com/predict/";

describe("Antworten von Brickognize lesen", () => {
  it("F1 liefert die Figur mit BrickLink-Nummer, Name, Trefferquote und Bild", () => {
    expect(
      parseSuggestions({ items: [entry("coltlbm28", "Hugo Strange, Series 1", 0.78)] }),
    ).toEqual([
      {
        number: "coltlbm28",
        name: "Hugo Strange, Series 1",
        score: 0.78,
        imageUrl: "https://img.bricklink.com/ItemImage/MN/0/coltlbm28.png",
      },
    ]);
  });

  it("F1 ein Vorschlag genügt, bis zu fünf kommen sortiert, mehr werden abgeschnitten", () => {
    const items = ["a1", "a2", "a3", "a4", "a5", "a6", "a7"].map((id, index) =>
      entry(id, `Figur ${id}`, index / 10),
    );
    const found = parseSuggestions({ items });
    expect(found.map((suggestion) => suggestion.number)).toEqual(["a7", "a6", "a5", "a4", "a3"]);
    expect(parseSuggestions({ items: [items[2]] })).toHaveLength(1);
  });

  it("lässt Unbrauchbares weg: ohne Nummer oder Quote, fremde Nummern, ungültige Zeichen", () => {
    const found = parseSuggestions({
      items: [
        { name: "ohne Nummer", score: 0.5 },
        { id: "sw0001", name: "ohne Quote" },
        entry("fremd1", "nur anderswo", 0.9, ["rebrickable"]),
        entry("../x", "Pfad", 0.9),
        { ...entry("sw0002", "ohne Bild", 0.4), img_url: "http://unsicher.example/x.png" },
        "kein Objekt",
      ],
    });
    expect(found).toEqual([{ number: "sw0002", name: "ohne Bild", score: 0.4 }]);
  });

  it("klemmt die Quote auf 0 bis 1 und nimmt die Nummer als Namen, wenn der Name fehlt", () => {
    expect(parseSuggestions({ items: [{ id: "sw0003", score: 1.7, external_sites: [] }] })).toEqual(
      [{ number: "sw0003", name: "sw0003", score: 1 }],
    );
  });

  it("ein Körper ohne Liste ist kein Treffer", () => {
    expect(parseSuggestions(null)).toEqual([]);
    expect(parseSuggestions({ items: "x" })).toEqual([]);
  });
});

describe("Funktion recognize", () => {
  it("F1 schickt das Foto als Formularfeld query_image an Brickognize und antwortet mit den Vorschlägen", async () => {
    const log: string[] = [];
    const sent: { field?: FormDataEntryValue | null | undefined } = {};
    const send = fakeFetch([AUTH, ["brickognize", HUGO]], log);
    const spying = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === BRICKOGNIZE_URL) {
        sent.field = (init?.body as FormData | undefined)?.get("query_image");
      }
      return send(input, init);
    }) as typeof fetch;
    const response = await handleRecognize(photo(), {
      signedIn: recognizeHandlerDeps((name) => ENV[name], spying).signedIn,
      service: createBrickognize({ fetch: spying }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      suggestions: [
        {
          number: "coltlbm28",
          name: "Hugo Strange, Series 1",
          score: 0.78,
          imageUrl: "https://img.bricklink.com/ItemImage/MN/0/coltlbm28.png",
        },
      ],
    });
    expect(log).toContain(`POST ${BRICKOGNIZE_URL}`);
    expect(sent.field).toBeInstanceOf(Blob);
    expect((sent.field as Blob).type).toBe("image/webp");
    expect((sent.field as Blob).size).toBe(4);
  });

  it("F1 ein Foto ohne Treffer ist eine leere Liste, kein Fehler", async () => {
    const response = await handleRecognize(photo(), deps([["brickognize", ok({ items: [] })]]));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ suggestions: [] });
  });

  it("ohne Anmeldung: 401, und Brickognize wird nicht gefragt", async () => {
    const log: string[] = [];
    const response = await handleRecognize(
      photo({ "Content-Type": "image/webp" }, new Uint8Array([1]), false),
      deps([["brickognize", HUGO]], log),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ failure: "not_signed_in" });
    expect(log.some((line) => line.includes("brickognize"))).toBe(false);
  });

  it("die Anmeldung wird beim Projekt geprüft: ein abgelehntes Token gibt 401", async () => {
    const refusing = recognizeHandlerDeps(
      (name) => ENV[name],
      fakeFetch([["/auth/v1/user", () => new Response("", { status: 401 })]]),
    );
    expect((await handleRecognize(photo(), refusing)).status).toBe(401);
  });

  it("OPTIONS beantwortet die Vorabfrage, andere Methoden werden abgelehnt", async () => {
    const options = await handleRecognize(
      new Request("https://x.test/", { method: "OPTIONS" }),
      deps([]),
    );
    expect(options.status).toBe(204);
    expect(options.headers.get("Access-Control-Allow-Headers")).toContain("authorization");
    const get = await handleRecognize(new Request("https://x.test/", { method: "GET" }), deps([]));
    expect(get.status).toBe(400);
  });

  it("schlechte Aufrufe: leer, zu groß, kein Bildtyp → 400", async () => {
    const bad = async (request: Request) =>
      (await handleRecognize(request, deps([["brickognize", HUGO]]))).status;
    expect(await bad(photo({ "Content-Type": "image/webp" }, new Uint8Array(0)))).toBe(400);
    expect(
      await bad(photo({ "Content-Type": "image/jpeg" }, new Uint8Array(MAX_PHOTO_BYTES + 1))),
    ).toBe(400);
    expect(await bad(photo({ "Content-Type": "application/json" }, "{}"))).toBe(400);
    expect(await bad(photo({}, new Uint8Array([1])))).toBe(400);
  });

  it("Jpeg und Png mit Zusatz im Typ werden angenommen", async () => {
    const accepted = async (type: string) =>
      (
        await handleRecognize(
          photo({ "Content-Type": type }, new Uint8Array([9])),
          deps([["brickognize", HUGO]]),
        )
      ).status;
    expect(await accepted("image/jpeg")).toBe(200);
    expect(await accepted("image/png; charset=binary")).toBe(200);
  });

  it("F1 Brickognize gestört, unlesbar oder nicht erreichbar → 502; zu viele Anfragen → 429", async () => {
    const status = async (route: Route) => (await handleRecognize(photo(), deps([route]))).status;
    expect(await status(["brickognize", () => new Response("kaputt", { status: 500 })])).toBe(502);
    expect(await status(["brickognize", () => new Response("<html>", { status: 200 })])).toBe(502);
    expect(await status(["brickognize", () => new Response("", { status: 429 })])).toBe(429);
    const offline = {
      signedIn: async () => true,
      service: createBrickognize({
        fetch: (async () => {
          throw new Error("offline");
        }) as typeof fetch,
      }),
    };
    const down = await handleRecognize(photo(), offline);
    expect(down.status).toBe(502);
    expect(await down.json()).toEqual({ failure: "unavailable" });
  });
});

describe("Sets erkennen (F1)", () => {
  const RANCOR_PIT = ok({
    items: [entry("75005-1", "Rancor Pit", 0.88), entry("75005", "Rancor Pit, ohne Variante", 0.2)],
  });

  it("F1 Set-Nummern bekommen ihre Variante, bester zuerst, mit Bild", () => {
    expect(
      parseSetSuggestions({
        items: [entry("75005", "Rancor Pit", 0.2), entry("75372-1", "Battle Pack", 0.7)],
      }),
    ).toEqual([
      {
        number: "75372-1",
        name: "Battle Pack",
        score: 0.7,
        imageUrl: "https://img.bricklink.com/ItemImage/MN/0/75372-1.png",
      },
      {
        number: "75005-1",
        name: "Rancor Pit",
        score: 0.2,
        imageUrl: "https://img.bricklink.com/ItemImage/MN/0/75005.png",
      },
    ]);
  });

  it("F1 Die Art legoSet fragt nur den Set-Endpunkt, mit dem Foto als query_image", async () => {
    const log: string[] = [];
    const response = await handleRecognize(
      photo({ "Content-Type": "image/webp", [RECOGNIZE_KIND_HEADER]: "legoSet" }),
      deps([[SETS_URL, RANCOR_PIT]], log),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { suggestions: Suggestion[] };
    // "75005" and "75005-1" are the same set: one suggestion, the sure one.
    expect(body.suggestions).toMatchObject([
      { number: "75005-1", name: "Rancor Pit", score: 0.88 },
    ]);
    expect(log).toContain(`POST ${BRICKOGNIZE_SETS_URL}`);
    expect(log.some((line) => line.endsWith(BRICKOGNIZE_URL))).toBe(false);
    expect(log.some((line) => line.endsWith(BRICKOGNIZE_ANY_URL))).toBe(false);
  });

  it("F1 Ohne Treffer: leere Liste; gestörter Dienst: 502", async () => {
    const asSet = { "Content-Type": "image/webp", [RECOGNIZE_KIND_HEADER]: "legoSet" };
    const none = await handleRecognize(photo(asSet), deps([[SETS_URL, ok({ items: [] })]]));
    expect(await none.json()).toEqual({ suggestions: [] });
    const broken = await handleRecognize(
      photo(asSet),
      deps([[SETS_URL, () => new Response("kaputt", { status: 500 })]]),
    );
    expect(broken.status).toBe(502);
  });
});

describe("Big Figs und Teile erkennen (F1)", () => {
  const RANCOR = typed("part", "11323pb01c01", "Large Figure, Rancor", 0.62);

  it("F1 Aus der allgemeinen Antwort werden für eine Figur nur Teile und Figuren, Teile als PART", () => {
    const found = parseAnySuggestions(
      {
        items: [
          RANCOR,
          typed("set", "75005-1", "Rancor Pit", 0.9),
          typed("fig", "sw0434", "Luke Skywalker", 0.3),
          entry("ohne-art", "weiß nicht, was es ist", 0.8),
        ],
      },
      "minifig",
    );
    expect(found).toEqual([
      {
        number: "11323pb01c01",
        name: "Large Figure, Rancor",
        score: 0.62,
        imageUrl: "https://img.bricklink.com/ItemImage/MN/0/11323pb01c01.png",
        ref: "PART:11323pb01c01",
        bricklinkType: "PART",
      },
      {
        number: "sw0434",
        name: "Luke Skywalker",
        score: 0.3,
        imageUrl: "https://img.bricklink.com/ItemImage/MN/0/sw0434.png",
      },
    ]);
  });

  it("F1 Ein guter Figurentreffer (ab 50 %) braucht keine zweite Frage", async () => {
    const log: string[] = [];
    const response = await handleRecognize(
      photo(),
      deps(
        [
          [FIGS_URL, ok({ items: [entry("sw0194", "Captain Rex", 0.5)] })],
          [ANY_URL, ok({ items: [RANCOR] })],
        ],
        log,
      ),
    );
    const body = (await response.json()) as { suggestions: Suggestion[] };
    expect(body.suggestions.map((suggestion) => suggestion.number)).toEqual(["sw0194"]);
    expect(log.filter((line) => line.startsWith("POST"))).toEqual([`POST ${BRICKOGNIZE_URL}`]);
  });

  it("F1 Ohne Figurentreffer wird die allgemeine Erkennung gefragt und die Big Fig als Figur vom Typ PART angeboten", async () => {
    const log: string[] = [];
    const response = await handleRecognize(
      photo(),
      deps(
        [
          [FIGS_URL, ok({ items: [] })],
          [ANY_URL, ok({ items: [RANCOR] })],
        ],
        log,
      ),
    );
    const body = (await response.json()) as { suggestions: Suggestion[] };
    expect(body.suggestions).toHaveLength(1);
    expect(body.suggestions[0]).toMatchObject({
      number: "11323pb01c01",
      ref: "PART:11323pb01c01",
      bricklinkType: "PART",
    });
    expect(log.filter((line) => line.startsWith("POST"))).toEqual([
      `POST ${BRICKOGNIZE_URL}`,
      `POST ${BRICKOGNIZE_ANY_URL}`,
    ]);
  });

  it("F1 Ein schwacher Figurentreffer (unter 50 %) und ein Teil kommen zusammen, nach Quote sortiert, ohne Doppelte", async () => {
    const response = await handleRecognize(
      photo(),
      deps([
        [FIGS_URL, ok({ items: [entry("sw0194", "Captain Rex", 0.3)] })],
        [
          ANY_URL,
          ok({
            items: [
              RANCOR,
              typed("fig", "sw0194", "Captain Rex", 0.3),
              typed("fig", "sw9", "X", 0.1),
            ],
          }),
        ],
      ]),
    );
    const body = (await response.json()) as { suggestions: Suggestion[] };
    expect(body.suggestions.map((suggestion) => suggestion.number)).toEqual([
      "11323pb01c01",
      "sw0194",
      "sw9",
    ]);
  });

  it("F1 Scheitert nur die zweite Frage, bleiben die Figurentreffer; ohne solche ist es ein Fehler", async () => {
    const failing: Route = [ANY_URL, () => new Response("kaputt", { status: 500 })];
    const weak = await handleRecognize(
      photo(),
      deps([[FIGS_URL, ok({ items: [entry("sw0194", "Captain Rex", 0.3)] })], failing]),
    );
    expect(weak.status).toBe(200);
    expect(((await weak.json()) as { suggestions: Suggestion[] }).suggestions).toHaveLength(1);
    const empty = await handleRecognize(photo(), deps([[FIGS_URL, ok({ items: [] })], failing]));
    expect(empty.status).toBe(502);
    const limited = await handleRecognize(
      photo(),
      deps([
        [FIGS_URL, ok({ items: [] })],
        [ANY_URL, () => new Response("", { status: 429 })],
      ]),
    );
    expect(limited.status).toBe(429);
  });
});

describe("Sonderteile erkennen (F1)", () => {
  const AS_SPECIAL = { "Content-Type": "image/webp", [RECOGNIZE_KIND_HEADER]: "specialPart" };

  it("F1 Sets, Gear und Bücher werden mit ihrem BrickLink-Typ geöffnet, Teile und Figuren nicht angeboten", () => {
    const found = parseAnySuggestions(
      {
        items: [
          typed("set", "5008889", "Promo-Set", 0.4),
          typed("gear", "5010325", "Metal Card", 0.3),
          typed("book", "5009999", "Buch", 0.2),
          typed("part", "3001", "Brick 2 x 4", 0.9),
          typed("fig", "sw0001", "Figur", 0.8),
          entry("5007777", "ohne Art", 0.1),
        ],
      },
      "specialPart",
    );
    expect(found.map((suggestion) => [suggestion.number, suggestion.ref])).toEqual([
      ["5008889-1", "SET:5008889-1"],
      ["5010325", "GEAR:5010325"],
      ["5009999", "BOOK:5009999"],
      ["5007777", undefined],
    ]);
  });

  it("F1 Die Art specialPart fragt nur den allgemeinen Endpunkt", async () => {
    const log: string[] = [];
    const response = await handleRecognize(
      photo(AS_SPECIAL),
      deps([[ANY_URL, ok({ items: [typed("gear", "5010325", "Metal Card", 0.3)] })]], log),
    );
    const body = (await response.json()) as { suggestions: Suggestion[] };
    expect(body.suggestions).toMatchObject([{ number: "5010325", ref: "GEAR:5010325" }]);
    expect(log.filter((line) => line.startsWith("POST"))).toEqual([`POST ${BRICKOGNIZE_ANY_URL}`]);
  });

  it("F1 Ein Foto, das der Dienst nicht kennt (GWPs oft), ist eine leere Liste, kein Fehler", async () => {
    const response = await handleRecognize(photo(AS_SPECIAL), deps([[ANY_URL, ok({ items: [] })]]));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ suggestions: [] });
  });
});

describe("Art des Fotos im Aufruf", () => {
  it("Eine unbekannte Art ist ein schlechter Aufruf (400), ohne Kopf gilt Figur", async () => {
    const unknown = await handleRecognize(
      photo({ "Content-Type": "image/webp", [RECOGNIZE_KIND_HEADER]: "diorama" }),
      deps([[FIGS_URL, HUGO]]),
    );
    expect(unknown.status).toBe(400);
    const log: string[] = [];
    await handleRecognize(photo(), deps([[FIGS_URL, HUGO]], log));
    expect(log).toContain(`POST ${BRICKOGNIZE_URL}`);
  });

  it("OPTIONS erlaubt den Kopf x-recognize-kind (Vorabfrage des Browsers)", async () => {
    const options = await handleRecognize(
      new Request("https://x.test/", { method: "OPTIONS" }),
      deps([]),
    );
    expect(options.headers.get("Access-Control-Allow-Headers")).toContain(RECOGNIZE_KIND_HEADER);
  });
});

/**
 * Echte Antworten von Brickognize, aufgenommen mit `npm run try:recognition` (je ein Foto eines Sets
 * und des Rancors). Fehlt die Datei, ist der Test übersprungen; die Form der Antworten prüfen die
 * Tests oben.
 */
describe("Aufgezeichnete Antworten von Brickognize", () => {
  const recorded = (name: string): Record<string, unknown> | undefined => {
    const path = new URL(`./samples/${name}`, import.meta.url);
    return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : undefined;
  };
  const set = recorded("brickognize-set.json");
  const rancor = recorded("brickognize-rancor.json");

  it.skipIf(set === undefined)("F1 Das Set-Foto gibt Set-Nummern mit Variante", () => {
    const found = parseSetSuggestions(set?.sets);
    expect(found.length).toBeGreaterThan(0);
    for (const suggestion of found) expect(suggestion.number).toMatch(/-\d+$/);
  });

  it.skipIf(rancor === undefined)(
    "F1 Das Rancor-Foto ergibt Vorschläge nach dem Muster der Funktion",
    () => {
      const figures = parseSuggestions(rancor?.figs);
      const parts = parseAnySuggestions(rancor?.any, "minifig");
      for (const suggestion of parts) {
        expect(suggestion.ref).toBe(`PART:${suggestion.number}`);
        expect(suggestion.bricklinkType).toBe("PART");
      }
      expect(figures.length + parts.length).toBeGreaterThan(0);
    },
  );
});
