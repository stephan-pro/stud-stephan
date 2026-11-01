import { describe, expect, it } from "vitest";
import { linkLabel, manufacturerLabel, safeUrl, TINT_COUNT, tintIndex } from "./labels";

describe("F5 Hersteller in der Anzeige", () => {
  it("F5 LEGO und Bluebrixx haben feste Namen, andere zeigen ihren eigenen", () => {
    expect(manufacturerLabel({ kind: "lego" })).toBe("LEGO");
    expect(manufacturerLabel({ kind: "bluebrixx" })).toBe("Bluebrixx");
    expect(manufacturerLabel({ kind: "custom", name: "Clone Army Customs" })).toBe(
      "Clone Army Customs",
    );
    expect(manufacturerLabel({ kind: "other", name: "Cobi" })).toBe("Cobi");
  });
});

describe("F3 Links an Objekten", () => {
  it("F3 Nur Webadressen werden zu Links", () => {
    expect(safeUrl("https://rebrickable.com/mocs/")).toBe("https://rebrickable.com/mocs/");
    expect(safeUrl(" http://beispiel.de ")).toBe("http://beispiel.de/");
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeUrl("data:text/html,x")).toBeUndefined();
    expect(safeUrl("im Laden um die Ecke")).toBeUndefined();
    expect(safeUrl("")).toBeUndefined();
    expect(safeUrl(undefined)).toBeUndefined();
  });

  it("F3 Ein Link zeigt die Seite, ein Text bleibt wie er ist", () => {
    expect(linkLabel("https://www.rebrickable.com/mocs/x")).toBe("rebrickable.com");
    expect(linkLabel("im Laden")).toBe("im Laden");
  });
});

describe("F11 Farben der Platzhalter", () => {
  it("F11 Derselbe Schlüssel bekommt immer dieselbe der fünf Farben", () => {
    expect(tintIndex("minifig-rex")).toBe(tintIndex("minifig-rex"));
    for (const key of ["a", "minifig-rex", "set-75372", "", "ä"]) {
      const index = tintIndex(key);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(TINT_COUNT);
    }
  });

  it("F11 Verschiedene Schlüssel verteilen sich auf mehrere Farben", () => {
    const used = new Set(Array.from({ length: 30 }, (_, i) => tintIndex(`minifig-${i}`)));
    expect(used.size).toBeGreaterThan(2);
  });
});
