// The maths of making a photo small (N8): longest side at most 1,600 px, WebP of about 200–300 KB.
// Pure; the canvas part that applies it lives in `browserPhoto.ts`.

export const PHOTO_MAX_SIDE = 1600;
/** What a photo should come to; the server takes up to 2 MB, the plan wants ≤ 400 KB. */
export const PHOTO_TARGET_BYTES = 300 * 1024;

/** Tried in this order: first the full size at good quality, then lower quality, then smaller. */
export const SIDE_STEPS: readonly number[] = [PHOTO_MAX_SIDE, 1280, 1024];
export const QUALITY_STEPS: readonly number[] = [0.8, 0.7, 0.6, 0.5, 0.4];

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** The size with the longest side at most `maxSide`, same proportions, never enlarged. */
export function fitWithin(source: Size, maxSide: number): Size {
  const longest = Math.max(source.width, source.height);
  if (longest <= maxSide) return { width: source.width, height: source.height };
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  };
}

/**
 * Encodes the photo with growing effort until it is at most `target` bytes (steps above); when
 * no step gets there the smallest result comes back. `encode` makes the image file of one step.
 */
export async function shrinkToTarget<T extends { readonly size: number }>(
  source: Size,
  encode: (size: Size, quality: number) => Promise<T>,
  target: number = PHOTO_TARGET_BYTES,
): Promise<T> {
  let smallest: T | undefined;
  for (const side of SIDE_STEPS) {
    const size = fitWithin(source, side);
    for (const quality of QUALITY_STEPS) {
      const result = await encode(size, quality);
      if (result.size <= target) return result;
      if (smallest === undefined || result.size < smallest.size) smallest = result;
    }
  }
  return smallest as T;
}
