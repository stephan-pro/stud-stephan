import { describe, expect, it } from "vitest";
import { withoutObject, withRestored, withSaved } from "./collectionEdit";
import { assignToDiorama, removeDiorama, removeFromDiorama } from "./dioramas";
import { aCollection, aDiorama, aMinifig, aSet } from "./fixtures";
import {
  assignableFigures,
  figureAt,
  figuresInSet,
  figuresNotOnDisplay,
  figuresToMove,
  figuresToSave,
  figureWithoutPlace,
  idsNotOnDisplay,
  placeName,
  placeOf,
} from "./placement";
import {
  filterShowcase,
  NO_FILTER,
  showcase,
  showcaseItems,
  tileFacts,
  toEntries,
} from "./showcase";
import type { Collection, Minifig } from "./types";

// "Steht in": a figure is displayed in a diorama OR in an own set OR nowhere, never in two places.

const castle = aSet({ id: "castle", name: "Mini Disney Castle", setNumber: "40478-1" });
const pack = aSet({ id: "pack", name: "Battle Pack" });
const umbara = aDiorama({ id: "umbara", name: "Umbara-Gefecht" });
const ids = (figures: readonly { id: string }[]) => figures.map((figure) => figure.id);
const figureOf = (collection: Collection, id: string): Minifig => {
  const found = collection.minifigs.find((figure) => figure.id === id);
  if (!found) throw new Error(`keine Figur ${id}`);
  return found;
};

describe("Steht in: der Ort einer Figur", () => {
  it("Eine Figur ohne eigenen Ort und ohne Set steht nirgends", () => {
    const collection = aCollection({ minifigs: [aMinifig({ id: "a" })] });
    expect(placeOf(collection, figureOf(collection, "a"))).toBeUndefined();
    expect(ids(figuresNotOnDisplay(collection))).toEqual(["a"]);
  });

  it("Automatik: Eine Figur aus einem eigenen Set mit Status „vollständig“ steht in diesem Set", () => {
    const mickey = aMinifig({
      id: "mickey",
      name: "Mickey Mouse",
      bricklinkId: "dis057",
      fromSet: { label: "40478-1", setId: "castle" },
    });
    const collection = aCollection({ sets: [castle], minifigs: [mickey] });
    const place = placeOf(collection, mickey);
    expect(place).toMatchObject({ kind: "set", automatic: true });
    expect(place && placeName(place)).toBe("Mini Disney Castle");
    expect(figuresNotOnDisplay(collection)).toEqual([]);
    expect(figuresInSet(collection, "castle")).toEqual([{ minifig: mickey, automatic: true }]);
  });

  it("Automatik: Bei „Figuren entnommen“ oder „zerlegt“ steht die Figur nicht im Set", () => {
    for (const status of ["figuresRemoved", "disassembled"] as const) {
      const mickey = aMinifig({ id: "mickey", fromSet: { setId: "castle" } });
      const collection = aCollection({ sets: [{ ...castle, status }], minifigs: [mickey] });
      expect(placeOf(collection, mickey)).toBeUndefined();
      expect(ids(figuresNotOnDisplay(collection))).toEqual(["mickey"]);
      expect(figuresInSet(collection, "castle")).toEqual([]);
    }
  });

  it("Automatik: Ohne Verknüpfung zu einem eigenen Set (nur Katalogangabe) gibt es keine", () => {
    const mickey = aMinifig({ id: "mickey", fromSet: { label: "40478-1" } });
    const gone = aMinifig({ id: "gone", fromSet: { setId: "weg" } });
    const collection = aCollection({ sets: [castle], minifigs: [mickey, gone] });
    expect(ids(figuresNotOnDisplay(collection))).toEqual(["mickey", "gone"]);
  });

  it("Ein eigener Ort geht vor der Automatik: Diorama vor Set, gewähltes Set vor dem Herkunftsset", () => {
    const inDiorama = aMinifig({ id: "d", dioramaId: "umbara", fromSet: { setId: "castle" } });
    const inOther = aMinifig({ id: "s", standsInSetId: "pack", fromSet: { setId: "castle" } });
    const collection = aCollection({
      sets: [castle, pack],
      dioramas: [umbara],
      minifigs: [inDiorama, inOther],
    });
    expect(placeOf(collection, inDiorama)).toMatchObject({ kind: "diorama" });
    expect(placeOf(collection, inOther)).toMatchObject({
      kind: "set",
      automatic: false,
      set: { id: "pack" },
    });
    expect(figuresInSet(collection, "castle")).toEqual([]);
  });

  it("Die Figuren eines Sets sind auch Figuren aus anderen Sets, ausgestellt oder automatisch", () => {
    const own = aMinifig({ id: "own", fromSet: { setId: "castle" } });
    const guest = aMinifig({ id: "guest", standsInSetId: "castle", fromSet: { setId: "pack" } });
    const loose = aMinifig({ id: "loose" });
    const collection = aCollection({ sets: [castle, pack], minifigs: [own, guest, loose] });
    expect(figuresInSet(collection, "castle")).toEqual([
      { minifig: own, automatic: true },
      { minifig: guest, automatic: false },
    ]);
    // "pack" is complete, too, but "guest" stands in the castle on its own account.
    expect(figuresInSet(collection, "pack")).toEqual([]);
    expect(ids(figuresNotOnDisplay(collection))).toEqual(["loose"]);
  });

  it("Ein Diorama oder Set, das es nicht mehr gibt, zählt nicht als Ort", () => {
    const collection = aCollection({
      minifigs: [
        aMinifig({ id: "a", dioramaId: "weg" }),
        aMinifig({ id: "b", standsInSetId: "weg" }),
      ],
    });
    expect(ids(figuresNotOnDisplay(collection))).toEqual(["a", "b"]);
  });
});

