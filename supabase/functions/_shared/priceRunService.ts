// The price run (P11, F10): works through the queue of open runs in portions, as long as one call
// of the function may take, asking BrickLink for the price guide (new and used) of each item.
// What a call does not finish, the next call goes on with (the cron job calls every five minutes,
// the app's "Jetzt aktualisieren" calls again while the settings are open).
//
// - An item with a price gets exactly one price point with the run's day (the database writes it).
// - Nothing sold, or BrickLink failed: no price point, so the older value stays (F10).
// - A failure that may pass is tried again in a later call, three times in all.
// - BrickLink's day used up (shared limit with the catalog): what was taken goes back, and the
//   run waits until the next day (UTC, like the count).

import type { BricklinkClient, BricklinkPrice, ItemType } from "./bricklinkClient.ts";
import { parseFigureRef, parseSpecialPartRef } from "./catalogTypes.ts";
import { CatalogError } from "./json.ts";
import type { ClaimedItem, ItemOutcome, PriceRunStore } from "./priceRunStore.ts";

export interface PriceRunDeps {
  readonly store: PriceRunStore;
  /** A client that counts its calls on the price run's share of the day (`store.countCall`). */
  readonly bricklink: Pick<BricklinkClient, "price">;
  readonly now: () => Date;
}

/** How often an item is tried before it counts as failed. */
export const MAX_ATTEMPTS = 3;
/** Items taken from the queue at once; small, so a call can stop on time. */
export const BATCH_SIZE = 5;
/** The cron job's call: well below the 150 s an Edge Function may run in the free plan. */
export const SCHEDULED_BUDGET_MS = 50_000;
/** A call from the app: shorter, so the settings show progress. */
export const MANUAL_BUDGET_MS = 20_000;

export interface WorkResult {
  /** Items finished in this call (priced, empty, failed or back for another try). */
  readonly processed: number;
  /** BrickLink's day is used up; the run goes on tomorrow. */
  readonly paused: boolean;
}

/** The number BrickLink knows: a set number typed without its variant gets "-1" ("75372" → "75372-1"). */
export function bricklinkNumber(item: Pick<ClaimedItem, "itemType" | "bricklinkId">): string {
  const number = item.bricklinkId.trim();
  return item.itemType === "legoSet" && !number.includes("-") ? `${number}-1` : number;
}

/**
 * What to ask BrickLink for: the type and the number. A special part carries its BrickLink type in
 * the key ("GEAR:5010325"); a key without a valid type cannot be asked for and counts as unknown.
 * A figure is a minifig unless its key says it is a part ("PART:11323pb01c01", a Big Fig).
 */
export function bricklinkTarget(item: Pick<ClaimedItem, "itemType" | "bricklinkId">): {
  readonly type: ItemType;
  readonly number: string;
} {
  if (item.itemType === "minifig") {
    const typed = parseFigureRef(item.bricklinkId.trim());
    return typed ?? { type: "MINIFIG", number: bricklinkNumber(item) };
  }
  if (item.itemType === "legoSet") return { type: "SET", number: bricklinkNumber(item) };
  const typed = parseSpecialPartRef(item.bricklinkId.trim());
  if (!typed) throw new CatalogError("not_found", "Sonderteil ohne BrickLink-Typ");
  return {
    type: typed.type,
    number:
      typed.type === "SET" && !typed.number.includes("-") ? `${typed.number}-1` : typed.number,
  };
}

/** The next day at 00:05 UTC: when BrickLink's count starts again. */
export function nextCountDay(now: Date): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5),
  ).toISOString();
}

/** Asks for new and used; both answers are needed, or the item is tried again later. */
export async function priceOf(
  bricklink: Pick<BricklinkClient, "price">,
  item: ClaimedItem,
): Promise<ItemOutcome> {
  const { type, number } = bricklinkTarget(item);
  const answers: Record<"new" | "used", BricklinkPrice> = {
    new: await bricklink.price(type, number, "new"),
    used: await bricklink.price(type, number, "used"),
  };
  const cents: Partial<Record<"new" | "used", number>> = {};
  const soldCount: Partial<Record<"new" | "used", number>> = {};
  for (const condition of ["new", "used"] as const) {
    const answer = answers[condition];
    if (answer.cents === undefined) continue;
    cents[condition] = answer.cents;
    soldCount[condition] = answer.soldCount;
  }
  return Object.keys(cents).length === 0 ? { kind: "empty" } : { kind: "priced", cents, soldCount };
}

function keyOf(item: ClaimedItem): string {
  return `${item.runId}|${item.itemType}|${item.bricklinkId}`;
}

/**
 * Works on the open runs of one owner (the app) or of all (the cron job) until the queue is empty,
 * BrickLink's day is used up or `budgetMs` has passed.
 */
export async function workOnPriceRuns(
  deps: PriceRunDeps,
  options: { readonly owner?: string | undefined; readonly budgetMs: number },
): Promise<WorkResult> {
  const started = deps.now().getTime();
  const overBudget = () => deps.now().getTime() - started >= options.budgetMs;
  // Items that failed in this call are tried again by a later one, not at once.
  const retried = new Set<string>();
  let processed = 0;

  while (!overBudget()) {
    const taken = await deps.store.claim(options.owner, BATCH_SIZE);
    const again = taken.filter((item) => retried.has(keyOf(item)));
    const items = taken.filter((item) => !retried.has(keyOf(item)));
    if (again.length > 0) await deps.store.release(again);
    if (items.length === 0) break;

    for (const [index, item] of items.entries()) {
      if (overBudget()) {
        await deps.store.release(items.slice(index));
        return { processed, paused: false };
      }
      let outcome: ItemOutcome;
      try {
        outcome = await priceOf(deps.bricklink, item);
      } catch (error) {
        if (error instanceof CatalogError && error.failure === "limit_reached") {
          await deps.store.release(items.slice(index), nextCountDay(deps.now()));
          return { processed, paused: true };
        }
        const unknown = error instanceof CatalogError && error.failure === "not_found";
        outcome = unknown || item.attempts >= MAX_ATTEMPTS ? { kind: "failed" } : { kind: "retry" };
        if (outcome.kind === "retry") retried.add(keyOf(item));
      }
      await deps.store.finish(item, outcome);
      processed += 1;
    }
  }
  return { processed, paused: false };
}
