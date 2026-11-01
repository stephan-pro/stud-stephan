import { describe, expect, it } from "vitest";
import { latestPriceDate, mostValuable, themeShares } from "./dashboard";
import { aCollection, aMinifig, aPrice, aSet, aSpecialPart } from "./fixtures";

describe("F12 Wertvollste Objekte", () => {
  const collection = aCollection({
    minifigs: [
      aMinifig({ name: "Rex", bricklinkId: "sw0194" }),
      aMinifig({ name: "Cody", bricklinkId: "sw0196" }),
      aMinifig({ name: "Ohne Wert", manufacturer: { kind: "custom", name: "Shop" } }),
    ],
    sets: [aSet({ name: "Battle Pack" })],
    specialParts: [
      aSpecialPart({ name: "Münze", manualValue: { cents: 1200, enteredOn: "2026-01-01" } }),
    ],
    prices: [
      aPrice("sw0194", "2026-10-27", { used: 3850 }),
      aPrice("sw0196", "2026-10-27", { used: 1200 }),
      aPrice("75372-1", "2026-10-27", { used: 2100 }, "legoSet"),
    ],
  });

  it("F12 Absteigend nach Wert; bei gleichem Wert nach Name; 0 € steht nicht in der Liste", () => {
    expect(mostValuable(collection).map((ranked) => [ranked.item.name, ranked.cents])).toEqual([
      ["Rex", 3850],
      ["Battle Pack", 2100],
      ["Cody", 1200],
      ["Münze", 1200],
    ]);
  });

  it("F12 Höchstens 10, jedes Exemplar für sich", () => {
    const many = aCollection({
      minifigs: Array.from({ length: 14 }, (_, index) =>
        aMinifig({
          name: `Figur ${index}`,
          purchasePrice: 100 + index,
          manufacturer: { kind: "custom", name: "Shop" },
        }),
      ),
    });
    const top = mostValuable(many);
    expect(top).toHaveLength(10);
    expect(top[0]?.cents).toBe(113);
    expect(mostValuable(many, 3)).toHaveLength(3);
  });
});

describe("F12 Verteilung nach Unterthema (Entscheidung des PO vom 31.10.2026)", () => {
  const themed = (theme: string | undefined, count: number) =>
    Array.from({ length: count }, () => {
      const { theme: _default, ...withoutTheme } = aMinifig();
      return theme === undefined ? withoutTheme : { ...withoutTheme, theme };
    });

  it("F12 Unterthema statt Hauptthema; Thema ohne Unterthema unter seinem Namen", () => {
    const shares = themeShares(
      aCollection({
        minifigs: [
          ...themed("Star Wars – The Clone Wars", 3),
          ...themed("Star Wars – The Mandalorian", 1),
          ...themed("Ritter", 1),
        ],
      }),
    );
    expect(shares).toEqual([
      { kind: "theme", name: "The Clone Wars", count: 3, percent: 60 },
      { kind: "theme", name: "Ritter", count: 1, percent: 20 },
      { kind: "theme", name: "The Mandalorian", count: 1, percent: 20 },
    ]);
  });

  it("F12 Mehr als fünf Themen: der Rest als „Sonstige“; Objekte ohne Thema für sich", () => {
    const shares = themeShares(
      aCollection({
        minifigs: [
          ...themed("A – a", 6),
          ...themed("B – b", 5),
          ...themed("C – c", 4),
          ...themed("D – d", 3),
          ...themed(undefined, 2),
          ...themed("E – e", 1),
          ...themed("F – f", 1),
        ],
      }),
    );
    expect(shares.map((share) => share.kind)).toEqual([
      "theme",
      "theme",
      "theme",
      "theme",
      "none",
      "rest",
    ]);
    expect(shares.at(-1)).toEqual({ kind: "rest", count: 2, percent: 9 });
  });

  it("F12 Ohne Objekte keine Verteilung", () => {
    expect(themeShares(aCollection())).toEqual([]);
  });
});

describe("F12 Preisstand für die Fußzeile", () => {
  it("F12 Der jüngste Tag mit einem Preis, nicht nach heute", () => {
    const prices = [
      aPrice("sw0194", "2026-10-20", { used: 1 }),
      aPrice("sw0194", "2026-10-27", { used: 1 }),
      aPrice("sw0194", "2026-11-03", { used: 1 }),
    ];
    expect(latestPriceDate(aCollection({ prices }), "2026-10-31")).toBe("2026-10-27");
    expect(latestPriceDate(aCollection(), "2026-10-31")).toBeUndefined();
  });
});
