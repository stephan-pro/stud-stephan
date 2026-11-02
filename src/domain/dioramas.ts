// Figures in dioramas (F8). A figure stands in at most one diorama: the minifig holds the one
// `dioramaId`, so two dioramas can never claim the same figure. Where figures can be put and what
// "not displayed" means (diorama or own set) is in `placement.ts`.

import { figureAt } from "./placement";
import { type CoverImage, normalize, photoImage } from "./showcase";
import type { Collection, Diorama, Id, Minifig } from "./types";

/** The photos of a diorama in their order, the first is the cover (S5, S6). */
export function dioramaImages(diorama: Diorama): CoverImage[] {
  return diorama.photos.map((path) => photoImage(diorama, path));
}

export function figuresInDiorama(collection: Collection, dioramaId: Id): Minifig[] {
  return collection.minifigs.filter((minifig) => minifig.dioramaId === dioramaId);
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
      chosen.has(minifig.id) ? figureAt(minifig, { kind: "diorama", id: dioramaId }) : minifig,
    ),
  };
}

export function removeFromDiorama(collection: Collection, minifigIds: readonly Id[]): Collection {
  const chosen = new Set(minifigIds);
  return {
    ...collection,
    minifigs: collection.minifigs.map((minifig) =>
      chosen.has(minifig.id) && minifig.dioramaId ? withoutDiorama(minifig) : minifig,
    ),
  };
}

/** Deletes the diorama; its figures stay in the collection and stand in no diorama any more. */
export function removeDiorama(collection: Collection, dioramaId: Id): Collection {
  return {
    ...collection,
    dioramas: collection.dioramas.filter((diorama) => diorama.id !== dioramaId),
    minifigs: collection.minifigs.map((minifig) =>
      minifig.dioramaId === dioramaId ? withoutDiorama(minifig) : minifig,
    ),
  };
}
