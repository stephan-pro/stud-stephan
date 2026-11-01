// P11: the price run of the function `bricklink`: price guide, queue in portions, daily limit,
// the cron job's secret and "Jetzt aktualisieren" of the app.
import { describe, expect, it } from "vitest";
import { createBricklink } from "./bricklinkClient.ts";
import {
  brickLinkFailure,
  brickLinkRoutes,
  CREDENTIALS,
  fakeFetch,
  ok,
  type Route,
} from "./catalog.fixtures.ts";
import { bricklinkHandlerDeps } from "./environment.ts";
import { handleBricklink, RUN_SECRET_HEADER, sameSecret } from "./handler.ts";
import { CatalogError } from "./json.ts";
import { guide, MemoryPriceRunStore, priceRoutes } from "./priceRun.fixtures.ts";
import {
  BATCH_SIZE,
  bricklinkNumber,
  MAX_ATTEMPTS,
  nextCountDay,
  type PriceRunDeps,
  priceOf,
  workOnPriceRuns,
} from "./priceRunService.ts";
import {
  BRICKLINK_TOTAL_CAP,
  PRICE_RUN_DAILY_CAP,
  readClaimed,
  supabasePriceRunStore,
} from "./priceRunStore.ts";

const NOW = new Date("2026-11-02T02:00:00Z");
const SECRET = "a".repeat(64);

/** A clock that moves on by `stepMs` every time it is read. */
function clock(stepMs = 0) {
  let time = NOW.getTime();
  return () => {
    const now = new Date(time);
    time += stepMs;
    return now;
  };
}

function runDeps(
  store: MemoryPriceRunStore,
  routes: Route[] = [],
  log: string[] = [],
  now: () => Date = clock(),
): PriceRunDeps {
  const bricklink = createBricklink({
    fetch: fakeFetch([...routes, ...priceRoutes(), ...brickLinkRoutes()], log),
    credentials: CREDENTIALS,
    beforeCall: async () => {
      if (!(await store.countCall(now().toISOString().slice(0, 10)))) {
        throw new CatalogError("limit_reached", "Tageslimit");
      }
    },
  });
  return { store, bricklink, now };
}

const priced = (store: MemoryPriceRunStore) =>
  store.outcomes.filter((entry) => entry.outcome.kind === "priced").map((entry) => entry.key);

describe("BrickLink-Preisguide", () => {
  it("fragt 'verkauft', neu bzw. gebraucht, in EUR und rechnet den Durchschnitt in Cent", async () => {
    const log: string[] = [];
    const client = createBricklink({
      fetch: fakeFetch(priceRoutes(), log),
      credentials: CREDENTIALS,
    });
    expect(await client.price("MINIFIG", "sw0194", "new")).toEqual({ cents: 9987, soldCount: 14 });
    expect(await client.price("MINIFIG", "sw0194", "used")).toEqual({ cents: 6739, soldCount: 97 });
    expect(log).toEqual([
      "GET https://api.bricklink.com/api/store/v1/items/MINIFIG/sw0194/price?guide_type=sold&new_or_used=N&currency_code=EUR",
      "GET https://api.bricklink.com/api/store/v1/items/MINIFIG/sw0194/price?guide_type=sold&new_or_used=U&currency_code=EUR",
    ]);
  });

  it("ohne Verkäufe gibt es keinen Preis; eine andere Währung oder keine Daten sind ein Fehler", async () => {
    const client = (route: Route) =>
      createBricklink({ fetch: fakeFetch([route]), credentials: CREDENTIALS });
    expect(await client(["/price", guide("0.0000", 0)]).price("MINIFIG", "sw0001", "new")).toEqual({
      soldCount: 0,
    });
    await expect(
      client(["/price", guide("10.0000", 2, "USD")]).price("MINIFIG", "x", "new"),
    ).rejects.toMatchObject({ failure: "unavailable" });
    await expect(
      client(["/price", ok({ meta: { code: 200 } })]).price("MINIFIG", "x", "new"),
    ).rejects.toMatchObject({ failure: "unavailable" });
    await expect(
      client(["/price", brickLinkFailure(404, "RESOURCE_NOT_FOUND")]).price("SET", "1-1", "used"),
    ).rejects.toMatchObject({ failure: "not_found" });
  });

  it("ergänzt bei einer Setnummer ohne Variante '-1'", () => {
    expect(bricklinkNumber({ itemType: "legoSet", bricklinkId: " 75372 " })).toBe("75372-1");
    expect(bricklinkNumber({ itemType: "legoSet", bricklinkId: "75372-2" })).toBe("75372-2");
    expect(bricklinkNumber({ itemType: "minifig", bricklinkId: "sw0194" })).toBe("sw0194");
  });

  it("verbindet neu und gebraucht zu einem Preisstand mit Verkaufszahlen", async () => {
    const client = createBricklink({
      fetch: fakeFetch(priceRoutes()),
      credentials: CREDENTIALS,
    });
    const item = { runId: 1, itemType: "minifig" as const, bricklinkId: "sw0542", attempts: 1 };
    expect(await priceOf(client, item)).toEqual({
      kind: "priced",
      cents: { used: 2400 },
      soldCount: { used: 3 },
    });
    expect(await priceOf(client, { ...item, bricklinkId: "sw0001" })).toEqual({ kind: "empty" });
  });
});

