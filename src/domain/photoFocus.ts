// The part of a photo that matters (the figure), set by Stephan as a point in percent. Boxes that
// fill their area with a photo (tiles, cards, round pictures, thumbnails) centre on this point
// (CSS `object-position`); without a point it is the middle, 50 / 50.

import type { PhotoFocus } from "./types";

export const CENTER_FOCUS: PhotoFocus = { x: 50, y: 50 };

/** Keys of the map are photo paths, so a photo keeps its point when the photos are moved around. */
export type PhotoFocusMap = Readonly<Record<string, PhotoFocus>>;

/** A percentage the way the database keeps it: a whole number from 0 to 100. */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function isCenter(focus: PhotoFocus): boolean {
  return focus.x === CENTER_FOCUS.x && focus.y === CENTER_FOCUS.y;
}

/** The point of a photo; the middle where none was set. */
export function focusOf(map: PhotoFocusMap | undefined, path: string): PhotoFocus {
  return map?.[path] ?? CENTER_FOCUS;
}

/** `object-position` for a point: "30% 70%". */
export function objectPosition(focus: PhotoFocus): string {
  return `${focus.x}% ${focus.y}%`;
}

/** The map with the point of one photo set; the middle is not kept, it is the default. */
export function withFocus(
  map: PhotoFocusMap | undefined,
  path: string,
  focus: PhotoFocus,
): Record<string, PhotoFocus> {
  const { [path]: _, ...rest } = map ?? {};
  const point = { x: clampPercent(focus.x), y: clampPercent(focus.y) };
  return isCenter(point) ? rest : { ...rest, [path]: point };
}

/**
 * The map as it is saved: only photos that are listed, only points off the middle, whole
 * percentages. Nothing left gives `undefined`, so objects without points stay as they were.
 */
export function cleanFocus(
  map: PhotoFocusMap | undefined,
  photos: readonly string[],
): Record<string, PhotoFocus> | undefined {
  const result: Record<string, PhotoFocus> = {};
  for (const path of photos) {
    const point = map?.[path];
    if (!point) continue;
    const clean = { x: clampPercent(point.x), y: clampPercent(point.y) };
    if (!isCenter(clean)) result[path] = clean;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}
