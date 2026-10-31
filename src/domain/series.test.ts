import { describe, expect, it } from "vitest";
import { aMinifig, aWish } from "./fixtures";
import { seriesProgress } from "./series";
import type { CatalogFigure } from "./types";

const SERIES: CatalogFigure[] = [
  { name: "Captain Rex", bricklinkId: "sw0194" },
  { name: "Clone Trooper", bricklinkId: "sw0631" },
  { name: "Commander Cody", bricklinkId: "sw0196" },
  { name: "Plo Koon" },
  { name: "Ahsoka Tano", bricklinkId: "sw0219" },
];

const owned = [
  aMinifig({ id: "rex-1", bricklinkId: "SW0194" }),
  aMinifig({ id: "rex-2", bricklinkId: "sw0194" }),
  aMinifig({ id: "trooper", bricklinkId: " SW0631" }),
  aMinifig({ id: "fives", bricklinkId: "sw0542" }),
];
const wishes = [
  aWish({ bricklinkId: "sw0196" }),
  aWish({ bricklinkId: "sw0219", type: "legoSet" }),
  aWish({ bricklinkId: "sw0194" }),
];

describe("F13 Fehlende Figuren", () => {
  const progress = seriesProgress(SERIES, owned, wishes);
  const statuses = progress.figures.map(({ figure, status }) => [figure.name, status]);

  it("F13 Die App zeigt alle offiziellen Figuren der Reihe mit Status vorhanden · fehlt · auf der Wunschliste", () => {
    expect(statuses).toEqual([
      ["Captain Rex", "present"],
      ["Clone Trooper", "present"],
      ["Commander Cody", "wished"],
      ["Plo Koon", "missing"],
      ["Ahsoka Tano", "missing"],
    ]);
  });

  it("F13 Vorhanden über die BrickLink-Nummer; die eigenen Exemplare stehen dabei", () => {
    expect(progress.figures[0]?.copies.map((copy) => copy.id)).toEqual(["rex-1", "rex-2"]);
    expect(progress.figures[1]?.copies.map((copy) => copy.id)).toEqual(["trooper"]);
  });

  it("F13 Zusätzlich gilt alles auf der Wunschliste als „fehlend“", () => {
    expect(progress).toMatchObject({ total: 5, present: 2, missing: 3, wished: 1 });
  });

  it("F13 Eine vorhandene Figur bleibt vorhanden, auch wenn ein weiteres Exemplar gewünscht ist", () => {
    expect(statuses[0]).toEqual(["Captain Rex", "present"]);
  });

  it("F13 Nur Figuren-Wünsche zählen, gewünschte Sets nicht", () => {
    expect(statuses[4]).toEqual(["Ahsoka Tano", "missing"]);
  });

  it("F13 Leere Nummern passen zu nichts", () => {
    const blank = seriesProgress(
      [{ name: "Ohne Nummer", bricklinkId: " " }],
      [aMinifig({ bricklinkId: " " })],
      [],
    );
    expect(blank).toMatchObject({ present: 0, missing: 1 });
    expect(seriesProgress([], owned, wishes)).toEqual({
      figures: [],
      total: 0,
      present: 0,
      missing: 0,
      wished: 0,
    });
  });
});
