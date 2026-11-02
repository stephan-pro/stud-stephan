import { describe, expect, it } from "vitest";
import {
  assignToDiorama,
  dioramaImages,
  figuresInDiorama,
  filterDioramas,
  removeDiorama,
  removeFromDiorama,
} from "./dioramas";
import { aCollection, aDiorama, aMinifig } from "./fixtures";
import {
  assignableFigures,
  figuresNotOnDisplay,
  figuresToMove,
  figuresToSave,
  figureWithoutPlace,
  idsNotOnDisplay,
  type Target,
} from "./placement";
import { filterShowcase, NO_FILTER, showcaseItems } from "./showcase";
import type { Collection } from "./types";

const umbara = aDiorama({ id: "umbara", name: "Umbara-Gefecht" });
const kamino = aDiorama({ id: "kamino", name: "Kamino-Hangar" });
const rex = aMinifig({ id: "rex" });
const fives = aMinifig({ id: "fives", name: "ARC Trooper Fives" });
const guard = aMinifig({ id: "guard", name: "Jedi-Tempelwache", dioramaId: "kamino" });
const start = aCollection({ dioramas: [umbara, kamino], minifigs: [rex, fives, guard] });

const ids = (minifigs: { id: string }[]) => minifigs.map((minifig) => minifig.id);
const notOnDisplayFilter = (collection: Collection) =>
  ids(
    filterShowcase(
      showcaseItems(collection),
      { ...NO_FILTER, notOnDisplay: true },
      idsNotOnDisplay(collection),
    ),
  );
const umbaraTarget = { kind: "diorama", id: "umbara" } as const;
const kaminoTarget = { kind: "diorama", id: "kamino" } as const;

