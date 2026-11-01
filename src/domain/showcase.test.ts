import { describe, expect, it } from "vitest";
import { aCollection, aMinifig, aPrice, aSet, aSpecialPart } from "./fixtures";
import {
  activeFilterCount,
  coverImage,
  filterShowcase,
  galleryImages,
  groupCopies,
  mainTheme,
  NO_FILTER,
  type ShowcaseEntry,
  shortSetNumber,
  showcase,
  showcaseItems,
  showcaseThemes,
  sortShowcase,
  subTheme,
  tileFacts,
  toEntries,
} from "./showcase";

const mod = { id: "mod-1", position: "arms", description: "Arme" } as const;
const names = (entries: ShowcaseEntry[]) =>
  entries.map((entry) => (entry.type === "minifig" ? entry.copies[0]?.name : entry.item.name));

describe("F5 Mehrere Exemplare", () => {
  const trooper = (fields = {}) =>
    aMinifig({ name: "Clone Trooper Phase II", bricklinkId: "sw0631", ...fields });

  it("F5 Die Vitrine fasst gleiche Figuren zu einer Kachel mit Anzahl zusammen (×3)", () => {
    const groups = groupCopies([trooper(), aMinifig(), trooper(), trooper()]);
    expect(groups.map((group) => group.copies.length)).toEqual([3, 1]);
  });

  it("F5 Jedes Exemplar bleibt ein eigener Eintrag mit eigenem Zustand, Fotos und Mods", () => {
    const used = trooper({ id: "a", condition: "used", photos: ["a.webp"] });
    const modded = trooper({ id: "b", condition: "new", mods: [mod] });
    const [group] = groupCopies([used, modded]);
    expect(group?.copies).toHaveLength(2);
    expect(group?.copies).toEqual(expect.arrayContaining([used, modded]));
  });

  it("F5 Ein Tipp zeigt die einzelnen Exemplare, das neueste zuerst", () => {
    const old = trooper({ id: "old", createdAt: "2025-03-01T10:00:00Z" });
    const recent = trooper({ id: "new", createdAt: "2026-10-01T10:00:00Z" });
    expect(groupCopies([old, recent])[0]?.copies.map((copy) => copy.id)).toEqual(["new", "old"]);
  });

  it("F5 Gleich heißt: gleicher Hersteller und gleiche Nummer (Groß-/Kleinschreibung egal)", () => {
    const groups = groupCopies([
      trooper(),
      trooper({ bricklinkId: "SW0631" }),
      trooper({ manufacturer: { kind: "custom", name: "Shop" } }),
      trooper({ bricklinkId: "sw0605" }),
    ]);
    expect(groups.map((group) => group.copies.length)).toEqual([2, 1, 1]);
  });

  it("F5 Ohne Nummer zählen Figuren mit gleichem Namen beim selben Hersteller als gleich", () => {
    const guard = (fields = {}) =>
      aMinifig({ name: "Burgwache", manufacturer: { kind: "bluebrixx" }, ...fields });
    const { bricklinkId: _, ...noNumber } = guard();
    const groups = groupCopies([
      noNumber,
      { ...noNumber, id: "g2", name: " burgwache" },
      { ...noNumber, id: "g3", manufacturer: { kind: "custom", name: "Shop" } },
      { ...noNumber, id: "g4", manufacturer: { kind: "custom", name: "shop" } },
    ]);
    expect(groups.map((group) => group.copies.length)).toEqual([2, 2]);
  });
});

