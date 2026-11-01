import { beforeAll, describe, expect, it } from "vitest";
import { admin, anonymous, type Person, signedIn, sql } from "./setup";

// P12: the queue that builds a series in the database (migration `…_series.sql`), as the Edge
// Function `bricklink` uses it with the service role, and what the app may see of it.

let owner: Person;
let stranger: Person;

async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(name, args);
  expect(error, name).toBeNull();
  return data as T;
}

interface Summary {
  id: number;
  themeId: number;
  name: string;
  total: number;
  done: number;
  failed: number;
  figureCount: number;
  finishedAt?: string;
  pausedUntil?: string;
}

interface Claimed {
  seriesId: number;
  setNumber: string;
  attempts: number;
}

const SETS = [{ number: "75372-1" }, { number: "75345-1" }, { number: "7675-1" }];

function begin(person: Person, themeId = 2, sets: object[] = SETS): Promise<Summary> {
  return call<Summary>("series_begin", {
    p_owner: person.id,
    p_theme_id: themeId,
    p_name: "Star Wars – The Clone Wars",
    p_sets: sets,
  });
}

const figure = (number: string) => ({
  number,
  name: `Figur ${number}`,
  imageUrl: "https://i/x.png",
});

beforeAll(async () => {
  [owner, stranger] = await Promise.all([signedIn(), signedIn()]);
});

describe("P12 Warteschlange einer Reihe", () => {
  it("Eine Reihe legt jedes Set einmal in die Warteschlange; dasselbe Thema noch einmal gibt dieselbe Reihe", async () => {
    const person = await signedIn();
    const first = await begin(person, 2, [...SETS, { number: "75372-1" }]);
    expect(first).toMatchObject({ themeId: 2, total: 3, done: 0, failed: 0, figureCount: 0 });
    expect(first.finishedAt).toBeUndefined();
    expect((await begin(person)).id).toBe(first.id);
    const { data } = await admin.from("series_build_sets").select("state").eq("owner", person.id);
    expect(data).toHaveLength(3);
  });

  it("Ein Thema ohne Sets ist sofort fertig", async () => {
    const empty = await begin(await signedIn(), 9, []);
    expect(empty).toMatchObject({ total: 0 });
    expect(empty.finishedAt).toBeDefined();
  });

  it("Zu viele Sets oder ein ungültiger Name werden abgelehnt", async () => {
    const person = await signedIn();
    const many = Array.from({ length: 1001 }, (_, i) => ({ number: `${i}-1` }));
    for (const args of [
      { p_theme_id: 3, p_name: "x", p_sets: many },
      { p_theme_id: 0, p_name: "x", p_sets: [] },
      { p_theme_id: 3, p_name: "", p_sets: [] },
      { p_theme_id: 3, p_name: "x", p_sets: { number: "1-1" } },
    ]) {
      const { error } = await admin.rpc("series_begin", { p_owner: person.id, ...args });
      expect(error, JSON.stringify(args).slice(0, 60)).not.toBeNull();
    }
  });

  it("F13 Die Figuren der fertigen Sets bilden die Reihe, jede Figur einmal, nach Namen sortiert", async () => {
    const person = await signedIn();
    const series = await begin(person);
    const items = await call<Claimed[]>("series_claim", { p_owner: person.id, p_limit: 50 });
    expect(items.map((item) => item.setNumber).sort()).toEqual(["75345-1", "75372-1", "7675-1"]);
    const outcomes: Record<string, unknown[]> = {
      "75372-1": [figure("sw0194"), figure("sw0631")],
      "75345-1": [figure("sw0631"), figure("sw0196")],
      "7675-1": [],
    };
    for (const item of items) {
      await call("series_finish", {
        p_series: series.id,
        p_set: item.setNumber,
        p_outcome: "done",
        p_figures: outcomes[item.setNumber],
      });
    }
    const opened = await call<{ summary: Summary; figures: { number: string; name: string }[] }>(
      "series_open",
      { p_owner: person.id, p_series: series.id, p_touch: true },
    );
    expect(opened.figures.map((f) => f.number)).toEqual(["sw0194", "sw0196", "sw0631"]);
    expect(opened.summary).toMatchObject({ total: 3, done: 3, failed: 0, figureCount: 3 });
    expect(opened.summary.finishedAt).toBeDefined();
  });

  it("Eine Reihe zählt fehlgeschlagene Sets, und ein erneuter Versuch kommt zurück in die Warteschlange", async () => {
    const person = await signedIn();
    const series = await begin(person);
    const items = await call<Claimed[]>("series_claim", { p_owner: person.id, p_limit: 50 });
    await call("series_finish", { p_series: series.id, p_set: "75372-1", p_outcome: "failed" });
    await call("series_finish", { p_series: series.id, p_set: "75345-1", p_outcome: "retry" });
    await call("series_finish", {
      p_series: series.id,
      p_set: "7675-1",
      p_outcome: "done",
      p_figures: [figure("sw1")],
    });
    expect(items).toHaveLength(3);
    const again = await call<Claimed[]>("series_claim", { p_owner: person.id, p_limit: 50 });
    expect(again).toEqual([{ seriesId: series.id, setNumber: "75345-1", attempts: 2 }]);
    const [summary] = await call<Summary[]>("series_list", { p_owner: person.id });
    expect(summary).toMatchObject({ done: 1, failed: 1, total: 3 });
    expect(summary?.finishedAt).toBeUndefined();
  });

  it("Ungültige Ergebnisse werden abgelehnt", async () => {
    const person = await signedIn();
    const series = await begin(person);
    await call("series_claim", { p_owner: person.id, p_limit: 1 });
    for (const args of [
      { p_set: "75372-1", p_outcome: "gut" },
      { p_set: "75372-1", p_outcome: "done" },
      { p_set: "75372-1", p_outcome: "done", p_figures: { number: "x" } },
      { p_set: "gibt-es-nicht", p_outcome: "failed" },
    ]) {
      const { error } = await admin.rpc("series_finish", { p_series: series.id, ...args });
      expect(error, JSON.stringify(args)).not.toBeNull();
    }
  });

  it("F13 Beim Tageslimit pausiert die Reihe bis zum nächsten Tag und geht dann weiter", async () => {
    const person = await signedIn();
    const series = await begin(person);
    const items = await call<Claimed[]>("series_claim", { p_owner: person.id, p_limit: 2 });
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    await call("series_release", { p_items: items, p_paused_until: tomorrow });
    // Released sets are open again without a lost attempt; while paused nothing is taken.
    expect(await call("series_claim", { p_owner: person.id, p_limit: 50 })).toEqual([]);
    const [paused] = await call<Summary[]>("series_list", { p_owner: person.id });
    expect(paused?.pausedUntil).toBeDefined();

    // The day is over: the pause is not shown any more and the sets are taken again.
    sql(
      `update public.series_builds set paused_until = now() - interval '1 minute' where id = ${series.id}`,
    );
    const [resumed] = await call<Summary[]>("series_list", { p_owner: person.id });
    expect(resumed?.pausedUntil).toBeUndefined();
    const again = await call<Claimed[]>("series_claim", { p_owner: person.id, p_limit: 50 });
    expect(again).toHaveLength(3);
    expect(again.every((item) => item.attempts === 1)).toBe(true);
  });

  it("Ein Set, das ein abgebrochener Aufruf genommen hat, wird nach drei Minuten wieder frei", async () => {
    const person = await signedIn();
    const series = await begin(person);
    await call("series_claim", { p_owner: person.id, p_limit: 50 });
    expect(await call("series_claim", { p_owner: person.id, p_limit: 50 })).toEqual([]);
    sql(
      `update public.series_build_sets set claimed_at = now() - interval '4 minutes' where series_id = ${series.id} and set_number = '75372-1'`,
    );
    const again = await call<Claimed[]>("series_claim", { p_owner: person.id, p_limit: 50 });
    expect(again.map((item) => item.setNumber)).toEqual(["75372-1"]);
  });

  it("Öffnen ohne touch ändert 'zuletzt geöffnet' nicht, mit touch schon; Löschen nimmt die Sets mit", async () => {
    const person = await signedIn();
    const a = await begin(person, 21);
    const b = await begin(person, 22);
    const order = async () =>
      (await call<Summary[]>("series_list", { p_owner: person.id })).map((s) => s.id);
    expect(await order()).toEqual([b.id, a.id]);
    await call("series_open", { p_owner: person.id, p_series: a.id, p_touch: false });
    expect(await order()).toEqual([b.id, a.id]);
    await call("series_open", { p_owner: person.id, p_series: a.id, p_touch: true });
    expect(await order()).toEqual([a.id, b.id]);
    await call("series_remove", { p_owner: person.id, p_series: a.id });
    expect(await order()).toEqual([b.id]);
    const { data } = await admin
      .from("series_build_sets")
      .select("series_id")
      .eq("series_id", a.id);
    expect(data).toEqual([]);
  });

  it("Der Cron-Job ruft auch weiter, wenn nur eine Reihe offen ist", () => {
    expect(
      sql("select pg_get_functiondef('public.price_run_continue'::regproc) like '%series_builds%'"),
    ).toEqual(["t"]);
  });
});

