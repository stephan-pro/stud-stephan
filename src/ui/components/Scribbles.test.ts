import { describe, expect, it } from "vitest";
import { patternId } from "./Scribbles";

describe("patternId", () => {
  it("P5 Nacharbeit: Ein Schlüssel mit Leerzeichen und Doppelpunkten wird zu einer gültigen Kennung", () => {
    expect(patternId("tile-minifig:lego:name:commander appo")).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("P5 Nacharbeit: Eine schon gültige Kennung bleibt unverändert", () => {
    expect(patternId("collection-card-scribbles")).toBe("collection-card-scribbles");
  });

  it("P5 Nacharbeit: Schlüssel, die sich nur in Sonderzeichen unterscheiden, bleiben verschieden", () => {
    expect(patternId("tile a b")).not.toBe(patternId("tile-a-b"));
    expect(patternId("tile a:b")).not.toBe(patternId("tile a b"));
  });
});
