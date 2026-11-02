import { beforeAll, describe, expect, it } from "vitest";
import { SupabasePriceRunner } from "../../src/backend/priceRun";
import { aMinifig, aPrice, aSet, aSpecialPart, aWish } from "../../src/domain/fixtures";
import { type PricePoint, SCHEMA_VERSION } from "../../src/domain/types";
import { admin, anonymous, type Person, signedIn, sql } from "./setup";

// P11: the queue of the price run in the database (migration `…_price_run.sql`), as the Edge
// Function `bricklink` uses it with the service role, and what the app may see of it.

let owner: Person;
let stranger: Person;

async function save(person: Person, kind: string, object: object): Promise<void> {
  const { error } = await person.client.rpc("save_object", {
    p_kind: kind,
    p_object: object,
    p_schema_version: SCHEMA_VERSION,
  });
  expect(error).toBeNull();
}

async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(name, args);
  expect(error, name).toBeNull();
  return data as T;
}

interface Claimed {
  runId: number;
  itemType: string;
  bricklinkId: string;
  attempts: number;
}

async function prices(person: Person): Promise<PricePoint[]> {
  const { data, error } = await person.client.rpc("load_collection");
  expect(error).toBeNull();
  return (data as { prices: PricePoint[] }).prices;
}

/** Takes everything open of the owner and finishes it with `outcome`. */
async function finishAll(person: Person, cents: Record<string, number>): Promise<Claimed[]> {
  const items = await call<Claimed[]>("price_run_claim", { p_owner: person.id, p_limit: 50 });
  for (const item of items) {
    await call("price_run_finish", {
      p_run: item.runId,
      p_item_type: item.itemType,
      p_bricklink_id: item.bricklinkId,
      p_outcome: "priced",
      p_cents: cents,
      p_sold: { used: 5 },
    });
  }
  return items;
}

beforeAll(async () => {
  [owner, stranger] = await Promise.all([signedIn(), signedIn()]);
  await save(owner, "minifig", aMinifig({ id: "rex", bricklinkId: "sw0194" }));
  await save(owner, "minifig", aMinifig({ id: "rex-2", bricklinkId: " SW0194 " }));
  await save(owner, "minifig", aMinifig({ id: "ohne", bricklinkId: "" }));
  await save(
    owner,
    "minifig",
    aMinifig({ id: "custom", manufacturer: { kind: "custom", name: "Shop" }, bricklinkId: "c1" }),
  );
  await save(owner, "legoSet", aSet({ id: "set", setNumber: "75372-1" }));
  await save(owner, "specialPart", aSpecialPart({ id: "gwp", number: "5008889" }));
  await save(owner, "wishItem", aWish({ id: "cody", bricklinkId: "sw0196" }));
  await save(owner, "wishItem", aWish({ id: "rex-wish", bricklinkId: "sw0194" }));
});

