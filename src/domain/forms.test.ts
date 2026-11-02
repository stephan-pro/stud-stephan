import { describe, expect, it } from "vitest";
import { aMinifig, aSet, aSpecialPart } from "./fixtures";
import {
  acquiredText,
  buildItem,
  buildMod,
  emptyForm,
  emptyMod,
  fieldsOf,
  firstError,
  firstModError,
  formForCopy,
  formFromItem,
  linesOf,
  modDraftOf,
  parseAcquired,
  validateForm,
  validateMod,
  webAddress,
} from "./forms";
import type { LegoSet, Minifig } from "./types";

const context = (extra: Partial<Parameters<typeof buildItem>[2]> = {}) => ({
  id: "minifig-new",
  createdAt: "2026-11-01T10:00:00.000Z",
  today: "2026-11-01",
  sets: [] as LegoSet[],
  ...extra,
});

const filled = (fields: Partial<ReturnType<typeof emptyForm>> = {}) => ({
  ...emptyForm(),
  name: "Captain Rex",
  ...fields,
});

describe("F4 Prüfung der Formulare", () => {
  it("F4 Ohne Namen lässt sich nichts speichern", () => {
    expect(validateForm("minifig", emptyForm())).toEqual({ name: "required" });
    expect(validateForm("minifig", filled({ name: "   " }))).toEqual({ name: "required" });
    expect(validateForm("minifig", filled())).toEqual({});
  });

  it("F4 Ein zu langer Name oder Text wird abgelehnt", () => {
    expect(validateForm("minifig", filled({ name: "x".repeat(201) })).name).toBe("tooLong");
    expect(validateForm("minifig", filled({ theme: "x".repeat(201) })).theme).toBe("tooLong");
    expect(validateForm("minifig", filled({ number: "x".repeat(101) })).number).toBe("tooLong");
    expect(validateForm("minifig", filled({ source: "x".repeat(501) })).source).toBe("tooLong");
    expect(validateForm("minifig", filled({ note: "x".repeat(5001) })).note).toBe("tooLong");
    expect(validateForm("minifig", filled({ fromSet: "x".repeat(101) })).fromSet).toBe("tooLong");
  });

  it("F4 Ein anderer oder Custom-Hersteller braucht einen Namen", () => {
    expect(validateForm("minifig", filled({ manufacturerKind: "other" }))).toEqual({
      manufacturerName: "required",
    });
    expect(
      validateForm("minifig", filled({ manufacturerKind: "custom", manufacturerName: "Ab" })),
    ).toEqual({});
    expect(
      validateForm(
        "minifig",
        filled({ manufacturerKind: "other", manufacturerName: "x".repeat(101) }),
      ).manufacturerName,
    ).toBe("tooLong");
    // LEGO and Bluebrixx have a name of their own.
    expect(validateForm("minifig", filled({ manufacturerKind: "bluebrixx" }))).toEqual({});
  });

  it.each([
    ["25,00 €", true],
    ["25", true],
    ["1.240,50", true],
    ["", true],
    ["abc", false],
    ["-5", false],
    ["1,234", false],
  ])("F4 Kaufpreis „%s“ ist gültig: %s", (text, valid) => {
    const errors = validateForm("minifig", filled({ purchasePrice: text }));
    expect(errors.purchasePrice).toBe(valid ? undefined : "money");
  });

  it("F4 Der geschätzte Wert wird wie ein Preis geprüft", () => {
    expect(validateForm("specialPart", filled({ manualValue: "viel" })).manualValue).toBe("money");
    expect(validateForm("specialPart", filled({ manualValue: "12,50" }))).toEqual({});
  });

  it.each([
    ["03.2025", true],
    ["14.03.2025", true],
    ["3.2025", true],
    ["13.2025", false],
    ["31.02.2025", false],
    ["2025", false],
    ["03.1800", false],
    ["morgen", false],
  ])("F4 Erworben am „%s“ ist gültig: %s", (text, valid) => {
    expect(validateForm("minifig", filled({ acquired: text })).acquired).toBe(
      valid ? undefined : "month",
    );
  });

  it("F7 Jahr, Teilezahl und Figurenzahl eines Sets müssen ganze Zahlen im Rahmen sein", () => {
    expect(validateForm("legoSet", filled({ year: "1850" })).year).toBe("year");
    expect(validateForm("legoSet", filled({ year: "2024" }))).toEqual({});
    expect(validateForm("legoSet", filled({ pieceCount: "12,5" })).pieceCount).toBe("wholeNumber");
    expect(validateForm("legoSet", filled({ pieceCount: "1203" }))).toEqual({});
    expect(validateForm("legoSet", filled({ minifigCount: "-1" })).minifigCount).toBe(
      "wholeNumber",
    );
    expect(validateForm("legoSet", filled({ minifigCount: "5000" })).minifigCount).toBe(
      "wholeNumber",
    );
  });

  it("F5 Felder, die ein Formular nicht zeigt, können dort nicht falsch sein", () => {
    // A figure has no year; a stray value from another form never blocks saving.
    expect(validateForm("minifig", filled({ year: "abc", pieceCount: "x" }))).toEqual({});
    expect(validateForm("specialPart", filled({ fromSet: "x".repeat(200) }))).toEqual({});
  });

  it("F4 Links müssen Webadressen sein, einer pro Zeile", () => {
    expect(validateForm("minifig", filled({ links: "https://rebrickable.com/mocs/x" }))).toEqual(
      {},
    );
    expect(
      validateForm("minifig", filled({ links: "https://a.de\n\njavascript:alert(1)" })),
    ).toEqual({ links: "url" });
    expect(validateForm("minifig", filled({ links: "ohne Adresse" })).links).toBe("url");
    const many = Array.from({ length: 21 }, (_, index) => `https://a.de/${index}`).join("\n");
    expect(validateForm("minifig", filled({ links: many })).links).toBe("tooLong");
    expect(
      validateForm("minifig", filled({ links: `https://a.de/${"x".repeat(500)}` })).links,
    ).toBe("tooLong");
  });

  it("F4 Der Fokus geht auf das erste falsche Feld in der Reihenfolge der Seite", () => {
    const errors = validateForm(
      "minifig",
      filled({ name: "", purchasePrice: "x", acquired: "y", note: "x".repeat(6000) }),
    );
    expect(firstError("minifig", errors)).toBe("name");
    expect(firstError("minifig", { purchasePrice: "money", acquired: "month" })).toBe("acquired");
    expect(firstError("minifig", {})).toBeUndefined();
    expect(fieldsOf("legoSet")).toContain("year");
    expect(fieldsOf("minifig")).not.toContain("year");
  });
});

