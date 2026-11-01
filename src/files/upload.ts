// Uploads a file with retries and a progress the page can show. The browser's `fetch` reports no
// bytes sent, so the progress is the step: sending (which try), waiting for the next try, done.

import { type Remote, RemoteError } from "../backend/remote";
import type { Bucket } from "../backend/rules";

export type UploadProgress =
  | { readonly step: "sending"; readonly attempt: number; readonly attempts: number }
  | { readonly step: "waiting"; readonly attempt: number; readonly attempts: number }
  | { readonly step: "done"; readonly path: string };

export interface UploadOptions {
  /** Tries in all, the first included; default 4. */
  readonly attempts?: number;
  /** Pause after the failed try `attempt` (1, 2, …) in ms; default 1 s, 2 s, 4 s. */
  readonly waitMs?: (attempt: number) => number;
  readonly onProgress?: (progress: UploadProgress) => void;
  /** For tests: replaces the real pause. */
  readonly sleep?: (ms: number) => Promise<void>;
}

/**
 * Stores the file and answers its path. A temporary failure (no connection, server trouble) is
 * tried again after a pause; a refusal (too large, wrong type) stops at once, the last failure
 * is thrown when the tries run out.
 */
export async function uploadFile(
  remote: Pick<Remote, "putFile">,
  bucket: Bucket,
  name: string,
  bytes: Uint8Array,
  contentType: string,
  options: UploadOptions = {},
): Promise<string> {
  const attempts = options.attempts ?? 4;
  const waitMs = options.waitMs ?? ((attempt: number) => 1000 * 2 ** (attempt - 1));
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));

  for (let attempt = 1; ; attempt++) {
    options.onProgress?.({ step: "sending", attempt, attempts });
    try {
      const path = await remote.putFile(bucket, name, bytes, contentType);
      options.onProgress?.({ step: "done", path });
      return path;
    } catch (error) {
      const retry = error instanceof RemoteError && !error.permanent && attempt < attempts;
      if (!retry) throw error;
      options.onProgress?.({ step: "waiting", attempt, attempts });
      await sleep(waitMs(attempt));
    }
  }
}
