import { describe, expect, it } from "vitest";
import { withoutObject, withRestored, withSaved, withSavedItem } from "./collectionEdit";
import { aCollection, aDiorama, aMinifig, aSet, aSpecialPart, aWish } from "./fixtures";

describe("F4 Speichern und Löschen in der Sammlung der App", () => {
  it("F4 Ein neues Objekt kommt dazu, ein vorhandenes wird ersetzt, die Liste bleibt nach Kennung sortiert", () => {
    const b = aMinifig({ id: "b", name: "B" });
    const collection = aCollection({ minifigs: [b] });
    const added = withSaved(collection, "minifig", aMinifig({ id: "a", name: "A" }));
    expect(added.minifigs.map((figure) => figure.id)).toEqual(["a", "b"]);
    const replaced = withSaved(added, "minifig", { ...b, name: "B2" });
    expect(replaced.minifigs.map((figure) => figure.name)).toEqual(["A", "B2"]);
    // The collection it started from stays as it was.
    expect(collection.minifigs).toHaveLength(1);
  });

  it("F4 Jede Art von Objekt hat ihre Liste", () => {
    let collection = aCollection();
    collection = withSaved(collection, "legoSet", aSet({ id: "s" }));
    collection = withSaved(collection, "specialPart", aSpecialPart({ id: "p" }));
    collection = withSaved(collection, "diorama", aDiorama({ id: "d" }));
    collection = withSaved(collection, "wishItem", aWish({ id: "w" }));
    expect([
      collection.sets.length,
      collection.specialParts.length,
      collection.dioramas.length,
      collection.wishlist.length,
    ]).toEqual([1, 1, 1, 1]);
    expect(withoutObject(collection, "wishItem", "w").wishlist).toEqual([]);
    expect(withoutObject(collection, "specialPart", "p").specialParts).toEqual([]);
  });

  it("F4 Ein Objekt der Vitrine wird in die Liste seiner Art gespeichert", () => {
    let collection = aCollection();
    collection = withSavedItem(collection, aMinifig({ id: "a" }));
    collection = withSavedItem(collection, aSet({ id: "b" }));
    collection = withSavedItem(collection, aSpecialPart({ id: "c" }));
    expect(
      [collection.minifigs, collection.sets, collection.specialParts].map((l) => l.length),
    ).toEqual([1, 1, 1]);
  });

  it("F4 Rückgängig: das Objekt ist wieder da, auch die Verknüpfung mit seinen Figuren", () => {
    const set = aSet({ id: "s" });
    const diorama = aDiorama({ id: "d" });
    const before = aCollection({
      sets: [set],
      dioramas: [diorama],
      minifigs: [
        aMinifig({ id: "a", fromSet: { label: "75372-1", setId: "s" }, dioramaId: "d" }),
        aMinifig({ id: "b", fromSet: { setId: "s" } }),
        aMinifig({ id: "c" }),
      ],
    });
    const afterSet = withoutObject(before, "legoSet", "s");
    const backSet = withRestored(afterSet, before, "legoSet", "s");
    expect(backSet.sets).toEqual([set]);
    expect(backSet.minifigs.find((figure) => figure.id === "a")?.fromSet).toEqual({
      label: "75372-1",
      setId: "s",
    });
    expect(backSet.minifigs.find((figure) => figure.id === "b")?.fromSet).toEqual({ setId: "s" });
    expect(backSet.minifigs.find((figure) => figure.id === "c")?.fromSet).toBeUndefined();

    const afterDiorama = withoutObject(before, "diorama", "d");
    const backDiorama = withRestored(afterDiorama, before, "diorama", "d");
    expect(backDiorama.dioramas).toEqual([diorama]);
    expect(backDiorama.minifigs.find((figure) => figure.id === "a")?.dioramaId).toBe("d");
  });

  it("F4 Rückgängig lässt spätere Änderungen stehen und wirft nichts Unbekanntes auf", () => {
    const before = aCollection({ minifigs: [aMinifig({ id: "a" })] });
    const after = withSaved(
      withoutObject(before, "minifig", "a"),
      "minifig",
      aMinifig({ id: "z" }),
    );
    const back = withRestored(after, before, "minifig", "a");
    expect(back.minifigs.map((figure) => figure.id)).toEqual(["a", "z"]);
    expect(withRestored(after, before, "minifig", "gibtsnicht")).toBe(after);
  });

  it("F4 Ein gelöschtes Objekt ist weg, die übrigen bleiben", () => {
    const collection = aCollection({
      minifigs: [aMinifig({ id: "a" }), aMinifig({ id: "b" })],
    });
    expect(withoutObject(collection, "minifig", "a").minifigs.map((figure) => figure.id)).toEqual([
      "b",
    ]);
  });

  it("F8 Diorama löschen → die Figuren bleiben, ohne Diorama", () => {
    const collection = aCollection({
      dioramas: [aDiorama({ id: "d" })],
      minifigs: [aMinifig({ id: "a", dioramaId: "d" }), aMinifig({ id: "b", dioramaId: "e" })],
    });
    const result = withoutObject(collection, "diorama", "d");
    expect(result.dioramas).toEqual([]);
    expect(result.minifigs.find((figure) => figure.id === "a")?.dioramaId).toBeUndefined();
    expect(result.minifigs.find((figure) => figure.id === "b")?.dioramaId).toBe("e");
  });

  it("F7 Set löschen → die Figuren bleiben, die Katalogangabe „Stammt aus Set“ auch", () => {
    const collection = aCollection({
      sets: [aSet({ id: "s" })],
      minifigs: [
        aMinifig({ id: "a", fromSet: { label: "75372-1", setId: "s" } }),
        aMinifig({ id: "b", fromSet: { setId: "s" } }),
        aMinifig({ id: "c", fromSet: { label: "x", setId: "t" } }),
        aMinifig({ id: "d" }),
      ],
    });
    const result = withoutObject(collection, "legoSet", "s");
    const by = (id: string) => result.minifigs.find((figure) => figure.id === id);
    expect(result.sets).toEqual([]);
    expect(by("a")?.fromSet).toEqual({ label: "75372-1" });
    expect(by("b")?.fromSet).toBeUndefined();
    expect(by("c")?.fromSet).toEqual({ label: "x", setId: "t" });
    expect(by("d")?.fromSet).toBeUndefined();
  });
});