describe("F11 Vitrine", () => {
  const rex = aMinifig({
    id: "rex",
    mods: [mod],
    dioramaId: "umbara",
    createdAt: "2026-10-03T10:00:00Z",
  });
  const fives = aMinifig({
    id: "fives",
    name: "ARC Trooper Fives",
    bricklinkId: "sw0542",
    condition: "new",
    createdAt: "2026-10-05T10:00:00Z",
  });
  const guard = aMinifig({
    id: "guard",
    name: "Burgwache",
    bricklinkId: "",
    manufacturer: { kind: "bluebrixx" },
    theme: "Ritter",
    purchasePrice: 400,
    createdAt: "2026-09-01T10:00:00Z",
  });
  const set = aSet({ id: "set", theme: "Star Wars", createdAt: "2026-10-04T10:00:00Z" });
  const coin = aSpecialPart({
    id: "coin",
    theme: "Star Wars",
    manualValue: { cents: 990, enteredOn: "2025-05-12" },
    createdAt: "2026-08-01T10:00:00Z",
  });
  const items = [rex, fives, guard, set, coin];
  const filter = (fields: Partial<typeof NO_FILTER>) =>
    filterShowcase(items, { ...NO_FILTER, ...fields }).map((item) => item.id);

  it("F11 Ohne Filter zeigt die Vitrine alle Figuren, Sets und Sonderteile", () => {
    expect(filter({})).toEqual(["rex", "fives", "guard", "set", "coin"]);
  });

  it("F11 Filter Objektart: Figuren · Sets · Sonderteile", () => {
    expect(filter({ type: "minifig" })).toEqual(["rex", "fives", "guard"]);
    expect(filter({ type: "legoSet" })).toEqual(["set"]);
    expect(filter({ type: "specialPart" })).toEqual(["coin"]);
  });

  it("F11 Filter Thema/Reihe nutzt das Hauptthema", () => {
    expect(mainTheme("Star Wars – The Clone Wars")).toBe("Star Wars");
    expect(mainTheme(undefined)).toBeUndefined();
    expect(mainTheme(" ")).toBeUndefined();
    expect(filter({ themes: ["Ritter"] })).toEqual(["guard"]);
    expect(filter({ themes: ["star wars"] })).toEqual(["rex", "fives", "set", "coin"]);
  });

  it("F11 Filter Hersteller", () => {
    expect(filter({ manufacturers: ["bluebrixx"] })).toEqual(["guard"]);
    expect(filter({ manufacturers: ["lego", "custom"] })).toEqual(["rex", "fives", "set", "coin"]);
  });

  it("F11 Filter Zustand", () => {
    expect(filter({ conditions: ["new"] })).toEqual(["fives", "coin"]);
    expect(filter({ conditions: ["new", "used"] })).toHaveLength(5);
  });

  it("F11 Filter modifiziert ja/nein zeigt nur Figuren", () => {
    expect(filter({ modified: "yes" })).toEqual(["rex"]);
    expect(filter({ modified: "no" })).toEqual(["fives", "guard"]);
  });

  it("F11 Filter ohne Diorama zeigt nur Figuren ohne Diorama", () => {
    expect(filter({ withoutDiorama: true })).toEqual(["fives", "guard"]);
  });

  it("F11 Suche in Name, Nummer, Thema und Hersteller, ohne Groß-/Kleinschreibung", () => {
    expect(filter({ query: "fives" })).toEqual(["fives"]);
    expect(filter({ query: "SW0542" })).toEqual(["fives"]);
    expect(filter({ query: "clone wars rex" })).toEqual(["rex"]);
    expect(filter({ query: "Ritter" })).toEqual(["guard"]);
    expect(filter({ query: "  " })).toHaveLength(5);
    const custom = aMinifig({
      id: "c",
      manufacturer: { kind: "custom", name: "Clone Army Customs" },
    });
    expect(filterShowcase([custom], { ...NO_FILTER, query: "army" })).toEqual([custom]);
  });

  it("F11 Suche ignoriert Akzente", () => {
    const pokemon = aMinifig({ id: "p", name: "Pokémon-Trainer" });
    expect(filterShowcase([pokemon], { ...NO_FILTER, query: "pokemon" })).toEqual([pokemon]);
  });

  it("F11 Filter lassen sich kombinieren", () => {
    expect(filter({ type: "minifig", conditions: ["used"], themes: ["Star Wars"] })).toEqual([
      "rex",
    ]);
  });

  it("F11 Der Filter-Knopf zählt die aktiven Filter", () => {
    expect(activeFilterCount(NO_FILTER)).toBe(0);
    expect(activeFilterCount({ ...NO_FILTER, type: "legoSet", query: "x" })).toBe(0);
    expect(
      activeFilterCount({
        ...NO_FILTER,
        themes: ["Star Wars", "Ritter"],
        manufacturers: ["lego"],
        conditions: ["new"],
        modified: "no",
        withoutDiorama: true,
      }),
    ).toBe(5);
  });

  it("F11 Die Themen für den Filter sind Hauptthemen mit ihren Unterthemen, alphabetisch und ohne Doppelte", () => {
    const ninja = aMinifig({ theme: "Ninjago – Staffel 1" });
    const lower = aMinifig({ theme: "star wars" });
    const mando = aMinifig({ theme: "Star Wars – The Mandalorian" });
    const again = aMinifig({ theme: "star wars – the clone wars" });
    expect(showcaseThemes([...items, ninja, lower, mando, again, aMinifig({ theme: "" })])).toEqual(
      [
        { theme: "Ninjago", subThemes: [{ theme: "Ninjago – Staffel 1", name: "Staffel 1" }] },
        { theme: "Ritter", subThemes: [] },
        {
          theme: "Star Wars",
          subThemes: [
            { theme: "Star Wars – The Clone Wars", name: "The Clone Wars" },
            { theme: "Star Wars – The Mandalorian", name: "The Mandalorian" },
          ],
        },
      ],
    );
  });

  it("F11 Ein Hauptthema im Filter nimmt alle Unterthemen mit, ein Unterthema nur sich selbst", () => {
    const clone = aMinifig({ id: "clone", theme: "Star Wars – The Clone Wars" });
    const mando = aMinifig({ id: "mando", theme: "Star Wars – The Mandalorian" });
    const plain = aMinifig({ id: "plain", theme: "Star Wars" });
    const other = aMinifig({ id: "other", theme: "Ritter" });
    const ids = (themes: string[]) =>
      filterShowcase([clone, mando, plain, other], { ...NO_FILTER, themes }).map((i) => i.id);
    expect(ids(["Star Wars"])).toEqual(["clone", "mando", "plain"]);
    expect(ids(["Star Wars – The Clone Wars"])).toEqual(["clone"]);
    expect(ids(["star wars – the mandalorian", "Ritter"])).toEqual(["mando", "other"]);
  });

  it("F11 Das Unterthema ist der Teil nach dem Gedankenstrich", () => {
    expect(subTheme("Star Wars – The Clone Wars")).toBe("The Clone Wars");
    expect(subTheme("Star Wars")).toBeUndefined();
    expect(subTheme(undefined)).toBeUndefined();
  });

  it("F11 Die Galerie zeigt eigene Fotos in Reihenfolge, das Katalogbild zuletzt", () => {
    const rexWith = aMinifig({ photos: ["a.webp", "b.webp"], catalogImageUrl: "https://x/y.png" });
    expect(galleryImages(rexWith)).toEqual([
      { kind: "photo", path: "a.webp" },
      { kind: "photo", path: "b.webp" },
      { kind: "catalog", url: "https://x/y.png" },
    ]);
    expect(galleryImages(aMinifig())).toEqual([]);
  });

  it("F5 Die Kachel zeigt Anzahl, Mod, fehlendes Diorama und den Wert des wertvollsten Exemplars", () => {
    const prices = [aPrice("sw0194", "2026-10-27", { used: 3850, new: 5200 })];
    const copies = [
      aMinifig({ id: "c1", dioramaId: "d" }),
      aMinifig({ id: "c2", condition: "new", mods: [mod] }),
    ];
    const [group] = toEntries(copies);
    expect(tileFacts(group as ShowcaseEntry, prices)).toEqual({
      name: "Captain Rex",
      manufacturer: { kind: "lego" },
      number: "sw0194",
      theme: "Star Wars",
      copies: 2,
      modified: true,
      withoutDiorama: true,
      cents: 5200,
      valueMissing: false,
    });
  });

  it("F10 Die Kachel eines Objekts ohne Wert sagt es, ohne Nummer und Thema fehlen sie", () => {
    const [entry] = toEntries([
      aMinifig({ bricklinkId: "", theme: "", manufacturer: { kind: "custom", name: "X" } }),
    ]);
    expect(tileFacts(entry as ShowcaseEntry, [])).toMatchObject({
      copies: 1,
      modified: false,
      cents: 0,
      valueMissing: true,
    });
    expect(tileFacts(entry as ShowcaseEntry, [])).not.toHaveProperty("number");
    expect(tileFacts(entry as ShowcaseEntry, [])).not.toHaveProperty("theme");
  });

  it("F7 Die Kachel eines Sets und die Setnummer ohne Versionsendung", () => {
    const [entry] = toEntries([aSet({ setNumber: "75372-1" })]);
    expect(tileFacts(entry as ShowcaseEntry, [])).toMatchObject({
      number: "75372-1",
      modified: false,
      withoutDiorama: false,
    });
    expect(shortSetNumber("75372-1")).toBe("75372");
    expect(shortSetNumber("BB-1234")).toBe("BB-1234");
  });

  it("F11 Sortierung „zuletzt hinzugefügt“, neueste zuerst", () => {
    const entries = sortShowcase(toEntries(items), "recent", []);
    expect(names(entries)).toEqual([
      "ARC Trooper Fives",
      "Clone Trooper & Battle Droid Battle Pack",
      "Captain Rex",
      "Burgwache",
      "Sammelmünze",
    ]);
  });

  it("F11 Sortierung nach Name", () => {
    expect(names(sortShowcase(toEntries(items), "name", []))).toEqual([
      "ARC Trooper Fives",
      "Burgwache",
      "Captain Rex",
      "Clone Trooper & Battle Droid Battle Pack",
      "Sammelmünze",
    ]);
  });

  it("F11 Sortierung nach Wert, wertvollste zuerst", () => {
    const prices = [
      aPrice("sw0194", "2026-10-27", { used: 3850 }),
      aPrice("sw0542", "2026-10-27", { new: 2400 }),
      aPrice("75372-1", "2026-10-27", { used: 2100 }, "legoSet"),
    ];
    expect(names(sortShowcase(toEntries(items), "value", prices))).toEqual([
      "Captain Rex",
      "ARC Trooper Fives",
      "Clone Trooper & Battle Droid Battle Pack",
      "Sammelmünze",
      "Burgwache",
    ]);
  });

  it("F11 Eine Gruppe sortiert mit ihrem neuesten und ihrem wertvollsten Exemplar", () => {
    const newRex = aMinifig({ ...rex, id: "rex-2", createdAt: "2026-11-01T10:00:00Z" });
    const grouped = toEntries([rex, { ...newRex, condition: "new" }, fives]);
    const prices = [aPrice("sw0194", "2026-10-27", { used: 100, new: 5000 })];
    expect(names(sortShowcase(grouped, "recent", []))).toEqual([
      "Captain Rex",
      "ARC Trooper Fives",
    ]);
    expect(names(sortShowcase(grouped, "value", prices))).toEqual([
      "Captain Rex",
      "ARC Trooper Fives",
    ]);
  });

  it("F11 Gleich benannte Kacheln stehen immer in derselben Reihenfolge", () => {
    const a = aSet({ id: "a", name: "Gleich" });
    const b = aSet({ id: "b", name: "Gleich" });
    expect(sortShowcase(toEntries([b, a]), "name", []).map((entry) => entry.key)).toEqual([
      "legoSet:a",
      "legoSet:b",
    ]);
  });

  it("F11 Eigene Fotos vor Katalogbild", () => {
    const [entry] = toEntries([
      aMinifig({ photos: ["mine.webp", "second.webp"], catalogImageUrl: "https://cdn/rex.png" }),
    ]);
    expect(entry && coverImage(entry)).toEqual({ kind: "photo", path: "mine.webp" });
    const [catalogOnly] = toEntries([aSet({ catalogImageUrl: "https://cdn/set.png" })]);
    expect(catalogOnly && coverImage(catalogOnly)).toEqual({
      kind: "catalog",
      url: "https://cdn/set.png",
    });
    const [nothing] = toEntries([aSpecialPart()]);
    expect(nothing && coverImage(nothing)).toBeUndefined();
  });

  it("F11 Bei einer Gruppe zeigt die Kachel das erste Exemplar mit eigenem Foto", () => {
    const [group] = groupCopies([
      aMinifig({ createdAt: "2026-10-02T10:00:00Z", catalogImageUrl: "https://cdn/rex.png" }),
      aMinifig({ createdAt: "2026-10-01T10:00:00Z", photos: ["old.webp"] }),
    ]);
    expect(group && coverImage(group)).toEqual({ kind: "photo", path: "old.webp" });
  });

  it("F11 showcase() filtert, gruppiert und sortiert in einem Schritt", () => {
    const { dioramaId: _, ...looseRex } = rex;
    const collection = aCollection({
      minifigs: [rex, { ...looseRex, id: "rex-2" }, fives, guard],
      sets: [set],
      specialParts: [coin],
    });
    expect(showcaseItems(collection)).toHaveLength(6);
    const entries = showcase(collection, { ...NO_FILTER, type: "minifig" }, "name");
    expect(entries.map((entry) => (entry.type === "minifig" ? entry.copies.length : 0))).toEqual([
      1, 1, 2,
    ]);
  });
});
