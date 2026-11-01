// The price run as the app sees it (P11, S12): the state of the latest run (database function
// `price_run_status`) and "Jetzt aktualisieren" (Edge Function `bricklink`, `{op: "priceRun"}`).
// `SupabasePriceRunner` is the real one, `FakePriceRunner` (`fakePriceRun.ts`) runs over the
// collection of a `Remote` in the demo and the end-to-end tests.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PriceRunAnswer,
  PriceRunStatus,
} from "../../supabase/functions/_shared/priceRunTypes";
import { CatalogCallError, failureOf } from "./catalog";

export type { PriceRunStatus } from "../../supabase/functions/_shared/priceRunTypes";

/** A failed call is a `CatalogCallError`: offline, unavailable, limit, sign-in. */
export type PriceRunCallError = CatalogCallError;

export interface PriceRunner {
  /** The latest run of the person, or null if there was none yet. */
  status(): Promise<PriceRunStatus | null>;
  /**
   * Works on the person's run for a while (`start`: begins one if none is open) and answers its
   * state; called again while `open` is above 0 and the run is not paused.
   */
  run(start: boolean): Promise<PriceRunStatus | null>;
}

function isStatus(value: unknown): value is PriceRunStatus {
  const status = value as Partial<PriceRunStatus> | null;
  return (
    typeof status === "object" &&
    status !== null &&
    typeof status.startedAt === "string" &&
    typeof status.total === "number" &&
    typeof status.open === "number"
  );
}

/** The status as it came, or null; missing lists are filled in. */
export function readStatus(value: unknown): PriceRunStatus | null {
  if (!isStatus(value)) return null;
  return { ...value, failedNumbers: Array.isArray(value.failedNumbers) ? value.failedNumbers : [] };
}

export class SupabasePriceRunner implements PriceRunner {
  constructor(private readonly client: Pick<SupabaseClient, "functions" | "rpc">) {}

  async status(): Promise<PriceRunStatus | null> {
    let answer: { data: unknown; error: { message: string } | null; status: number };
    try {
      answer = await this.client.rpc("price_run_status");
    } catch (error) {
      throw new CatalogCallError(`price_run_status: ${String(error)}`, "offline");
    }
    if (answer.error) {
      throw new CatalogCallError(
        `price_run_status: ${answer.error.message}`,
        answer.status === 0 ? "offline" : "unavailable",
      );
    }
    return readStatus(answer.data);
  }

  async run(start: boolean): Promise<PriceRunStatus | null> {
    const { data, error } = await this.client.functions.invoke("bricklink", {
      body: { op: "priceRun", start },
    });
    if (error) throw await failureOf(error, "bricklink");
    const answer = data as Partial<PriceRunAnswer> | null;
    if (!answer || !("status" in answer)) {
      throw new CatalogCallError("bricklink: unlesbare Antwort", "unavailable");
    }
    return readStatus(answer.status);
  }
}
