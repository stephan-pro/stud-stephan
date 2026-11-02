// Missing figures of a series (F13): every official figure of the series with its status.
// Everything on the wishlist also counts as missing ("18 fehlen · 3 davon auf der Wunschliste").

import type { CatalogFigure, LegoSet, Minifig, WishItem } from "./types";

export type SeriesStatus = "present" | "missing" | "wished";

export interface SeriesFigure {
  figure: CatalogFigure;
  status: SeriesStatus;
  /** Own copies of this figure, found by the BrickLink number. */
  copies: Minifig[];
  /** The complete own set the figure sits in when it has no copy of its own. */
  inSet?: LegoSet;
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

/** The filter of the series page (S10a): everything, what is missing (also wished) or what is there. */
export type SeriesFilter = "all" | "missing" | "present";

export function filterSeries(
  figures: readonly SeriesFigure[],
  filter: SeriesFilter,
): SeriesFigure[] {
  if (filter === "all") return [...figures];
  return figures.filter(({ status }) => (status === "present") === (filter === "present"));
}

/**
 * The figures a build found as the catalog figures `seriesProgress` takes. A Big Fig (a BrickLink
 * part) comes with its type in the number, "PART:11323pb01c01"; the series store keeps only number,
 * name and picture.
 */
export function catalogFiguresOf(
  found: readonly { number: string; name: string; imageUrl?: string }[],
): CatalogFigure[] {
  return found.map((figure) => {
    const part = /^PART:(.+)$/.exec(figure.number);
    return {
      name: figure.name,
      bricklinkId: part?.[1] ?? figure.number,
      ...(part ? { bricklinkType: "PART" as const } : {}),
      ...(figure.imageUrl ? { imageUrl: figure.imageUrl } : {}),
    };
  });
}

/** Share of the series that is present, whole percent (the bar's width). */
export function seriesPercent(progress: Pick<SeriesProgress, "present" | "total">): number {
  return progress.total === 0 ? 0 : Math.round((progress.present / progress.total) * 100);
}

/**
 * A figure that is owned counts as present, even if another copy is wished. So does a figure not
 * captured on its own that sits in a complete own set (F13): it is physically there.
 */
export function seriesProgress(
  catalogFigures: readonly CatalogFigure[],
  minifigs: readonly Minifig[],
  wishlist: readonly WishItem[],
  sets: readonly LegoSet[] = [],
): SeriesProgress {
  const wishedFigures = wishlist.filter((wish) => wish.type === "minifig");
  const figures = catalogFigures.map((figure): SeriesFigure => {
    const copies = minifigs.filter((minifig) => matches(figure, minifig));
    const inSet =
      copies.length > 0
        ? undefined
        : sets.find(
            (set) =>
              set.status === "complete" &&
              set.containedFigures.some((contained) => matches(figure, contained)),
          );
    const status: SeriesStatus =
      copies.length > 0 || inSet
        ? "present"
        : wishedFigures.some((wish) => matches(figure, wish))
          ? "wished"
          : "missing";
    return { figure, status, copies, ...(inSet ? { inSet } : {}) };
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
