// `Recognizer` from lists in memory: the demo and the end-to-end tests. Answers the same list for
// every photo of a kind (the photo itself is not looked at) and can be cut off, told to fail or to
// find nothing, like the real function can.

import { CatalogCallError } from "./catalog";
import type { RecognizeKind, Recognizer, Suggestion } from "./recognition";

/** How the fake answers when told otherwise (the fake build reads it from the device's storage). */
export type RecognitionControl =
  | "offline"
  | "unavailable"
  | "limit_reached"
  | "none"
  | "one"
  /** A figure photo is known only as a part (a Big Fig); the other kinds answer as usual. */
  | "bigFig"
  | undefined;

/**
 * What each kind of photo is "recognized" as (and, for the control "bigFig", the part a figure
 * photo gives); a plain list is the answer for figures only.
 */
export type RecognitionAnswers =
  | readonly Suggestion[]
  | Partial<Record<RecognizeKind | "bigFig", readonly Suggestion[]>>;

export class FakeRecognizer implements Recognizer {
  /** When false, every call fails as without a connection. */
  online = true;
  /** Photos received, newest last: their type and size. */
  readonly calls: string[] = [];
  /** The kinds asked for, newest last. */
  readonly kinds: RecognizeKind[] = [];

  constructor(
    private readonly answers: RecognitionAnswers,
    private readonly control: () => RecognitionControl = () => undefined,
  ) {}

  async recognize(photo: Blob, kind: RecognizeKind = "minifig"): Promise<Suggestion[]> {
    this.calls.push(`${photo.type} ${photo.size}`);
    this.kinds.push(kind);
    const mode = this.control();
    if (!this.online || mode === "offline") {
      throw new CatalogCallError("Keine Verbindung", "offline");
    }
    if (mode === "unavailable" || mode === "limit_reached") {
      throw new CatalogCallError("Dienst gestört", mode);
    }
    if (mode === "none") return [];
    const suggestions: readonly Suggestion[] = Array.isArray(this.answers)
      ? kind === "minifig"
        ? this.answers
        : []
      : ((this.answers as Exclude<RecognitionAnswers, readonly Suggestion[]>)[
          mode === "bigFig" && kind === "minifig" ? "bigFig" : kind
        ] ?? []);
    // One single suggestion is what Brickognize answered in P2.
    return mode === "one" ? suggestions.slice(0, 1) : [...suggestions];
  }
}