describe("Steht in: Übergänge", () => {
  const start = aCollection({
    sets: [castle, pack],
    dioramas: [umbara],
    minifigs: [aMinifig({ id: "a" }), aMinifig({ id: "b", dioramaId: "umbara" })],
  });

  it("Nirgends → Set: nur das Set steht an der Figur", () => {
    const next = figureAt(figureOf(start, "a"), { kind: "set", id: "castle" });
    expect(next.standsInSetId).toBe("castle");
    expect(next).not.toHaveProperty("dioramaId");
  });

  it("Diorama → Set: das Diorama geht, nie beides", () => {
    const next = figureAt(figureOf(start, "b"), { kind: "set", id: "castle" });
    expect(next).toMatchObject({ standsInSetId: "castle" });
    expect(next).not.toHaveProperty("dioramaId");
  });

  it("Set → Diorama: das Set geht, nie beides", () => {
    const inSet = aMinifig({ id: "c", standsInSetId: "castle" });
    const next = figureAt(inSet, { kind: "diorama", id: "umbara" });
    expect(next).toMatchObject({ dioramaId: "umbara" });
    expect(next).not.toHaveProperty("standsInSetId");
    const collection = assignToDiorama(aCollection({ ...start, minifigs: [inSet] }), "umbara", [
      "c",
    ]);
    expect(figureOf(collection, "c")).not.toHaveProperty("standsInSetId");
  });

  it("Set → nirgends: „Aus dem Set nehmen“ lässt keinen Ort zurück", () => {
    const next = figureWithoutPlace(aMinifig({ id: "c", standsInSetId: "castle" }));
    expect(next).not.toHaveProperty("standsInSetId");
    expect(next).not.toHaveProperty("dioramaId");
    const withBoth = figureWithoutPlace(
      aMinifig({ id: "x", standsInSetId: "castle", dioramaId: "umbara" }),
    );
    expect(withBoth).not.toHaveProperty("standsInSetId");
    expect(withBoth).not.toHaveProperty("dioramaId");
  });

  it("Aus dem Diorama nehmen lässt ein gewähltes Set unberührt", () => {
    const collection = aCollection({
      sets: [castle],
      minifigs: [aMinifig({ id: "c", standsInSetId: "castle" })],
    });
    expect(removeFromDiorama(collection, ["c"]).minifigs[0]?.standsInSetId).toBe("castle");
  });

  it("Eine Figur mit Automatik wird einem Diorama zugeordnet: das Diorama gilt, das Set nicht mehr", () => {
    const auto = aMinifig({ id: "auto", fromSet: { setId: "castle" } });
    const collection = aCollection({ sets: [castle], dioramas: [umbara], minifigs: [auto] });
    expect(figuresToMove(collection, { kind: "diorama", id: "umbara" }, ["auto"])).toEqual([]);
    const after = assignToDiorama(collection, "umbara", ["auto"]);
    expect(placeOf(after, figureOf(after, "auto"))).toMatchObject({ kind: "diorama" });
    expect(figuresInSet(after, "castle")).toEqual([]);
  });

  it("Zuordnen zu dem Set, in dem die Figur schon automatisch steht, ändert nichts", () => {
    const auto = aMinifig({ id: "auto", fromSet: { setId: "castle" } });
    const collection = aCollection({ sets: [castle], minifigs: [auto] });
    expect(figuresToSave(collection, { kind: "set", id: "castle" }, ["auto"])).toEqual([]);
  });

  it("Vor dem Verschieben nennt die App den Ort („steht in: …“), Diorama oder Set; die Automatik fragt nicht", () => {
    const auto = aMinifig({ id: "auto", fromSet: { setId: "castle" } });
    const inDiorama = aMinifig({ id: "d", dioramaId: "umbara" });
    const inPack = aMinifig({ id: "p", standsInSetId: "pack" });
    const collection = aCollection({
      sets: [castle, pack],
      dioramas: [umbara],
      minifigs: [auto, inDiorama, inPack],
    });
    const castleTarget = { kind: "set", id: "castle" } as const;
    expect(
      figuresToMove(collection, castleTarget, ["auto", "d", "p"]).map(({ minifig, from }) => [
        minifig.id,
        from.name,
      ]),
    ).toEqual([
      ["d", "Umbara-Gefecht"],
      ["p", "Battle Pack"],
    ]);
    // Within the same place nothing moves.
    expect(figuresToMove(collection, { kind: "set", id: "pack" }, ["p"])).toEqual([]);
    expect(figuresToMove(collection, { kind: "diorama", id: "umbara" }, ["d"])).toEqual([]);
  });

  it("Zuordnen bietet Figuren an, die noch nicht dort stehen; „nur nicht ausgestellte“ lässt die im Set aus", () => {
    const auto = aMinifig({ id: "auto", name: "Mickey", fromSet: { setId: "castle" } });
    const loose = aMinifig({ id: "loose", name: "Donald" });
    const inDiorama = aMinifig({ id: "d", name: "Minnie", dioramaId: "umbara" });
    const collection = aCollection({
      sets: [castle],
      dioramas: [umbara],
      minifigs: [auto, loose, inDiorama],
    });
    const offered = (onlyWithout: boolean, query = "") =>
      ids(assignableFigures(collection, { kind: "set", id: "castle" }, { onlyWithout, query }));
    expect(offered(true)).toEqual(["loose"]);
    expect(offered(false)).toEqual(["loose", "d"]);
    expect(offered(false, "minn")).toEqual(["d"]);
  });
});

