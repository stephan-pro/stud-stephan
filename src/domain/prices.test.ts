import { describe, expect, it } from "vitest";
import { aCollection, aMinifig, aPrice, aSet, aSpecialPart, aWish } from "./fixtures";
import {
  catalogKey,
  hasMarketPrice,
  itemsToPrice,
  marketPrice,
  type PriceResult,
  recordPriceRun,
} from "./prices";
import { valueOfItem } from "./value";

const TODAY = "2026-11-02";
const LAST_WEEK = "2026-10-26";

describe("F10 Preisabruf", () => {
  const rex = aMinifig({ catalogNumber: "sw0194" });
  const rex2 = aMinifig({ catalogNumber: "SW0194", condition: "new" });
  const fives = aMinifig({ name: "ARC Trooper Fives", catalogNumber: "sw0542" });
  const set = aSet({ catalogNumber: "75372-1" });
  const custom = aMinifig({ manufacturer: { kind: "custom", name: "Shop" }, catalogNumber: "x1" });
  const collection = aCollection({ minifigs: [rex, rex2, fives, custom], sets: [set] });

  it("F10 Abgefragt wird jedes offizielle Objekt mit Nummer, gleiche Figuren nur einmal", () => {
    expect(itemsToPrice(collection)).toEqual([
      { itemType: "minifig", catalogNumber: "sw0194" },
      { itemType: "minifig", catalogNumber: "sw0542" },
      { itemType: "legoSet", catalogNumber: "75372-1" },
    ]);
  });

  it("F10 Auch Wünsche und Sonderteile von LEGO bekommen einen Marktpreis", () => {
    const withWish = aCollection({
      wishlist: [
        aWish({ catalogNumber: "sw0196" }),
        aWish({ manufacturer: { kind: "bluebrixx" } }),
      ],
      specialParts: [aSpecialPart({ catalogNumber: "5008889" }), aSpecialPart()],
    });
    expect(itemsToPrice(withWish)).toEqual([
      { itemType: "specialPart", catalogNumber: "5008889" },
      { itemType: "minifig", catalogNumber: "sw0196" },
    ]);
  });

  it("F10 Nach jedem Abruf gibt es je offiziellem Objekt genau einen neuen Preisstand mit Datum", () => {
    const before = [aPrice("sw0194", LAST_WEEK, { used: 1200, new: 1800 })];
    const results: PriceResult[] = itemsToPrice(collection).map((item) => ({
      ...item,
      ok: true,
      cents: { used: 1300, new: 1900 },
    }));
    const after = recordPriceRun(before, results, TODAY);
    for (const item of itemsToPrice(collection)) {
      const fresh = after.filter(
        (point) =>
          catalogKey(point.itemType, point.catalogNumber) ===
            catalogKey(item.itemType, item.catalogNumber) && point.date === TODAY,
      );
      expect(fresh).toHaveLength(1);
    }
    expect(after).toHaveLength(before.length + 3);
    expect(after[0]).toEqual(before[0]);
    expect(valueOfItem(rex, after)).toMatchObject({ cents: 1300, asOf: TODAY });
    expect(valueOfItem(rex2, after)).toMatchObject({ cents: 1900, asOf: TODAY });
  });

  it("F10 Ein zweiter Abruf am selben Tag ersetzt den Stand dieses Tages", () => {
    const first = recordPriceRun(
      [],
      [{ itemType: "minifig", catalogNumber: "sw0194", ok: true, cents: { used: 1300 } }],
      TODAY,
    );
    const second = recordPriceRun(
      first,
      [
        { itemType: "minifig", catalogNumber: "sw0194", ok: true, cents: { used: 1250 } },
        { itemType: "minifig", catalogNumber: "SW0194 ", ok: true, cents: { used: 1260 } },
      ],
      TODAY,
    );
    expect(second).toEqual([aPrice("SW0194", TODAY, { used: 1260 })]);
  });

  it("F10 Ein fehlgeschlagener Abruf überschreibt keinen vorhandenen Wert; das Objekt zeigt „Stand vom …“", () => {
    const before = [aPrice("sw0194", LAST_WEEK, { used: 1200, new: 1800 })];
    const after = recordPriceRun(
      before,
      [
        { itemType: "minifig", catalogNumber: "sw0194", ok: false },
        { itemType: "minifig", catalogNumber: "sw0542", ok: true, cents: {} },
      ],
      TODAY,
    );
    expect(after).toEqual(before);
    expect(valueOfItem(rex, after)).toMatchObject({ cents: 1200, kind: "market", asOf: LAST_WEEK });
  });

  it("F10 Verkaufszahlen werden mit dem Preisstand gespeichert", () => {
    const after = recordPriceRun(
      [],
      [
        {
          itemType: "minifig",
          catalogNumber: "sw0194",
          ok: true,
          cents: { new: 9987, used: 6739 },
          soldCount: { new: 14, used: 97 },
        },
      ],
      TODAY,
    );
    expect(after[0]?.soldCount).toEqual({ new: 14, used: 97 });
    expect(marketPrice(rex, "used", after)).toEqual({ cents: 6739, date: TODAY, soldCount: 97 });
  });

  it("F10 Nur offizielle LEGO-Objekte mit Nummer haben einen Marktpreis", () => {
    expect(hasMarketPrice(rex)).toBe(true);
    expect(hasMarketPrice(custom)).toBe(false);
    expect(hasMarketPrice(aMinifig({ catalogNumber: "  " }))).toBe(false);
    const { catalogNumber: _, ...withoutNumber } = rex;
    expect(hasMarketPrice(withoutNumber)).toBe(false);
    expect(marketPrice(withoutNumber, "used", [aPrice("", TODAY, { used: 1 })])).toBeUndefined();
  });
});
