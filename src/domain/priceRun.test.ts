import { describe, expect, it } from "vitest";
import type { PriceRunStatus } from "../backend/priceRun";
import { formatDateTime } from "./dates";
import { nextPriceRun, priceRunDone, priceRunState } from "./priceRun";

function aStatus(fields: Partial<PriceRunStatus> = {}): PriceRunStatus {
  return {
    trigger: "schedule",
    day: "2026-10-26",
    startedAt: "2026-10-26T02:00:00Z",
    total: 314,
    updated: 0,
    empty: 0,
    failed: 0,
    open: 314,
    skipped: 0,
    failedNumbers: [],
    ...fields,
  };
}

describe("P11 Nächster Lauf", () => {
  it("ist der nächste Montag um 3 Uhr (Winterzeit), wie der Cron-Job (02:00 UTC)", () => {
    // Sunday 1 November 2026 → Monday 2 November.
    expect(nextPriceRun("2026-11-01T12:00:00Z")).toBe("2026-11-02T02:00:00.000Z");
    expect(formatDateTime(nextPriceRun("2026-11-01T12:00:00Z"))).toBe("02.11.2026, 03:00");
    // Monday before the run, and right after it.
    expect(nextPriceRun("2026-11-02T01:59:00Z")).toBe("2026-11-02T02:00:00.000Z");
    expect(nextPriceRun("2026-11-02T02:00:00Z")).toBe("2026-11-09T02:00:00.000Z");
    // Over the end of the year; in summer time it is 04:00 in Germany.
    expect(nextPriceRun("2026-12-29T10:00:00Z")).toBe("2027-01-04T02:00:00.000Z");
    expect(formatDateTime(nextPriceRun("2027-06-30T10:00:00Z"))).toBe("05.07.2027, 04:00");
  });

  it("zeigt Datum und Uhrzeit in deutscher Zeit; Unlesbares bleibt stehen", () => {
    expect(formatDateTime("2026-10-27T02:00:00+00:00")).toBe("27.10.2026, 03:00");
    expect(formatDateTime("gestern")).toBe("gestern");
  });
});

describe("P11 Zustand des letzten Laufs", () => {
  const NOW = "2026-11-02T10:00:00Z";

  it("unterscheidet keinen Lauf, laufend, pausiert (Tageslimit) und fertig", () => {
    expect(priceRunState(null, NOW)).toBe("none");
    expect(priceRunState(aStatus(), NOW)).toBe("running");
    expect(priceRunState(aStatus({ pausedUntil: "2026-11-03T00:05:00Z" }), NOW)).toBe("paused");
    // A pause that is over: the run goes on.
    expect(priceRunState(aStatus({ pausedUntil: "2026-11-02T00:05:00Z" }), NOW)).toBe("running");
    expect(priceRunState(aStatus({ finishedAt: "2026-10-26T02:20:00Z", open: 0 }), NOW)).toBe(
      "done",
    );
  });

  it("zählt die schon abgefragten Einträge", () => {
    expect(priceRunDone(aStatus({ open: 300 }))).toBe(14);
    expect(priceRunDone(aStatus({ total: 0, open: 0 }))).toBe(0);
  });
});
