import { describe, expect, it } from "vitest";
import { aMinifig, aPrice, aSet, aWish } from "../domain/fixtures";
import { valueOfItem } from "../domain/value";
import { FAKE_PRICE_RUN_KEY, FakePriceRunner, type PriceRunControl } from "./fakePriceRun";
import { FakeRemote } from "./fakeRemote";
import { FakeStore } from "./fakeStore";
import { type PriceRunStatus, readStatus, SupabasePriceRunner } from "./priceRun";

// The real run is tested in `supabase/functions/_shared/priceRun.test.ts` and against the database
// in `supabase/tests/`; here how the app calls it, and the fake of the demo and the E2E tests.

const STATUS: PriceRunStatus = {
  trigger: "schedule",
  day: "2026-10-26",
  startedAt: "2026-10-26T02:00:00.123+00:00",
  finishedAt: "2026-10-26T02:20:00+00:00",
  total: 314,
  updated: 312,
  empty: 0,
  failed: 2,
  open: 0,
  skipped: 3,
  failedNumbers: ["sw9998", "sw9999"],
};

interface Call {
  name: string;
  body?: unknown;
}

function runnerWith(
  answers: {
    rpc?: { data: unknown; error: unknown; status: number } | Error;
    invoke?: { data: unknown; error: unknown };
  },
  calls: Call[] = [],
): SupabasePriceRunner {
  return new SupabasePriceRunner({
    rpc: async (name: string) => {
      calls.push({ name });
      if (answers.rpc instanceof Error) throw answers.rpc;
      return answers.rpc;
    },
    functions: {
      invoke: async (name: string, options: { body: unknown }) => {
        calls.push({ name, body: options.body });
        return answers.invoke;
      },
    },
  } as never);
}

describe("P11 Der Preisabruf der App", () => {
  it("liest den Stand des letzten Laufs über die Datenbankfunktion", async () => {
    const calls: Call[] = [];
    const runner = runnerWith({ rpc: { data: STATUS, error: null, status: 200 } }, calls);
    expect(await runner.status()).toEqual(STATUS);
    expect(calls).toEqual([{ name: "price_run_status" }]);
    expect(await runnerWith({ rpc: { data: null, error: null, status: 200 } }).status()).toBeNull();
  });

  it("meldet Fehler beim Lesen als 'offline' oder 'nicht verfügbar'", async () => {
    await expect(
      runnerWith({ rpc: { data: null, error: { message: "x" }, status: 0 } }).status(),
    ).rejects.toMatchObject({ failure: "offline" });
    await expect(
      runnerWith({ rpc: { data: null, error: { message: "x" }, status: 404 } }).status(),
    ).rejects.toMatchObject({ failure: "unavailable" });
    await expect(
      runnerWith({ rpc: new TypeError("Failed to fetch") }).status(),
    ).rejects.toMatchObject({ failure: "offline" });
  });

  it("'Jetzt aktualisieren' ruft die Funktion bricklink mit op priceRun", async () => {
    const calls: Call[] = [];
    const runner = runnerWith({ invoke: { data: { status: STATUS }, error: null } }, calls);
    expect(await runner.run(true)).toEqual(STATUS);
    expect(calls).toEqual([{ name: "bricklink", body: { op: "priceRun", start: true } }]);
    const none = runnerWith({ invoke: { data: { status: null }, error: null } });
    expect(await none.run(false)).toBeNull();
  });

  it("übersetzt Fehler der Funktion; eine unlesbare Antwort ist 'nicht verfügbar'", async () => {
    for (const failure of ["limit_reached", "unavailable", "not_signed_in"]) {
      const runner = runnerWith({
        invoke: { data: null, error: { context: Response.json({ failure }, { status: 502 }) } },
      });
      await expect(runner.run(true)).rejects.toMatchObject({ failure });
    }
    const offline = runnerWith({ invoke: { data: null, error: new TypeError("Failed to fetch") } });
    await expect(offline.run(true)).rejects.toMatchObject({ failure: "offline" });
    await expect(runnerWith({ invoke: { data: {}, error: null } }).run(true)).rejects.toMatchObject(
      {
        failure: "unavailable",
      },
    );
  });

  it("nimmt nur einen lesbaren Stand an", () => {
    expect(readStatus({ ...STATUS, failedNumbers: undefined })).toEqual({
      ...STATUS,
      failedNumbers: [],
    });
    expect(readStatus({ total: 1 })).toBeNull();
    expect(readStatus("x")).toBeNull();
  });
});

