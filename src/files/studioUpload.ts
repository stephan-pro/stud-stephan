// Sends a Studio file (`.io`) of a diorama to storage and makes the entry the diorama lists for it.
// Pure but for the file's own `arrayBuffer`; the page shows the progress.

import type { Remote } from "../backend/remote";
import type { Id, StudioFile } from "../domain/types";
import {
  STUDIO_CONTENT_TYPE,
  studioFileEntry,
  studioFileProblem,
  studioStorageName,
} from "./studioFile";
import { type UploadOptions, uploadFile } from "./upload";

/** What a chosen file needs to be a Studio file. */
export interface ChosenFile {
  readonly name: string;
  readonly size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * Uploads the file as `<diorama>/<file id>.io` and answers the entry for the diorama. A file that
 * cannot be a Studio file is refused before anything is sent (`StudioFileRefused`).
 */
export async function uploadStudioFile(
  remote: Pick<Remote, "putFile">,
  dioramaId: Id,
  fileId: Id,
  file: ChosenFile,
  uploadedAt: string,
  options: UploadOptions = {},
): Promise<StudioFile> {
  const problem = studioFileProblem(file);
  if (problem) throw new StudioFileRefused(problem);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const path = await uploadFile(
    remote,
    "studio-files",
    studioStorageName(dioramaId, fileId),
    bytes,
    STUDIO_CONTENT_TYPE,
    options,
  );
  return studioFileEntry(fileId, file, path, uploadedAt);
}

export class StudioFileRefused extends Error {
  constructor(readonly problem: NonNullable<ReturnType<typeof studioFileProblem>>) {
    super(problem);
    this.name = "StudioFileRefused";
  }
}
