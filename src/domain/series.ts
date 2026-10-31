// Missing figures of a series (F13): every official figure of the series with its status.
// Everything on the wishlist also counts as missing ("18 fehlen · 3 davon auf der Wunschliste").

import type { CatalogFigure, Minifig, WishItem } from "./types";

export type SeriesStatus = "present" | "missing" | "wished";

export interface SeriesFigure {
  figure: CatalogFigure;
  status: SeriesStatus;
  /** Own copies of this figure, found by the BrickLink number. */
  copies: Minifig[];
}

export interface SeriesProgress {
  figures: SeriesFigure[];
  total: number;
  present: number;
  /** Not present, including the wished ones. */
  missing: number;
  /** Missing and on the wishlist. */
  wished: number;
}

const normalized = (id: string | undefined) => id?.trim().toLowerCase() || undefined;

/** Same figure if the BrickLink number matches; without a number nothing matches. */
function matches(figure: CatalogFigure, other: { bricklinkId?: string }): boolean {
  const id = normalized(figure.bricklinkId);
  return id !== undefined && id === normalized(other.bricklinkId);
}

/** A figure that is owned counts as present, even if another copy is wished. */
export function seriesProgress(
  catalogFigures: readonly CatalogFigure[],
  minifigs: readonly Minifig[],
  wishlist: readonly WishItem[],
): SeriesProgress {
  const wishedFigures = wishlist.filter((wish) => wish.type === "minifig");
  const figures = catalogFigures.map((figure): SeriesFigure => {
    const copies = minifigs.filter((minifig) => matches(figure, minifig));
    const status: SeriesStatus =
      copies.length > 0
        ? "present"
        : wishedFigures.some((wish) => matches(figure, wish))
          ? "wished"
          : "missing";
    return { figure, status, copies };
  });
  const present = figures.filter(({ status }) => status === "present").length;
  return {
    figures,
    total: figures.length,
    present,
    missing: figures.length - present,
    wished: figures.filter(({ status }) => status === "wished").length,
  };
}
