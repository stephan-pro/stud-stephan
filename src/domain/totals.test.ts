import { describe, expect, it } from "vitest";
import { aCollection, aDiorama, aMinifig, aPrice, aSet, aSpecialPart } from "./fixtures";
import { totals } from "./totals";

const mod = { id: "mod-1", position: "arms", description: "Arme", price: 500 } as const;

describe("F10/F12 Summen der Sammlung", () => {
  const collection = aCollection({
    minifigs: [
      aMinifig({ purchasePrice: 1000, mods: [mod] }),
      aMinifig({
        name: "Burgwache",
        manufacturer: { kind: "bluebrixx" },
        theme: "Ritter",
        purchasePrice: 400,
      }),
      aMinifig({ name: "Ohne alles", bricklinkId: "sw9999", theme: "Ninjago – Staffel 1" }),
    ],
    sets: [aSet({ purchasePrice: 1999, theme: "Star Wars" })],
    specialParts: [
      aSpecialPart({ manualValue: { cents: 990, enteredOn: "2025-05-12" } }),
      aSpecialPart({ name: "Ohne Wert" }),
    ],
    dioramas: [aDiorama(), aDiorama({ manualValue: { cents: 5000, enteredOn: "2026-01-01" } })],
    prices: [
      aPrice("sw0194", "2026-10-27", { used: 1200, new: 1800 }),
      aPrice("75372-1", "2026-10-27", { used: 2100 }, "legoSet"),
    ],
  });
  const result = totals(collection);

  it("F10 Objekte ohne Marktwert und ohne eingetragenen Wert zählen im Gesamtwert mit 0 € und werden als „ohne Wert“ ausgewiesen", () => {
    // 12 € market + 4 € purchase + 0 € + 21 € market + 9,90 € estimate + 0 € + 50 € diorama
    expect(result.value).toBe(1200 + 400 + 0 + 2100 + 990 + 0 + 5000);
    expect(result.withoutValue).toBe(2);
  });

  it("F12 Kaufsumme gegenüber aktuellem Wert", () => {
    expect(result.purchase).toBe(1000 + 400 + 1999);
    expect(result.difference).toBe(result.value - result.purchase);
  });

  it("F6 Ausgaben für Mods zählen nicht zum Wert und werden getrennt summiert", () => {
    expect(result.modSpend).toBe(500);
    const withoutMods = totals({
      ...collection,
      minifigs: collection.minifigs.map((minifig) => ({ ...minifig, mods: [] })),
    });
    expect(withoutMods.value).toBe(result.value);
  });

  it("F12 Anzahl je Objektart", () => {
    expect(result.counts).toEqual({ minifigs: 3, sets: 1, specialParts: 2, dioramas: 2 });
  });

  it("F12 Verteilung nach Hauptthema, größte zuerst", () => {
    expect(result.themes).toEqual([
      { theme: "Star Wars", count: 2 },
      { theme: "Ninjago", count: 1 },
      { theme: "Ritter", count: 1 },
    ]);
  });

  it("F12 Leere Sammlung → alles 0", () => {
    expect(totals(aCollection())).toEqual({
      value: 0,
      purchase: 0,
      difference: 0,
      modSpend: 0,
      withoutValue: 0,
      counts: { minifigs: 0, sets: 0, specialParts: 0, dioramas: 0 },
      themes: [],
    });
  });
});
