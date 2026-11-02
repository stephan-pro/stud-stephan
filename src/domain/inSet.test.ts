import { describe, expect, it } from "vitest";
import { withSaved } from "./collectionEdit";
import { mostValuable } from "./dashboard";
import { aCollection, aDiorama, aMinifig, aSet } from "./fixtures";
import {
  countsOnItsOwn,
  creatableFigures,
  figureOfSet,
  figuresToLink,
  inSetFigureCount,
  originSetFor,
  setIncludingValue,
  setsByNumber,
} from "./inSet";
import { placeOf } from "./placement";
import { totals } from "./totals";
import { valueAt } from "./valueHistory";

// Figures in their own complete set (Praxisfall Gum-Gum Fruit 75647 mit zwei Figuren "im Set").

const worth = (cents: number) => ({ cents, enteredOn: "2026-10-01" });
const gumGum = aSet({
  id: "gum",
  name: "Gum-Gum Fruit",
  setNumber: "75647-1",
  manualValue: worth(5000),
  containedFigures: [
    { name: "Luffy", bricklinkId: "op001" },
    { name: "Nami", bricklinkId: "op002" },
  ],
});
const luffy = aMinifig({
  id: "luffy",
  name: "Luffy",
  bricklinkId: "op001",
  manualValue: worth(1200),
  fromSet: { label: "75647", setId: "gum" },
});

describe("Automatisch verknüpfen: Stammt aus Set per Nummer", () => {
  it("findet Sets mit und ohne „-1“", () => {
    const sets = [gumGum, aSet({ id: "other", setNumber: "75372-1" })];
    expect(setsByNumber(sets, "75647").map((set) => set.id)).toEqual(["gum"]);
    expect(setsByNumber(sets, " 75647-1 ").map((set) => set.id)).toEqual(["gum"]);
    expect(setsByNumber(sets, "")).toEqual([]);
    expect(setsByNumber(sets, "99999")).toEqual([]);
  });

  it("verknüpft die Figur, wenn genau ein Set die Nummer trägt", () => {
    expect(originSetFor([gumGum], "75647")?.id).toBe("gum");
  });

  it("verknüpft bei mehreren passenden Sets nichts von selbst, aber nach Wahl oder wie bisher", () => {
    const twin = { ...gumGum, id: "twin" };
    expect(originSetFor([gumGum, twin], "75647")).toBeUndefined();
    expect(originSetFor([gumGum, twin], "75647", { chosen: "twin" })?.id).toBe("twin");
    expect(originSetFor([gumGum, twin], "75647", { current: "gum" })?.id).toBe("gum");
    expect(originSetFor([gumGum, twin], "75647", { chosen: "weg" })).toBeUndefined();
  });

  it("zieht beim Anlegen des Sets vorhandene Figuren nach", () => {
    const loose = aMinifig({ id: "loose", fromSet: { label: "75647" } });
    const done = aMinifig({ id: "done", fromSet: { label: "75647", setId: "elsewhere" } });
    const unrelated = aMinifig({ id: "unrelated", fromSet: { label: "75372" } });
    const collection = aCollection({ sets: [gumGum], minifigs: [loose, done, unrelated] });
    const toLink = figuresToLink(collection, gumGum);
    expect(toLink.map((figure) => figure.id)).toEqual(["loose"]);
    expect(toLink[0]?.fromSet).toEqual({ label: "75647", setId: "gum" });
  });

  it("zieht bei mehreren Sets mit derselben Nummer nichts nach", () => {
    const loose = aMinifig({ id: "loose", fromSet: { label: "75647" } });
    const collection = aCollection({
      sets: [gumGum, { ...gumGum, id: "twin" }],
      minifigs: [loose],
    });
    expect(figuresToLink(collection, gumGum)).toEqual([]);
  });

  it("zieht nichts nach, wenn das Set keine Nummer hat", () => {
    const set = aSet({ id: "free" });
    const { setNumber: _, ...without } = set;
    expect(figuresToLink(aCollection({ sets: [without] }), without)).toEqual([]);
  });
});

