// The catalog as the app sees it (F2): official sets and minifigs by BrickLink number or by name,
// answered by the Edge Function `catalog` (`supabase/functions/`). `SupabaseCatalog` is the real one,
// `FakeCatalog` (`fakeCatalog.ts`) answers from a few example entries in the demo and the
// end-to-end tests.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CatalogAnswer,
  CatalogFailure,
  CatalogHit,
  CatalogItem,
  CatalogKind,
  CatalogRequest,
} from "../../supabase/functions/_shared/catalogTypes";

import { SOURCE_IDS, type SourcesAnswer } from "../../supabase/functions/_shared/sourcesTypes";

export type {
  CatalogFailure,
  CatalogFigureInfo,
  CatalogHit,
  CatalogItem,
  CatalogKind,
  CatalogSetInfo,
} from "../../supabase/functions/_shared/catalogTypes";

/**
 * A catalog call failed. `failure` says why: `offline` = no answer (device or function not
 * reachable), `not_found` = no such entry, `limit_reached` = BrickLink's day is used up,
 * `unavailable` = a service behind the function failed.
 */
export class CatalogCallError extends Error {
  constructor(
    message: string,
    readonly failure: CatalogFailure | "offline",
  ) {
    super(message);
    this.name = "CatalogCallError";
  }
}

export type { SourceId, SourceState } from "../../supabase/functions/_shared/sourcesTypes";

export interface Catalog {
  /** Entries matching a BrickLink/set number or a name; an empty list is "no match". */
  search(kind: CatalogKind, query: string): Promise<CatalogHit[]>;
  /** The full entry of a hit (`ref`), to fill a form from. */
  item(kind: CatalogKind, ref: string): Promise<CatalogItem>;
  /** The state of the four data sources, for the settings (P14); never a key. */
  sources(): Promise<SourcesAnswer["sources"]>;
}

const FAILURES: readonly CatalogFailure[] = [
  "bad_request",
  "not_signed_in",
  "not_found",
  "limit_reached",
  "unavailable",
];

/**
 * What a failed call of an Edge Function answered: the `failure` in its JSON body, if it has one.
 * `source` names the function in the message (`catalog`, `recognize`).
 */
export async function failureOf(error: unknown, source = "catalog"): Promise<CatalogCallError> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    const body = (await context.json().catch(() => null)) as { failure?: unknown } | null;
    const failure = FAILURES.find((candidate) => candidate === body?.failure);
    return new CatalogCallError(
      `${source}: ${failure ?? context.status}`,
      failure ?? "unavailable",
    );
  }
  return new CatalogCallError(`${source}: ${String(error)}`, "offline");
}

export class SupabaseCatalog implements Catalog {
  constructor(private readonly client: Pick<SupabaseClient, "functions">) {}

  async search(kind: CatalogKind, query: string): Promise<CatalogHit[]> {
    const answer = await this.call({ op: "search", kind, query });
    if (answer.op !== "search")
      throw new CatalogCallError("catalog: falsche Antwort", "unavailable");
    return answer.hits;
  }

  async item(kind: CatalogKind, ref: string): Promise<CatalogItem> {
    const answer = await this.call({ op: "item", kind, ref });
    if (answer.op !== "item") throw new CatalogCallError("catalog: falsche Antwort", "unavailable");
    return answer.item;
  }

  async sources(): Promise<SourcesAnswer["sources"]> {
    const { data, error } = await this.client.functions.invoke("catalog", {
      body: { op: "sources" },
    });
    if (error) throw await failureOf(error);
    const answer = data as Partial<SourcesAnswer> | null;
    const sources = answer?.sources;
    if (answer?.op !== "sources" || !sources || SOURCE_IDS.some((id) => !(id in sources))) {
      throw new CatalogCallError("catalog: unlesbare Antwort", "unavailable");
    }
    return sources;
  }

  private async call(request: CatalogRequest): Promise<CatalogAnswer> {
    const { data, error } = await this.client.functions.invoke("catalog", { body: request });
    if (error) throw await failureOf(error);
    const answer = data as CatalogAnswer | null;
    if (!answer || (answer.op !== "search" && answer.op !== "item")) {
      throw new CatalogCallError("catalog: unlesbare Antwort", "unavailable");
    }
    return answer;
  }
}