describe("P11 Warteschlange des Preisabrufs", () => {
  it("Ein Lauf nimmt jede offizielle Figur, jedes Set und jeden Wunsch mit Nummer genau einmal", async () => {
    await call("price_run_begin", { p_owner: owner.id, p_trigger: "manual" });
    const { data } = await admin
      .from("price_run_items")
      .select("item_type, bricklink_id, state")
      .eq("owner", owner.id);
    const items = (data ?? []) as { item_type: string; bricklink_id: string; state: string }[];
    expect(
      items.map((item) => `${item.item_type}:${item.bricklink_id.toLowerCase()}`).sort(),
    ).toEqual(["legoSet:75372-1", "minifig:sw0194", "minifig:sw0196"]);
    expect(items.every((item) => item.state === "open")).toBe(true);
    const status = await new SupabasePriceRunner(owner.client).status();
    expect(status).toMatchObject({ trigger: "manual", total: 3, open: 3, skipped: 1, updated: 0 });
    expect(status?.finishedAt).toBeUndefined();
    // A second start while the run is open goes on with it.
    await call("price_run_begin", { p_owner: owner.id, p_trigger: "schedule" });
    const { data: runs } = await admin.from("price_runs").select("id").eq("owner", owner.id);
    expect(runs).toHaveLength(1);
  });

  it("F10 Nach jedem Abruf gibt es je offiziellem Objekt genau einen neuen Preisstand mit Datum", async () => {
    const before = (await prices(owner)).length;
    const taken = await finishAll(owner, { used: 1200, new: 1800 });
    expect(taken).toHaveLength(3);
    expect(taken.every((item) => item.attempts === 1)).toBe(true);
    const status = await new SupabasePriceRunner(owner.client).status();
    expect(status).toMatchObject({ total: 3, updated: 3, open: 0, failed: 0 });
    expect(status?.finishedAt).toBeDefined();
    const after = await prices(owner);
    expect(after).toHaveLength(before + 3);
    const day = status?.day;
    expect(after.filter((point) => point.date === day)).toHaveLength(3);
    expect(after.find((point) => point.bricklinkId === "75372-1")).toEqual({
      ...aPrice("75372-1", day ?? "", { used: 1200, new: 1800 }, "legoSet"),
      soldCount: { used: 5 },
    });
  });

  it("F10 Ein zweiter Abruf am selben Tag ersetzt den Stand dieses Tages", async () => {
    await call("price_run_begin", { p_owner: owner.id, p_trigger: "manual" });
    await finishAll(owner, { used: 1300 });
    const after = await prices(owner);
    expect(after).toHaveLength(3);
    expect(after.every((point) => point.cents.used === 1300 && point.cents.new === undefined)).toBe(
      true,
    );
    // The items of the finished run are gone, its result stays.
    const { data } = await admin.from("price_run_items").select("state").eq("owner", owner.id);
    expect((data ?? []).every((item: { state: string }) => item.state === "priced")).toBe(true);
  });

  it("F10 Ein fehlgeschlagener Abruf überschreibt keinen vorhandenen Wert", async () => {
    await call("price_run_begin", { p_owner: owner.id, p_trigger: "manual" });
    const items = await call<Claimed[]>("price_run_claim", { p_owner: owner.id, p_limit: 50 });
    const [first, second, third] = items;
    if (!first || !second || !third) throw new Error("drei Einträge erwartet");
    const finish = (item: Claimed, outcome: string) =>
      call("price_run_finish", {
        p_run: item.runId,
        p_item_type: item.itemType,
        p_bricklink_id: item.bricklinkId,
        p_outcome: outcome,
      });
    await finish(first, "failed");
    await finish(second, "empty");
    await finish(third, "retry");
    const open = await new SupabasePriceRunner(owner.client).status();
    expect(open).toMatchObject({
      failed: 1,
      empty: 1,
      open: 1,
      failedNumbers: [first.bricklinkId],
    });
    // The retried item is taken again with its second attempt.
    const again = await call<Claimed[]>("price_run_claim", { p_owner: owner.id, p_limit: 50 });
    expect(again).toEqual([{ ...third, attempts: 2 }]);
    await finish(again[0] as Claimed, "failed");
    const done = await new SupabasePriceRunner(owner.client).status();
    expect(done).toMatchObject({ updated: 0, failed: 2, empty: 1, open: 0 });
    expect(done?.finishedAt).toBeDefined();
    // Nothing was written: the values of the earlier run stay.
    const after = await prices(owner);
    expect(after).toHaveLength(3);
    expect(after.every((point) => point.cents.used === 1300)).toBe(true);
  });

  it("Zurückgeben ohne Versuch; mit Pause wartet der Lauf und gibt nichts heraus", async () => {
    await call("price_run_begin", { p_owner: owner.id, p_trigger: "manual" });
    const [item] = await call<Claimed[]>("price_run_claim", { p_owner: owner.id, p_limit: 1 });
    if (!item) throw new Error("ein Eintrag erwartet");
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    await call("price_run_release", {
      p_items: [{ runId: item.runId, itemType: item.itemType, bricklinkId: item.bricklinkId }],
      p_paused_until: tomorrow,
    });
    expect(await call("price_run_claim", { p_owner: owner.id, p_limit: 50 })).toEqual([]);
    const status = await new SupabasePriceRunner(owner.client).status();
    expect(status?.pausedUntil).toBeDefined();
    expect(status?.open).toBe(3);
    // The pause is over: everything open again, the attempt was not counted.
    await call("price_run_release", { p_items: [], p_paused_until: new Date(0).toISOString() });
    const all = await call<Claimed[]>("price_run_claim", { p_owner: owner.id, p_limit: 50 });
    expect(all).toHaveLength(3);
    expect(all.every((claimed) => claimed.attempts === 1)).toBe(true);
    await call("price_run_release", { p_items: all, p_paused_until: null });
  });

  it("Unsinnige Ergebnisse lehnt die Datenbank ab", async () => {
    const [item] = await call<Claimed[]>("price_run_claim", { p_owner: owner.id, p_limit: 1 });
    if (!item) throw new Error("ein Eintrag erwartet");
    for (const [outcome, cents] of [
      ["priced", null],
      ["priced", {}],
      ["priced", { used: -1 }],
      ["priced", { used: 12.5 }],
      ["priced", { gebraucht: 100 }],
      ["vielleicht", null],
    ] as const) {
      const { error } = await admin.rpc("price_run_finish", {
        p_run: item.runId,
        p_item_type: item.itemType,
        p_bricklink_id: item.bricklinkId,
        p_outcome: outcome,
        p_cents: cents,
      });
      expect(error, `${outcome} ${JSON.stringify(cents)}`).not.toBeNull();
    }
    const { error } = await admin.rpc("price_run_finish", {
      p_run: item.runId,
      p_item_type: item.itemType,
      p_bricklink_id: "gibt-es-nicht",
      p_outcome: "failed",
    });
    expect(error).not.toBeNull();
  });
});

