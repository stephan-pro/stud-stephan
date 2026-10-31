// Fake services instead of the internet: the answers imitate the documented shapes of the real APIs.
import { describe, expect, it } from "vitest";
import { classifyPriceAnswer } from "./bricklink.ts";
import { topPredictions } from "./brickognize.ts";
import { type Fetch, formatCents, toCents } from "./json.ts";
import { extractSetPage } from "./merlin.ts";
import { formatSummary, redact } from "./report.ts";
import { checkBrickLink, checkBrickognize, checkMerlin, checkRebrickable } from "./steps.ts";

type Route = [match: string, answer: () => Response];

/** A fake internet: the first route whose text is part of the address answers. */
function fakeFetch(routes: Route[], log: string[] = []): Fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    log.push(`${init?.method ?? "GET"} ${url}`);
    const route = routes.find(([match]) => url.includes(match));
    return route ? route[1]() : new Response("not found", { status: 404 });
  }) as Fetch;
}

const json =
  (body: unknown, status = 200) =>
  () =>
    Response.json(body, { status });
const noSleep = async () => {};
const clock = () => ({ nonce: "n", timestamp: "1" });
const credentials = {
  consumerKey: "ck",
  consumerSecret: "cs",
  tokenValue: "tv",
  tokenSecret: "ts",
};
const photo = { bytes: new Uint8Array(new ArrayBuffer(2048)), fileName: "minifig.jpg" };

describe("Rebrickable: minifig and set 75372-1 with its minifigs", () => {
  const figure = {
    set_num: "fig-004567",
    name: "Clone Trooper",
    num_parts: 4,
    set_img_url: "https://cdn.rebrickable.com/fig.jpg",
    external_ids: { BrickLink: ["sw1234"] },
  };
  const routes: Route[] = [
    ["/minifigs/?", json({ count: 1, results: [figure] })],
    [
      "/sets/75372-1/minifigs/",
      json({
        results: [{ set_num: "fig-004567", set_name: "Clone Trooper", quantity: 2 }],
        next: null,
      }),
    ],
    [
      "/sets/75372-1/",
      json({
        set_num: "75372-1",
        name: "Clone Trooper & Battle Droid Pack",
        year: 2024,
        num_parts: 215,
        set_img_url: "https://cdn.rebrickable.com/set.jpg",
      }),
    ],
    ["/minifigs/fig-004567/", json(figure)],
  ];

  it("reads the set, its minifigs and the BrickLink numbers, and sends the key only as header", async () => {
    const log: string[] = [];
    const result = await checkRebrickable(fakeFetch(routes, log), "geheim-key", noSleep);
    const text = result.lines.join("\n");
    expect(result.status).toBe("ok");
    expect(text).toContain("75372-1: Clone Trooper & Battle Droid Pack · 2024 · 215 Teile");
    expect(text).toContain("2× fig-004567 · Clone Trooper · BrickLink: sw1234");
    expect(text).toContain("Zuordnung Rebrickable → BrickLink-Nummer: vorhanden");
    expect(log.join("\n")).not.toContain("geheim-key");
  });

  it("says clearly when the BrickLink numbers are missing", async () => {
    const plain = { ...figure, external_ids: undefined };
    const result = await checkRebrickable(
      fakeFetch(
        [
          ["/minifigs/fig-004567/", json(plain)],
          ["/minifigs/?", json({ count: 0, results: [] })],
          ...routes,
        ],
        [],
      ),
      "k",
      noSleep,
    );
    expect(result.lines.join("\n")).toContain("NICHT geliefert");
  });

  it("is skipped without key and reports a refused key as error", async () => {
    expect((await checkRebrickable(fakeFetch([]), undefined)).status).toBe("skipped");
    const result = await checkRebrickable(
      fakeFetch([["rebrickable", json({}, 401)]]),
      "k",
      noSleep,
    );
    expect(result.status).toBe("error");
    expect(result.lines.join("\n")).toContain("HTTP 401");
  });

  it("waits and retries after HTTP 429", async () => {
    let calls = 0;
    const waits: number[] = [];
    const fetchFn = fakeFetch([
      ["/sets/75372-1/minifigs/", json({ results: [], next: null })],
      [
        "/sets/75372-1/",
        () =>
          ++calls === 1
            ? new Response("", { status: 429, headers: { "retry-after": "3" } })
            : Response.json({ name: "Set" }),
      ],
      ["/minifigs/?", json({ count: 0, results: [] })],
    ]);
    const result = await checkRebrickable(fetchFn, "k", async (ms) => void waits.push(ms));
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(waits).toContain(3000);
    expect(result.status).toBe("ok");
  });
});

