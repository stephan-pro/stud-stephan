// Figures in dioramas (F8). A figure stands in at most one diorama: the minifig holds the one
// `dioramaId`, so two dioramas can never claim the same figure.

import type { Collection, Diorama, Id, Minifig } from "./types";

export function figuresInDiorama(collection: Collection, dioramaId: Id): Minifig[] {
  return collection.minifigs.filter((minifig) => minifig.dioramaId === dioramaId);
}

/** "N Figuren haben noch kein Diorama". */
export function figuresWithoutDiorama(collection: Collection): Minifig[] {
  return collection.minifigs.filter((minifig) => !minifig.dioramaId);
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
