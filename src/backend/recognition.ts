// Photo recognition as the app sees it (F1): a photo of a figure in, up to five suggestions with a
// BrickLink number out, answered by the Edge Function `recognize` (`supabase/functions/`, which
// forwards the photo to Brickognize). `SupabaseRecognizer` is the real one, `FakeRecognizer`
// (`fakeRecognizer.ts`) answers from a list in the demo and the end-to-end tests.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecognizeAnswer, Suggestion } from "../../supabase/functions/_shared/recognizeTypes";
import { CatalogCallError, failureOf } from "./catalog";

export type { Suggestion } from "../../supabase/functions/_shared/recognizeTypes";

/** A failed call is a `CatalogCallError` too: same reasons (offline, unavailable, limit, sign-in). */
export type RecognitionCallError = CatalogCallError;

export interface Recognizer {
  /** The best guesses for the figure on the photo, best first; an empty list is "nothing found". */
  recognize(photo: Blob): Promise<Suggestion[]>;
}

export class SupabaseRecognizer implements Recognizer {
  constructor(private readonly client: Pick<SupabaseClient, "functions">) {}

  async recognize(photo: Blob): Promise<Suggestion[]> {
    // The photo itself is the body; the function reads its type from the header.
    const { data, error } = await this.client.functions.invoke("recognize", {
      body: photo,
      headers: { "Content-Type": photo.type },
    });
    if (error) throw await failureOf(error, "recognize");
    const answer = data as Partial<RecognizeAnswer> | null;
    if (!answer || !Array.isArray(answer.suggestions)) {
      throw new CatalogCallError("recognize: unlesbare Antwort", "unavailable");
    }
    return answer.suggestions;
  }
}
