// `Recognizer` from a list in memory: the demo and the end-to-end tests. Answers the same list for
// every photo (the photo itself is not looked at) and can be cut off, told to fail or to find
// nothing, like the real function can.

import { CatalogCallError } from "./catalog";
import type { Recognizer, Suggestion } from "./recognition";

/** How the fake answers when told otherwise (the fake build reads it from the device's storage). */
export type RecognitionControl =
  | "offline"
  | "unavailable"
  | "limit_reached"
  | "none"
  | "one"
  | undefined;

export class FakeRecognizer implements Recognizer {
  /** When false, every call fails as without a connection. */
  online = true;
  /** Photos received, newest last: their type and size. */
  readonly calls: string[] = [];

  constructor(
    private readonly suggestions: readonly Suggestion[],
    private readonly control: () => RecognitionControl = () => undefined,
  ) {}

  async recognize(photo: Blob): Promise<Suggestion[]> {
    this.calls.push(`${photo.type} ${photo.size}`);
    const mode = this.control();
    if (!this.online || mode === "offline") {
      throw new CatalogCallError("Keine Verbindung", "offline");
    }
    if (mode === "unavailable" || mode === "limit_reached") {
      throw new CatalogCallError("Dienst gestört", mode);
    }
    if (mode === "none") return [];
    // One single suggestion is what Brickognize answered in P2.
    return mode === "one" ? this.suggestions.slice(0, 1) : [...this.suggestions];
  }
}
