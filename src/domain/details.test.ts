import { describe, expect, it } from "vitest";
import { findItem, otherCopies, ownSetOf, setFigureProgress, setFigures } from "./details";
import { aCollection, aMinifig, aSet, aSpecialPart } from "./fixtures";

describe("F5 Weitere Exemplare", () => {
  const trooper = (id: string, createdAt: string, fields = {}) =>
    aMinifig({ id, name: "Clone Trooper", bricklinkId: "sw0631", createdAt, ...fields });
  const a = trooper("a", "2026-01-01T10:00:00Z");
  const b = trooper("b", "2026-03-01T10:00:00Z");
  const c = trooper("c", "2026-02-01T10:00:00Z");
  const rex = aMinifig({ id: "rex" });
  const collection = aCollection({ minifigs: [a, rex, b, c] });

  it("F5 Die anderen Exemplare derselben Figur, das neueste zuerst, ohne das gezeigte", () => {
    expect(otherCopies(collection, a).map((copy) => copy.id)).toEqual(["b", "c"]);
    expect(otherCopies(collection, b).map((copy) => copy.id)).toEqual(["c", "a"]);
  });

  it("F5 Eine einzelne Figur hat keine weiteren Exemplare", () => {
    expect(otherCopies(collection, rex)).toEqual([]);
    expect(otherCopies(collection, aMinifig({ id: "unknown" }))).toEqual([]);
  });
});

describe("F5 und F8 Herkunft und Diorama einer Figur", () => {
  const set = aSet({ id: "set-1" });
  const collection = aCollection({ sets: [set] });

  it("F5 „Stammt aus Set“ verlinkt zum eigenen Set, wenn es in der Sammlung ist", () => {
    expect(ownSetOf(collection, aMinifig({ fromSet: { label: "x", setId: "set-1" } }))).toBe(set);
    expect(ownSetOf(collection, aMinifig({ fromSet: { label: "75372-1" } }))).toBeUndefined();
    expect(ownSetOf(collection, aMinifig({ fromSet: { setId: "gone" } }))).toBeUndefined();
    expect(ownSetOf(collection, aMinifig())).toBeUndefined();
  });
});

describe("F7 Enthaltene Figuren eines Sets", () => {
  const set = aSet({
    id: "set-1",
    containedFigures: [
      { name: "Clone Trooper", bricklinkId: "sw0631", quantity: 2 },
      { name: "Battle Droid", bricklinkId: "sw0001", quantity: 2 },
      { name: "Namenlos" },
    ],
  });
  const trooper = (id: string, createdAt: string) =>
    aMinifig({ id, name: "Clone Trooper", bricklinkId: "SW0631 ", createdAt });
  const collection = aCollection({
    sets: [set],
    minifigs: [
      trooper("t1", "2026-01-01T10:00:00Z"),
      trooper("t2", "2026-02-01T10:00:00Z"),
      trooper("t3", "2026-03-01T10:00:00Z"),
      aMinifig({
        id: "custom",
        bricklinkId: "sw0001",
        manufacturer: { kind: "custom", name: "Shop" },
      }),
      aMinifig({
        id: "nameless",
        name: "Namenlos",
        bricklinkId: "",
        fromSet: { setId: "set-1" },
      }),
      aMinifig({ id: "elsewhere", name: "Namenlos", bricklinkId: "", fromSet: { setId: "other" } }),
    ],
  });

  it("F7 Vorhandene Figuren sind mit dem Set verknüpft (gleiche Nummer), fehlende bleiben leer", () => {
    const figures = setFigures(collection, set);
    expect(figures.map(({ owned }) => owned.map((copy) => copy.id))).toEqual([
      ["t3", "t2", "t1"],
      [],
      ["nameless"],
    ]);
  });

  it("F7 Die Anzeige „2 / 4“ zählt vorhandene Figuren des Sets gegen alle enthaltenen", () => {
    expect(setFigureProgress(setFigures(collection, set))).toEqual({ have: 3, total: 5 });
    expect(setFigureProgress([])).toEqual({ have: 0, total: 0 });
  });
});

describe("F11 Objekt zur Adresse finden", () => {
  const part = aSpecialPart({ id: "same-id" });
  const set = aSet({ id: "same-id" });
  const collection = aCollection({ specialParts: [part], sets: [set] });

  it("F11 Art und Kennung zusammen bestimmen das Objekt", () => {
    expect(findItem(collection, "specialPart", "same-id")).toBe(part);
    expect(findItem(collection, "legoSet", "same-id")).toBe(set);
    expect(findItem(collection, "minifig", "same-id")).toBeUndefined();
  });
});