describe("Hilfen für Adressen, Zeilen und Monate", () => {
  it("F4 Nur http und https gelten als Webadresse", () => {
    expect(webAddress(" https://a.de/x ")).toBe("https://a.de/x");
    expect(webAddress("http://a.de")).toBe("http://a.de/");
    expect(webAddress("javascript:alert(1)")).toBeUndefined();
    expect(webAddress("a.de")).toBeUndefined();
    expect(webAddress(undefined)).toBeUndefined();
    expect(webAddress("")).toBeUndefined();
  });

  it("F4 Links: eine Adresse pro Zeile, ohne leere Zeilen und Doppelte", () => {
    expect(linesOf("a\r\n\n b \na")).toEqual(["a", "b"]);
  });

  it("F5 „Erworben“ wird als Monat oder Tag gelesen und so wieder angezeigt", () => {
    expect(parseAcquired("03.2025")).toBe("2025-03-01");
    expect(parseAcquired("14.3.2025")).toBe("2025-03-14");
    expect(parseAcquired("00.2025")).toBeUndefined();
    expect(acquiredText("2025-03-01")).toBe("03.2025");
    expect(acquiredText("2025-03-14")).toBe("14.03.2025");
    expect(acquiredText(undefined)).toBe("");
    expect(acquiredText("kaputt")).toBe("kaputt");
    // A day is not lost by editing.
    expect(parseAcquired(acquiredText("2025-03-14"))).toBe("2025-03-14");
  });
});

