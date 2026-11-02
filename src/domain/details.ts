// What the detail pages (S2 figure, S3 set, S4 special part) need besides the object itself:
// other copies, the set a figure comes from, the figures of a set. Where a figure stands is in `placement.ts`.

import { groupCopies, showcaseItems } from "./showcase";
import type { CatalogFigure, Collection, Id, LegoSet, Minifig, ShowcaseItem } from "./types";

export function findItem(
  collection: Collection,
  type: ShowcaseItem["type"],
  id: Id,
): ShowcaseItem | undefined {
  return showcaseItems(collection).find((item) => item.type === type && item.id === id);
}

/** The other copies of the same figure (F5), newest first. */
export function otherCopies(collection: Collection, minifig: Minifig): Minifig[] {
  const group = groupCopies(collection.minifigs).find((candidate) =>
    candidate.copies.some((copy) => copy.id === minifig.id),
  );
  return group?.copies.filter((copy) => copy.id !== minifig.id) ?? [];
}

/** The set of the own collection the figure is linked to ("Stammt aus Set"). */
export function ownSetOf(collection: Collection, minifig: Minifig): LegoSet | undefined {
  const setId = minifig.fromSet?.setId;
  return setId ? collection.sets.find((set) => set.id === setId) : undefined;
}

/** A figure the catalog lists in a set, with the own copies of it. */
export interface SetFigure {
  figure: CatalogFigure;
  /** Own copies, newest first; empty = missing. */
  owned: Minifig[];
}

const sameNumber = (a: string | undefined, b: string | undefined) =>
  a !== undefined && b !== undefined && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The figures of a set with the own copies (F7): same BrickLink number, or, for a figure that
 * came out of this very set, the same name.
 */
export function setFigures(collection: Collection, set: LegoSet): SetFigure[] {
  return set.containedFigures.map((figure) => {
    const owned = collection.minifigs
      .filter((minifig) =>
        figure.bricklinkId
          ? minifig.manufacturer.kind === "lego" &&
            sameNumber(minifig.bricklinkId, figure.bricklinkId)
          : minifig.fromSet?.setId === set.id && minifig.name === figure.name,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
    return { figure, owned };
  });
}

/** "2 / 4": figures of the set at hand out of all it contains (a figure counts per piece). */
export function setFigureProgress(figures: readonly SetFigure[]): { have: number; total: number } {
  let have = 0;
  let total = 0;
  for (const { figure, owned } of figures) {
    const quantity = figure.quantity ?? 1;
    total += quantity;
    have += Math.min(quantity, owned.length);
  }
  return { have, total };
}
