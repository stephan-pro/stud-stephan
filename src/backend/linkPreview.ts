// Capture by link as the app sees it (F3): a pasted address in, what can be read from it out,
// answered by the Edge Function `link-preview` (`supabase/functions/`, which fetches the page under
// the limits of `_shared/safeFetch.ts`). `SupabaseLinkPreviewer` is the real one, `FakeLinkPreviewer`
// (`fakeLinkPreviewer.ts`) answers from a few example pages in the demo and the end-to-end tests.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LinkAnswer, LinkFailure } from "../../supabase/functions/_shared/linkTypes";

export type {
  LinkAnswer,
  LinkFailure,
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
}
