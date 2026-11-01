// Capture by link as the app sees it (F3): a pasted address in, what can be read from it out,
// answered by the Edge Function `link-preview` (`supabase/functions/`, which fetches the page under
// the limits of `_shared/safeFetch.ts`). `SupabaseLinkPreviewer` is the real one, `FakeLinkPreviewer`
// (`fakeLinkPreviewer.ts`) answers from a few example pages in the demo and the end-to-end tests.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  LinkAnswer,
  LinkFailure,
  LinkImageAnswer,
} from "../../supabase/functions/_shared/linkTypes";

export type {
  LinkAnswer,
  LinkFailure,
  LinkImageAnswer,
  PageFields,
} from "../../supabase/functions/_shared/linkTypes";

/**
 * A call failed. `failure` says why: `offline` = no answer (device or function not reachable),
 * `blocked` = not an address the function may fetch, `unreachable` = the page did not answer
 * usably, `unavailable` = the function itself failed.
 */
export class LinkCallError extends Error {
  constructor(
    message: string,
    readonly failure: LinkFailure | "offline",
  ) {
    super(message);
    this.name = "LinkCallError";
  }
}

export interface LinkPreviewer {
  /** What the address gives; throws a `LinkCallError` where it cannot be read. */
  preview(address: string): Promise<LinkAnswer>;
  /**
   * The one picture at an address (a page's picture), fetched by the function under the same limits
   * as a page, so a page that forbids embedding still gives it. JPEG, PNG or WebP, at most 3 MB;
   * throws a `LinkCallError` where it cannot be fetched.
   */
  image(address: string): Promise<File>;
}

const IMAGE_EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

/** The picture of an answer as a file the form can send like a chosen photo. */
export function fileOfImage(answer: LinkImageAnswer): File {
  const text = atob(answer.data);
  const bytes = Uint8Array.from(text, (char) => char.charCodeAt(0));
  return new File([bytes], `bild.${IMAGE_EXTENSIONS[answer.contentType]}`, {
    type: answer.contentType,
  });
}

const FAILURES: readonly LinkFailure[] = [
  "bad_request",
  "not_signed_in",
  "blocked",
  "unreachable",
  "unavailable",
];

async function failureOf(error: unknown): Promise<LinkCallError> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    const body = (await context.json().catch(() => null)) as { failure?: unknown } | null;
    const failure = FAILURES.find((candidate) => candidate === body?.failure);
    return new LinkCallError(
      `link-preview: ${failure ?? context.status}`,
      failure ?? "unavailable",
    );
  }
  return new LinkCallError(`link-preview: ${String(error)}`, "offline");
}

export class SupabaseLinkPreviewer implements LinkPreviewer {
  constructor(private readonly client: Pick<SupabaseClient, "functions">) {}

  async preview(address: string): Promise<LinkAnswer> {
    const { data, error } = await this.client.functions.invoke("link-preview", {
      body: { url: address },
    });
    if (error) throw await failureOf(error);
    const answer = data as LinkAnswer | null;
    if (!answer || (answer.kind !== "catalog" && answer.kind !== "page")) {
      throw new LinkCallError("link-preview: unlesbare Antwort", "unavailable");
    }
    return answer;
  }

  async image(address: string): Promise<File> {
    const { data, error } = await this.client.functions.invoke("link-preview", {
      body: { image: address },
    });
    if (error) throw await failureOf(error);
    const answer = data as LinkImageAnswer | null;
    if (
      answer?.kind !== "image" ||
      typeof answer.data !== "string" ||
      !(answer.contentType in IMAGE_EXTENSIONS)
    ) {
      throw new LinkCallError("link-preview: unlesbare Antwort", "unavailable");
    }
    try {
      return fileOfImage(answer);
    } catch {
      throw new LinkCallError("link-preview: unlesbares Bild", "unavailable");
    }
  }
}