describe("P11 Preisabruf in Portionen", () => {
  it("F10 Nach jedem Abruf gibt es je offiziellem Objekt genau einen neuen Preisstand mit Datum", async () => {
    const store = new MemoryPriceRunStore();
    store.add("stephan", [
      ["minifig", "sw0194"],
      ["minifig", "sw0542"],
      ["legoSet", "75372"],
    ]);
    const result = await workOnPriceRuns(runDeps(store), { budgetMs: 50_000 });
    expect(result).toEqual({ processed: 3, paused: false });
    expect(priced(store)).toEqual(["minifig:sw0194", "minifig:sw0542", "legoSet:75372"]);
    expect(store.outcomes[0]?.outcome).toEqual({
      kind: "priced",
      cents: { new: 9987, used: 6739 },
      soldCount: { new: 14, used: 97 },
    });
    // Asked once each: two calls (new, used) per item, all counted.
    expect([...store.calls.values()]).toEqual([6]);
  });

  it("F10 Ein fehlgeschlagener Abruf überschreibt keinen vorhandenen Wert", async () => {
    const store = new MemoryPriceRunStore();
    store.add("stephan", [
      ["minifig", "sw0194"],
      ["minifig", "sw9999"],
    ]);
    const down: Route = ["/items/MINIFIG/sw0194/price", brickLinkFailure(500, "Fehler")];
    // The unknown number fails at once, the failing service is tried again by later calls.
    await workOnPriceRuns(runDeps(store, [down]), { budgetMs: 50_000 });
    expect(store.state("minifig:sw9999")).toBe("failed");
    expect(store.state("minifig:sw0194")).toBe("open");
    for (let call = 1; call < MAX_ATTEMPTS; call++) {
      await workOnPriceRuns(runDeps(store, [down]), { budgetMs: 50_000 });
    }
    expect(store.state("minifig:sw0194")).toBe("failed");
    expect(priced(store)).toEqual([]);
    expect(store.outcomes.map((entry) => entry.outcome.kind)).toEqual([
      "retry",
      "failed",
      "retry",
      "failed",
    ]);
  });

  it("Ohne Verkäufe entsteht kein Preisstand", async () => {
    const store = new MemoryPriceRunStore();
    store.add("stephan", [["minifig", "sw0001"]]);
    await workOnPriceRuns(runDeps(store), { budgetMs: 50_000 });
    expect(store.state("minifig:sw0001")).toBe("empty");
  });

  it("Eine Portion endet an der Zeitgrenze; der Rest bleibt für den nächsten Aufruf", async () => {
    const store = new MemoryPriceRunStore();
    const numbers = Array.from({ length: 12 }, (_, index) => ["minifig", `sw0194-${index}`]) as [
      "minifig",
      string,
    ][];
    store.add("stephan", numbers);
    const routes: Route[] = [["/price", guide("10.0000", 1)]];
    // Every reading of the clock is one second later: the budget of 10 s ends the portion.
    const first = await workOnPriceRuns(runDeps(store, routes, [], clock(1000)), {
      budgetMs: 10_000,
    });
    expect(first.processed).toBeGreaterThan(0);
    expect(first.processed).toBeLessThan(12);
    expect(store.items.filter((entry) => entry.state === "working")).toEqual([]);
    // Taken but not done: back in the queue without counting the attempt.
    expect(store.items.every((entry) => entry.state !== "open" || entry.attempts === 0)).toBe(true);
  });

  it("Über mehrere Aufrufe fortsetzbar, ohne doppelte Preisstände", async () => {
    const store = new MemoryPriceRunStore();
    const numbers = Array.from({ length: 13 }, (_, index) => ["minifig", `fig${index}`]) as [
      "minifig",
      string,
    ][];
    store.add("stephan", numbers);
    const routes: Route[] = [["/price", guide("10.0000", 1)]];
    let calls = 0;
    while (store.items.some((entry) => entry.state === "open")) {
      calls += 1;
      await workOnPriceRuns(runDeps(store, routes, [], clock(1000)), { budgetMs: 8_000 });
    }
    expect(calls).toBeGreaterThan(1);
    expect(priced(store).sort()).toEqual(numbers.map(([, id]) => `minifig:${id}`).sort());
    expect(new Set(priced(store)).size).toBe(13);
  });

  it("Tageslimit: Rest zurück in die Warteschlange, der Lauf wartet bis zum nächsten Tag", async () => {
    const store = new MemoryPriceRunStore();
    store.add("stephan", [
      ["minifig", "sw0194"],
      ["minifig", "sw0542"],
      ["legoSet", "75372-1"],
    ]);
    store.cap = 3;
    const log: string[] = [];
    const result = await workOnPriceRuns(runDeps(store, [], log), { budgetMs: 50_000 });
    expect(result).toEqual({ processed: 1, paused: true });
    expect(store.pausedUntil).toBe("2026-11-03T00:05:00.000Z");
    expect(log.length).toBe(3);
    expect(store.items.map((entry) => entry.state)).toEqual(["priced", "open", "open"]);
    expect(store.items.map((entry) => entry.attempts)).toEqual([1, 0, 0]);
    expect(nextCountDay(new Date("2026-12-31T23:59:00Z"))).toBe("2027-01-01T00:05:00.000Z");
  });

  it("Nimmt nur die Figuren und Sets eines Besitzers, wenn er genannt ist", async () => {
    const store = new MemoryPriceRunStore();
    store.add("stephan", [["minifig", "sw0194"]]);
    store.add("jemand", [["minifig", "sw0542"]]);
    await workOnPriceRuns(runDeps(store), { owner: "stephan", budgetMs: 50_000 });
    expect(priced(store)).toEqual(["minifig:sw0194"]);
    expect(store.state("minifig:sw0542")).toBe("open");
    expect(BATCH_SIZE).toBeLessThanOrEqual(50);
  });
});

