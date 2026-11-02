import { describe, expect, it } from "vitest";
import { figuresInDiorama } from "../domain/dioramas";
import { formatMoney, formatMoneyDifference } from "../domain/money";
import { figuresNotOnDisplay } from "../domain/placement";
import { itemsToPrice } from "../domain/prices";
import { seriesProgress } from "../domain/series";
import { groupCopies, NO_FILTER, showcase } from "../domain/showcase";
import { totals } from "../domain/totals";
import { SCHEMA_VERSION } from "../domain/types";
import { isModified, modSpend, valueOfItem } from "../domain/value";
import { arrangeWishlist, wishStatus } from "../domain/wishlist";
import { DEMO_COLLECTION, DEMO_SERIES, DEMO_TODAY } from "./collection";

const demo = DEMO_COLLECTION;
const euro = (text: string) => text.replace(/ €/g, " €");
const byId = <T extends { id: string }>(items: T[], id: string): T => {
  const item = items.find((entry) => entry.id === id);
  if (!item) throw new Error(`missing ${id}`);
  return item;
};

describe("P3 Demo-Daten passen zum Klick-Dummy", () => {
  it("P3 Captain Rex: 38,50 € gebraucht, neu 52,00 €, Kaufpreis 25,00 €, +13,50 €, Mods 14,50 €", () => {
    const rex = byId(demo.minifigs, "minifig-rex");
    const value = valueOfItem(rex, demo.prices);
    expect(formatMoney(value.cents)).toBe(euro("38,50 €"));
    expect(value.asOf).toBe("2026-10-27");
    expect(value.otherCondition && formatMoney(value.otherCondition.cents)).toBe(euro("52,00 €"));
    expect(formatMoneyDifference(value.difference ?? 0)).toBe(euro("+13,50 €"));
    expect(isModified(rex)).toBe(true);
    expect(formatMoney(modSpend(rex))).toBe(euro("14,50 €"));
  });

  it("P3 Vitrine: Clone Trooper Phase II ×3 zu 6,20 €, Fives nicht ausgestellt zu 24,00 €", () => {
    const groups = groupCopies(demo.minifigs);
    const troopers = groups.find((group) => group.copies[0]?.name === "Clone Trooper Phase II");
    expect(troopers?.copies).toHaveLength(3);
    expect(troopers?.copies[0] && valueOfItem(troopers.copies[0], demo.prices).cents).toBe(620);
    const fives = byId(demo.minifigs, "minifig-fives");
    expect(fives.dioramaId).toBeUndefined();
    expect(valueOfItem(fives, demo.prices).cents).toBe(2400);
  });

  it("P3 Set 75372: Figuren entnommen, 21,00 €, Kaufpreis 19,99 €, +1,01 €, neu 27,50 €", () => {
    const [set] = demo.sets;
    expect(set?.status).toBe("figuresRemoved");
    const value = set && valueOfItem(set, demo.prices);
    expect(value).toMatchObject({ cents: 2100, difference: 101 });
    expect(value?.otherCondition?.cents).toBe(2750);
  });

  it("P3 Sammelmünze (GWP): 9,90 € selbst geschätzt, eingetragen am 12.05.2025", () => {
    const [coin] = demo.specialParts;
    expect(coin && valueOfItem(coin, demo.prices)).toMatchObject({
      cents: 990,
      kind: "manual",
      asOf: "2025-05-12",
    });
  });

  it("P3 Umbara-Gefecht hat 6 Figuren und zwei Studio-Dateien", () => {
    const umbara = byId(demo.dioramas, "diorama-umbara");
    expect(figuresInDiorama(demo, umbara.id)).toHaveLength(6);
    expect(umbara.studioFiles.map((file) => file.fileName)).toEqual([
      "umbara-gefecht-v3.io",
      "umbara-gefecht-v2.io",
    ]);
    expect(figuresNotOnDisplay(demo).map((minifig) => minifig.name)).toEqual([
      "ARC Trooper Fives",
      "Wookiee-Krieger",
      "Kai",
      "Clone Medic",
    ]);
  });

  it("P3 Wunschliste: Commander Cody hat den Zielpreis erreicht (18,90 € ≤ 20,00 €)", () => {
    const cody = byId(demo.wishlist, "wish-cody");
    expect(wishStatus(cody, demo.prices)).toMatchObject({
      marketPrice: { cents: 1890 },
      targetReached: true,
    });
    const { reached, others } = arrangeWishlist(demo.wishlist, demo.prices, "priority");
    expect(reached.map((wish) => wish.name)).toEqual(["Commander Cody"]);
    expect(others.map((wish) => wish.name)).toEqual([
      "Ahsoka Tano",
      "Republic Gunship",
      "Battle Droid",
    ]);
  });

  it("P3 Reihe Clone Wars: vorhanden, fehlend und gewünscht kommen vor", () => {
    const progress = seriesProgress(DEMO_SERIES.figures, demo.minifigs, demo.wishlist);
    expect(progress).toMatchObject({ total: 8, present: 3, missing: 5, wished: 3 });
  });

  it("P3 Summen: Wert, „ohne Wert“ und Anzahl je Objektart", () => {
    const sum = totals(demo);
    expect(sum.counts).toEqual({ minifigs: 15, sets: 1, specialParts: 1, dioramas: 3 });
    expect(sum.withoutValue).toBe(1);
    expect(sum.modSpend).toBe(1450);
    expect(sum.themes[0]).toEqual({ theme: "Star Wars", count: 14 });
    expect(sum.value).toBeGreaterThan(sum.purchase);
  });

  it("P3 Die Vitrine zeigt neueste zuerst: Captain Rex vorn", () => {
    const [first] = showcase(demo, NO_FILTER, "recent");
    expect(first?.type === "minifig" && first.copies[0]?.name).toBe("Captain Rex");
  });

  it("P3 Die Demo-Daten sind in sich stimmig", () => {
    expect(demo.schemaVersion).toBe(SCHEMA_VERSION);
    const all = [
      ...demo.minifigs,
      ...demo.sets,
      ...demo.specialParts,
      ...demo.dioramas,
      ...demo.wishlist,
    ];
    expect(new Set(all.map((item) => item.id)).size).toBe(all.length);
    const dioramas = new Set(demo.dioramas.map((diorama) => diorama.id));
    const sets = new Set(demo.sets.map((set) => set.id));
    for (const minifig of demo.minifigs) {
      if (minifig.dioramaId) expect(dioramas).toContain(minifig.dioramaId);
      if (minifig.fromSet?.setId) expect(sets).toContain(minifig.fromSet.setId);
    }
    // Every official item with a number has a price, and no price is newer than "today".
    const priced = new Set(demo.prices.map((point) => `${point.itemType}:${point.bricklinkId}`));
    for (const item of itemsToPrice(demo)) {
      expect(priced).toContain(`${item.itemType}:${item.bricklinkId}`);
    }
    expect(demo.prices.every((point) => point.date <= DEMO_TODAY)).toBe(true);
    const createdAt = all.map((item) => item.createdAt.slice(0, 10));
    expect(createdAt.every((day) => day <= DEMO_TODAY)).toBe(true);
  });
});
