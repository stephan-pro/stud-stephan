import { describe, expect, it } from "vitest";
import type { CatalogItem } from "../backend/catalog";
import { aMinifig, aWish } from "./fixtures";
import {
  formFromWish,
  newWish,
  newWishValues,
  targetCents,
  validateWish,
  wishableFigures,
  wishForFigure,
  wishSourceOfFigure,
  wishValuesOf,
  withWishValues,
} from "./wishForm";

const CONTEXT = { id: "wish-1", createdAt: "2026-11-03T10:00:00Z" };

describe("Figuren eines Katalog-Sets wünschen", () => {
  const item: CatalogItem = {
    kind: "legoSet",
    number: "75455-1",
    name: "Set",
    figures: [
      { number: "sw1", name: "Eins", quantity: 1 },
      { number: "sw2", name: "Zwei", quantity: 2 },
      { number: "sw3", name: "Drei", quantity: 1 },
    ],
  };

  it("Figuren sind als vorhanden (LEGO-Exemplar) und als gewünscht markiert", () => {
    const rows = wishableFigures(item, {
      minifigs: [
        aMinifig({ bricklinkId: "SW1" }),
        aMinifig({ bricklinkId: "sw3", manufacturer: { kind: "other", name: "X" } }),
      ],
      wishlist: [aWish({ bricklinkId: "sw2" })],
    });
    expect(rows.map((row) => [row.figure.bricklinkId, row.owned, row.wish !== undefined])).toEqual([
      ["sw1", true, false],
      ["sw2", false, true],
      ["sw3", false, false],
    ]);
  });

  it("Ein Set ohne Figurenliste gibt keine Zeilen", () => {
    const { figures: _, ...withoutFigures } = item;
    expect(wishableFigures(withoutFigures, { minifigs: [], wishlist: [] })).toEqual([]);
  });
});

describe("F14 Wunsch anlegen und bearbeiten", () => {
  it("F14 Ein neuer Wunsch beginnt mit Priorität mittel; Figuren gebraucht, Sets neu", () => {
    expect(newWishValues("minifig")).toMatchObject({ priority: "medium", condition: "used" });
    expect(newWishValues("legoSet")).toMatchObject({ priority: "medium", condition: "new" });
  });

  it("F14 Der Zielpreis ist freiwillig; ein Betrag wird in Cent gelesen, Unsinn abgelehnt", () => {
    const values = newWishValues("minifig");
    expect(validateWish(values)).toEqual({});
    expect(targetCents(values)).toBeUndefined();
    expect(targetCents({ ...values, targetPrice: "20,00 €" })).toBe(2000);
    expect(validateWish({ ...values, targetPrice: "20 Euro" })).toEqual({ targetPrice: "money" });
    expect(validateWish({ ...values, targetPrice: "-5" })).toEqual({ targetPrice: "money" });
    expect(validateWish({ ...values, note: "x".repeat(5001) })).toEqual({ note: "tooLong" });
  });

  it("F13 Aus einer fehlenden Reihen-Figur wird ein Wunsch mit Nummer, Reihe und Zielpreis", () => {
    const source = wishSourceOfFigure(
      { name: "Plo Koon", bricklinkId: "sw0225", imageUrl: "https://img/x.png" },
      { theme: "Star Wars – The Clone Wars", fromSeries: "Star Wars – The Clone Wars" },
    );
    const wish = newWish(
      source,
      { ...newWishValues("minifig"), priority: "high", targetPrice: "15,50", note: " Für Umbara " },
      CONTEXT,
    );
    expect(wish).toEqual({
      id: "wish-1",
      type: "minifig",
      name: "Plo Koon",
      bricklinkId: "sw0225",
      manufacturer: { kind: "lego" },
      theme: "Star Wars – The Clone Wars",
      priority: "high",
      targetPrice: 1550,
      desiredCondition: "used",
      imageUrl: "https://img/x.png",
      links: [],
      fromSeries: "Star Wars – The Clone Wars",
      note: "Für Umbara",
      createdAt: "2026-11-03T10:00:00Z",
    });
  });

  it("F14 Ein Wunsch für ein Set trägt die Setnummer statt der BrickLink-Nummer", () => {
    const wish = newWish(
      { type: "legoSet", name: "Gunship", number: "75021-1" },
      newWishValues("legoSet"),
      CONTEXT,
    );
    expect(wish).toMatchObject({ type: "legoSet", setNumber: "75021-1", desiredCondition: "new" });
    expect(wish).not.toHaveProperty("bricklinkId");
  });

  it("F14 Beim Bearbeiten ändern sich nur Priorität, Zielpreis, Zustand und Notiz; leer löscht", () => {
    const wish = aWish({
      targetPrice: 2000,
      note: "alt",
      fromSeries: "Reihe",
      links: ["https://a"],
    });
    const values = { ...wishValuesOf(wish), priority: "low" as const, targetPrice: "", note: "" };
    const changed = withWishValues(wish, values);
    expect(changed).toMatchObject({ priority: "low", fromSeries: "Reihe", links: ["https://a"] });
    expect(changed).not.toHaveProperty("targetPrice");
    expect(changed).not.toHaveProperty("note");
    expect(wishValuesOf(wish)).toMatchObject({ targetPrice: "20,00", note: "alt" });
  });

  it("F14 Man findet den Wunsch zu einer Figur über die Nummer, egal wie sie geschrieben ist", () => {
    const wishes = [aWish({ id: "a", bricklinkId: "SW0196" }), aWish({ id: "b", type: "legoSet" })];
    expect(wishForFigure(wishes, " sw0196 ")?.id).toBe("a");
    expect(wishForFigure(wishes, "sw9999")).toBeUndefined();
    expect(wishForFigure(wishes, undefined)).toBeUndefined();
  });

  it("F14 „Erhalten“ füllt das Formular aus dem Wunsch und merkt sich das Bild", () => {
    const wish = aWish({
      name: "Commander Cody",
      bricklinkId: "sw0196",
      theme: "Star Wars",
      desiredCondition: "used",
      imageUrl: "https://img/cody.png",
      note: "Für Umbara",
    });
    const form = formFromWish(wish);
    expect(form.values).toMatchObject({
      name: "Commander Cody",
      number: "sw0196",
      theme: "Star Wars",
      condition: "used",
      note: "Für Umbara",
      manufacturerKind: "lego",
    });
    expect(form.prefilled).toEqual(["name", "number", "theme", "note"]);
    expect(form.extras).toEqual({ imageUrl: "https://img/cody.png" });
    expect(form.origin).toBe("wish");
  });
});