describe("Sonderteile im Preisabruf", () => {
  it("Ein offizielles Sonderteil mit BrickLink-Typ kommt als „TYP:Nummer“ in die Warteschlange, eines ohne Typ nicht", async () => {
    const person = await signedIn();
    await save(
      person,
      "specialPart",
      aSpecialPart({ id: "card", number: "5010325", bricklinkType: "GEAR" }),
    );
    await save(person, "specialPart", aSpecialPart({ id: "ohne-typ", number: "5008889" }));
    await save(
      person,
      "specialPart",
      aSpecialPart({
        id: "custom",
        number: "77",
        bricklinkType: "BOOK",
        manufacturer: { kind: "custom", name: "Shop" },
      }),
    );
    await call("price_run_begin", { p_owner: person.id, p_trigger: "manual" });
    const { data } = await admin
      .from("price_run_items")
      .select("item_type, bricklink_id")
      .eq("owner", person.id);
    expect(data).toEqual([{ item_type: "specialPart", bricklink_id: "GEAR:5010325" }]);
    const status = await new SupabasePriceRunner(person.client).status();
    expect(status).toMatchObject({ total: 1, open: 1, skipped: 0 });
    const taken = await finishAll(person, { used: 900, new: 1500 });
    expect(taken).toHaveLength(1);
    expect(await prices(person)).toEqual([
      {
        itemType: "specialPart",
        bricklinkId: "GEAR:5010325",
        date: status?.day,
        source: "bricklink",
        cents: { used: 900, new: 1500 },
        soldCount: { used: 5 },
      },
    ]);
  });
});

