import { describe, expect, it } from "vitest";
import type { CatalogItem } from "../backend/catalog";
import { containedFigures, formFromCatalog } from "./catalog";
import { buildItem } from "./forms";

const REX: CatalogItem = {
  kind: "minifig",
  number: "sw0194",
  name: "Captain Rex",
  year: 2012,
  theme: "Star Wars – The Clone Wars",
  imageUrl: "https://img.bricklink.com/ItemImage/MN/0/sw0194.png",
  sets: [{ number: "75372-1", name: "Battle Pack" }],
};

const BATTLE_PACK: CatalogItem = {
  kind: "legoSet",
  number: "75372-1",
  name: "Clone Trooper & Battle Droid Battle Pack",
  year: 2024,
  theme: "Star Wars – Battle Packs",
  pieceCount: 215,
  imageUrl: "https://img.bricklink.com/ItemImage/SN/0/75372-1.png",
  figures: [
    {
      number: "sw1306",
      name: "Clone Trooper, 332nd Company",
      quantity: 2,
      imageUrl: "https://x.test/a.png",
    },
    { number: "sw1308", name: "Commander Bly", quantity: 1 },
  ],
};

const CONTEXT = {
  id: "minifig-1",
  createdAt: "2026-11-01T10:00:00Z",
  today: "2026-11-01",
  sets: [],
};

