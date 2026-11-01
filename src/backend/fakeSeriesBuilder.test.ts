import { describe, expect, it } from "vitest";
import { DEMO_SERIES_CATALOG } from "../demo/series";
import { FakeSeriesBuilder, type SeriesControl } from "./fakeSeriesBuilder";
import { SERIES_MAX_SETS, SERIES_WARNING_SETS, seriesAsked, seriesOpen } from "./seriesBuilder";

function builder(control: () => SeriesControl = () => undefined) {
  let tick = 0;
  return new FakeSeriesBuilder(DEMO_SERIES_CATALOG, {
    control,
    now: () => new Date(Date.UTC(2026, 10, 3, 10, 0, tick++)),
  });
}

describe("P12 Reihen im Speicher (Demo und E2E)", () => {
  it("findet Themen über Wörter des Namens, auch „Sammelserie“", async () => {
    const fake = builder();
    expect((await fake.search("clone wars")).map((theme) => theme.id)).toEqual([1]);
    expect((await fake.search("Batman Movie Sammelserie")).map((theme) => theme.id)).toEqual([2]);
    expect(await fake.search("")).toEqual([]);
  });

  it("zählt vor dem Anlegen die Sets; das große Thema liegt über der Warnschwelle", async () => {
    const fake = builder();
    expect((await fake.plan(1)).setCount).toBe(4);
    const big = (await fake.plan(3)).setCount;
    expect(big).toBeGreaterThan(SERIES_WARNING_SETS);
    expect(big).toBeLessThanOrEqual(SERIES_MAX_SETS);
    await expect(fake.plan(99)).rejects.toMatchObject({ failure: "not_found" });
  });

  it("baut in Portionen auf und sammelt die Figuren, jede einmal", async () => {
    const fake = builder();
    const started = await fake.start(1);
    expect(started).toMatchObject({ total: 4, done: 0 });
    expect(seriesOpen(started)).toBe(true);
    const first = await fake.work(started.id);
    expect(seriesAsked(first)).toBe(2);
    const last = await fake.work(started.id);
    expect(last.finishedAt).toBeDefined();
    expect(last.figureCount).toBe(8);
    const detail = await fake.get(started.id, false);
    expect(detail?.figures.map((figure) => figure.name)).toContain("Plo Koon");
    // The same theme again finds the series there is.
    expect((await fake.start(1)).id).toBe(started.id);
  });

  it("hält beim Tageslimit an und macht danach weiter", async () => {
    let control: SeriesControl = "limit_reached";
    const fake = builder(() => control);
    const { id } = await fake.start(1);
    const paused = await fake.work(id);
    expect(paused.pausedUntil).toBeDefined();
    expect(seriesOpen(paused)).toBe(false);
    expect(seriesAsked(paused)).toBe(0);
    control = undefined;
    const resumed = await fake.work(id);
    expect(resumed.pausedUntil).toBeUndefined();
    expect(seriesAsked(resumed)).toBe(2);
  });

  it("listet die zuletzt geöffnete Reihe zuerst; Lesen ohne Öffnen ändert die Reihenfolge nicht", async () => {
    const fake = builder();
    const a = await fake.start(1);
    const b = await fake.start(2);
    expect((await fake.list()).map((s) => s.id)).toEqual([b.id, a.id]);
    await fake.get(a.id, false);
    expect((await fake.list()).map((s) => s.id)).toEqual([b.id, a.id]);
    await fake.get(a.id, true);
    expect((await fake.list()).map((s) => s.id)).toEqual([a.id, b.id]);
    await fake.remove(a.id);
    expect((await fake.list()).map((s) => s.id)).toEqual([b.id]);
    expect(await fake.get(a.id, true)).toBeNull();
  });

  it("scheitert wie der Dienst: ohne Verbindung und gestört", async () => {
    await expect(builder(() => "offline").list()).rejects.toMatchObject({ failure: "offline" });
    await expect(builder(() => "unavailable").search("x")).rejects.toMatchObject({
      failure: "unavailable",
    });
  });
});
