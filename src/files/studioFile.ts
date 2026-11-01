// Studio files (`.io`, the BrickLink Studio format) of a diorama: what may be uploaded and how
// they are named in storage. Pure; the upload itself is `uploadFile`.

import { MAX_FILE_BYTES } from "../backend/rules";
import type { Id, StudioFile, Timestamp } from "../domain/types";

export const STUDIO_MAX_BYTES = MAX_FILE_BYTES["studio-files"];
/** Studio files are sent as plain bytes (the bucket takes nothing else). */
export const STUDIO_CONTENT_TYPE = "application/octet-stream";

export type StudioFileProblem = "not_io" | "empty" | "too_large";

/** Why a file cannot be a Studio file, or `undefined` if it can. */
export function studioFileProblem(file: {
  readonly name: string;
  readonly size: number;
}): StudioFileProblem | undefined {
  if (!/\.io$/i.test(file.name)) return "not_io";
  if (file.size === 0) return "empty";
  if (file.size > STUDIO_MAX_BYTES) return "too_large";
  return undefined;
}

/** The name in storage: one folder per diorama, the file's own id as name (no odd characters). */
export function studioStorageName(dioramaId: Id, fileId: Id): string {
  return `${dioramaId}/${fileId}.io`;
}

/** The entry a diorama lists for an uploaded file; `fileName` stays as the person named it. */
export function studioFileEntry(
  id: Id,
  file: { readonly name: string; readonly size: number },
  path: string,
  uploadedAt: Timestamp,
): StudioFile {
  return { id, fileName: file.name, sizeBytes: file.size, uploadedAt, path };
}

/** The name in storage of a photo: next to the object, the photo's own id as name. */
export function photoStorageName(objectId: Id, photoId: Id, contentType: string): string {
  const extension =
    contentType === "image/webp" ? "webp" : contentType === "image/png" ? "png" : "jpg";
  return `${objectId}/${photoId}.${extension}`;
}
