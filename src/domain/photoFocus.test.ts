import { describe, expect, it } from "vitest";
import { aMinifig } from "./fixtures";
import {
  CENTER_FOCUS,
  clampPercent,
  cleanFocus,
  focusOf,
  isCenter,
  objectPosition,
  withFocus,
} from "./photoFocus";
import { galleryImages, photoImage } from "./showcase";

describe("Bildausschnitt", () => {
  it("Ohne gesetzten Punkt ist es die Mitte", () => {
    expect(focusOf(undefined, "a.webp")).toEqual(CENTER_FOCUS);
    expect(focusOf({ "b.webp": { x: 10, y: 20 } }, "a.webp")).toEqual({ x: 50, y: 50 });
    expect(focusOf({ "a.webp": { x: 10, y: 20 } }, "a.webp")).toEqual({ x: 10, y: 20 });
  });

  it("Prozentwerte werden gerundet und auf 0 bis 100 begrenzt", () => {
    expect(clampPercent(-4)).toBe(0);
    expect(clampPercent(104)).toBe(100);
    expect(clampPercent(33.6)).toBe(34);
    expect(clampPercent(Number.NaN)).toBe(50);
  });

  it("object-position nennt Prozent von links und oben", () => {
    expect(objectPosition({ x: 30, y: 70 })).toBe("30% 70%");
    expect(isCenter({ x: 50, y: 50 })).toBe(true);
    expect(isCenter({ x: 50, y: 51 })).toBe(false);
  });

  it("Ein gesetzter Punkt ersetzt den alten, die Mitte wird nicht gespeichert", () => {
    const first = withFocus(undefined, "a.webp", { x: 20, y: 80 });
    expect(first).toEqual({ "a.webp": { x: 20, y: 80 } });
    expect(withFocus(first, "a.webp", { x: 25.4, y: 90 })).toEqual({
      "a.webp": { x: 25, y: 90 },
    });
    expect(withFocus(first, "a.webp", { x: 50, y: 50 })).toEqual({});
  });

  it("Gespeichert werden nur Punkte gelisteter Fotos abseits der Mitte", () => {
    const map = {
      "a.webp": { x: 20, y: 80 },
      "b.webp": { x: 50, y: 50 },
      "gone.webp": { x: 1, y: 2 },
    };
    expect(cleanFocus(map, ["a.webp", "b.webp"])).toEqual({ "a.webp": { x: 20, y: 80 } });
    expect(cleanFocus(map, ["b.webp"])).toBeUndefined();
    expect(cleanFocus(undefined, ["a.webp"])).toBeUndefined();
  });

  it("Das Bild einer Kachel oder Galerie trägt den Punkt seines Fotos", () => {
    const figure = aMinifig({
      photos: ["a.webp", "b.webp"],
      photoFocus: { "b.webp": { x: 40, y: 60 } },
    });
    expect(photoImage(figure, "a.webp")).toEqual({ kind: "photo", path: "a.webp" });
    expect(galleryImages(figure)).toEqual([
      { kind: "photo", path: "a.webp" },
      { kind: "photo", path: "b.webp", focus: { x: 40, y: 60 } },
    ]);
  });
});