describe("F8 Figuren in Dioramen", () => {
  it("F8 Figur einem Diorama zuordnen → sie erscheint in der Detailansicht des Dioramas und verschwindet aus dem Filter „nicht ausgestellt“", () => {
    expect(notOnDisplayFilter(start)).toContain("rex");
    const after = assignToDiorama(start, "umbara", ["rex"]);
    expect(ids(figuresInDiorama(after, "umbara"))).toEqual(["rex"]);
    expect(notOnDisplayFilter(after)).not.toContain("rex");
    expect(ids(figuresNotOnDisplay(after))).toEqual(["fives"]);
  });

  it("F8 Diorama löschen → zugeordnete Figuren bleiben erhalten und sind wieder „nicht ausgestellt“", () => {
    const filled = assignToDiorama(start, "umbara", ["rex", "fives"]);
    const after = removeDiorama(filled, "umbara");
    expect(after.dioramas.map((diorama) => diorama.id)).toEqual(["kamino"]);
    expect(ids(after.minifigs)).toEqual(["rex", "fives", "guard"]);
    expect(ids(figuresNotOnDisplay(after))).toEqual(["rex", "fives"]);
    expect(notOnDisplayFilter(after)).toEqual(["rex", "fives"]);
    expect(after.minifigs[0]).not.toHaveProperty("dioramaId");
    expect(ids(figuresInDiorama(after, "kamino"))).toEqual(["guard"]);
  });

  it("F8 Eine Figur steht in höchstens einem Diorama: Zuordnen verschiebt sie", () => {
    const after = assignToDiorama(start, "umbara", ["guard"]);
    expect(ids(figuresInDiorama(after, "umbara"))).toEqual(["guard"]);
    expect(figuresInDiorama(after, "kamino")).toEqual([]);
  });

  it("F8 Vor dem Verschieben nennt die App, wo die Figur steht („steht in: …“)", () => {
    const moves = figuresToMove(start, umbaraTarget, ["rex", "guard"]);
    expect(moves.map(({ minifig, from }) => [minifig.id, from.name])).toEqual([
      ["guard", "Kamino-Hangar"],
    ]);
    expect(figuresToMove(start, kaminoTarget, ["guard"])).toEqual([]);
    const lost = aCollection({ minifigs: [aMinifig({ id: "x", dioramaId: "gone" })] });
    expect(figuresToMove(lost, umbaraTarget, ["x"])).toEqual([]);
  });

  it("F8 Zuordnen zu einem unbekannten Diorama ist ein Fehler", () => {
    expect(() => assignToDiorama(start, "gibt-es-nicht", ["rex"])).toThrow();
  });

  it("F8 Figur aus dem Diorama nehmen", () => {
    const after = removeFromDiorama(start, ["guard"]);
    expect(figuresInDiorama(after, "kamino")).toEqual([]);
    expect(ids(figuresNotOnDisplay(after))).toEqual(["rex", "fives", "guard"]);
  });

  it("F8 Zuordnen: angeboten werden Figuren, die noch nicht im Diorama stehen, mit Suche und Filter", () => {
    const offered = (target: Target, onlyWithout: boolean, query = "") =>
      ids(assignableFigures(start, target, { onlyWithout, query }));
    expect(offered(umbaraTarget, true)).toEqual(["fives", "rex"]);
    expect(
      ids(assignableFigures(start, umbaraTarget, { onlyWithout: true, query: "" })),
    ).not.toContain("guard");
    expect(offered(umbaraTarget, false)).toEqual(["fives", "rex", "guard"]);
    expect(offered(kaminoTarget, false)).toEqual(["fives", "rex"]);
    expect(offered(umbaraTarget, false, "  FIVES ")).toEqual(["fives"]);
    const numbered = aCollection({
      dioramas: [umbara],
      minifigs: [aMinifig({ id: "a", name: "Clone", bricklinkId: "sw0631" })],
    });
    expect(
      ids(assignableFigures(numbered, umbaraTarget, { onlyWithout: true, query: "SW06" })),
    ).toEqual(["a"]);
  });

  it("F8 Zum Speichern: nur Figuren, die sich ändern, mit dem neuen Diorama", () => {
    const toSave = figuresToSave(start, kaminoTarget, ["rex", "guard", "gibt-es-nicht"]);
    expect(toSave.map((minifig) => [minifig.id, minifig.dioramaId])).toEqual([["rex", "kamino"]]);
    expect(rex).not.toHaveProperty("dioramaId");
    expect(figureWithoutPlace(guard)).not.toHaveProperty("dioramaId");
    expect(dioramaImages(aDiorama({ photos: ["a.webp", "b.webp"] }))).toEqual([
      { kind: "photo", path: "a.webp" },
      { kind: "photo", path: "b.webp" },
    ]);
  });

  it("F8 Die Änderungen lassen die alte Sammlung unverändert", () => {
    const copy = structuredClone(start);
    assignToDiorama(start, "umbara", ["rex"]);
    removeFromDiorama(start, ["guard"]);
    removeDiorama(start, "kamino");
    expect(start).toEqual(copy);
  });
});

describe("P15 Suche in der Dioramen-Liste (Lupe wie im Dummy)", () => {
  const collection = aCollection({
    dioramas: [
      aDiorama({ id: "umbara", name: "Umbara-Gefecht", note: "Nachtkampf im Dschungel" }),
      aDiorama({ id: "kamino", name: "Kamino Klonfabrik" }),
    ],
    minifigs: [aMinifig({ id: "rex", name: "Captain Rex", dioramaId: "kamino" })],
  });
  const names = (query: string) => filterDioramas(collection, query).map((d) => d.id);

  it("P15 Ohne Suchtext stehen alle Dioramen da", () => {
    expect(names("")).toEqual(["umbara", "kamino"]);
    expect(names("   ")).toEqual(["umbara", "kamino"]);
  });

  it("P15 Gesucht wird in Name, Notiz und den Namen der Figuren, ohne Groß/klein und Akzente", () => {
    expect(names("UMBARA")).toEqual(["umbara"]);
    expect(names("dschungel")).toEqual(["umbara"]);
    expect(names("rex")).toEqual(["kamino"]);
    expect(names("Klönfabrik")).toEqual(["kamino"]);
  });

  it("P15 Jedes Wort muss passen", () => {
    expect(names("kamino rex")).toEqual(["kamino"]);
    expect(names("kamino dschungel")).toEqual([]);
  });
});