describe("Grund eines fehlgeschlagenen Eintrags", () => {
  it("Der Grund steht am Eintrag, im Stand des laufenden Laufs und nach dem Abschluss im Lauf; Preisstände schreiben keinen", async () => {
    const person = await signedIn();
    await save(person, "minifig", aMinifig({ id: "a", bricklinkId: "sw9999" }));
    await save(person, "minifig", aMinifig({ id: "b", bricklinkId: "sw0194" }));
    await call("price_run_begin", { p_owner: person.id, p_trigger: "manual" });
    const items = await call<Claimed[]>("price_run_claim", { p_owner: person.id, p_limit: 50 });
    const unknown = items.find((item) => item.bricklinkId === "sw9999");
    const known = items.find((item) => item.bricklinkId === "sw0194");
    if (!unknown || !known) throw new Error("beide Einträge werden genommen");

    await call("price_run_finish", {
      p_run: unknown.runId,
      p_item_type: unknown.itemType,
      p_bricklink_id: unknown.bricklinkId,
      p_outcome: "failed",
      p_reason: "BrickLink: nicht gefunden (RESOURCE_NOT_FOUND)",
    });
    // While the run is open the status has the reason already.
    const running = await new SupabasePriceRunner(person.client).status();
    expect(running).toMatchObject({
      failed: 1,
      failedNumbers: ["sw9999"],
      failedReasons: { sw9999: "BrickLink: nicht gefunden (RESOURCE_NOT_FOUND)" },
    });

    // Six named parameters still work (the Edge Function before the migration, and priced items).
    await call("price_run_finish", {
      p_run: known.runId,
      p_item_type: known.itemType,
      p_bricklink_id: known.bricklinkId,
      p_outcome: "priced",
      p_cents: { used: 100 },
    });
    const done = await new SupabasePriceRunner(person.client).status();
    expect(done?.finishedAt).toBeDefined();
    expect(done).toMatchObject({
      failed: 1,
      failedNumbers: ["sw9999"],
      failedReasons: { sw9999: "BrickLink: nicht gefunden (RESOURCE_NOT_FOUND)" },
    });
  });

  it("Ein zu langer Grund wird auf 200 Zeichen gekürzt, ein leerer und der Grund eines anderen Ergebnisses gar nicht gespeichert", async () => {
    const person = await signedIn();
    await save(person, "minifig", aMinifig({ id: "c", bricklinkId: "sw0001" }));
    await save(person, "minifig", aMinifig({ id: "d", bricklinkId: "sw0002" }));
    await call("price_run_begin", { p_owner: person.id, p_trigger: "manual" });
    const [first, second] = await call<Claimed[]>("price_run_claim", {
      p_owner: person.id,
      p_limit: 50,
    });
    if (!first || !second) throw new Error("zwei Einträge");
    await call("price_run_finish", {
      p_run: first.runId,
      p_item_type: first.itemType,
      p_bricklink_id: first.bricklinkId,
      p_outcome: "failed",
      p_reason: "x".repeat(500),
    });
    await call("price_run_finish", {
      p_run: second.runId,
      p_item_type: second.itemType,
      p_bricklink_id: second.bricklinkId,
      p_outcome: "empty",
      p_reason: "gehört nicht dazu",
    });
    const { data } = await admin
      .from("price_run_items")
      .select("bricklink_id, state, reason")
      .eq("owner", person.id)
      .order("bricklink_id");
    expect(data).toEqual(
      [
        { bricklink_id: first.bricklinkId, state: "failed", reason: "x".repeat(200) },
        { bricklink_id: second.bricklinkId, state: "empty", reason: null },
      ].sort((a, b) => a.bricklink_id.localeCompare(b.bricklink_id)),
    );
  });
});

describe("Big Figs im Preisabruf", () => {
  it("Eine Figur oder ein Wunsch mit Typ PART kommt als „PART:Nummer“ in die Warteschlange, eine Minifigur mit der nackten Nummer", async () => {
    const person = await signedIn();
    await save(
      person,
      "minifig",
      aMinifig({ id: "rancor", bricklinkId: "11323pb01c01", bricklinkType: "PART" }),
    );
    await save(person, "minifig", aMinifig({ id: "luke", bricklinkId: "sw0434" }));
    await save(
      person,
      "wishItem",
      aWish({ id: "wish-rancor-2", bricklinkId: "973c01", bricklinkType: "PART" }),
    );
    await call("price_run_begin", { p_owner: person.id, p_trigger: "manual" });
    const { data } = await admin
      .from("price_run_items")
      .select("item_type, bricklink_id")
      .eq("owner", person.id)
      .order("bricklink_id");
    expect(data).toEqual([
      { item_type: "minifig", bricklink_id: "PART:11323pb01c01" },
      { item_type: "minifig", bricklink_id: "PART:973c01" },
      { item_type: "minifig", bricklink_id: "sw0434" },
    ]);
  });
});

