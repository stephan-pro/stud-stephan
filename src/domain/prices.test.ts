import { describe, expect, it } from "vitest";
import { aCollection, aMinifig, aPrice, aSet, aSpecialPart, aWish } from "./fixtures";
import {
  catalogKey,
  hasMarketPrice,
  itemsToPrice,
  itemsWithoutNumber,
  marketPrice,
  type PriceResult,
  priceHistory,
  priceNumber,
  recordPriceRun,
} from "./prices";
import { valueOfItem } from "./value";

const TODAY = "2026-11-02";
const LAST_WEEK = "2026-10-26";

describe("F10 Preisabruf", () => {
  const rex = aMinifig({ bricklinkId: "sw0194" });
  const rex2 = aMinifig({ bricklinkId: "SW0194", condition: "new" });
  const fives = aMinifig({ name: "ARC Trooper Fives", bricklinkId: "sw0542" });
  const set = aSet({ setNumber: "75372-1" });
  const custom = aMinifig({ manufacturer: { kind: "custom", name: "Shop" }, bricklinkId: "x1" });
  const collection = aCollection({ minifigs: [rex, rex2, fives, custom], sets: [set] });

  it("F10 Abgefragt wird jedes offizielle Objekt mit Nummer, gleiche Figuren nur einmal", () => {
    expect(itemsToPrice(collection)).toEqual([
      { itemType: "minifig", bricklinkId: "sw0194" },
      { itemType: "minifig", bricklinkId: "sw0542" },
      { itemType: "legoSet", bricklinkId: "75372-1" },
    ]);
  });

  it("F10 Auch Wünsche von LEGO bekommen einen Marktpreis; Sonderteile ohne BrickLink-Typ fragt der Abruf nicht ab (P11)", () => {
    const withWish = aCollection({
      wishlist: [
        aWish({ bricklinkId: "sw0196" }),
        aWish({ type: "legoSet", setNumber: "75372-1" }),
        aWish({ manufacturer: { kind: "bluebrixx" } }),
      ],
      specialParts: [aSpecialPart({ number: "5008889" }), aSpecialPart()],
    });
    expect(itemsToPrice(withWish)).toEqual([
      { itemType: "minifig", bricklinkId: "sw0196" },
      { itemType: "legoSet", bricklinkId: "75372-1" },
    ]);
  });

  it("Der Preisabruf fragt Sonderteile mit gespeichertem BrickLink-Typ ab, unter „TYP:Nummer“, jedes nur einmal", () => {
    const card = aSpecialPart({ number: "5010325", bricklinkType: "GEAR" });
    const withParts = aCollection({
      specialParts: [
        card,
        aSpecialPart({ number: " 5010325 ", bricklinkType: "GEAR", condition: "used" }),
        aSpecialPart({ number: "5008889-1", bricklinkType: "SET" }),
        aSpecialPart({ number: "77", bricklinkType: "BOOK", manufacturer: { kind: "bluebrixx" } }),
        aSpecialPart({ number: "5008818" }),
        aSpecialPart({ bricklinkType: "GEAR" }),
      ],
    });
    expect(itemsToPrice(withParts)).toEqual([
      { itemType: "specialPart", bricklinkId: "GEAR:5010325" },
      { itemType: "specialPart", bricklinkId: "SET:5008889-1" },
    ]);
    // A part without a type is not "skipped": it simply keeps its own value.
    expect(itemsWithoutNumber(withParts)).toBe(0);
    expect(hasMarketPrice(card)).toBe(true);
    expect(hasMarketPrice(aSpecialPart({ number: "5010325" }))).toBe(false);
  });

  it("Die Wert-Karte eines Sonderteils zeigt den Marktpreis in seinem Zustand und vergleicht mit dem anderen", () => {
    const card = aSpecialPart({ number: "5010325", bricklinkType: "GEAR", condition: "new" });
    const prices = [
      aPrice("GEAR:5010325", LAST_WEEK, { new: 1400, used: 900 }, "specialPart"),
      aPrice("GEAR:5010325", TODAY, { new: 1500 }, "specialPart"),
      // The same number as a set is another item.
      aPrice("5010325", TODAY, { new: 99999 }, "legoSet"),
    ];
    expect(marketPrice(card, "new", prices)).toEqual({ cents: 1500, date: TODAY });
    expect(valueOfItem(card, prices)).toMatchObject({
      kind: "market",
      cents: 1500,
      asOf: TODAY,
      otherCondition: { condition: "used", cents: 900, date: LAST_WEEK },
    });
    expect(priceHistory(card, "new", prices)).toEqual([
      { date: LAST_WEEK, cents: 1400 },
      { date: TODAY, cents: 1500 },
    ]);
  });

  it("Der Preisabruf fragt eine Big Fig (Typ PART) unter „PART:Nummer“ ab, eine Minifigur unter der Nummer, Wünsche ebenso", () => {
    const rancor = aMinifig({ bricklinkId: "11323pb01c01", bricklinkType: "PART" });
    const withBigFigs = aCollection({
      minifigs: [
        rancor,
        aMinifig({ bricklinkId: " 11323PB01C01 ", bricklinkType: "PART", condition: "new" }),
        aMinifig({ bricklinkId: "sw0194" }),
      ],
      wishlist: [aWish({ bricklinkId: "973c01", bricklinkType: "PART" })],
    });
    expect(itemsToPrice(withBigFigs)).toEqual([
      { itemType: "minifig", bricklinkId: "PART:11323pb01c01" },
      { itemType: "minifig", bricklinkId: "sw0194" },
      { itemType: "minifig", bricklinkId: "PART:973c01" },
    ]);
    const prices = [
      aPrice("PART:11323pb01c01", TODAY, { used: 8000, new: 12050 }),
      // The same number as a minifig is another item.
      aPrice("11323pb01c01", TODAY, { used: 1 }),
    ];
    expect(marketPrice(rancor, "used", prices)).toEqual({ cents: 8000, date: TODAY });
    expect(valueOfItem(rancor, prices)).toMatchObject({ kind: "market", cents: 8000 });
    expect(priceNumber(rancor)).toBe("PART:11323pb01c01");
    expect(priceNumber(aMinifig({ bricklinkId: "sw0194" }))).toBe("sw0194");
    expect(priceNumber(aMinifig({ bricklinkId: " ", bricklinkType: "PART" }))).toBeUndefined();
  });

  it("Ein Sonderteil ohne BrickLink-Typ bleibt beim eigenen Wert, auch wenn eine Nummer da ist", () => {
    const own = aSpecialPart({
      number: "5010325",
      manualValue: { cents: 700, enteredOn: LAST_WEEK },
    });
    const prices = [aPrice("5010325", TODAY, { new: 1500 }, "specialPart")];
    expect(marketPrice(own, "new", prices)).toBeUndefined();
    expect(valueOfItem(own, prices)).toMatchObject({ kind: "manual", cents: 700 });
  });

  it("P11 Objekte ohne BrickLink-Nummer werden übersprungen und gezählt", () => {
    const { bricklinkId: _custom, ...customWithout } = custom;
    const { setNumber: _set, ...setWithout } = aSet();
    const { bricklinkId: _wish, ...wishWithout } = aWish();
    const withGaps = aCollection({
      minifigs: [rex, aMinifig({ bricklinkId: " " }), customWithout],
      sets: [setWithout],
      wishlist: [wishWithout],
      specialParts: [aSpecialPart()],
    });
    expect(itemsToPrice(withGaps)).toEqual([{ itemType: "minifig", bricklinkId: "sw0194" }]);
    // A custom figure has no market value at all, so it is not "skipped".
    expect(itemsWithoutNumber(withGaps)).toBe(3);
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
          catalogKey(point.itemType, point.bricklinkId) ===
            catalogKey(item.itemType, item.bricklinkId) && point.date === TODAY,
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
      [{ itemType: "minifig", bricklinkId: "sw0194", ok: true, cents: { used: 1300 } }],
      TODAY,
    );
    const second = recordPriceRun(
      first,
      [
        { itemType: "minifig", bricklinkId: "sw0194", ok: true, cents: { used: 1250 } },
        { itemType: "minifig", bricklinkId: "SW0194 ", ok: true, cents: { used: 1260 } },
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
        { itemType: "minifig", bricklinkId: "sw0194", ok: false },
        { itemType: "minifig", bricklinkId: "sw0542", ok: true, cents: {} },
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
          bricklinkId: "sw0194",
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
    expect(hasMarketPrice(aMinifig({ bricklinkId: "  " }))).toBe(false);
    const { bricklinkId: _, ...withoutNumber } = rex;
    expect(hasMarketPrice(withoutNumber)).toBe(false);
    expect(marketPrice(withoutNumber, "used", [aPrice("", TODAY, { used: 1 })])).toBeUndefined();
  });
});

describe("F10 Verlauf des Marktpreises", () => {
  const rex = aMinifig({ bricklinkId: "sw0194" });
  const prices = [
    aPrice("sw0194", "2026-10-27", { used: 3850, new: 5200 }),
    aPrice("sw0194", "2026-10-13", { used: 3650 }),
    aPrice("sw0194", "2026-10-20", { new: 5100 }),
    aPrice("sw0542", "2026-10-27", { used: 2400 }),
  ];

  it("F10 Der Verlauf läuft vom ältesten Stand zum neuesten und folgt dem Zustand", () => {
    expect(priceHistory(rex, "used", prices)).toEqual([
      { date: "2026-10-13", cents: 3650 },
      { date: "2026-10-27", cents: 3850 },
    ]);
    expect(priceHistory(rex, "new", prices)).toEqual([
      { date: "2026-10-20", cents: 5100 },
      { date: "2026-10-27", cents: 5200 },
    ]);
  });

  it("F10 Ohne Marktpreis (Custom, ohne Nummer) gibt es keinen Verlauf", () => {
    const custom = aMinifig({ manufacturer: { kind: "custom", name: "Shop" } });
    expect(priceHistory(custom, "used", prices)).toEqual([]);
    expect(priceHistory(aMinifig({ bricklinkId: "sw9999" }), "used", prices)).toEqual([]);
  });
});
