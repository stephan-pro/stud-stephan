import { describe, expect, it } from "vitest";
import { aPrice, aWish } from "./fixtures";
import { arrangeWishlist, targetReached, wishStatus } from "./wishlist";

const priced = (cents: number, fields = {}) => {
  const wish = aWish({ bricklinkId: "sw0196", desiredCondition: "used", ...fields });
  return { wish, prices: [aPrice("sw0196", "2026-10-27", { used: cents, new: 9999 })] };
};

describe("F14 Zielpreis erreicht", () => {
  it("F14 Zielpreis 20 €, Marktpreis 19,50 € → „Zielpreis erreicht“; Marktpreis 20,01 € → keine Markierung", () => {
    const below = priced(1950, { targetPrice: 2000 });
    const above = priced(2001, { targetPrice: 2000 });
    expect(wishStatus(below.wish, below.prices).targetReached).toBe(true);
    expect(wishStatus(above.wish, above.prices).targetReached).toBe(false);
  });

  it("F14 Marktpreis genau auf dem Zielpreis → „Zielpreis erreicht“", () => {
    const equal = priced(2000, { targetPrice: 2000 });
    expect(wishStatus(equal.wish, equal.prices).targetReached).toBe(true);
  });

  it("F14 Kein Zielpreis oder kein Marktpreis → keine Markierung", () => {
    const noTarget = priced(1950);
    expect(wishStatus(noTarget.wish, noTarget.prices)).toEqual({
      marketPrice: { cents: 1950, date: "2026-10-27" },
      targetReached: false,
    });
    expect(wishStatus(aWish({ targetPrice: 2000 }), [])).toEqual({ targetReached: false });
    expect(targetReached(undefined, undefined)).toBe(false);
    expect(targetReached(2000, undefined)).toBe(false);
    expect(targetReached(undefined, 1950)).toBe(false);
  });

  it("F14 Es zählt der Marktpreis im gewünschten Zustand", () => {
    const wantsNew = priced(1950, { targetPrice: 2000, desiredCondition: "new" });
    expect(wishStatus(wantsNew.wish, wantsNew.prices)).toMatchObject({
      marketPrice: { cents: 9999 },
      targetReached: false,
    });
  });

  it("F14 Wünsche anderer Hersteller haben keinen Marktpreis", () => {
    const bluebrixx = priced(1950, { targetPrice: 2000, manufacturer: { kind: "bluebrixx" } });
    expect(wishStatus(bluebrixx.wish, bluebrixx.prices)).toEqual({ targetReached: false });
  });
});

describe("F14 Wunschliste sortieren", () => {
  const prices = [
    aPrice("sw0196", "2026-10-27", { used: 1890 }),
    aPrice("sw0219", "2026-10-27", { used: 4100 }),
    aPrice("75021-1", "2026-10-27", { new: 14999 }, "legoSet"),
    aPrice("sw0001", "2026-10-27", { used: 340 }),
  ];
  const cody = aWish({ id: "cody", name: "Commander Cody", targetPrice: 2000, priority: "low" });
  const ahsoka = aWish({
    id: "ahsoka",
    name: "Ahsoka Tano",
    bricklinkId: "sw0219",
    priority: "high",
    targetPrice: 3000,
  });
  const gunship = aWish({
    id: "gunship",
    type: "legoSet",
    name: "Republic Gunship",
    setNumber: "75021-1",
    desiredCondition: "new",
    priority: "medium",
    targetPrice: 12000,
  });
  const droid = aWish({
    id: "droid",
    name: "Battle Droid",
    bricklinkId: "sw0001",
    priority: "low",
    targetPrice: 300,
  });
  const custom = aWish({
    id: "custom",
    name: "Clone Medic",
    manufacturer: { kind: "custom", name: "Shop" },
    priority: "high",
  });
  const items = [droid, gunship, cody, custom, ahsoka];
  const order = (sort: "priority" | "price" | "name") => {
    const { reached, others } = arrangeWishlist(items, prices, sort);
    return { reached: reached.map((item) => item.id), others: others.map((item) => item.id) };
  };

  it("F14 Liegt der Marktpreis auf oder unter dem Zielpreis, steht der Eintrag oben", () => {
    expect(order("priority").reached).toEqual(["cody"]);
  });

  it("F14 Sortierung nach Priorität (hoch · mittel · niedrig), dann Name", () => {
    expect(order("priority").others).toEqual(["ahsoka", "custom", "gunship", "droid"]);
  });

  it("F14 Sortierung nach Preis, günstigste zuerst, ohne Preis am Ende", () => {
    expect(order("price").others).toEqual(["droid", "ahsoka", "gunship", "custom"]);
  });

  it("F14 Sortierung nach Name", () => {
    expect(order("name").others).toEqual(["ahsoka", "droid", "custom", "gunship"]);
  });
});