describe("Kein doppelter Wert: Figur im vollständigen Herkunfts-Set", () => {
  const collection = (set = gumGum, figure = luffy) =>
    aCollection({ sets: [set], minifigs: [figure] });

  it("steht die Figur automatisch in ihrem vollständigen Set, zählt ihr Wert nicht einzeln", () => {
    const all = collection();
    expect(setIncludingValue(all, luffy)?.id).toBe("gum");
    expect(countsOnItsOwn(all, luffy)).toBe(false);
    expect(totals(all).value).toBe(5000);
  });

  it("gilt auch, wenn das Set gewählt wurde", () => {
    const chosen = { ...luffy, standsInSetId: "gum" };
    expect(totals(collection(gumGum, chosen)).value).toBe(5000);
  });

  it("zählt die Figur wieder selbst, wenn das Set „Figuren entnommen“ oder „zerlegt“ ist", () => {
    for (const status of ["figuresRemoved", "disassembled"] as const) {
      const all = collection({ ...gumGum, status });
      expect(countsOnItsOwn(all, luffy)).toBe(true);
      expect(totals(all).value).toBe(6200);
    }
  });

  it("zählt die Figur wieder selbst, wenn sie woanders steht oder bewusst nirgends", () => {
    const stage = aDiorama({ id: "d" });
    expect(
      totals(
        aCollection({
          sets: [gumGum],
          dioramas: [stage],
          minifigs: [{ ...luffy, dioramaId: "d" }],
        }),
      ).value,
    ).toBe(6200);
    expect(totals(collection(gumGum, { ...luffy, standsInSetId: null })).value).toBe(6200);
    const other = aSet({ id: "other" });
    const elsewhere = { ...luffy, standsInSetId: "other" };
    expect(totals(aCollection({ sets: [gumGum, other], minifigs: [elsewhere] })).value).toBe(6200);
  });

  it("zählt eine Figur ohne verknüpftes Set selbst, auch wenn sie in einem anderen vollständigen Set steht", () => {
    const loose = { ...luffy, fromSet: { label: "75647" } };
    expect(placeOf(collection(), loose)).toBeUndefined();
    expect(totals(collection(gumGum, loose)).value).toBe(6200);
  });

  it("lässt die Figur aus „ohne Wert“ und der Top 10 heraus", () => {
    const { manualValue: _, ...noValue } = luffy;
    const all = collection(gumGum, noValue);
    expect(totals(all).withoutValue).toBe(0);
    expect(mostValuable(collection()).map(({ item }) => item.id)).toEqual(["gum"]);
    expect(
      mostValuable(collection({ ...gumGum, status: "disassembled" })).map(({ item }) => item.id),
    ).toEqual(["gum", "luffy"]);
  });

  it("lässt den Kaufpreis der Figur in der Summe, der Wert im Verlauf zählt nicht doppelt", () => {
    const bought = { ...luffy, purchasePrice: 800 };
    expect(totals(collection(gumGum, bought)).purchase).toBe(800);
    expect(valueAt(collection(), "2026-10-10", "2026-10-10")).toBe(5000);
  });
});

describe("Zählung: Figuren „im Set“", () => {
  it("zählt Figuren vollständiger Sets ohne eigenes Exemplar zusätzlich", () => {
    const all = aCollection({ sets: [gumGum], minifigs: [luffy] });
    expect(totals(all).counts.minifigs).toBe(1);
    expect(totals(all).counts.minifigsInSets).toBe(1);
    expect(inSetFigureCount(aCollection({ sets: [gumGum] }))).toBe(2);
  });

  it("zählt Stückzahlen einzeln und lässt Sets mit entnommenen Figuren aus", () => {
    const pack = aSet({
      id: "pack",
      containedFigures: [{ name: "Trooper", bricklinkId: "sw1", quantity: 3 }],
    });
    expect(inSetFigureCount(aCollection({ sets: [pack] }))).toBe(3);
    expect(inSetFigureCount(aCollection({ sets: [{ ...pack, status: "figuresRemoved" }] }))).toBe(
      0,
    );
  });
});

describe("Figuren einzeln anlegen", () => {
  it("bietet nur Figuren „im Set“ an, mit der Zahl der fehlenden Stücke", () => {
    const pack = aSet({
      id: "pack",
      containedFigures: [
        { name: "Trooper", bricklinkId: "sw1", quantity: 3 },
        { name: "Droid", bricklinkId: "sw2" },
      ],
    });
    const owned = aMinifig({ id: "own", bricklinkId: "sw2" });
    const options = creatableFigures(aCollection({ sets: [pack], minifigs: [owned] }), pack);
    expect(options.map((option) => [option.figure.name, option.missing])).toEqual([["Trooper", 3]]);
    const taken = { ...pack, status: "disassembled" as const };
    expect(creatableFigures(aCollection({ sets: [taken] }), taken)).toEqual([]);
  });

  it("legt die Figur mit Zustand des Sets, Verknüpfung und ohne Kaufpreis an; sie steht im Set", () => {
    const set = { ...gumGum, condition: "new" as const, theme: "One Piece" };
    const figure = figureOfSet(
      set,
      { name: "Luffy", bricklinkId: "op001", imageUrl: "https://x/y.png" },
      {
        id: "new-1",
        createdAt: "2026-11-02T10:00:00Z",
      },
    );
    expect(figure).toMatchObject({
      id: "new-1",
      name: "Luffy",
      bricklinkId: "op001",
      condition: "new",
      theme: "One Piece",
      catalogImageUrl: "https://x/y.png",
      manufacturer: { kind: "lego" },
      fromSet: { label: "75647", setId: "gum" },
    });
    expect(figure).not.toHaveProperty("purchasePrice");
    const all = withSaved(aCollection({ sets: [set] }), "minifig", figure);
    const place = placeOf(all, figure);
    expect(place).toMatchObject({ kind: "set", automatic: true });
    expect(inSetFigureCount(all)).toBe(1);
  });

  it("behält bei einer Big Fig den Typ Teil", () => {
    const figure = figureOfSet(
      gumGum,
      { name: "Rancor", bricklinkId: "11323pb01c01", bricklinkType: "PART" },
      { id: "r", createdAt: "2026-11-02T10:00:00Z" },
    );
    expect(figure.bricklinkType).toBe("PART");
  });
});
