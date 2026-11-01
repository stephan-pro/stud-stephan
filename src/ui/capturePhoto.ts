// The photo taken for the recognition (S7a), kept while the person walks on to the search or to the
// form, so it ends up on the new figure ("Das eigene Foto wird an der Figur gespeichert", F1).
// Lives in memory only; the shell lets go of it when the person leaves that way of capturing.

let held: File | undefined;

export const CapturePhoto = {
  hold(photo: File): void {
    held = photo;
  },
  /** The photo, if there is one; it stays until `clear`, so a form opened again gets it again. */
  peek(): File | undefined {
    return held;
  },
  clear(): void {
    held = undefined;
  },
};
