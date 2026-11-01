import { describe, expect, it } from "vitest";
import { aCollection, aDiorama, aMinifig, aPrice, aSet } from "./fixtures";
import { totals } from "./totals";
import {
  addDays,
  periodStart,
  priceDates,
  valueAt,
  valueTrend,
  weeklyChange,
} from "./valueHistory";

// One official figure (sw0194, used) bought 2026-08-01 and a set (75372-1, used) bought 2026-10-20.
const rex = aMinifig({ acquiredOn: "2026-08-01", purchasePrice: 2000 });
const set = aSet({ acquiredOn: "2026-10-20", purchasePrice: 3000 });
const prices = [
  aPrice("sw0194", "2026-10-06", { used: 1000 }),
  aPrice("sw0194", "2026-10-13", { used: 1100 }),
  aPrice("sw0194", "2026-10-27", { used: 1200 }),
  aPrice("75372-1", "2026-10-27", { used: 2500 }, "legoSet"),
];
const collection = aCollection({ minifigs: [rex], sets: [set], prices });
const TODAY = "2026-10-31";

describe("F12 Verlauf des Gesamtwerts aus den Preisständen", () => {
  it("F12 Stichtage sind die Tage der Preisabrufe, nicht mehr", () => {
    expect(priceDates(collection, TODAY)).toEqual(["2026-10-06", "2026-10-13", "2026-10-27"]);
    const trend = valueTrend(collection, "all", TODAY);
    expect(trend.points.map((point) => point.date)).toEqual([
      "2026-10-06",
      "2026-10-13",
      "2026-10-27",
    ]);
  });

  it("F12 Pro Stichtag zählen nur Objekte, die an dem Tag schon in der Sammlung waren", () => {
    expect(valueAt(collection, "2026-10-13", TODAY)).toBe(1100);
    // The set came on 20.10.: its market value counts from the run on 27.10.
    expect(valueAt(collection, "2026-10-27", TODAY)).toBe(1200 + 2500);
  });

  it("F12 Ohne Kaufdatum zählt der Tag des Anlegens", () => {
    const entered = aMinifig({ createdAt: "2026-10-10T08:00:00Z" });
    const later = aCollection({ minifigs: [entered], prices });
    expect(valueAt(later, "2026-10-09", TODAY)).toBe(0);
    expect(valueAt(later, "2026-10-13", TODAY)).toBe(1100);
  });

  it("F12 Je Objekt gilt der Wert des Tages: Marktwert, sonst eigener Wert, sonst Kaufpreis", () => {
    const own = aMinifig({
      manufacturer: { kind: "custom", name: "Shop" },
      acquiredOn: "2026-08-01",
      purchasePrice: 700,
      manualValue: { cents: 900, enteredOn: "2026-10-10" },
    });
    const mixed = aCollection({ minifigs: [own], prices });
    // Before the estimate was entered the purchase price held, afterwards the estimate.
    expect(valueAt(mixed, "2026-10-06", TODAY)).toBe(700);
    expect(valueAt(mixed, "2026-10-13", TODAY)).toBe(900);
  });

  it("F12 Ein Marktwert, der erst später abgerufen wurde, rückt nicht in frühere Tage", () => {
    expect(valueAt(collection, "2026-10-05", TODAY)).toBe(2000 + 0);
  });

  it("F12 Ein Diorama zählt mit seinem eigenen Wert ab dem Tag, an dem es angelegt wurde", () => {
    const withDiorama = aCollection({
      minifigs: [rex],
      dioramas: [
        aDiorama({
          createdAt: "2026-10-12T08:00:00Z",
          manualValue: { cents: 5000, enteredOn: "2026-10-12" },
        }),
      ],
      prices,
    });
    expect(valueAt(withDiorama, "2026-10-06", TODAY)).toBe(1000);
    expect(valueAt(withDiorama, "2026-10-13", TODAY)).toBe(1100 + 5000);
  });

  it("F12 Der Wert von heute ist der Gesamtwert der Sammlung", () => {
    expect(valueAt(collection, TODAY, TODAY)).toBe(totals(collection).value);
    const future = aCollection({
      minifigs: [
        aMinifig({
          acquiredOn: "2027-01-01",
          purchasePrice: 400,
          manufacturer: { kind: "custom", name: "Shop" },
        }),
      ],
    });
    expect(valueAt(future, TODAY, TODAY)).toBe(totals(future).value);
  });

  it("F12 Mit nur einem Preisstand gibt es einen Punkt und keine Veränderung (keine erfundene Linie)", () => {
    const single = aCollection({ minifigs: [rex], prices: [prices[0] as (typeof prices)[number]] });
    const trend = valueTrend(single, "year", "2026-10-07");
    expect(trend.points).toEqual([{ date: "2026-10-06", cents: 1000 }]);
    expect(trend.change).toBeUndefined();
    expect(trend.since).toBe("2026-10-06");
    expect(trend.partial).toBe(true);
  });

  it("F12 Ohne Preisstände gibt es keinen Verlauf", () => {
    const trend = valueTrend(aCollection({ minifigs: [rex] }), "all", TODAY);
    expect(trend).toEqual({ points: [], partial: false });
  });

  it("F12 Wenn der Zeitraum weiter zurückreicht als die Preise, ist der Verlauf nur teilweise", () => {
    const trend = valueTrend(collection, "year", TODAY);
    expect(trend.partial).toBe(true);
    expect(trend.since).toBe("2026-10-06");
    expect(trend.points[0]?.date).toBe("2026-10-06");
    expect(trend.change).toBe(1200 + 2500 - 1000);
    expect(valueTrend(collection, "all", TODAY).partial).toBe(false);
  });

  it("F12 Der Zeitraum beginnt mit einem Punkt, wenn es zu seinem Beginn schon Preise gab", () => {
    // 3 months before 2026-12-31 is 2026-09-30; all prices are younger, so the history is partial.
    expect(periodStart("threeMonths", "2026-12-31")).toBe("2026-09-30");
    const later = valueTrend(collection, "threeMonths", "2027-01-20");
    // Start 2026-10-20: prices existed (runs on 06.10., 13.10.), so a point stands there; the set
    // came that day and counts at its purchase price.
    expect(later.points[0]).toEqual({ date: "2026-10-20", cents: 1100 + 3000 });
    expect(later.points.map((point) => point.date)).toEqual(["2026-10-20", "2026-10-27"]);
    expect(later.partial).toBe(false);
  });

  it("F12 Zeitraum 1 Jahr und Monatsende: 31. Mai minus 3 Monate ist der 28. Februar", () => {
    expect(periodStart("threeMonths", "2026-05-31")).toBe("2026-02-28");
    expect(periodStart("year", "2026-10-31")).toBe("2025-10-31");
    expect(periodStart("all", "2026-10-31")).toBeUndefined();
  });

  it("F12 Ein Punkt für heute entsteht nur, wenn sich seit dem letzten Abruf etwas geändert hat", () => {
    expect(valueTrend(collection, "all", TODAY).points.at(-1)?.date).toBe("2026-10-27");
    const changed = aCollection({
      minifigs: [
        rex,
        aMinifig({
          manufacturer: { kind: "custom", name: "Shop" },
          acquiredOn: "2026-10-29",
          purchasePrice: 800,
        }),
      ],
      sets: [set],
      prices,
    });
    expect(valueTrend(changed, "all", TODAY).points.at(-1)).toEqual({
      date: TODAY,
      cents: 1200 + 2500 + 800,
    });
  });

  it("F12 Preisstände aus der Zukunft zählen nicht", () => {
    expect(priceDates(collection, "2026-10-10")).toEqual(["2026-10-06"]);
  });
});

