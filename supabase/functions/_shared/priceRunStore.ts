// The database side of the price run (P11): the queue of `supabase/migrations/…_price_run.sql`,
// reached through PostgREST with the service role key. Unlike the catalog cache this is not best
// effort: if the database fails, the call fails, and what was taken goes back into the queue after
// three minutes by itself.

import type { StoreSettings } from "./catalogStore.ts";
import { CatalogError, type Fetch, isRecord, num, str } from "./json.ts";
import type { PriceRunStatus } from "./priceRunTypes.ts";

export type PricedKind = "minifig" | "legoSet";

/** One catalog item taken from the queue. */
export interface ClaimedItem {
  readonly runId: number;
  readonly itemType: PricedKind;
  readonly bricklinkId: string;
  /** How often it was taken, this time included. */
  readonly attempts: number;
}

export type ItemOutcome =
  | {
      readonly kind: "priced";
      readonly cents: Partial<Record<"new" | "used", number>>;
      readonly soldCount: Partial<Record<"new" | "used", number>>;
    }
  | { readonly kind: "empty" }
  | { readonly kind: "failed" }
  | { readonly kind: "retry" };

export interface PriceRunStore {
  /** Starts a run for the owner, unless one is open (then that one goes on). */
  begin(owner: string, trigger: "schedule" | "manual"): Promise<void>;
  /** Up to `limit` open items, of one owner or of all (`undefined`). */
  claim(owner: string | undefined, limit: number): Promise<ClaimedItem[]>;
  finish(item: ClaimedItem, outcome: ItemOutcome): Promise<void>;
  /** Puts taken items back; with `pausedUntil` every open run waits until then. */
  release(items: readonly ClaimedItem[], pausedUntil?: string): Promise<void>;
  /** Counts one BrickLink call of the day; `false` once the price run's share is used up. */
  countCall(day: string): Promise<boolean>;
  status(owner: string): Promise<PriceRunStatus | null>;
}

/** BrickLink allows 5,000 calls a day; catalog and prices together stop a little below. */
export const BRICKLINK_TOTAL_CAP = 4950;
/** The price run takes at most this many a day, so the catalog keeps enough for the day. */
export const PRICE_RUN_DAILY_CAP = 2500;

function isKind(value: unknown): value is PricedKind {
  return value === "minifig" || value === "legoSet";
}

/** The items of `price_run_claim`, read defensively. */
export function readClaimed(rows: unknown): ClaimedItem[] {
  if (!Array.isArray(rows)) throw new CatalogError("unavailable", "Warteschlange unlesbar");
  return rows.flatMap((row) => {
    if (!isRecord(row)) return [];
    const runId = num(row.runId);
    const bricklinkId = str(row.bricklinkId);
    if (runId === undefined || bricklinkId === undefined || !isKind(row.itemType)) return [];
    return [{ runId, itemType: row.itemType, bricklinkId, attempts: num(row.attempts) ?? 1 }];
  });
}

export function supabasePriceRunStore(settings: StoreSettings, send: Fetch): PriceRunStore {
  const headers = {
    apikey: settings.serviceRoleKey,
    Authorization: `Bearer ${settings.serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
    let response: Response;
    try {
      response = await send(`${settings.url}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers,
        body: JSON.stringify(args),
      });
    } catch (error) {
      throw new CatalogError("unavailable", `Datenbank nicht erreichbar: ${String(error)}`);
    }
    if (!response.ok) {
      throw new CatalogError("unavailable", `Datenbank: ${name} mit HTTP ${response.status}`);
    }
    const text = await response.text();
    return text === "" ? null : (JSON.parse(text) as unknown);
  }

  const keys = (item: ClaimedItem) => ({
    runId: item.runId,
    itemType: item.itemType,
    bricklinkId: item.bricklinkId,
  });

  return {
    async begin(owner, trigger) {
      await rpc("price_run_begin", { p_owner: owner, p_trigger: trigger });
    },

    async claim(owner, limit) {
      return readClaimed(await rpc("price_run_claim", { p_owner: owner ?? null, p_limit: limit }));
    },

    async finish(item, outcome) {
      await rpc("price_run_finish", {
        p_run: item.runId,
        p_item_type: item.itemType,
        p_bricklink_id: item.bricklinkId,
        p_outcome: outcome.kind,
        p_cents: outcome.kind === "priced" ? outcome.cents : null,
        p_sold: outcome.kind === "priced" ? outcome.soldCount : null,
      });
    },

    async release(items, pausedUntil) {
      await rpc("price_run_release", {
        p_items: items.map(keys),
        p_paused_until: pausedUntil ?? null,
      });
    },

    async countCall(day) {
      const answer = await rpc("price_count_call", {
        p_day: day,
        p_total_cap: BRICKLINK_TOTAL_CAP,
        p_price_cap: PRICE_RUN_DAILY_CAP,
      });
      return answer === true;
    },

    async status(owner) {
      const answer = await rpc("price_run_status", { p_owner: owner });
      return isRecord(answer) ? (answer as unknown as PriceRunStatus) : null;
    },
  };
}
