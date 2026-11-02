import { describe, expect, it } from "vitest";
import { aDiorama, aMinifig, aPrice, aSet, aSpecialPart } from "./fixtures";
import { isModified, modSpend, valueOfItem } from "./value";

const BRICKLINK = [aPrice("sw0194", "2026-10-26", { used: 1200, new: 1800 })];
const modPart = {
  id: "mod-1",
  position: "arms",
  description: "Bedruckte Arme",
  price: 500,
} as const;

describe("F10 Wert offizieller Objekte", () => {
  it("F10 Offizielle Figur, Zustand gebraucht, BrickLink gebraucht 12 € / neu 18 € → Wert 12 €", () => {
    const value = valueOfItem(aMinifig({ condition: "used" }), BRICKLINK);
    expect(value.cents).toBe(1200);
    expect(value.kind).toBe("market");
    expect(value.asOf).toBe("2026-10-26");
  });

  it("F10 Dieselbe Figur mit Mod-Teil für 5 € → Wert weiterhin 12 €; „Ausgaben für Mods“ 5 €", () => {
    const rex = aMinifig({ condition: "used", mods: [modPart] });
    expect(valueOfItem(rex, BRICKLINK).cents).toBe(1200);
    expect(modSpend(rex)).toBe(500);
  });

  it("F10 Zustand von gebraucht auf neu geändert → Wert sofort 18 €, ohne neuen Abruf", () => {
    const used = aMinifig({ condition: "used" });
    const changed = { ...used, condition: "new" as const };
    expect(valueOfItem(used, BRICKLINK).cents).toBe(1200);
    expect(valueOfItem(changed, BRICKLINK).cents).toBe(1800);
  });

  it("P11 Der Marktwert nennt, aus wie vielen Verkäufen er stammt", () => {
    const sold = [{ ...aPrice("sw0194", "2026-11-02", { used: 6739 }), soldCount: { used: 97 } }];
    expect(valueOfItem(aMinifig({ condition: "used" }), sold)).toMatchObject({
      cents: 6739,
      soldCount: 97,
    });
    expect(valueOfItem(aMinifig({ condition: "used" }), BRICKLINK).soldCount).toBeUndefined();
  });

  it("F10 Der Preis im anderen Zustand steht zum Vergleich daneben", () => {
    expect(valueOfItem(aMinifig({ condition: "used" }), BRICKLINK).otherCondition).toEqual({
      condition: "new",
      cents: 1800,
      date: "2026-10-26",
    });
  });

  it("F10 Differenz = aktueller Wert − Kaufpreis", () => {
    expect(valueOfItem(aMinifig({ purchasePrice: 1000 }), BRICKLINK).difference).toBe(200);
    expect(valueOfItem(aMinifig({ purchasePrice: 1500 }), BRICKLINK).difference).toBe(-300);
    expect(valueOfItem(aMinifig(), BRICKLINK).difference).toBeUndefined();
  });

  it("F10 Sets und Sonderteile von LEGO bekommen ebenfalls den Marktwert in ihrem Zustand", () => {
    const prices = [
      aPrice("75372-1", "2026-10-26", { used: 2100, new: 2750 }, "legoSet"),
      aPrice("GEAR:5008889", "2026-10-26", { new: 990 }, "specialPart"),
    ];
    expect(valueOfItem(aSet({ condition: "used" }), prices).cents).toBe(2100);
    // A special part's price is kept under its BrickLink type and number.
    expect(
      valueOfItem(aSpecialPart({ number: "5008889", bricklinkType: "GEAR" }), prices).cents,
    ).toBe(990);
    // The number alone says nothing about the type: it keeps its own value (none here).
    expect(valueOfItem(aSpecialPart({ number: "5008889" }), prices).kind).toBe("none");
  });

  it("F10 Gleiche Nummer bei anderer Objektart zählt nicht als Preis", () => {
    const value = valueOfItem(aSet({ setNumber: "sw0194", purchasePrice: 999 }), BRICKLINK);
    expect(value.kind).toBe("purchase");
  });

  it("F10 Groß-/Kleinschreibung der Nummer spielt keine Rolle", () => {
    expect(valueOfItem(aMinifig({ bricklinkId: " SW0194 " }), BRICKLINK).cents).toBe(1200);
  });

  it("F10 Der neueste Preisstand gilt", () => {
    const prices = [
      aPrice("sw0194", "2026-10-19", { used: 1100 }),
      aPrice("sw0194", "2026-10-26", { used: 1200 }),
      aPrice("sw0194", "2026-10-12", { used: 1000 }),
    ];
    expect(valueOfItem(aMinifig(), prices)).toMatchObject({ cents: 1200, asOf: "2026-10-26" });
  });

  it("F10 Fehlt im neuesten Stand ein Zustand, gilt dessen letzter bekannter Preis mit „Stand vom …“", () => {
    const prices = [
      aPrice("sw0194", "2026-10-19", { used: 1100, new: 1700 }),
      aPrice("sw0194", "2026-10-26", { new: 1800 }),
    ];
    expect(valueOfItem(aMinifig({ condition: "used" }), prices)).toMatchObject({
      cents: 1100,
      asOf: "2026-10-19",
      otherCondition: { cents: 1800, date: "2026-10-26" },
    });
  });

  it("F10 Die Stückzahl der Verkäufe wird mitgegeben, wenn bekannt", () => {
    const point = { ...aPrice("sw0194", "2026-10-26", { used: 1200 }), soldCount: { used: 97 } };
    expect(valueOfItem(aMinifig(), [point])).toMatchObject({ cents: 1200, kind: "market" });
    expect(valueOfItem(aMinifig({ condition: "new" }), [point]).otherCondition).toEqual({
      condition: "used",
      cents: 1200,
      date: "2026-10-26",
      soldCount: 97,
    });
  });
});