describe("F5 Aus dem Formular wird eine Figur", () => {
  it("F5 Eine Figur mit allen Feldern", () => {
    const item = buildItem(
      "minifig",
      filled({
        number: " sw0194 ",
        theme: "Star Wars – The Clone Wars",
        condition: "used",
        source: "BrickLink-Händler",
        acquired: "03.2025",
        purchasePrice: "25,00 €",
        manualValue: "30",
        links: "https://a.de\nhttps://b.de",
        note: " Steht vorne. ",
        photos: ["u1/minifig-new/photo-1.webp"],
      }),
      context(),
    );
    expect(item).toEqual({
      type: "minifig",
      id: "minifig-new",
      name: "Captain Rex",
      bricklinkId: "sw0194",
      manufacturer: { kind: "lego" },
      theme: "Star Wars – The Clone Wars",
      condition: "used",
      source: "BrickLink-Händler",
      acquiredOn: "2025-03-01",
      purchasePrice: 2500,
      manualValue: { cents: 3000, enteredOn: "2026-11-01" },
      photos: ["u1/minifig-new/photo-1.webp"],
      links: ["https://a.de", "https://b.de"],
      note: "Steht vorne.",
      mods: [],
      createdAt: "2026-11-01T10:00:00.000Z",
    });
  });

  it("Der Bildausschnitt wird mit den Fotos gespeichert, nur für gelistete Fotos und nicht die Mitte", () => {
    const item = buildItem(
      "minifig",
      filled({
        photos: ["a.webp", "b.webp"],
        photoFocus: {
          "a.webp": { x: 30, y: 70 },
          "b.webp": { x: 50, y: 50 },
          "gone.webp": { x: 1, y: 1 },
        },
      }),
      context(),
    );
    expect(item.photoFocus).toEqual({ "a.webp": { x: 30, y: 70 } });
    expect(buildItem("minifig", filled({ photos: ["a.webp"] }), context())).not.toHaveProperty(
      "photoFocus",
    );
    expect(formFromItem(item).photoFocus).toEqual({ "a.webp": { x: 30, y: 70 } });
  });

  it("F4 Leere Felder werden nicht gespeichert", () => {
    const item = buildItem("minifig", filled(), context());
    expect(Object.keys(item).sort()).toEqual(
      [
        "condition",
        "createdAt",
        "id",
        "links",
        "manufacturer",
        "mods",
        "name",
        "photos",
        "type",
      ].sort(),
    );
  });

  it("F5 Ein Hersteller mit Namen behält ihn, LEGO bekommt keinen", () => {
    expect(
      buildItem(
        "minifig",
        filled({ manufacturerKind: "custom", manufacturerName: " Brick Arms " }),
        context(),
      ).manufacturer,
    ).toEqual({ kind: "custom", name: "Brick Arms" });
    expect(
      buildItem(
        "minifig",
        filled({ manufacturerKind: "lego", manufacturerName: "übrig" }),
        context(),
      ).manufacturer,
    ).toEqual({ kind: "lego" });
  });

  it("F5 „Stammt aus Set“ verknüpft das Set der eigenen Sammlung, mit oder ohne „-1“", () => {
    const set = aSet({ id: "set-a", setNumber: "75372-1" });
    for (const text of ["75372-1", "75372"]) {
      const item = buildItem("minifig", filled({ fromSet: text }), context({ sets: [set] }));
      expect((item as Minifig).fromSet).toEqual({ label: text, setId: "set-a" });
    }
    const unknown = buildItem("minifig", filled({ fromSet: "99999-1" }), context({ sets: [set] }));
    expect((unknown as Minifig).fromSet).toEqual({ label: "99999-1" });
    const none = buildItem("minifig", filled({ fromSet: "  " }), context({ sets: [set] }));
    expect((none as Minifig).fromSet).toBeUndefined();
  });

  it("F6 Die Mod-Teile kommen in die Figur, ihr Preis zählt nicht zum Kaufpreis", () => {
    const mods = [
      { id: "m1", position: "arms" as const, description: "Bedruckt", price: 600 },
      { id: "m2", position: "headgear" as const, description: "Helm", price: 850 },
    ];
    const item = buildItem("minifig", filled({ purchasePrice: "25", mods }), context()) as Minifig;
    expect(item.mods).toEqual(mods);
    expect(item.purchasePrice).toBe(2500);
  });
});