describe("Brickognize: top 3 with confidence", () => {
  const answer = {
    items: [
      { id: "sw0002", name: "B", score: 0.4 },
      {
        id: "sw0001",
        name: "A",
        score: 0.93,
        img_url: "https://x/a.jpg",
        external_sites: [{ name: "bricklink" }],
      },
      { id: "sw0003", name: "C", score: 0.2 },
      { id: "sw0004", name: "D", score: 0.1 },
      { name: "ohne id", score: 0.9 },
    ],
  };

  it("returns the three best predictions sorted by confidence", () => {
    const top = topPredictions(answer);
    expect(top.map((p) => p.id)).toEqual(["sw0001", "sw0002", "sw0003"]);
    expect(top[0]).toMatchObject({
      score: 0.93,
      sites: ["bricklink"],
      imageUrl: "https://x/a.jpg",
    });
  });

  it("sends the photo as form field query_image and prints percent values", async () => {
    let field: FormDataEntryValue | null = null;
    const fetchFn = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        field = (init.body as FormData).get("query_image");
        return Response.json(answer);
      }
      return new Response(null, { status: 204 });
    }) as Fetch;
    const result = await checkBrickognize(fetchFn, photo);
    expect(field).toBeInstanceOf(Blob);
    expect(result.status).toBe("ok");
    expect(result.lines.join("\n")).toContain("1. sw0001 · A · 93 %");
    expect(result.lines.join("\n")).toContain("CORS: nicht erlaubt");
  });

  it("is skipped without photo, ignores strange answers and reports HTTP errors", async () => {
    expect((await checkBrickognize(fakeFetch([]), undefined)).status).toBe("skipped");
    expect(topPredictions("kaputt")).toEqual([]);
    expect(topPredictions({ items: [null, { id: "x", score: "hoch" }] })).toEqual([]);
    const failed = await checkBrickognize(fakeFetch([["brickognize", json({}, 500)]]), photo);
    expect(failed.status).toBe("error");
  });
});

