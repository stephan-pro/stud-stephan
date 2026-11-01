// P7: the HTTP side of the functions `catalog` and `bricklink`: sign-in, requests, failures, the
// daily BrickLink limit and the database store.
import { describe, expect, it } from "vitest";
import {
  brickLinkRoutes,
  fakeFetch,
  ok,
  type Route,
  rebrickableRoutes,
} from "./catalog.fixtures.ts";
import { supabaseStore } from "./catalogStore.ts";
import { BRICKLINK_DAILY_CAP, bricklinkHandlerDeps, catalogHandlerDeps } from "./environment.ts";
import { handleBricklink, handleCatalog, isSignedIn, parseCatalogRequest } from "./handler.ts";

const ENV: Record<string, string> = {
  SUPABASE_URL: "https://projekt.supabase.co",
  REBRICKABLE_API_KEY: "rk",
  BRICKLINK_CONSUMER_KEY: "ck",
  BRICKLINK_CONSUMER_SECRET: "cs",
  BRICKLINK_TOKEN_VALUE: "tv",
  BRICKLINK_TOKEN_SECRET: "ts",
};

const AUTH: Route = ["/auth/v1/user", ok({ id: "u" })];

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://projekt.supabase.co/functions/v1/catalog", {
    method: "POST",
    headers: {
      Authorization: "Bearer jwt",
      apikey: "pk",
      "Content-Type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function catalogDeps(routes: Route[] = [], env: Record<string, string | undefined> = ENV) {
  return catalogHandlerDeps(
    (name) => env[name],
    fakeFetch([...routes, AUTH, ...brickLinkRoutes(), ...rebrickableRoutes()]),
    () => new Date("2026-11-01T10:00:00Z"),
  );
}

describe("Anmeldung der Funktionen", () => {
  it("ohne Anmeldung oder ohne Schlüssel im Aufruf: 401", async () => {
    const deps = catalogDeps([["/auth/v1/user", () => new Response("", { status: 401 })]]);
    const body = { op: "search", kind: "minifig", query: "sw0194" };
    const refused = await handleCatalog(post(body), deps);
    expect(refused.status).toBe(401);
    expect(await refused.json()).toEqual({ failure: "not_signed_in" });
    const noKey = new Request("https://x.test/", { method: "POST", body: JSON.stringify(body) });
    expect((await handleCatalog(noKey, catalogDeps())).status).toBe(401);
  });

  it("fragt den Anmeldedienst des Projekts mit dem Aufrufschlüssel des Aufrufs", async () => {
    const log: string[] = [];
    const send = fakeFetch([AUTH], log);
    expect(await isSignedIn(post({}), "https://projekt.supabase.co", send)).toBe(true);
    expect(log).toEqual(["GET https://projekt.supabase.co/auth/v1/user"]);
    const offline = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    expect(await isSignedIn(post({}), "https://projekt.supabase.co", offline)).toBe(false);
  });
});