describe("P11 Rechte", () => {
  it("Die App liest nur ihren eigenen Stand und kann die Warteschlange nicht ändern", async () => {
    expect(await new SupabasePriceRunner(stranger.client).status()).toBeNull();
    const foreign = await stranger.client.rpc("price_run_status", { p_owner: owner.id });
    expect(foreign.data).toBeNull();
    for (const table of ["price_runs", "price_run_items"]) {
      const read = await stranger.client.from(table).select("*");
      expect(read.data ?? [], table).toEqual([]);
      const own = await owner.client.from(table).select("*");
      expect((own.data ?? []).length, table).toBeGreaterThan(0);
      const write = await owner.client
        .from(table)
        .update({ owner: owner.id })
        .eq("owner", owner.id);
      expect(write.error, table).not.toBeNull();
      const remove = await owner.client.from(table).delete().eq("owner", owner.id);
      expect(remove.error, table).not.toBeNull();
    }
    for (const client of [owner.client, anonymous()]) {
      for (const [name, args] of [
        ["price_run_begin", { p_owner: owner.id, p_trigger: "manual" }],
        ["price_run_claim", { p_owner: owner.id, p_limit: 5 }],
        ["price_run_release", { p_items: [], p_paused_until: null }],
        ["price_count_call", { p_day: "2031-01-01", p_total_cap: 5, p_price_cap: 5 }],
        ["price_run_weekly", {}],
        ["price_run_call", {}],
      ] as const) {
        const { error } = await client.rpc(name, args);
        expect(error, name).not.toBeNull();
      }
    }
  });

  it("Ohne Anmeldung gibt es keinen Stand", async () => {
    const { data, error } = await anonymous().rpc("price_run_status");
    expect(data ?? null).toBeNull();
    expect(error).not.toBeNull();
  });
});

describe("P11 Tageslimit und Zeitplan", () => {
  it("Der Preisabruf zählt auf dem gemeinsamen Zähler und hält beide Grenzen ein", async () => {
    const day = "2032-02-02";
    const count = (total: number, prices: number) =>
      call<boolean>("price_count_call", { p_day: day, p_total_cap: total, p_price_cap: prices });
    expect([await count(10, 2), await count(10, 2), await count(10, 2)]).toEqual([
      true,
      true,
      false,
    ]);
    // The catalog's calls count towards the shared limit.
    await call("catalog_count_call", { p_service: "bricklink", p_day: day, p_cap: 100 });
    expect(await count(3, 10)).toBe(false);
    expect(await count(4, 10)).toBe(true);
    const { data } = await admin
      .from("catalog_usage")
      .select("service, calls")
      .eq("day", day)
      .order("service");
    expect(data).toEqual([
      { service: "bricklink", calls: 4 },
      { service: "bricklink-prices", calls: 3 },
    ]);
  });

  it("Die Cron-Jobs stehen im Zeitplan: Montag 02:00 UTC, alle fünf Minuten weiter, Aufräumen", () => {
    expect(
      sql(
        "select jobname, schedule, command from cron.job where jobname like 'stud-stephan-%' order by 1",
      ),
    ).toEqual([
      "stud-stephan-cron-cleanup|30 3 * * *|delete from cron.job_run_details where end_time < now() - interval '14 days'",
      "stud-stephan-price-run|0 2 * * 1|select public.price_run_weekly()",
      "stud-stephan-price-run-continue|*/5 * * * *|select public.price_run_continue()",
    ]);
  });

  it("Ohne Geheimnis im Vault ruft die Datenbank die Funktion nicht auf, mit Geheimnis schon", () => {
    sql("delete from vault.secrets where name in ('price_run_secret', 'project_url')");
    expect(sql("select public.price_run_call() is null")).toEqual(["t"]);
    // Too short counts as missing.
    sql("select vault.create_secret('kurz', 'price_run_secret')");
    expect(sql("select public.price_run_call() is null")).toEqual(["t"]);
    sql("delete from vault.secrets where name = 'price_run_secret'");
    // A local address that answers nothing, so no call leaves the test machine.
    sql(`select vault.create_secret('${"x".repeat(64)}', 'price_run_secret')`);
    sql("select vault.create_secret('http://127.0.0.1:9', 'project_url')");
    expect(sql("select public.price_run_call() is not null")).toEqual(["t"]);
    sql("delete from vault.secrets where name in ('price_run_secret', 'project_url')");
  });

  it("Der Montags-Job startet einen Lauf für jeden mit Sammlung", async () => {
    const fresh = await signedIn();
    await save(fresh, "legoSet", aSet({ id: "set" }));
    sql("select public.price_run_weekly()");
    const status = await new SupabasePriceRunner(fresh.client).status();
    expect(status).toMatchObject({ trigger: "schedule", total: 1, open: 1 });
    const today = sql("select to_char((now() at time zone 'Europe/Berlin')::date, 'YYYY-MM-DD')");
    expect(status?.day).toBe(today[0]);
  });
});