describe("BrickLink: price guide new and used in EUR", () => {
  const price = (avg: string) => ({
    meta: { code: 200, message: "OK" },
    data: {
      currency_code: "EUR",
      min_price: "1.0000",
      max_price: "30.5000",
      avg_price: avg,
      total_quantity: 12,
    },
  });

  it("turns the price texts into whole cents", () => {
    expect(toCents("12.3400")).toBe(1234);
    expect(toCents("0.1")).toBe(10);
    expect(toCents("abc")).toBeUndefined();
    expect(toCents(undefined)).toBeUndefined();
    expect(formatCents(1250)).toBe("12,50 €");
    expect(formatCents(905)).toBe("9,05 €");
  });

  it("reports both prices when BrickLink answers", async () => {
    const log: string[] = [];
    const fetchFn = fakeFetch(
      [
        ["new_or_used=N", json(price("18.0000"))],
        ["new_or_used=U", json(price("12.0000"))],
      ],
      log,
    );
    const result = await checkBrickLink(fetchFn, credentials, clock);
    const text = result.lines.join("\n");
    expect(result.status).toBe("ok");
    expect(text).toContain("neu: 18,00 €");
    expect(text).toContain("gebraucht: 12,00 €");
    expect(log[0]).toContain("guide_type=sold");
    expect(log[0]).toContain("currency_code=EUR");
  });

  it("records a refusal with HTTP status, code and reason", async () => {
    const refused = {
      meta: { code: 403, message: "PERMISSION_DENIED", description: "Nur für Verkäufer" },
    };
    const result = await checkBrickLink(
      fakeFetch([["bricklink", json(refused, 403)]]),
      credentials,
      clock,
    );
    expect(result.status).toBe("refused");
    expect(result.lines.join("\n")).toContain(
      "ABGELEHNT (HTTP 403, Code 403): PERMISSION_DENIED – Nur für Verkäufer",
    );
  });

  it("tells HTTP 200 with a refusal inside meta apart from real data", () => {
    expect(
      classifyPriceAnswer(200, { meta: { code: 401, message: "INVALID_SIGNATURE" } }, "new").kind,
    ).toBe("refused");
    expect(classifyPriceAnswer(200, { meta: { code: 200 } }, "new").kind).toBe("error");
    expect(classifyPriceAnswer(500, "kaputt", "used").kind).toBe("error");
    expect(classifyPriceAnswer(200, price("0.0000"), "used")).toMatchObject({
      kind: "ok",
      averageCents: 0,
    });
  });

  it("reports non-JSON answers, network errors and missing keys", async () => {
    const html = await checkBrickLink(
      fakeFetch([["bricklink", () => new Response("<html>", { status: 502 })]]),
      credentials,
      clock,
    );
    expect(html.status).toBe("error");
    expect(html.lines.join("\n")).toContain("kein JSON");
    const broken = (async () => {
      throw new Error("offline");
    }) as Fetch;
    expect((await checkBrickLink(broken, credentials, clock)).lines.join("\n")).toContain(
      "offline",
    );
    expect((await checkBrickLink(fakeFetch([]), undefined, clock)).status).toBe("skipped");
  });

  it("is partial if only one condition has an answer", async () => {
    const fetchFn = fakeFetch([
      ["new_or_used=N", json(price("18.0000"))],
      ["new_or_used=U", json({ meta: { code: 404, message: "ITEM_NOT_FOUND" } }, 404)],
    ]);
    expect((await checkBrickLink(fetchFn, credentials, clock)).status).toBe("partial");
  });
});