describe("Steht in: Löschen, Rückgängig und Statuswechsel", () => {
  const inCastle = aMinifig({ id: "in", standsInSetId: "castle" });
  const auto = aMinifig({ id: "auto", fromSet: { label: "40478-1", setId: "castle" } });
  const collection = aCollection({
    sets: [castle, pack],
    dioramas: [umbara],
    minifigs: [inCastle, auto, aMinifig({ id: "other", standsInSetId: "pack" })],
  });

  it("Set gelöscht → die Figur bleibt und steht nicht mehr im Set", () => {
    const after = withoutObject(collection, "legoSet", "castle");
    expect(ids(after.minifigs)).toEqual(["in", "auto", "other"]);
    expect(figureOf(after, "in")).not.toHaveProperty("standsInSetId");
    expect(figureOf(after, "other").standsInSetId).toBe("pack");
    expect(figureOf(after, "auto")).not.toHaveProperty("fromSet.setId");
    expect(ids(figuresNotOnDisplay(after))).toEqual(["in", "auto"]);
  });

  it("Set gelöscht, dann „Rückgängig“: die Figuren stehen wieder im Set", () => {
    const deleted = withoutObject(collection, "legoSet", "castle");
    const back = withRestored(deleted, collection, "legoSet", "castle");
    expect(figureOf(back, "in").standsInSetId).toBe("castle");
    expect(figureOf(back, "auto").fromSet?.setId).toBe("castle");
    expect(placeOf(back, figureOf(back, "auto"))).toMatchObject({ kind: "set", automatic: true });
  });

  it("Rückgängig überschreibt keinen neuen Ort: wer inzwischen im Diorama steht, bleibt dort", () => {
    const deleted = withoutObject(collection, "legoSet", "castle");
    const moved = assignToDiorama(deleted, "umbara", ["in"]);
    const back = withRestored(moved, collection, "legoSet", "castle");
    expect(figureOf(back, "in")).toMatchObject({ dioramaId: "umbara" });
    expect(figureOf(back, "in")).not.toHaveProperty("standsInSetId");
  });

  it("Diorama gelöscht → die Figur im Set bleibt im Set", () => {
    const both = aCollection({
      sets: [castle],
      dioramas: [umbara],
      minifigs: [
        aMinifig({ id: "in", standsInSetId: "castle" }),
        aMinifig({ id: "d", dioramaId: "umbara" }),
      ],
    });
    const after = removeDiorama(both, "umbara");
    expect(ids(figuresNotOnDisplay(after))).toEqual(["d"]);
    expect(withoutObject(both, "diorama", "umbara").minifigs[0]?.standsInSetId).toBe("castle");
  });

  it("Status des Sets auf „Figuren entnommen“ → die automatisch ausgestellten Figuren sind es nicht mehr", () => {
    const removed = withSaved(collection, "legoSet", { ...castle, status: "figuresRemoved" });
    // "in" chose the castle itself and stays; "auto" only stood there because it was complete.
    expect(ids(figuresNotOnDisplay(removed))).toEqual(["auto"]);
    expect(figuresInSet(removed, "castle").map(({ minifig }) => minifig.id)).toEqual(["in"]);
  });
});