describe("F4 Bearbeiten lässt unberührt, was das Formular nicht zeigt", () => {
  const existing = aMinifig({
    id: "minifig-old",
    name: "Alt",
    dioramaId: "diorama-1",
    catalogImageUrl: "https://img.example/x.png",
    createdAt: "2026-01-01T00:00:00Z",
    manualValue: { cents: 3000, enteredOn: "2026-05-05" },
    acquiredOn: "2025-03-14",
  });

  it("F4 Kennung, Anlegezeit, Diorama und Katalogbild bleiben", () => {
    const form = formFromItem(existing);
    const item = buildItem(
      "minifig",
      { ...form, name: "Neu" },
      context({ id: "minifig-old", existing }),
    );
    expect(item).toMatchObject({
      id: "minifig-old",
      name: "Neu",
      dioramaId: "diorama-1",
      catalogImageUrl: "https://img.example/x.png",
      createdAt: "2026-01-01T00:00:00Z",
    });
  });

  it("F10 Ein unveränderter geschätzter Wert behält seinen Tag, ein geänderter bekommt heute", () => {
    const form = formFromItem(existing);
    expect(form.manualValue).toBe("30,00");
    const same = buildItem("minifig", form, context({ existing })) as Minifig;
    expect(same.manualValue).toEqual({ cents: 3000, enteredOn: "2026-05-05" });
    const changed = buildItem("minifig", { ...form, manualValue: "35" }, context({ existing }));
    expect(changed.manualValue).toEqual({ cents: 3500, enteredOn: "2026-11-01" });
    const removed = buildItem("minifig", { ...form, manualValue: "" }, context({ existing }));
    expect(removed.manualValue).toBeUndefined();
  });

  it("F4 Ein Tag in „Erworben“ geht beim Bearbeiten nicht verloren", () => {
    const form = formFromItem(existing);
    expect(form.acquired).toBe("14.03.2025");
    expect(buildItem("minifig", form, context({ existing })).acquiredOn).toBe("2025-03-14");
  });

  it("F5 Das Formular einer Figur zeigt „Stammt aus Set“ aus dem Katalog oder dem eigenen Set", () => {
    const set = aSet({ id: "set-a", setNumber: "75372-1" });
    const linkedOnly = aMinifig({ fromSet: { setId: "set-a" } });
    expect(formFromItem(linkedOnly, [set]).fromSet).toBe("75372");
    expect(
      formFromItem(aMinifig({ fromSet: { label: "75372-1", setId: "set-a" } }), [set]).fromSet,
    ).toBe("75372-1");
    expect(formFromItem(aMinifig(), [set]).fromSet).toBe("");
  });

  it("F5 Das Formular einer Figur zeigt Hersteller mit Namen und die Mod-Teile als Kopie", () => {
    const mods = [{ id: "m1", position: "arms" as const, description: "x" }];
    const figure = aMinifig({ manufacturer: { kind: "custom", name: "Brick Arms" }, mods });
    const form = formFromItem(figure);
    expect(form).toMatchObject({ manufacturerKind: "custom", manufacturerName: "Brick Arms" });
    expect(form.mods).toEqual(mods);
    expect(form.mods[0]).not.toBe(mods[0]);
  });

  it("F5 „Weiteres Exemplar anlegen“ übernimmt die Katalogdaten, nicht die Besonderheiten", () => {
    const original = aMinifig({
      name: "Captain Rex",
      bricklinkId: "sw0194",
      theme: "Star Wars",
      condition: "used",
      source: "Händler",
      purchasePrice: 2500,
      note: "Notiz",
      photos: ["u/p.webp"],
      mods: [{ id: "m1", position: "arms", description: "x" }],
      fromSet: { label: "75372-1" },
    });
    const form = formForCopy(original);
    expect(form).toMatchObject({
      name: "Captain Rex",
      number: "sw0194",
      theme: "Star Wars",
      manufacturerKind: "lego",
      fromSet: "75372-1",
      condition: "new",
      source: "",
      purchasePrice: "",
      note: "",
      photos: [],
      mods: [],
    });
  });
});