describe("P7 F2 Formular aus dem Katalog", () => {
  it("P7 F2 Eine Figur füllt Name, Katalognummer, Thema und das einzige Set aus", () => {
    const form = formFromCatalog(REX);
    expect(form.values).toMatchObject({
      name: "Captain Rex",
      number: "sw0194",
      theme: "Star Wars – The Clone Wars",
      fromSet: "75372",
      manufacturerKind: "lego",
      condition: "new",
    });
    expect(form.prefilled).toEqual(["name", "number", "theme", "fromSet"]);
    expect(form.extras).toEqual({ imageUrl: REX.imageUrl });
    expect(form.numberMissing).toBe(false);
  });

  it("P7 F2 Kommt die Figur in mehreren Sets vor, bleibt 'Stammt aus Set' leer und die Sets werden genannt", () => {
    const form = formFromCatalog({
      ...REX,
      sets: [
        { number: "75372-1", name: "A" },
        { number: "75345-1", name: "B" },
      ],
    });
    expect(form.values.fromSet).toBe("");
    expect(form.prefilled).not.toContain("fromSet");
    expect(form.sets.map((set) => set.number)).toEqual(["75372-1", "75345-1"]);
  });

  it("P7 F2 Ein Set füllt Name, Setnummer, Thema, Jahr, Teile und die Zahl der Figuren aus", () => {
    const form = formFromCatalog(BATTLE_PACK);
    expect(form.values).toMatchObject({
      name: "Clone Trooper & Battle Droid Battle Pack",
      number: "75372-1",
      theme: "Star Wars – Battle Packs",
      year: "2024",
      pieceCount: "215",
      minifigCount: "3",
    });
    expect(form.prefilled).toEqual([
      "name",
      "number",
      "theme",
      "year",
      "pieceCount",
      "minifigCount",
    ]);
    expect(form.sets).toEqual([]);
  });

  it("P7 F7 Die Figuren des Sets bleiben mit BrickLink-Nummer, Bild und Stückzahl am Set", () => {
    expect(containedFigures(BATTLE_PACK)).toEqual([
      {
        name: "Clone Trooper, 332nd Company",
        bricklinkId: "sw1306",
        quantity: 2,
        imageUrl: "https://x.test/a.png",
      },
      { name: "Commander Bly", bricklinkId: "sw1308", quantity: 1 },
    ]);
    const set = buildItem("legoSet", formFromCatalog(BATTLE_PACK).values, {
      ...CONTEXT,
      id: "set-1",
      catalog: formFromCatalog(BATTLE_PACK).extras,
    });
    expect(set).toMatchObject({
      type: "legoSet",
      setNumber: "75372-1",
      minifigCount: 3,
      catalogImageUrl: BATTLE_PACK.imageUrl,
    });
    expect(set.type === "legoSet" && set.containedFigures).toHaveLength(2);
  });

  it("Ein Sonderteil füllt Name, Nummer, Kategorie und Jahr aus und merkt sich den BrickLink-Typ", () => {
    const card: CatalogItem = {
      kind: "specialPart",
      number: "5010325",
      bricklinkType: "GEAR",
      name: "The Mandalorian and Grogu Metal Card",
      year: 2026,
      theme: "Gear – Miscellaneous",
      imageUrl: "https://img.bricklink.com/ItemImage/GN/0/5010325.png",
    };
    const form = formFromCatalog(card);
    expect(form.values).toMatchObject({
      name: "The Mandalorian and Grogu Metal Card",
      number: "5010325",
      theme: "Gear – Miscellaneous",
      year: "2026",
      manufacturerKind: "lego",
    });
    expect(form.prefilled).toEqual(["name", "number", "theme", "year"]);
    expect(form.extras).toEqual({
      imageUrl: card.imageUrl,
      bricklink: { type: "GEAR", number: "5010325" },
    });
    expect(form.sets).toEqual([]);
    expect(form.numberMissing).toBe(false);
    const part = buildItem("specialPart", form.values, {
      ...CONTEXT,
      id: "part-1",
      catalog: form.extras,
    });
    expect(part).toMatchObject({
      type: "specialPart",
      number: "5010325",
      bricklinkType: "GEAR",
      year: 2026,
      theme: "Gear – Miscellaneous",
      catalogImageUrl: card.imageUrl,
    });
  });

  it("Eine Big Fig füllt Name, Nummer, Thema, Set und merkt sich den Typ PART; die Figuren eines Sets behalten ihn", () => {
    const rancor: CatalogItem = {
      kind: "minifig",
      number: "11323pb01c01",
      bricklinkType: "PART",
      name: "Large Figure, Rancor",
      year: 2013,
      theme: "Large Figure",
      imageUrl: "https://img.bricklink.com/ItemImage/PN/0/11323pb01c01.png",
      sets: [{ number: "75005-1", name: "Rancor Pit" }],
    };
    const form = formFromCatalog(rancor);
    expect(form.values).toMatchObject({
      name: "Large Figure, Rancor",
      number: "11323pb01c01",
      theme: "Large Figure",
      fromSet: "75005",
    });
    expect(form.extras).toEqual({
      imageUrl: rancor.imageUrl,
      bricklink: { type: "PART", number: "11323pb01c01" },
    });
    const figure = buildItem("minifig", form.values, {
      ...CONTEXT,
      id: "minifig-rancor",
      catalog: form.extras,
    });
    expect(figure).toMatchObject({ bricklinkId: "11323pb01c01", bricklinkType: "PART" });

    const pit: CatalogItem = {
      kind: "legoSet",
      number: "75005-1",
      name: "Rancor Pit",
      figures: [
        { number: "sw0434", name: "Luke Skywalker", quantity: 1 },
        {
          number: "11323pb01c01",
          name: "Large Figure, Rancor",
          quantity: 1,
          bricklinkType: "PART",
        },
      ],
    };
    expect(containedFigures(pit)).toEqual([
      { name: "Luke Skywalker", bricklinkId: "sw0434", quantity: 1 },
      {
        name: "Large Figure, Rancor",
        bricklinkId: "11323pb01c01",
        quantity: 1,
        bricklinkType: "PART",
      },
    ]);
    // Big Figs count among the figures of the set.
    expect(formFromCatalog(pit).values.minifigCount).toBe("2");
  });

  it("Ein Eintrag ohne BrickLink-Typ (alter Zwischenspeicher) macht ein Sonderteil ohne Typ", () => {
    const form = formFromCatalog({ kind: "specialPart", number: "5010325", name: "Karte" });
    expect(form.extras).toEqual({});
  });

  it("P7 F2 Das Katalogbild kommt mit an die neue Figur", () => {
    const item = buildItem("minifig", formFromCatalog(REX).values, {
      ...CONTEXT,
      catalog: formFromCatalog(REX).extras,
    });
    expect(item).toMatchObject({
      type: "minifig",
      bricklinkId: "sw0194",
      catalogImageUrl: REX.imageUrl,
    });
  });

  it("P7 F2 Beim Bearbeiten bleiben Katalogbild und Figuren des Objekts, nicht die des Katalogs", () => {
    const existing = buildItem("legoSet", formFromCatalog(BATTLE_PACK).values, {
      ...CONTEXT,
      id: "set-1",
      catalog: formFromCatalog(BATTLE_PACK).extras,
    });
    const edited = buildItem("legoSet", formFromCatalog(BATTLE_PACK).values, {
      ...CONTEXT,
      id: "set-1",
      existing,
      catalog: { imageUrl: "https://anderes.test/x.png", figures: [] },
    });
    expect(edited).toMatchObject({ catalogImageUrl: BATTLE_PACK.imageUrl });
    expect(edited.type === "legoSet" && edited.containedFigures).toHaveLength(2);
  });

  it("P7 F2 Eine Figur, deren BrickLink-Nummer der Katalog nicht kennt, öffnet das Formular ohne Nummer", () => {
    const form = formFromCatalog({ kind: "minifig", number: "", name: "Unknown Person" });
    expect(form.values.number).toBe("");
    expect(form.prefilled).toEqual(["name"]);
    expect(form.numberMissing).toBe(true);
    expect(form.extras).toEqual({});
  });

  it("P7 F2 Ein Set ohne Angaben des Katalogs lässt die Felder leer", () => {
    const form = formFromCatalog({ kind: "legoSet", number: "1-1", name: "Mini" });
    expect(form.values).toMatchObject({ year: "", pieceCount: "", minifigCount: "", theme: "" });
    expect(form.prefilled).toEqual(["name", "number"]);
    expect(form.extras.figures).toEqual([]);
  });
});
