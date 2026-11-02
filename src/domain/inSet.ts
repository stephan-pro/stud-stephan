// Figures and their own complete set: the link "Stammt aus Set" made by the set number, the value
// that is then already in the set (F10), the figures that are only "im Set", and creating them.

import { setFigures } from "./details";
import { placeOf } from "./placement";
import { shortSetNumber } from "./showcase";
import type { CatalogFigure, Collection, Id, LegoSet, Minifig, ShowcaseItem } from "./types";

/** The own sets that carry this number, with or without "-1" ("75647" finds "75647-1"). */
export function setsByNumber(sets: readonly LegoSet[], text: string): LegoSet[] {
  const wanted = shortSetNumber(text.trim().toLowerCase());
  if (wanted === "") return [];
  return sets.filter((set) => {
    const number = set.setNumber?.toLowerCase();
    return number !== undefined && shortSetNumber(number) === wanted;
  });
}

/**
 * The set a figure is linked to by its number: the one set that carries it, else the one the
 * person chose (`chosen`) or the figure is already linked to if it is among several. Without
 * a label, or with several sets and no choice, there is none.
 */
export function originSetFor(
  sets: readonly LegoSet[],
  label: string,
  options: { readonly chosen?: Id | undefined; readonly current?: Id | undefined } = {},
): LegoSet | undefined {
  const matches = setsByNumber(sets, label);
  if (matches.length === 1) return matches[0];
  return (
    matches.find((set) => set.id === options.chosen) ??
    matches.find((set) => set.id === options.current)
  );
}

/** The figure linked to the set (its label is kept). */
export function linkedToSet(minifig: Minifig, set: LegoSet): Minifig {
  return { ...minifig, fromSet: { ...minifig.fromSet, setId: set.id } };
}

/**
 * Figures that name this set as origin by number but are not linked yet, as they must be saved. With
 * several sets of the same number nothing is linked by itself: the figure asks when it is saved.
 */
export function figuresToLink(collection: Collection, set: LegoSet): Minifig[] {
  if (!set.setNumber) return [];
  if (setsByNumber(collection.sets, set.setNumber).length !== 1) return [];
  return collection.minifigs
    .filter(
      (minifig) =>
        minifig.fromSet?.setId === undefined &&
        minifig.fromSet?.label !== undefined &&
        setsByNumber([set], minifig.fromSet.label).length === 1,
    )
    .map((minifig) => linkedToSet(minifig, set));
}

/**
 * The complete set whose value already contains this figure: it stands in the set it came from
 * (automatically or chosen). Out of the set, or with the set taken apart, it counts on its own.
 */
export function setIncludingValue(collection: Collection, item: ShowcaseItem): LegoSet | undefined {
  if (item.type !== "minifig") return undefined;
  const place = placeOf(collection, item);
  return place?.kind === "set" &&
    place.set.status === "complete" &&
    place.set.id === item.fromSet?.setId
    ? place.set
    : undefined;
}

/** Whether the value of this object counts on its own in the totals. */
export function countsOnItsOwn(collection: Collection, item: ShowcaseItem): boolean {
  return setIncludingValue(collection, item) === undefined;
}

/** The figures of complete sets that are only "im Set", no copy of their own; per piece. */
export function inSetFigureCount(collection: Collection): number {
  let count = 0;
  for (const set of collection.sets) {
    for (const { figure, owned, inSet } of setFigures(collection, set)) {
      if (inSet) count += (figure.quantity ?? 1) - owned.length;
    }
  }
  return count;
}

/** One entry of "Figuren einzeln anlegen": a catalog figure of the set and how many are still missing. */
export interface CreatableFigure {
  readonly figure: CatalogFigure;
  /** Index in the list of the figures of the set, the key of the choice. */
  readonly index: number;
  /** How many pieces are "im Set" without a copy of their own. */
  readonly missing: number;
}

/** The figures "im Set" that can be created, in the order of the set. */
export function creatableFigures(collection: Collection, set: LegoSet): CreatableFigure[] {
  return setFigures(collection, set).flatMap(({ figure, owned, inSet }, index) =>
    inSet ? [{ figure, index, missing: (figure.quantity ?? 1) - owned.length }] : [],
  );
}

/**
 * A figure created from the catalog entry the set holds: condition of the set, linked to it,
 * without a price. The set being complete, it stands in the set by itself.
 */
export function figureOfSet(
  set: LegoSet,
  figure: CatalogFigure,
  context: { readonly id: Id; readonly createdAt: string },
): Minifig {
  return {
    type: "minifig",
    id: context.id,
    name: figure.name,
    manufacturer: { kind: "lego" },
    condition: set.condition,
    photos: [],
    links: [],
    mods: [],
    createdAt: context.createdAt,
    ...(figure.bricklinkId ? { bricklinkId: figure.bricklinkId } : {}),
    ...(figure.bricklinkType === "PART" ? { bricklinkType: figure.bricklinkType } : {}),
    ...(figure.imageUrl ? { catalogImageUrl: figure.imageUrl } : {}),
    ...(set.theme ? { theme: set.theme } : {}),
    fromSet: {
      ...(set.setNumber ? { label: shortSetNumber(set.setNumber) } : {}),
      setId: set.id,
    },
  };
}
