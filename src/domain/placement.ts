// Where a figure is displayed ("Steht in"): in one diorama, or in one own set, or nowhere. The
// minifig holds the place itself (`dioramaId` or `standsInSetId`, never both), so a figure can
// never be displayed in two places. A figure that came out of an own set with the status
// "vollständig" and has no place of its own counts as displayed in that set (automatic), unless
// `standsInSetId` is `null`: the person took it out of the set on purpose.

import type { Collection, Diorama, Id, LegoSet, Minifig } from "./types";

export type Place =
  | { readonly kind: "diorama"; readonly diorama: Diorama }
  | { readonly kind: "set"; readonly set: LegoSet; readonly automatic: boolean };

/** Where to put figures: a diorama or an own set. */
export interface Target {
  readonly kind: "diorama" | "set";
  readonly id: Id;
}

/** The place of a figure; an id of a diorama or set that is gone counts as no place of its own. */
export function placeOf(collection: Collection, minifig: Minifig): Place | undefined {
  const diorama = minifig.dioramaId
    ? collection.dioramas.find((candidate) => candidate.id === minifig.dioramaId)
    : undefined;
  if (diorama) return { kind: "diorama", diorama };
  const chosen = minifig.standsInSetId
    ? collection.sets.find((candidate) => candidate.id === minifig.standsInSetId)
    : undefined;
  if (chosen) return { kind: "set", set: chosen, automatic: false };
  // `null` is the deliberate "nicht ausgestellt": no automatic place then.
  if (minifig.standsInSetId === null) return undefined;
  const origin = minifig.fromSet?.setId
    ? collection.sets.find((candidate) => candidate.id === minifig.fromSet?.setId)
    : undefined;
  if (origin?.status === "complete") return { kind: "set", set: origin, automatic: true };
  return undefined;
}

/** The name of the place, for "steht in: …". */
export function placeName(place: Place): string {
  return place.kind === "diorama" ? place.diorama.name : place.set.name;
}

function isAt(place: Place | undefined, target: Target): boolean {
  if (!place) return false;
  return place.kind === "diorama"
    ? target.kind === "diorama" && place.diorama.id === target.id
    : target.kind === "set" && place.set.id === target.id;
}

/** The figures that are displayed nowhere ("Nicht ausgestellt"), in the order of the collection. */
export function figuresNotOnDisplay(collection: Collection): Minifig[] {
  return collection.minifigs.filter((minifig) => !placeOf(collection, minifig));
}

/** The ids of those figures, for the showcase filter and the tile marker. */
export function idsNotOnDisplay(collection: Collection): Set<Id> {
  return new Set(figuresNotOnDisplay(collection).map((minifig) => minifig.id));
}

/** A figure displayed in an own set, and whether only the status of the set says so. */
export interface DisplayedFigure {
  readonly minifig: Minifig;
  readonly automatic: boolean;
}

/** The figures displayed in this set ("Ausgestellte Figuren"), also those from other sets. */
export function figuresInSet(collection: Collection, setId: Id): DisplayedFigure[] {
  return collection.minifigs.flatMap((minifig) => {
    const place = placeOf(collection, minifig);
    return place?.kind === "set" && place.set.id === setId
      ? [{ minifig, automatic: place.automatic }]
      : [];
  });
}

/** Of the chosen figures, those that stand somewhere else on their own account ("steht in: …"). */
export function figuresToMove(
  collection: Collection,
  target: Target,
  minifigIds: readonly Id[],
): { minifig: Minifig; from: Diorama | LegoSet }[] {
  const chosen = new Set(minifigIds);
  return collection.minifigs.flatMap((minifig) => {
    if (!chosen.has(minifig.id)) return [];
    const place = placeOf(collection, minifig);
    if (!place || isAt(place, target)) return [];
    if (place.kind === "set" && place.automatic) return [];
    return [{ minifig, from: place.kind === "diorama" ? place.diorama : place.set }];
  });
}

/**
 * The figures that can be put there (those already displayed there are not offered), A–Z. With
 * `onlyWithout` only figures that are displayed nowhere.
 */
export function assignableFigures(
  collection: Collection,
  target: Target,
  options: { readonly onlyWithout: boolean; readonly query: string },
): Minifig[] {
  const query = options.query.trim().toLowerCase();
  return collection.minifigs
    .filter((minifig) => {
      const place = placeOf(collection, minifig);
      if (isAt(place, target)) return false;
      if (options.onlyWithout && place) return false;
      if (query === "") return true;
      return (
        minifig.name.toLowerCase().includes(query) ||
        (minifig.bricklinkId?.toLowerCase().includes(query) ?? false)
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de") || (a.id < b.id ? -1 : 1));
}

/** The figure as it must be saved to stand nowhere of its own (no diorama, no chosen set). */
export function figureWithoutPlace(minifig: Minifig): Minifig {
  const { dioramaId: _, standsInSetId: __, ...rest } = minifig;
  return rest;
}

/**
 * The figure as it must be saved after "Aus dem Set nehmen": displayed nowhere on purpose
 * (`standsInSetId: null`), which also overrules the automatic place of a complete set.
 */
export function figureTakenFromSet(minifig: Minifig): Minifig {
  return { ...figureWithoutPlace(minifig), standsInSetId: null };
}

/** The figure as it must be saved to stand there; its other place goes (never both). */
export function figureAt(minifig: Minifig, target: Target): Minifig {
  const rest = figureWithoutPlace(minifig);
  return target.kind === "diorama"
    ? { ...rest, dioramaId: target.id }
    : { ...rest, standsInSetId: target.id };
}

/** The figures as they must be saved to stand there; those already there are left out. */
export function figuresToSave(
  collection: Collection,
  target: Target,
  minifigIds: readonly Id[],
): Minifig[] {
  const chosen = new Set(minifigIds);
  return collection.minifigs
    .filter((minifig) => chosen.has(minifig.id) && !isAt(placeOf(collection, minifig), target))
    .map((minifig) => figureAt(minifig, target));
}