describe("Funktion catalog", () => {
  it("OPTIONS beantwortet die Vorabfrage des Browsers, andere Methoden werden abgelehnt", async () => {
    const options = await handleCatalog(
      new Request("https://x.test/", { method: "OPTIONS" }),
      catalogDeps(),
    );
    expect(options.status).toBe(204);
    expect(options.headers.get("Access-Control-Allow-Headers")).toContain("authorization");
    const get = await handleCatalog(
      new Request("https://x.test/", { method: "GET" }),
      catalogDeps(),
    );
    expect(get.status).toBe(400);
  });

  it("sucht nach der Nummer sw0194 (F2)", async () => {
    const response = await handleCatalog(
      post({ op: "search", kind: "minifig", query: "sw0194" }),
      catalogDeps(),
    );
    expect(response.status).toBe(200);
    const answer = (await response.json()) as { op: string; hits: { number: string }[] };
    expect(answer.op).toBe("search");
    expect(answer.hits.map((hit) => hit.number)).toEqual(["sw0194"]);
  });

  it("liefert den Eintrag des Sets 75372-1 mit seinen Figuren (F2, F7)", async () => {
    const response = await handleCatalog(
      post({ op: "item", kind: "legoSet", ref: "75372-1" }),
      catalogDeps(),
    );
    const answer = (await response.json()) as { item: { figures: unknown[]; theme: string } };
    expect(answer.item.figures).toHaveLength(2);
    expect(answer.item.theme).toBe("Star Wars – Battle Packs");
  });

  it("lehnt unlesbare und unsinnige Aufrufe mit 400 ab", async () => {
    const deps = catalogDeps();
    for (const body of [
      "kein json",
      {},
      { op: "search", kind: "diorama", query: "x" },
      { op: "search", kind: "minifig", query: "" },
      { op: "search", kind: "minifig", query: "x".repeat(101) },
      { op: "item", kind: "minifig", ref: "../geheim" },
      { op: "boom", kind: "minifig" },
    ]) {
      expect((await handleCatalog(post(body), deps)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it("übersetzt Ausfälle der Dienste in Antworten: 404, 429, 502", async () => {
    const status = async (routes: Route[], query = "sw0001") =>
      (await handleCatalog(post({ op: "item", kind: "minifig", ref: query }), catalogDeps(routes)))
        .status;
    expect(await status([])).toBe(404);
    expect(await status([["/items/MINIFIG/sw0194", ok({ meta: { code: 429 } })]], "sw0194")).toBe(
      429,
    );
    expect(await status([["/items/MINIFIG/sw0194", ok({ meta: { code: 500 } })]], "sw0194")).toBe(
      502,
    );
    const crash = catalogHandlerDeps(
      (name) => ENV[name],
      fakeFetch([AUTH, ["/items/", () => Promise.reject(new TypeError("kaputt")) as never]]),
    );
    const unknown = await handleCatalog(
      post({ op: "item", kind: "minifig", ref: "sw0194" }),
      crash,
    );
    expect(unknown.status).toBe(502);
  });

  it("ohne gesetzte Schlüssel antwortet sie 'nicht verfügbar' statt abzustürzen", async () => {
    const withoutKey = catalogDeps([], { ...ENV, REBRICKABLE_API_KEY: undefined });
    const response = await handleCatalog(
      post({ op: "search", kind: "minifig", query: "sw0194" }),
      withoutKey,
    );
    expect(response.status).toBe(502);
    const withoutBricklink = catalogDeps([], { ...ENV, BRICKLINK_TOKEN_SECRET: undefined });
    expect(
      (
        await handleCatalog(
          post({ op: "search", kind: "minifig", query: "sw0194" }),
          withoutBricklink,
        )
      ).status,
    ).toBe(502);
  });

  it("hält das Tageslimit von BrickLink ein: danach 429, ohne BrickLink zu fragen", async () => {
    const log: string[] = [];
    const env: Record<string, string> = { ...ENV, SUPABASE_SERVICE_ROLE_KEY: "sr" };
    // The database answers "false" like `catalog_count_call` does once the cap is reached.
    const limited = catalogHandlerDeps(
      (name) => env[name],
      fakeFetch(
        [
          AUTH,
          ["/rpc/catalog_count_call", ok(false)],
          ...brickLinkRoutes(),
          ...rebrickableRoutes(),
        ],
        log,
      ),
    );
    const response = await handleCatalog(
      post({ op: "search", kind: "minifig", query: "sw0194" }),
      limited,
    );
    expect(response.status).toBe(429);
    expect(log.some((line) => line.includes("rpc/catalog_count_call"))).toBe(true);
    expect(log.some((line) => line.includes("api.bricklink.com"))).toBe(false);
    expect(BRICKLINK_DAILY_CAP).toBeLessThan(5000);
    // Without the service key there is no count, and the call goes through.
    const unlimited = await handleCatalog(
      post({ op: "search", kind: "minifig", query: "sw0194" }),
      catalogDeps(),
    );
    expect(unlimited.status).toBe(200);
  });
});

describe("parseCatalogRequest", () => {
  it("nimmt Suche und Eintrag, kürzt Leerraum", () => {
    expect(parseCatalogRequest({ op: "search", kind: "legoSet", query: "  75372 " })).toEqual({
      op: "search",
      kind: "legoSet",
      query: "75372",
    });
    expect(parseCatalogRequest({ op: "item", kind: "minifig", ref: "fig-014663" })).toEqual({
      op: "item",
      kind: "minifig",
      ref: "fig-014663",
    });
    expect(parseCatalogRequest(null)).toBeUndefined();
  });
});

describe("Funktion bricklink", () => {
  const bricklinkDeps = () =>
    bricklinkHandlerDeps((name) => ENV[name], fakeFetch([AUTH, ...brickLinkRoutes()]));

  it("liefert Eintrag, Figuren eines Sets und Sets einer Figur", async () => {
    const item = await handleBricklink(
      post({ op: "item", type: "MINIFIG", number: "sw0194" }),
      bricklinkDeps(),
    );
    expect(await item.json()).toMatchObject({ number: "sw0194", year: 2012 });
    const subsets = await handleBricklink(
      post({ op: "subsets", number: "75372-1" }),
      bricklinkDeps(),
    );
    expect(((await subsets.json()) as unknown[]).length).toBe(2);
    const supersets = await handleBricklink(
      post({ op: "supersets", number: "sw0194" }),
      bricklinkDeps(),
    );
    expect(((await supersets.json()) as unknown[]).length).toBe(2);
  });

  it("lehnt falsche Aufrufe ab, meldet fehlende Schlüssel und unbekannte Nummern", async () => {
    const deps = bricklinkDeps();
    for (const body of [
      {},
      { op: "item", type: "PART", number: "3001" },
      { op: "item", type: "SET", number: "../x" },
      { op: "price", number: "sw0194" },
    ]) {
      expect((await handleBricklink(post(body), deps)).status, JSON.stringify(body)).toBe(400);
    }
    const signedInNoKeys = bricklinkHandlerDeps(
      (name) => (name === "SUPABASE_URL" ? ENV[name] : undefined),
      fakeFetch([AUTH]),
    );
    expect(
      (await handleBricklink(post({ op: "subsets", number: "1-1" }), signedInNoKeys)).status,
    ).toBe(502);
    const unknown = await handleBricklink(post({ op: "subsets", number: "99999-1" }), deps);
    expect(unknown.status).toBe(404);
  });
});

describe("Speicher in der Datenbank", () => {
  const settings = { url: "https://projekt.supabase.co", serviceRoleKey: "sr" };

  it("liest und schreibt den Cache über die Tabelle, mit dem Dienstschlüssel", async () => {
    const log: string[] = [];
    const sent: RequestInit[] = [];
    const store = supabaseStore(settings, (async (input: RequestInfo | URL, init?: RequestInit) => {
      log.push(String(input));
      sent.push(init ?? {});
      return Response.json([{ value: { name: "Rex" } }]);
    }) as typeof fetch);
    expect(await store.read("item:minifig:sw0194", "2026-10-01T00:00:00.000Z")).toEqual({
      name: "Rex",
    });
    expect(log[0]).toContain(
      "/rest/v1/catalog_cache?key=eq.item%3Aminifig%3Asw0194&fetched_at=gte.",
    );
    expect(sent[0]?.headers).toMatchObject({ apikey: "sr", Authorization: "Bearer sr" });
    await store.write("k", { a: 1 }, "2026-11-01T10:00:00.000Z");
    expect(sent[1]?.method).toBe("POST");
    expect(JSON.parse(String(sent[1]?.body))).toEqual({
      key: "k",
      value: { a: 1 },
      fetched_at: "2026-11-01T10:00:00.000Z",
    });
  });

  it("zählt Aufrufe über die Datenbankfunktion und stoppt bei 'false'", async () => {
    const answers = [true, false];
    const store = supabaseStore(settings, (async () =>
      Response.json(answers.shift())) as typeof fetch);
    expect(await store.countCall("bricklink", "2026-11-01", 4500)).toBe(true);
    expect(await store.countCall("bricklink", "2026-11-01", 4500)).toBe(false);
  });

  it("arbeitet ohne Cache weiter, wenn die Datenbank nicht antwortet", async () => {
    const down = supabaseStore(settings, (async () => {
      throw new Error("offline");
    }) as typeof fetch);
    expect(await down.read("k", "2026-01-01T00:00:00.000Z")).toBeUndefined();
    await expect(down.write("k", 1, "2026-01-01T00:00:00.000Z")).resolves.toBeUndefined();
    expect(await down.countCall("bricklink", "2026-11-01", 5)).toBe(true);
    const failing = supabaseStore(
      settings,
      (async () => new Response("", { status: 500 })) as typeof fetch,
    );
    expect(await failing.read("k", "2026-01-01T00:00:00.000Z")).toBeUndefined();
    expect(await failing.countCall("bricklink", "2026-11-01", 5)).toBe(true);
    const empty = supabaseStore(settings, (async () => Response.json([])) as typeof fetch);
    expect(await empty.read("k", "2026-01-01T00:00:00.000Z")).toBeUndefined();
  });
});