describe("F7 Sets", () => {
  it("F7 Ein Set mit Nummer, Jahr, Zahlen und Status", () => {
    const item = buildItem(
      "legoSet",
      filled({
        name: "Battle Pack",
        number: "75372-1",
        status: "figuresRemoved",
        year: "2024",
        pieceCount: "215",
        minifigCount: "4",
        condition: "new",
      }),
      context({ id: "set-new" }),
    );
    expect(item).toMatchObject({
      type: "legoSet",
      setNumber: "75372-1",
      status: "figuresRemoved",
      year: 2024,
      pieceCount: 215,
      minifigCount: 4,
      containedFigures: [],
    });
  });

  it("F7 Beim Bearbeiten bleiben die enthaltenen Figuren aus dem Katalog", () => {
    const existing = aSet({
      containedFigures: [{ name: "Clone Trooper", bricklinkId: "sw0001" }],
      year: 2024,
    });
    const form = formFromItem(existing);
    expect(form).toMatchObject({ number: "75372-1", status: "complete", year: "2024" });
    const item = buildItem("legoSet", form, context({ id: existing.id, existing }));
    expect((item as LegoSet).containedFigures).toEqual(existing.containedFigures);
  });

  it("F7 Ein Set ohne Zahlen speichert keine Zahlen", () => {
    const item = buildItem("legoSet", filled({ name: "Set" }), context()) as LegoSet;
    expect(item.year).toBeUndefined();
    expect(item.pieceCount).toBeUndefined();
    expect(item.minifigCount).toBeUndefined();
    expect(item.setNumber).toBeUndefined();
    expect(formFromItem(aSet({ setNumber: undefined as never })).number).toBe("");
  });
});

describe("F9 Sonderteile", () => {
  it("F9 Art, Name, Nummer, Hersteller, Zustand, Quelle, Preis, Wert und Notiz", () => {
    const item = buildItem(
      "specialPart",
      filled({
        name: "Sammelmünze Jabba",
        kind: "coin",
        number: "5008818",
        manufacturerKind: "other",
        manufacturerName: "Anderer",
        condition: "new",
        purchasePrice: "5",
        manualValue: "9,50",
        note: "n",
      }),
      context({ id: "part-new" }),
    );
    expect(item).toMatchObject({
      type: "specialPart",
      kind: "coin",
      number: "5008818",
      manufacturer: { kind: "other", name: "Anderer" },
      purchasePrice: 500,
      manualValue: { cents: 950, enteredOn: "2026-11-01" },
    });
  });

  it("F9 Das Formular eines Sonderteils zeigt Art und Nummer", () => {
    const part = aSpecialPart({ kind: "gwp", number: "5008" });
    expect(formFromItem(part)).toMatchObject({ kind: "gwp", number: "5008" });
    expect(formFromItem(aSpecialPart()).number).toBe("");
  });

  describe("Sonderteil aus dem Katalog: BrickLink-Typ und Jahr", () => {
    const fromCatalog = {
      bricklink: { type: "GEAR" as const, number: "5010325" },
      imageUrl: "https://img.bricklink.com/ItemImage/GN/0/5010325.png",
    };
    const card = filled({ name: "Metal Card", number: "5010325", year: "2026" });

    it("Typ und Nummer aus dem Katalog bleiben am Sonderteil, dazu das Jahr", () => {
      const item = buildItem("specialPart", card, context({ catalog: fromCatalog }));
      expect(item).toMatchObject({
        type: "specialPart",
        number: "5010325",
        bricklinkType: "GEAR",
        year: 2026,
        catalogImageUrl: fromCatalog.imageUrl,
      });
    });

    it("Wird die Nummer im Formular geändert, fällt der Typ weg; Groß-/Kleinschreibung zählt nicht", () => {
      const other = buildItem(
        "specialPart",
        { ...card, number: "5010326" },
        context({ catalog: fromCatalog }),
      );
      expect(other).not.toHaveProperty("bricklinkType");
      const spaced = buildItem(
        "specialPart",
        { ...card, number: " 5010325 " },
        context({ catalog: fromCatalog }),
      );
      expect(spaced).toMatchObject({ bricklinkType: "GEAR" });
      const noNumber = buildItem(
        "specialPart",
        { ...card, number: "" },
        context({ catalog: fromCatalog }),
      );
      expect(noNumber).not.toHaveProperty("bricklinkType");
      expect(noNumber).not.toHaveProperty("number");
    });

    it("Von Hand angelegt hat ein Sonderteil keinen Typ und kein Jahr", () => {
      const item = buildItem("specialPart", filled({ number: "5010325" }), context());
      expect(item).not.toHaveProperty("bricklinkType");
      expect(item).not.toHaveProperty("year");
    });

    it("Beim Bearbeiten bleibt der Typ, solange die Nummer dieselbe ist, und das Jahr lässt sich ändern", () => {
      const existing = aSpecialPart({ number: "5010325", bricklinkType: "GEAR", year: 2026 });
      const form = formFromItem(existing);
      expect(form).toMatchObject({ number: "5010325", year: "2026" });
      expect(buildItem("specialPart", form, context({ existing }))).toMatchObject({
        bricklinkType: "GEAR",
        year: 2026,
      });
      expect(
        buildItem("specialPart", { ...form, year: "2025" }, context({ existing })),
      ).toMatchObject({ bricklinkType: "GEAR", year: 2025 });
      const changed = buildItem("specialPart", { ...form, number: "77" }, context({ existing }));
      expect(changed).not.toHaveProperty("bricklinkType");
    });

    it("Das Jahr wird nur bei Sets und Sonderteilen geprüft", () => {
      expect(validateForm("specialPart", filled({ year: "1800" })).year).toBe("year");
      expect(validateForm("specialPart", filled({ year: "2026" }))).toEqual({});
    });
  });
});