const ENV: Record<string, string> = {
  SUPABASE_URL: "https://projekt.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "sr",
  BRICKLINK_CONSUMER_KEY: "ck",
  BRICKLINK_CONSUMER_SECRET: "cs",
  BRICKLINK_TOKEN_VALUE: "tv",
  BRICKLINK_TOKEN_SECRET: "ts",
  PRICE_RUN_SECRET: SECRET,
};

const AUTH: Route = ["/auth/v1/user", ok({ id: "stephan-id" })];

/** The database of the project as PostgREST answers the price run's functions. */
function databaseRoutes(rpc: string[]): Route[] {
  const record = (name: string, body: unknown) => (): Response => {
    rpc.push(name);
    return Response.json(body);
  };
  let claimed = false;
  return [
    ["/rpc/price_run_begin", record("begin", 7)],
    [
      "/rpc/price_run_claim",
      () => {
        rpc.push("claim");
        const items = claimed
          ? []
          : [{ runId: 7, itemType: "minifig", bricklinkId: "sw0194", attempts: 1 }];
        claimed = true;
        return Response.json(items);
      },
    ],
    [
      "/rpc/price_run_finish",
      () => {
        rpc.push("finish");
        return new Response(null, { status: 204 });
      },
    ],
    ["/rpc/price_count_call", record("count", true)],
    [
      "/rpc/price_run_status",
      record("status", {
        trigger: "manual",
        day: "2026-11-02",
        startedAt: "2026-11-02T09:00:00+00:00",
        finishedAt: "2026-11-02T09:00:05+00:00",
        total: 1,
        updated: 1,
        empty: 0,
        failed: 0,
        open: 0,
        skipped: 0,
        failedNumbers: [],
      }),
    ],
  ];
}

function cronRequest(secret: string | undefined): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret !== undefined) headers[RUN_SECRET_HEADER] = secret;
  return new Request("https://projekt.supabase.co/functions/v1/bricklink", {
    method: "POST",
    headers,
    body: JSON.stringify({ op: "priceRun" }),
  });
}

