import { describe, expect, it } from "vitest";
import {
  assignToDiorama,
  figuresInDiorama,
  figuresToMove,
  figuresWithoutDiorama,
  removeDiorama,
  removeFromDiorama,
} from "./dioramas";
import { aCollection, aDiorama, aMinifig } from "./fixtures";
import { filterShowcase, NO_FILTER, showcaseItems } from "./showcase";
import type { Collection } from "./types";

const umbara = aDiorama({ id: "umbara", name: "Umbara-Gefecht" });
const kamino = aDiorama({ id: "kamino", name: "Kamino-Hangar" });
const rex = aMinifig({ id: "rex" });
const fives = aMinifig({ id: "fives", name: "ARC Trooper Fives" });
const guard = aMinifig({ id: "guard", name: "Jedi-Tempelwache", dioramaId: "kamino" });
const start = aCollection({ dioramas: [umbara, kamino], minifigs: [rex, fives, guard] });

const ids = (minifigs: { id: string }[]) => minifigs.map((minifig) => minifig.id);
const withoutDioramaFilter = (collection: Collection) =>
  ids(filterShowcase(showcaseItems(collection), { ...NO_FILTER, withoutDiorama: true }));

describe("F8 Figuren in Dioramen", () => {
  it("F8 Figur einem Diorama zuordnen → sie erscheint in der Detailansicht des Dioramas und verschwindet aus dem Filter „ohne Diorama“", () => {
    expect(withoutDioramaFilter(start)).toContain("rex");
    const after = assignToDiorama(start, "umbara", ["rex"]);
    expect(ids(figuresInDiorama(after, "umbara"))).toEqual(["rex"]);
    expect(withoutDioramaFilter(after)).not.toContain("rex");
    expect(ids(figuresWithoutDiorama(after))).toEqual(["fives"]);
  });

  it("F8 Diorama löschen → zugeordnete Figuren bleiben erhalten und gelten wieder als „ohne Diorama“", () => {
    const filled = assignToDiorama(start, "umbara", ["rex", "fives"]);
    const after = removeDiorama(filled, "umbara");
    expect(after.dioramas.map((diorama) => diorama.id)).toEqual(["kamino"]);
    expect(ids(after.minifigs)).toEqual(["rex", "fives", "guard"]);
    expect(ids(figuresWithoutDiorama(after))).toEqual(["rex", "fives"]);
    expect(withoutDioramaFilter(after)).toEqual(["rex", "fives"]);
    expect(after.minifigs[0]).not.toHaveProperty("dioramaId");
    expect(ids(figuresInDiorama(after, "kamino"))).toEqual(["guard"]);
  });

  it("F8 Eine Figur steht in höchstens einem Diorama: Zuordnen verschiebt sie", () => {
    const after = assignToDiorama(start, "umbara", ["guard"]);
    expect(ids(figuresInDiorama(after, "umbara"))).toEqual(["guard"]);
    expect(figuresInDiorama(after, "kamino")).toEqual([]);
  });

  it("F8 Vor dem Verschieben nennt die App, wo die Figur steht („steht in: …“)", () => {
    const moves = figuresToMove(start, "umbara", ["rex", "guard"]);
    expect(moves.map(({ minifig, from }) => [minifig.id, from.name])).toEqual([
      ["guard", "Kamino-Hangar"],
    ]);
    expect(figuresToMove(start, "kamino", ["guard"])).toEqual([]);
    const lost = aCollection({ minifigs: [aMinifig({ id: "x", dioramaId: "gone" })] });
    expect(figuresToMove(lost, "umbara", ["x"])).toEqual([]);
  });

  it("F8 Zuordnen zu einem unbekannten Diorama ist ein Fehler", () => {
    expect(() => assignToDiorama(start, "gibt-es-nicht", ["rex"])).toThrow();
  });

  it("F8 Figur aus dem Diorama nehmen", () => {
    const after = removeFromDiorama(start, ["guard"]);
    expect(figuresInDiorama(after, "kamino")).toEqual([]);
    expect(ids(figuresWithoutDiorama(after))).toEqual(["rex", "fives", "guard"]);
  });

  it("F8 Die Änderungen lassen die alte Sammlung unverändert", () => {
    const copy = structuredClone(start);
    assignToDiorama(start, "umbara", ["rex"]);
    removeFromDiorama(start, ["guard"]);
    removeDiorama(start, "kamino");
    expect(start).toEqual(copy);
  });
});