describe("Merlins Steine: one set page", () => {
  const page = `<html><head><title>Demo Set - Merlins Steine</title>
    <meta property="og:title" content="Burg &amp; Turm"><meta property="og:image" content="/img/burg.jpg"></head>
    <body><h1>Burg</h1><table>
      <tr><th>Hersteller:</th><td>Cobi</td></tr>
      <tr><th>Set-Nr.:</th><td>2345</td></tr>
      <tr><th>Teile:</th><td>1.234</td></tr></table>
      <nav><a>Hersteller</a><a>Kategorien</a></nav>
      <script>var Hersteller = "falsch";</script></body></html>`;

  it("takes name, manufacturer, set number, piece count and image from a table page", () => {
    const { fields, labels } = extractSetPage(page, "https://www.merlinssteine.de/setdb/set/1");
    expect(fields).toEqual({
      name: "Burg & Turm",
      manufacturer: "Cobi",
      setNumber: "2345",
      pieceCount: 1234,
      imageUrl: "https://www.merlinssteine.de/img/burg.jpg",
    });
    expect(labels).toEqual(["Hersteller", "Set-Nr.", "Teile"]);
  });

  it("reads a real SetDB page: product data inside @graph, number and pieces from the texts", () => {
    const real = `<title>BlueBrixx Burg &bull; Set 110374</title>
      <meta name=description property="og:description" content="Infos zu Burg (110374) aus 2026 in der SetDB • 929 Teile">
      <meta property="og:image" content="https://cdn.merlinssteine.de/b.jpeg?v=2">
      <script type=application/ld+json>{"@graph":[{"@type":["Organization","Brand"],"name":"Merlins Steine"},
        {"@type":"Product","name":"BlueBrixx - Burg | Set 110374","brand":{"@type":"Brand","name":"BlueBrixx"},"sku":"110374"}]}</script>
      <a>Hersteller</a><a>Kategorien</a>
      <ul><li>Von: <a href=/x>BlueBrixx</a></li><li>EAN: 4060904030462</li><li>Steine von: Xingbao</li></ul>`;
    const { fields, labels } = extractSetPage(real, "https://www.merlinssteine.de/sets/bb-110374/");
    expect(fields).toEqual({
      name: "BlueBrixx - Burg",
      manufacturer: "BlueBrixx",
      setNumber: "110374",
      pieceCount: 929,
      imageUrl: "https://cdn.merlinssteine.de/b.jpeg?v=2",
    });
    expect(labels).toEqual(["Von", "EAN", "Steine von"]);
    expect(extractSetPage("<title>A &bull; B</title>", "https://x/").fields.name).toBe("A • B");
    const manufacturerOnly = "<ul><li>Von: <a>Cobi</a></li></ul>";
    expect(extractSetPage(manufacturerOnly, "https://x/").fields.manufacturer).toBe("Cobi");
  });

  it("prefers structured data and reads 'Label: value' lines", () => {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"Schiff","brand":{"name":"Mould King"},"sku":"13001","image":["https://x/s.jpg"]}</script>
      <p>Teile: 3 000 Stück</p><p>Teile: 3000</p>`;
    const { fields, labels } = extractSetPage(html, "https://x/");
    expect(fields).toMatchObject({
      name: "Schiff",
      manufacturer: "Mould King",
      setNumber: "13001",
      imageUrl: "https://x/s.jpg",
      pieceCount: 3,
    });
    expect(labels).toEqual(["Teile"]);
  });

  it("falls back to h1 and title and reports missing fields", () => {
    expect(extractSetPage("<h1>Nur Titel</h1>", "https://x/").fields).toEqual({
      name: "Nur Titel",
    });
    expect(extractSetPage("<title>T &#228;&#x4f;</title>", "https://x/").fields.name).toBe("T äO");
    expect(extractSetPage("<p>nichts</p>", "https://x/").fields).toEqual({});
    expect(
      extractSetPage('<script type="application/ld+json">{kaputt</script>', "https://x/").fields,
    ).toEqual({});
  });

  it("reports found and missing fields and saves the page", async () => {
    const { result, html } = await checkMerlin(
      fakeFetch([["merlinssteine", () => new Response(page)]]),
      "https://www.merlinssteine.de/setdb/set/1",
    );
    expect(result.status).toBe("ok");
    expect(html).toBe(page);
    const partial = await checkMerlin(
      fakeFetch([["x.de", () => new Response("<h1>A</h1>")]]),
      "https://x.de/",
    );
    expect(partial.result.status).toBe("partial");
    expect(partial.result.lines).toContain("Hersteller: NICHT gefunden");
  });

  it("is skipped without address and reports HTTP and network errors", async () => {
    expect((await checkMerlin(fakeFetch([]), undefined)).result.status).toBe("skipped");
    expect((await checkMerlin(fakeFetch([]), "https://x.de/")).result.lines[0]).toContain(
      "HTTP 404",
    );
    const broken = (async () => {
      throw new Error("offline");
    }) as Fetch;
    expect((await checkMerlin(broken, "https://x.de/")).result.lines[0]).toContain("offline");
  });
});

describe("Summary never contains a key", () => {
  it("scrubs every secret from the text, even inside error messages", () => {
    const results = [
      {
        service: "S",
        status: "error" as const,
        lines: ["Fehler bei abc123SECRET und abc123SECRET"],
      },
    ];
    const text = formatSummary(results, ["abc123SECRET", "xy"], "2026-10-31");
    expect(text).not.toContain("abc123SECRET");
    expect(text).toContain("***");
    expect(text).toContain("## ❌ S");
    expect(redact("xy bleibt", ["xy"])).toBe("xy bleibt");
  });
});