describe("P11 Der Beispiel-Preisabruf für Demo und E2E-Tests", () => {
  const NOW = new Date("2026-11-02T09:30:00");

  async function setUp() {
    const store = new FakeStore();
    const owner = store.createUser();
    const remote = new FakeRemote(store, owner);
    const rex = aMinifig({ id: "rex", bricklinkId: "sw0194", condition: "used" });
    const wish = aWish({ id: "cody", bricklinkId: "sw0196" });
    const set = aSet({ id: "set" });
    await remote.save("minifig", rex);
    await remote.save("legoSet", set);
    await remote.save("wishItem", wish);
    await remote.save("minifig", aMinifig({ id: "ohne", bricklinkId: " " }));
    await remote.savePrice(aPrice("sw0194", "2026-10-26", { used: 1000, new: 2000 }));
    return { remote, rex };
  }

  it("F10 Nach jedem Abruf gibt es je offiziellem Objekt genau einen neuen Preisstand mit Datum", async () => {
    const { remote, rex } = await setUp();
    const runner = new FakePriceRunner(remote, { now: () => NOW, portion: 2 });
    expect(await runner.status()).toBeNull();
    const first = await runner.run(true);
    expect(first).toMatchObject({ total: 3, open: 1, skipped: 1, day: "2026-11-02" });
    expect(first?.finishedAt).toBeUndefined();
    const last = await runner.run(false);
    expect(last).toMatchObject({ total: 3, open: 0, updated: 1, empty: 2 });
    expect(last?.finishedAt).toBe(NOW.toISOString());
    const prices = (await remote.load()).prices;
    expect(prices.filter((point) => point.date === "2026-11-02")).toEqual([
      aPrice("sw0194", "2026-11-02", { new: 2040, used: 1020 }),
    ]);
    expect(valueOfItem(rex, prices)).toMatchObject({ cents: 1020, asOf: "2026-11-02" });
    // A finished run stays finished until the next start.
    expect(await runner.run(false)).toEqual(last);
    expect(runner.calls).toEqual(["status", "run true", "run false", "run false"]);
  });

  it("merkt sich den Lauf im Speicher des Geräts und kann gestört werden", async () => {
    const { remote } = await setUp();
    const stored = new Map<string, string>();
    const storage = {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
    };
    let control: PriceRunControl = "limit_reached";
    const runner = new FakePriceRunner(remote, { now: () => NOW, storage, control: () => control });
    const paused = await runner.run(true);
    expect(paused?.pausedUntil).toBe("2026-11-03T00:05:00.000Z");
    expect(paused?.open).toBe(3);
    expect(stored.has(FAKE_PRICE_RUN_KEY)).toBe(true);
    control = undefined;
    const again = new FakePriceRunner(remote, { now: () => NOW, storage, portion: 5 });
    expect(await again.run(false)).toMatchObject({ open: 0, updated: 1 });
    for (const failing of ["offline", "unavailable"] as const) {
      control = failing;
      await expect(runner.run(true)).rejects.toMatchObject({ failure: failing });
    }
    control = "offline";
    await expect(runner.status()).rejects.toMatchObject({ failure: "offline" });
    const broken = new FakePriceRunner(remote, {
      storage: {
        getItem: () => "{kaputt",
        setItem: () => {
          throw new Error("voll");
        },
      },
    });
    expect(await broken.status()).toBeNull();
  });

  it("ein Lauf ohne Figuren und Sets ist sofort fertig", async () => {
    const store = new FakeStore();
    const remote = new FakeRemote(store, store.createUser());
    const runner = new FakePriceRunner(remote, { now: () => NOW });
    expect(await runner.run(true)).toMatchObject({ total: 0, finishedAt: NOW.toISOString() });
    expect((await remote.load()).prices).toEqual([]);
  });
});