describe("F10 Wert ohne Marktpreis", () => {
  const estimate = { cents: 990, enteredOn: "2025-05-12" };

  it("F10 Custom-Figur → Kaufpreis", () => {
    const custom = aMinifig({ manufacturer: { kind: "custom", name: "Custom-Shop" } });
    expect(valueOfItem({ ...custom, purchasePrice: 3500 }, BRICKLINK)).toMatchObject({
      cents: 3500,
      kind: "purchase",
      difference: 0,
      ownValueMissing: false,
    });
  });

  it("F10 Anderer Hersteller → selbst geschätzter Wert geht vor dem Kaufpreis", () => {
    const burgwache = aMinifig({
      manufacturer: { kind: "bluebrixx" },
      bricklinkId: "sw0194",
      purchasePrice: 400,
      manualValue: { cents: 600, enteredOn: "2026-01-02" },
    });
    expect(valueOfItem(burgwache, BRICKLINK)).toMatchObject({
      cents: 600,
      kind: "manual",
      asOf: "2026-01-02",
      difference: 200,
    });
    expect(valueOfItem(burgwache, BRICKLINK).otherCondition).toBeUndefined();
  });

  it("F10 Offizielles Objekt ohne Marktpreis → selbst geschätzter Wert", () => {
    const coin = aSpecialPart({ manualValue: estimate });
    expect(valueOfItem(coin, [])).toMatchObject({ cents: 990, kind: "manual", asOf: "2025-05-12" });
  });

  it("F10 Offizielle Figur ohne Nummer → kein Marktwert, Kaufpreis", () => {
    const appo = aMinifig({ name: "Commander Appo", bricklinkId: "", purchasePrice: 1800 });
    expect(valueOfItem(appo, BRICKLINK)).toMatchObject({ cents: 1800, kind: "purchase" });
  });

  it("F10 MOC/Diorama → selbst geschätzter Wert, sonst kein Wert", () => {
    expect(valueOfItem(aDiorama({ manualValue: estimate }), [])).toMatchObject({
      cents: 990,
      kind: "manual",
    });
    expect(valueOfItem(aDiorama(), [])).toMatchObject({ cents: 0, kind: "none" });
  });

  it("F10 Weder Marktwert noch eingetragener Wert → 0 € und „ohne Wert“", () => {
    const value = valueOfItem(aMinifig({ bricklinkId: "sw9999" }), BRICKLINK);
    expect(value).toEqual({ cents: 0, kind: "none", ownValueMissing: true });
  });
});

describe("F5/F6 Modifiziert", () => {
  it("F5 Modifiziert ergibt sich automatisch, sobald mindestens eine Modifikation erfasst ist", () => {
    expect(isModified(aMinifig())).toBe(false);
    expect(isModified(aMinifig({ mods: [modPart] }))).toBe(true);
  });

  it("F6 Ausgaben für Mods sind die Summe der Teilepreise; Teile ohne Preis zählen 0 €", () => {
    const { price: _, ...withoutPrice } = { ...modPart, id: "mod-3" };
    const mods = [modPart, { ...modPart, id: "mod-2", price: 850 }, withoutPrice];
    expect(modSpend(aMinifig({ mods }))).toBe(1350);
    expect(modSpend(aMinifig())).toBe(0);
  });
});
