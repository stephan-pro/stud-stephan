import { describe, expect, it } from "vitest";
import type { CatalogItem } from "../backend/catalog";
import { aWish } from "./fixtures";
import { manufacturerFromName } from "./linkForm";
import {
  formFromWish,
  newWish,
  newWishValues,
  wishForSource,
  wishSourceOfItem,
  wishSourceOfPage,
  withCatalogEntry,
} from "./wishForm";

// P15: the gaps from P12 – a wish straight from the capture sheet (number, search, link) and a set
// received from the wishlist that gets its figures like a set from the catalog.

const CONTEXT = { id: "wish-1", createdAt: "2026-11-01T10:00:00Z" };

const SET: CatalogItem = {
  kind: "legoSet",
  number: "75372-1",
  name: "Clone Trooper & Battle Droid Battle Pack",
  year: 2024,
  theme: "Star Wars",
  pieceCount: 215,
  imageUrl: "https://img.bricklink.com/75372-1.png",
  figures: [
    { number: "sw1319", name: "Clone Trooper", quantity: 2 },
    { number: "sw1320", name: "Battle Droid", quantity: 2, imageUrl: "https://img/sw1320.png" },
  ],
};

describe("P15 Wunsch direkt aus dem Erfassen-Blatt", () => {
  it("P15 Ein Katalogeintrag (Nummer oder Suche) wird ein Wunsch mit Nummer, Thema und Bild", () => {
    const source = wishSourceOfItem(SET);
    const wish = newWish(source, newWishValues("legoSet"), CONTEXT);
    expect(wish).toMatchObject({
      type: "legoSet",
      name: SET.name,
      setNumber: "75372-1",
      theme: "Star Wars",
      imageUrl: SET.imageUrl,
      manufacturer: { kind: "lego" },
      desiredCondition: "new",
      links: [],
    });
  });

  it("P15 Eine Figur, deren BrickLink-Nummer der Katalog nicht fand, wird ein Wunsch ohne Nummer", () => {
    const source = wishSourceOfItem({ kind: "minifig", number: "", name: "Clone Trooper" });
    const wish = newWish(source, newWishValues("minifig"), CONTEXT);
    expect(wish.bricklinkId).toBeUndefined();
    expect(wish.desiredCondition).toBe("used");
  });

  it("P15 Über einen Rebrickable- oder BrickLink-Link bleibt der Link am Wunsch", () => {
    const link = "https://rebrickable.com/sets/75372-1/";
    expect(newWish(wishSourceOfItem(SET, link), newWishValues("legoSet"), CONTEXT).links).toEqual([
      link,
    ]);
  });

  it("P15 Eine gelesene Seite wird ein Wunsch mit Name, Setnummer, Hersteller, Bild und Link", () => {
    const link = "https://www.merlinssteine.de/sets/bb-109580/";
    const source = wishSourceOfPage(
      "legoSet",
      {
        name: "Sternenzerstörer",
        manufacturer: "BlueBrixx",
        setNumber: "109580",
        imageUrl: "https://merlin/109580.jpg",
      },
      link,
    );
    expect(newWish(source, newWishValues("legoSet"), CONTEXT)).toMatchObject({
      name: "Sternenzerstörer",
      setNumber: "109580",
      manufacturer: { kind: "bluebrixx" },
      imageUrl: "https://merlin/109580.jpg",
      links: [link],
    });
  });

  it("P15 Ohne Namen heißt der Wunsch nach der Seite; eine Nummer zählt nur bei Sets", () => {
    const source = wishSourceOfPage("minifig", { setNumber: "123" }, "https://shop.example/fig");
    expect(source.name).toBe("shop.example");
    expect(source.number).toBeUndefined();
    expect(source.manufacturer).toBeUndefined();
    expect(wishSourceOfPage("legoSet", {}, "kein Link").name).toBe("kein Link");
  });

  it("P15 Steht dieselbe Nummer schon auf der Wunschliste, wird kein zweiter Wunsch angelegt", () => {
    const figure = aWish({ id: "w-fig", type: "minifig", bricklinkId: "SW0194" });
    const set = aWish({ id: "w-set", type: "legoSet", setNumber: "75372" });
    const list = [figure, set];
    expect(wishForSource(list, { type: "minifig", name: "Rex", number: "sw0194" })).toBe(figure);
    expect(wishForSource(list, { type: "legoSet", name: "Pack", number: "75372-1" })).toBe(set);
    expect(wishForSource(list, { type: "legoSet", name: "Pack" })).toBeUndefined();
    expect(wishForSource(list, { type: "minifig", name: "Rex" })).toBeUndefined();
    expect(
      wishForSource([aWish({ type: "legoSet" })], { type: "legoSet", name: "x", number: "1" }),
    ).toBeUndefined();
  });

  it("P15 Herstellernamen einer Seite: BlueBrixx und LEGO erkannt, andere mit Namen", () => {
    expect(manufacturerFromName(" bluebrixx ")).toEqual({ kind: "bluebrixx" });
    expect(manufacturerFromName("LEGO")).toEqual({ kind: "lego" });
    expect(manufacturerFromName("Cobi")).toEqual({ kind: "other", name: "Cobi" });
  });
});

describe("P15 Erhaltenes Set bekommt seine Figuren aus dem Katalog", () => {
  it("P15 Ein erhaltenes Set hat danach seine enthaltenen Figuren wie ein Set aus dem Katalog", () => {
    const wish = aWish({
      type: "legoSet",
      name: "Mein Battle Pack",
      setNumber: "75372",
      theme: "Star Wars – The Clone Wars",
    });
    const form = withCatalogEntry(formFromWish(wish), SET);
    expect(form.extras.figures).toEqual([
      { name: "Clone Trooper", bricklinkId: "sw1319", quantity: 2 },
      {
        name: "Battle Droid",
        bricklinkId: "sw1320",
        quantity: 2,
        imageUrl: "https://img/sw1320.png",
      },
    ]);
    expect(form.values).toMatchObject({
      name: "Mein Battle Pack",
      number: "75372",
      theme: "Star Wars – The Clone Wars",
      year: "2024",
      pieceCount: "215",
      minifigCount: "4",
    });
    expect(form.prefilled).toEqual(expect.arrayContaining(["year", "pieceCount", "minifigCount"]));
    expect(form.extras.imageUrl).toBe(SET.imageUrl);
    expect(form.origin).toBe("wish");
  });

  it("P15 Das Bild des Wunsches bleibt vor dem Katalogbild", () => {
    const wish = aWish({ type: "legoSet", setNumber: "75372", imageUrl: "https://own.png" });
    expect(withCatalogEntry(formFromWish(wish), SET).extras.imageUrl).toBe("https://own.png");
  });
});
