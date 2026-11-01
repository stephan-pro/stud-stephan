// Collects the pieces of a ZIP in a `Blob`. Browsers keep large blobs outside the page's memory
// (on disk), so the pieces are handed over to the blob every few megabytes instead of piling up.

const FLUSH_BYTES = 8 * 1024 * 1024;

export class BlobSink {
  private blob = new Blob([]);
  private pending: Uint8Array[] = [];
  private pendingBytes = 0;

  /** Takes the next piece. */
  readonly write = (chunk: Uint8Array): void => {
    this.pending.push(chunk);
    this.pendingBytes += chunk.length;
    if (this.pendingBytes >= FLUSH_BYTES) this.flush();
  };

  /** Everything written so far as one blob. */
  toBlob(type = "application/zip"): Blob {
    this.flush();
    return new Blob([this.blob], { type });
  }

  private flush(): void {
    if (this.pending.length === 0) return;
    this.blob = new Blob([this.blob, ...(this.pending as BlobPart[])]);
    this.pending = [];
    this.pendingBytes = 0;
  }
}