describe("P12 Rechte", () => {
  it("Die Tabellen sind für die App gesperrt, auch angemeldet; fremde Reihen gibt es nicht", async () => {
    const series = await begin(owner, 31);
    for (const client of [anonymous(), owner.client, stranger.client]) {
      for (const table of ["series_builds", "series_build_sets"]) {
        const read = await client.from(table).select("*");
        expect(read.data ?? [], table).toEqual([]);
        const write = await client.from(table).insert({ owner: owner.id });
        expect(write.error, table).not.toBeNull();
      }
    }
    const foreign = await call<{ summary: Summary } | null>("series_open", {
      p_owner: stranger.id,
      p_series: series.id,
      p_touch: false,
    });
    expect(foreign).toBeNull();
    await call("series_remove", { p_owner: stranger.id, p_series: series.id });
    expect(
      (await call<Summary[]>("series_list", { p_owner: owner.id })).map((s) => s.id),
    ).toContain(series.id);
  });

  it("Nur die Funktion mit dem Dienstschlüssel darf die Reihen ändern, nicht die App und nicht Fremde", async () => {
    for (const client of [owner.client, anonymous()]) {
      for (const [name, args] of [
        ["series_begin", { p_owner: owner.id, p_theme_id: 1, p_name: "x", p_sets: [] }],
        ["series_claim", { p_owner: owner.id, p_limit: 5 }],
        ["series_finish", { p_series: 1, p_set: "1-1", p_outcome: "failed" }],
        ["series_release", { p_items: [], p_paused_until: null }],
        ["series_list", { p_owner: owner.id }],
        ["series_open", { p_owner: owner.id, p_series: 1, p_touch: true }],
        ["series_remove", { p_owner: owner.id, p_series: 1 }],
        ["series_settle", { p_series: 1 }],
        ["series_summary", { p_series: 1 }],
      ] as const) {
        const { error } = await client.rpc(name, args);
        expect(error, name).not.toBeNull();
      }
    }
  });
});
