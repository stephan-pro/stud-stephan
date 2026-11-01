// P8 (F1): the function `recognize` — the photo goes to Brickognize, up to five suggestions with a
// BrickLink number come back; sign-in, bad bodies and failures of the service. The answers are in
// the shape Brickognize sent in P2 (docs/DATENQUELLEN.md).
import { describe, expect, it } from "vitest";
import { BRICKOGNIZE_URL, createBrickognize, parseSuggestions } from "./brickognizeClient.ts";
import { fakeFetch, ok, type Route } from "./catalog.fixtures.ts";
import { recognizeHandlerDeps } from "./environment.ts";
import { handleRecognize } from "./handler.ts";
import { MAX_PHOTO_BYTES } from "./recognizeTypes.ts";

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
