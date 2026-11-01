// Hands bytes to the person as a file download. Only in the browser (needs the page).

/** Saves the bytes under the given name, exactly as they are. */
export function saveAsFile(
  bytes: Uint8Array,
  fileName: string,
  contentType = "application/octet-stream",
): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: contentType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // The browser has taken the file by then; giving the address back frees the memory.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