describe("F12 Veränderung in der Woche (Sammlungskarte)", () => {
  it("F12 Vergleich mit dem Wert vor 7 Tagen", () => {
    expect(addDays("2026-10-31", -7)).toBe("2026-10-24");
    const change = weeklyChange(collection, TODAY);
    // 24.10.: 1100 + the set at its purchase price 3000 (no market price yet); 31.10.: 1200 + 2500.
    expect(change?.cents).toBe(3700 - 4100);
    expect(change?.percent).toBeCloseTo(((3700 - 4100) / 4100) * 100, 6);
  });

  it("F12 Ohne Vergleichswert wird keine Veränderung berechnet", () => {
    // The first price is from 27.10.: a week before 31.10. there was none.
    const young = aCollection({ minifigs: [rex], prices: [prices[2] as (typeof prices)[number]] });
    expect(weeklyChange(young, TODAY)).toBeUndefined();
    expect(weeklyChange(aCollection({ minifigs: [rex] }), TODAY)).toBeUndefined();
  });

  it("F12 Ohne Wert vor einer Woche gibt es keine Prozent", () => {
    const empty = aCollection({ prices });
    expect(weeklyChange(empty, TODAY)).toBeUndefined();
  });

  it("F12 Eine unveränderte Woche ist 0 %", () => {
    const flat = aCollection({ minifigs: [rex], prices });
    expect(weeklyChange(flat, "2026-11-03")?.percent).toBe(0);
  });
});