function appRequest(body: unknown): Request {
  return new Request("https://projekt.supabase.co/functions/v1/bricklink", {
    method: "POST",
    headers: { Authorization: "Bearer jwt", apikey: "pk", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Funktion bricklink: Preisabruf", () => {
  it("Der Cron-Job weist sich mit dem Geheimnis aus; ohne, falsch oder zu kurz: 401 ohne Abruf", async () => {
    for (const [given, env] of [
      [undefined, ENV],
      ["falsch", ENV],
      ["b".repeat(64), ENV],
      ["kurz", { ...ENV, PRICE_RUN_SECRET: "kurz" }],
      ["", { ...ENV, PRICE_RUN_SECRET: "" }],
    ] as const) {
      const log: string[] = [];
      const deps = bricklinkHandlerDeps(
        (name) => (env as Record<string, string>)[name],
        fakeFetch([AUTH, ...databaseRoutes([])], log),
      );
      const request = given === undefined ? appRequest({ op: "priceRun" }) : cronRequest(given);
      if (given === undefined) {
        // Without the header it is an ordinary call and needs a sign-in, which a cron job has not.
        const unsigned = new Request(request.url, { method: "POST", body: "{}" });
        expect((await handleBricklink(unsigned, deps)).status).toBe(401);
        continue;
      }
      const response = await handleBricklink(request, deps);
      expect(response.status, given).toBe(401);
      expect(log, given).toEqual([]);
    }
    expect(sameSecret("abc", "abc")).toBe(true);
    expect(sameSecret("abc", "abd")).toBe(false);
    expect(sameSecret("abc", "abcd")).toBe(false);
  });

  it("Mit dem richtigen Geheimnis arbeitet der Cron-Job alle offenen Läufe ab", async () => {
    const rpc: string[] = [];
    const log: string[] = [];
    const deps = bricklinkHandlerDeps(
      (name) => ENV[name],
      fakeFetch([...databaseRoutes(rpc), ...priceRoutes(), AUTH], log),
      () => NOW,
    );
    const response = await handleBricklink(cronRequest(SECRET), deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ processed: 1, paused: false });
    expect(rpc).toEqual(["claim", "count", "count", "finish", "claim"]);
    // No sign-in asked, and the claim is for every owner.
    expect(log.some((line) => line.includes("/auth/v1/user"))).toBe(false);
  });

  it("'Jetzt aktualisieren' startet einen Lauf für die angemeldete Person und gibt den Stand zurück", async () => {
    const rpc: string[] = [];
    const sent: { url: string; body: string }[] = [];
    const routes = [AUTH, ...databaseRoutes(rpc), ...priceRoutes()];
    const send = (async (input: RequestInfo | URL, init?: RequestInit) => {
      sent.push({ url: String(input), body: String(init?.body ?? "") });
      return fakeFetch(routes)(input, init);
    }) as typeof fetch;
    const deps = bricklinkHandlerDeps(
      (name) => ENV[name],
      send,
      () => NOW,
    );
    const response = await handleBricklink(appRequest({ op: "priceRun", start: true }), deps);
    expect(response.status).toBe(200);
    const answer = (await response.json()) as { status: { updated: number } };
    expect(answer.status.updated).toBe(1);
    expect(rpc).toEqual(["begin", "claim", "count", "count", "finish", "claim", "status"]);
    const begin = sent.find((call) => call.url.endsWith("/rpc/price_run_begin"));
    expect(JSON.parse(begin?.body ?? "{}")).toEqual({ p_owner: "stephan-id", p_trigger: "manual" });
    const claim = sent.find((call) => call.url.endsWith("/rpc/price_run_claim"));
    expect(JSON.parse(claim?.body ?? "{}")).toMatchObject({ p_owner: "stephan-id" });
    // The sign-in is asked once, though both the check and the id are needed.
    expect(sent.filter((call) => call.url.endsWith("/auth/v1/user"))).toHaveLength(1);
  });

  it("Ohne start geht nur ein offener Lauf weiter; falsche Aufrufe und fehlende Teile werden abgelehnt", async () => {
    const rpc: string[] = [];
    const deps = bricklinkHandlerDeps(
      (name) => ENV[name],
      fakeFetch([AUTH, ...databaseRoutes(rpc), ...priceRoutes()]),
      () => NOW,
    );
    expect((await handleBricklink(appRequest({ op: "priceRun" }), deps)).status).toBe(200);
    expect(rpc[0]).toBe("claim");
    expect((await handleBricklink(appRequest({ op: "priceRun", start: "ja" }), deps)).status).toBe(
      400,
    );
    const signedOut = bricklinkHandlerDeps(
      (name) => ENV[name],
      fakeFetch([["/auth/v1/user", () => new Response("", { status: 401 })]]),
    );
    expect((await handleBricklink(appRequest({ op: "priceRun" }), signedOut)).status).toBe(401);
    const noDatabase = bricklinkHandlerDeps(
      (name) => (name === "SUPABASE_SERVICE_ROLE_KEY" ? undefined : ENV[name]),
      fakeFetch([AUTH]),
    );
    expect((await handleBricklink(appRequest({ op: "priceRun" }), noDatabase)).status).toBe(502);
    expect((await handleBricklink(cronRequest(SECRET), noDatabase)).status).toBe(502);
    const noKeys = bricklinkHandlerDeps(
      (name) => (name.startsWith("BRICKLINK") ? undefined : ENV[name]),
      fakeFetch([AUTH]),
    );
    expect((await handleBricklink(appRequest({ op: "priceRun" }), noKeys)).status).toBe(502);
    const brokenDatabase = bricklinkHandlerDeps(
      (name) => ENV[name],
      fakeFetch([AUTH, ["/rpc/", () => new Response("", { status: 500 })]]),
    );
    expect((await handleBricklink(cronRequest(SECRET), brokenDatabase)).status).toBe(502);
    expect((await handleBricklink(appRequest({ op: "priceRun" }), brokenDatabase)).status).toBe(
      502,
    );
  });
});

describe("Warteschlange in der Datenbank", () => {
  const settings = { url: "https://projekt.supabase.co", serviceRoleKey: "sr" };

  it("ruft die Funktionen der Migration mit dem Dienstschlüssel auf", async () => {
    const sent: { url: string; init: RequestInit }[] = [];
    const answers: unknown[] = [
      null,
      [{ runId: 3, itemType: "legoSet", bricklinkId: "75372-1", attempts: 2 }],
      null,
      null,
      true,
      null,
    ];
    const store = supabasePriceRunStore(settings, (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      sent.push({ url: String(input), init: init ?? {} });
      const body = answers.shift();
      return body === null ? new Response(null, { status: 204 }) : Response.json(body);
    }) as typeof fetch);
    await store.begin("o", "schedule");
    const [item] = await store.claim(undefined, 5);
    expect(item).toEqual({ runId: 3, itemType: "legoSet", bricklinkId: "75372-1", attempts: 2 });
    if (!item) throw new Error("kein Eintrag");
    await store.finish(item, { kind: "priced", cents: { new: 1800 }, soldCount: { new: 4 } });
    await store.release([item], "2026-11-03T00:05:00.000Z");
    expect(await store.countCall("2026-11-02")).toBe(true);
    expect(await store.status("o")).toBeNull();
    expect(sent.map((call) => call.url.replace(`${settings.url}/rest/v1/rpc/`, ""))).toEqual([
      "price_run_begin",
      "price_run_claim",
      "price_run_finish",
      "price_run_release",
      "price_count_call",
      "price_run_status",
    ]);
    expect(sent[0]?.init.headers).toMatchObject({ apikey: "sr", Authorization: "Bearer sr" });
    expect(JSON.parse(String(sent[1]?.init.body))).toEqual({ p_owner: null, p_limit: 5 });
    expect(JSON.parse(String(sent[2]?.init.body))).toEqual({
      p_run: 3,
      p_item_type: "legoSet",
      p_bricklink_id: "75372-1",
      p_outcome: "priced",
      p_cents: { new: 1800 },
      p_sold: { new: 4 },
    });
    expect(JSON.parse(String(sent[3]?.init.body))).toEqual({
      p_items: [{ runId: 3, itemType: "legoSet", bricklinkId: "75372-1" }],
      p_paused_until: "2026-11-03T00:05:00.000Z",
    });
    expect(JSON.parse(String(sent[4]?.init.body))).toEqual({
      p_day: "2026-11-02",
      p_total_cap: BRICKLINK_TOTAL_CAP,
      p_price_cap: PRICE_RUN_DAILY_CAP,
    });
    expect(BRICKLINK_TOTAL_CAP).toBeLessThan(5000);
    expect(PRICE_RUN_DAILY_CAP).toBeLessThan(BRICKLINK_TOTAL_CAP);
  });

  it("liest die Warteschlange vorsichtig und meldet Fehler der Datenbank", async () => {
    expect(
      readClaimed([
        { runId: 1, itemType: "minifig", bricklinkId: "sw0194" },
        { runId: 1, itemType: "diorama", bricklinkId: "x" },
        null,
        { itemType: "minifig" },
      ]),
    ).toEqual([{ runId: 1, itemType: "minifig", bricklinkId: "sw0194", attempts: 1 }]);
    expect(() => readClaimed({})).toThrow(CatalogError);
    const down = supabasePriceRunStore(settings, (async () => {
      throw new Error("offline");
    }) as typeof fetch);
    await expect(down.claim(undefined, 5)).rejects.toMatchObject({ failure: "unavailable" });
    const refused = supabasePriceRunStore(
      settings,
      (async () => new Response("", { status: 404 })) as typeof fetch,
    );
    await expect(refused.countCall("2026-11-02")).rejects.toMatchObject({ failure: "unavailable" });
  });
});
