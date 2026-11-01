import { describe, expect, it } from "vitest";
import { formFromCatalog } from "./catalog";
import { buildItem, validateForm } from "./forms";
import { formFromLink, hasFields, linkRows } from "./linkForm";

// P9 F3: what a pasted link fills into a form, and what it leaves for the person.

const LINK = "https://www.merlinssteine.de/sets/bluebrixx-110374/";

describe("P9 F3 Formular aus einem Link", () => {
  it("F3 übernimmt Name, Hersteller, Setnummer, Teilezahl und Bild; der Link bleibt am Objekt", () => {
    const form = formFromLink("legoSet", LINK, {
      name: "Burgtor mit Zugbrücke",
      manufacturer: "BlueBrixx",
      setNumber: "110374",
      pieceCount: 1520,
      imageUrl: "https://www.merlinssteine.de/b.jpg",
    });
    expect(form.values).toMatchObject({
      name: "Burgtor mit Zugbrücke",
      manufacturerKind: "bluebrixx",
      number: "110374",
      pieceCount: "1520",
      links: LINK,
    });
    expect(form.prefilled).toEqual(["name", "number", "pieceCount"]);
    expect(form.extras).toEqual({ imageUrl: "https://www.merlinssteine.de/b.jpg" });
    expect(form.origin).toBe("link");

    const item = buildItem("legoSet", form.values, {
      id: "legoSet-1",
      createdAt: "2026-11-01T10:00:00.000Z",
      today: "2026-11-01",
      sets: [],
      existing: undefined,
      catalog: form.extras,
    });
    expect(item.links).toEqual([LINK]);
    expect(item).toMatchObject({ catalogImageUrl: "https://www.merlinssteine.de/b.jpg" });
  });

  it("F3 ein anderer Hersteller wird mit Namen eingetragen und grün markiert", () => {
    const form = formFromLink("legoSet", LINK, { name: "Schiff", manufacturer: "Cobi" });
    expect(form.values).toMatchObject({ manufacturerKind: "other", manufacturerName: "Cobi" });
    expect(form.prefilled).toEqual(["name", "manufacturerName"]);
    expect(formFromLink("legoSet", LINK, { manufacturer: "LEGO" }).values.manufacturerKind).toBe(
      "lego",
    );
  });

  it("F3 Seite nicht lesbar: leere Felder, aber der Link ist gespeichert und das Formular gültig machbar", () => {
    const form = formFromLink("legoSet", LINK, {});
    expect(form.values.links).toBe(LINK);
    expect(form.prefilled).toEqual([]);
    expect(form.extras).toEqual({});
    expect(form.values.name).toBe("");
    // Der Name ist Pflicht und fehlt noch; mit ihm ist es speicherbar.
    expect(validateForm("legoSet", form.values).name).toBe("required");
    expect(validateForm("legoSet", { ...form.values, name: "Burg" })).toEqual({});
  });

  it("F3 Felder, die die Art nicht hat, werden nicht übernommen (Teilezahl bei einer Figur)", () => {
    const form = formFromLink("minifig", LINK, { name: "Ritter", pieceCount: 5, setNumber: "x1" });
    expect(form.values.pieceCount).toBe("");
    expect(form.values.number).toBe("x1");
    expect(form.prefilled).toEqual(["name", "number"]);
    const part = formFromLink("specialPart", LINK, { name: "Münze", pieceCount: 5 });
    expect(part.values.pieceCount).toBe("");
  });

  it("F3 die Zeilen der Karte 'Erkannt' gibt es nur für Felder, die das Formular der Art hat", () => {
    const fields = { name: "Burg", pieceCount: 1520 };
    expect(linkRows("legoSet", fields)).toEqual([
      { key: "name", value: "Burg" },
      { key: "manufacturer", value: undefined },
      { key: "number", value: undefined },
      { key: "pieceCount", value: "1.520" },
      { key: "image", value: undefined },
    ]);
    expect(linkRows("minifig", fields).map((row) => row.key)).toEqual([
      "name",
      "manufacturer",
      "number",
      "image",
    ]);
    // Ein Sonderteil hat eine Nummer, aber keine Teilezahl.
    expect(linkRows("specialPart", fields).map((row) => row.key)).toEqual([
      "name",
      "manufacturer",
      "number",
      "image",
    ]);
  });

  it("F3 hasFields erkennt eine Seite ohne alles", () => {
    expect(hasFields({})).toBe(false);
    for (const fields of [
      { name: "x" },
      { manufacturer: "x" },
      { setNumber: "1" },
      { pieceCount: 1 },
      { imageUrl: "https://x/y.jpg" },
    ]) {
      expect(hasFields(fields)).toBe(true);
    }
  });

  it("F3 aus dem Katalog erreicht, bleibt der Link ebenfalls am Objekt", () => {
    const item = {
      kind: "legoSet" as const,
      number: "75372-1",
      name: "Battle Pack",
    };
    expect(formFromCatalog(item).values.links).toBe("");
    const form = formFromCatalog(item, "https://rebrickable.com/sets/75372-1/");
    expect(form.values.links).toBe("https://rebrickable.com/sets/75372-1/");
    expect(form.origin).toBe("catalog");
    expect(form.prefilled).not.toContain("links");
  });
});
