// Makes a photo small in the browser with a canvas (no library): decoded with its EXIF rotation
// applied (`imageOrientation: "from-image"`, so a phone photo taken upright is not lying down),
// drawn at most 1,600 px on the longest side and encoded as WebP (JPEG where the browser cannot
// encode WebP, e.g. Safari). Needs a real browser, so the end-to-end tests cover it
// (`tests/e2e/photo.spec.ts`); the maths is in `photoSize.ts`.

import { type Size, shrinkToTarget } from "./photoSize";

export interface ResizedPhoto {
  readonly bytes: Uint8Array;
  /** "image/webp", or "image/jpeg" where WebP cannot be encoded. */
  readonly contentType: string;
  readonly width: number;
  readonly height: number;
}

/** The file could not be read as an image. */
export class PhotoError extends Error {
  constructor() {
    super("Das Foto konnte nicht gelesen werden.");
    this.name = "PhotoError";
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob === null ? reject(new PhotoError()) : resolve(blob)),
      type,
      quality,
    );
  });
}

export async function resizePhoto(file: Blob): Promise<ResizedPhoto> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoError();
  }
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (context === null) throw new PhotoError();

  const encode = async (size: Size, quality: number): Promise<Blob> => {
    canvas.width = size.width;
    canvas.height = size.height;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const webp = await toBlob(canvas, "image/webp", quality);
    // A browser that cannot encode WebP answers with PNG, far too big for a photo.
    return webp.type === "image/webp" ? webp : toBlob(canvas, "image/jpeg", quality);
  };

  try {
    const blob = await shrinkToTarget({ width: bitmap.width, height: bitmap.height }, encode);
    // The canvas still holds the last step tried, not necessarily the chosen one: ask the blob.
    const size = await sizeOf(blob);
    return {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      contentType: blob.type,
      width: size.width,
      height: size.height,
    };
  } finally {
    bitmap.close();
  }
}

async function sizeOf(blob: Blob): Promise<Size> {
  const image = await createImageBitmap(blob);
  const size = { width: image.width, height: image.height };
  image.close();
  return size;
}