describe("Steht in: Vitrine, Marker und Filter", () => {
  const mickey = aMinifig({ id: "mickey", name: "Mickey Mouse", fromSet: { setId: "castle" } });
  const donald = aMinifig({ id: "donald", name: "Donald" });
  const minnie = aMinifig({ id: "minnie", name: "Minnie", standsInSetId: "castle" });
  const collection = aCollection({ sets: [castle], minifigs: [mickey, donald, minnie] });

  it("Der Filter „Nur nicht ausgestellte Figuren“ zeigt nur Figuren, die weder im Diorama noch im Set stehen", () => {
    const entries = showcase(collection, { ...NO_FILTER, notOnDisplay: true }, "name");
    expect(entries.map((entry) => (entry.type === "minifig" ? entry.copies[0]?.id : "?"))).toEqual([
      "donald",
    ]);
    const items = showcaseItems(collection);
    expect(
      ids(filterShowcase(items, { ...NO_FILTER, notOnDisplay: true }, idsNotOnDisplay(collection))),
    ).toEqual(["donald"]);
  });

  it("Der Marker „Nicht ausgestellt“ steht nur an der Kachel einer Figur, die nirgends steht", () => {
    const notShown = idsNotOnDisplay(collection);
    const markerOf = (figure: Minifig) => {
      const [entry] = toEntries([figure]);
      return entry ? tileFacts(entry, [], notShown).notOnDisplay : undefined;
    };
    expect(markerOf(mickey)).toBe(false);
    expect(markerOf(minnie)).toBe(false);
    expect(markerOf(donald)).toBe(true);
  });
});