describe("F6 Mod-Teile", () => {
  it("F6 Position und Beschreibung sind Pflicht, der Rest ist freiwillig", () => {
    expect(validateMod(emptyMod())).toEqual({ position: "required", description: "required" });
    const draft = { ...emptyMod(), position: "arms" as const, description: "Bedruckt" };
    expect(validateMod(draft)).toEqual({});
  });

  it("F6 Preis und Link werden geprüft, zu lange Texte abgelehnt", () => {
    const draft = { ...emptyMod(), position: "head" as const, description: "x" };
    expect(validateMod({ ...draft, price: "viel" }).price).toBe("money");
    expect(validateMod({ ...draft, url: "kein Link" }).url).toBe("url");
    expect(validateMod({ ...draft, url: `https://a.de/${"x".repeat(500)}` }).url).toBe("tooLong");
    expect(validateMod({ ...draft, description: "x".repeat(201) }).description).toBe("tooLong");
    expect(validateMod({ ...draft, vendor: "x".repeat(101) }).vendor).toBe("tooLong");
    expect(validateMod({ ...draft, originalPart: "x".repeat(101) }).originalPart).toBe("tooLong");
    expect(firstModError({ price: "money", description: "required" })).toBe("description");
    expect(firstModError({})).toBeUndefined();
  });

  it("F6 Aus dem Entwurf wird ein Teil, aus dem Teil wieder ein Entwurf", () => {
    const part = buildMod(
      {
        position: "arms",
        description: " Bedruckt ",
        vendor: "Custom-Shop",
        url: "https://shop.de/arme",
        price: "6,00 €",
        originalPart: "Teilekiste",
      },
      "mod-1",
    );
    expect(part).toEqual({
      id: "mod-1",
      position: "arms",
      description: "Bedruckt",
      vendor: "Custom-Shop",
      url: "https://shop.de/arme",
      price: 600,
      originalPart: "Teilekiste",
    });
    expect(modDraftOf(part)).toEqual({
      position: "arms",
      description: "Bedruckt",
      vendor: "Custom-Shop",
      url: "https://shop.de/arme",
      price: "6,00",
      originalPart: "Teilekiste",
    });
    expect(buildMod({ ...emptyMod(), position: "head", description: "x" }, "m")).toEqual({
      id: "m",
      position: "head",
      description: "x",
    });
  });
});
