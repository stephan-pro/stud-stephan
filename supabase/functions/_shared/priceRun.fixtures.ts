// Test helpers of the price run (P11): BrickLink's price guide answers as seen in P2, and the queue
// of the database in memory, following the rules of `price_run_claim`, `…_finish`, `…_release`.

import { brickLink, type Route } from "./catalog.fixtures.ts";
import type { ClaimedItem, ItemOutcome, PriceRunStore } from "./priceRunStore.ts";
import type { PriceRunStatus } from "./priceRunTypes.ts";

/** The price guide answer: average as text, pieces sold. */
export function guide(average: string, quantity: number, currency = "EUR") {
  return brickLink({
    item: { no: "sw0194", type: "MINIFIG" },
    new_or_used: "N",
    currency_code: currency,
    min_price: "1.0000",
    max_price: "200.0000",
    avg_price: average,
    qty_avg_price: average,
    unit_quantity: quantity,
    total_quantity: quantity,
    price_detail: [],
  });
}

/** Price guide routes; they must come before `brickLinkRoutes()` (same address start). */
export function priceRoutes(): Route[] {
  return [
    ["/items/MINIFIG/sw0194/price?guide_type=sold&new_or_used=N", guide("99.8700", 14)],
    ["/items/MINIFIG/sw0194/price?guide_type=sold&new_or_used=U", guide("67.3900", 97)],
    ["/items/MINIFIG/sw0542/price?guide_type=sold&new_or_used=N", guide("0.0000", 0)],
    ["/items/MINIFIG/sw0542/price?guide_type=sold&new_or_used=U", guide("24.0000", 3)],
    ["/items/SET/75372-1/price?guide_type=sold&new_or_used=N", guide("18.0000", 40)],
    ["/items/SET/75372-1/price?guide_type=sold&new_or_used=U", guide("12.0000", 25)],
    // Special parts: gear, a promotional set and a book.
    ["/items/GEAR/5010325/price?guide_type=sold&new_or_used=N", guide("15.5000", 8)],
    ["/items/GEAR/5010325/price?guide_type=sold&new_or_used=U", guide("9.0000", 3)],
    ["/items/SET/5008889-1/price?guide_type=sold&new_or_used=N", guide("0.0000", 0)],
    ["/items/SET/5008889-1/price?guide_type=sold&new_or_used=U", guide("4.0000", 2)],
    ["/items/BOOK/5000001/price", guide("0.0000", 0)],
    // Known, but nothing sold in 6 months.
    ["/items/MINIFIG/sw0001/price", guide("0.0000", 0)],
  ];
}

interface QueueItem {
  item: ClaimedItem;
  owner: string;
  state: "open" | "working" | "priced" | "empty" | "failed";
  attempts: number;
}

/** The queue in memory: one open run per owner, items of all owners. */
export class MemoryPriceRunStore implements PriceRunStore {
  readonly items: QueueItem[] = [];
  readonly outcomes: { key: string; outcome: ItemOutcome }[] = [];
  readonly begun: string[] = [];
  readonly calls = new Map<string, number>();
  pausedUntil: string | undefined;
  /** Calls the fake allows a day. */
  cap = Number.POSITIVE_INFINITY;
  private nextRun = 1;

  /** Puts an open run with these items into the queue (as `price_run_begin` would). */
  add(owner: string, numbers: readonly [ClaimedItem["itemType"], string][]): number {
    const runId = this.nextRun++;
    for (const [itemType, bricklinkId] of numbers) {
      this.items.push({
        item: { runId, itemType, bricklinkId, attempts: 0 },
        owner,
        state: "open",
        attempts: 0,
      });
    }
    return runId;
  }

  async begin(owner: string, trigger: "schedule" | "manual") {
    this.begun.push(`${owner}:${trigger}`);
  }

  async claim(owner: string | undefined, limit: number) {
    if (this.pausedUntil !== undefined) return [];
    const open = this.items.filter(
      (entry) => entry.state === "open" && (owner === undefined || entry.owner === owner),
    );
    open.sort((a, b) => a.attempts - b.attempts);
    return open.slice(0, limit).map((entry) => {
      entry.state = "working";
      entry.attempts += 1;
      return { ...entry.item, attempts: entry.attempts };
    });
  }

  async finish(item: ClaimedItem, outcome: ItemOutcome) {
    const entry = this.find(item);
    if (entry.state !== "working") throw new Error(`${this.key(item)} wurde nicht genommen`);
    entry.state = outcome.kind === "retry" ? "open" : outcome.kind;
    this.outcomes.push({ key: this.key(item), outcome });
  }

  async release(items: readonly ClaimedItem[], pausedUntil?: string) {
    for (const item of items) {
      const entry = this.find(item);
      if (entry.state !== "working") continue;
      entry.state = "open";
      entry.attempts = Math.max(entry.attempts - 1, 0);
    }
    if (pausedUntil !== undefined) this.pausedUntil = pausedUntil;
  }

  async countCall(day: string) {
    const calls = this.calls.get(day) ?? 0;
    if (calls >= this.cap) return false;
    this.calls.set(day, calls + 1);
    return true;
  }

  async status(owner: string): Promise<PriceRunStatus | null> {
    const mine = this.items.filter((entry) => entry.owner === owner);
    const count = (state: QueueItem["state"]) => mine.filter((e) => e.state === state).length;
    return {
      trigger: "manual",
      day: "2026-11-02",
      startedAt: "2026-11-02T09:00:00Z",
      total: mine.length,
      updated: count("priced"),
      empty: count("empty"),
      failed: count("failed"),
      open: count("open") + count("working"),
      skipped: 0,
      failedNumbers: mine.filter((e) => e.state === "failed").map((e) => e.item.bricklinkId),
    };
  }

  /** "minifig:sw0194" → its state. */
  state(key: string): QueueItem["state"] | undefined {
    return this.items.find((entry) => this.key(entry.item) === key)?.state;
  }

  key(item: Pick<ClaimedItem, "itemType" | "bricklinkId">): string {
    return `${item.itemType}:${item.bricklinkId}`;
  }

  private find(item: ClaimedItem): QueueItem {
    const entry = this.items.find(
      (candidate) =>
        candidate.item.runId === item.runId &&
        candidate.item.itemType === item.itemType &&
        candidate.item.bricklinkId === item.bricklinkId,
    );
    if (!entry) throw new Error(`${this.key(item)} ist nicht in der Warteschlange`);
    return entry;
  }
}
