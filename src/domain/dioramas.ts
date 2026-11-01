// Figures in dioramas (F8). A figure stands in at most one diorama: the minifig holds the one
// `dioramaId`, so two dioramas can never claim the same figure.

import { type CoverImage, normalize } from "./showcase";
import type { Collection, Diorama, Id, Minifig } from "./types";

/** The photos of a diorama in their order, the first is the cover (S5, S6). */
export function dioramaImages(diorama: Diorama): CoverImage[] {
  return diorama.photos.map((path) => ({ kind: "photo", path }));
}

export function figuresInDiorama(collection: Collection, dioramaId: Id): Minifig[] {
  return collection.minifigs.filter((minifig) => minifig.dioramaId === dioramaId);
}

/** "N Figuren haben noch kein Diorama". */
export function figuresWithoutDiorama(collection: Collection): Minifig[] {
  return collection.minifigs.filter((minifig) => !minifig.dioramaId);
}

/**
 * The search of the diorama list (S5, P15): every word must appear in the name, the note or the
 * name of a figure standing in it (case and accents do not matter). An empty search keeps all.
 */
export function filterDioramas(collection: Collection, query: string): Diorama[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return collection.dioramas;
  return collection.dioramas.filter((diorama) => {
    const text = normalize(
      [
        diorama.name,
        diorama.note,
        ...figuresInDiorama(collection, diorama.id).map((figure) => figure.name),
      ]
        .filter(Boolean)
        .join(" "),
    );
    return words.every((word) => text.includes(word));
  });
}

/** Of the chosen figures, those that already stand in another diorama ("steht in: …"). */
export function figuresToMove(
  collection: Collection,
  dioramaId: Id,
  minifigIds: readonly Id[],
): { minifig: Minifig; from: Diorama }[] {
  const chosen = new Set(minifigIds);
  return collection.minifigs.flatMap((minifig) => {
    if (!chosen.has(minifig.id) || !minifig.dioramaId || minifig.dioramaId === dioramaId) return [];
    const from = collection.dioramas.find((diorama) => diorama.id === minifig.dioramaId);
    return from ? [{ minifig, from }] : [];
  });
}

/** The figures that can be put into this diorama (those already in it are not offered), A–Z. */
export function assignableFigures(
  collection: Collection,
  dioramaId: Id,
  options: { readonly onlyWithout: boolean; readonly query: string },
): Minifig[] {
  const query = options.query.trim().toLowerCase();
  return collection.minifigs
    .filter((minifig) => {
      if (minifig.dioramaId === dioramaId) return false;
      if (options.onlyWithout && minifig.dioramaId) return false;
      if (query === "") return true;
      return (
        minifig.name.toLowerCase().includes(query) ||
        (minifig.bricklinkId?.toLowerCase().includes(query) ?? false)
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de") || (a.id < b.id ? -1 : 1));
}

/** The figures as they must be saved to stand in the diorama; those already there are left out. */
export function figuresToSave(
  collection: Collection,
  dioramaId: Id,
  minifigIds: readonly Id[],
): Minifig[] {
  const chosen = new Set(minifigIds);
  return collection.minifigs
    .filter((minifig) => chosen.has(minifig.id) && minifig.dioramaId !== dioramaId)
    .map((minifig) => ({ ...minifig, dioramaId }));
}

/** The figure as it must be saved to stand in no diorama. */
export function figureWithoutDiorama(minifig: Minifig): Minifig {
  return withoutDiorama(minifig);
}

function withoutDiorama(minifig: Minifig): Minifig {
  const { dioramaId: _, ...rest } = minifig;
  return rest;
}

/** Puts the figures into the diorama; figures from another diorama move (asked before in S6a). */
export function assignToDiorama(
  collection: Collection,
  dioramaId: Id,
  minifigIds: readonly Id[],
): Collection {
  if (!collection.dioramas.some((diorama) => diorama.id === dioramaId)) {
    throw new Error(`Unknown diorama ${dioramaId}`);
  }
  const chosen = new Set(minifigIds);
  return {
    ...collection,
    minifigs: collection.minifigs.map((minifig) =>
      chosen.has(minifig.id) ? { ...minifig, dioramaId } : minifig,
    ),
  };
}

export function removeFromDiorama(collection: Collection, minifigIds: readonly Id[]): Collection {
  const chosen = new Set(minifigIds);
  return {
    ...collection,
    minifigs: collection.minifigs.map((minifig) =>
      chosen.has(minifig.id) ? withoutDiorama(minifig) : minifig,
    ),
  };
}

/** Deletes the diorama; its figures stay in the collection and are "ohne Diorama" again. */
export function removeDiorama(collection: Collection, dioramaId: Id): Collection {
  return {
    ...collection,
    dioramas: collection.dioramas.filter((diorama) => diorama.id !== dioramaId),
    minifigs: collection.minifigs.map((minifig) =>
      minifig.dioramaId === dioramaId ? withoutDiorama(minifig) : minifig,
    ),
  };
}
