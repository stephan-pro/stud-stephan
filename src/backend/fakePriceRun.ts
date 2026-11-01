// `PriceRunner` over the collection of a `Remote`: the demo and the end-to-end tests (the real run
// lives in the Edge Function `bricklink`). Like the real one it asks for the official figures, sets
// and wishes with a number, a few per call, and writes one price point per item with the run's day
// through `Remote.savePrice`. The "market" moves the latest known price up by 2 %; an item without
// any known price has no sale. The state is kept in the device's storage, if given, so it survives
// a reload like the real one.

import { type CatalogItem, itemsToPrice, itemsWithoutNumber, marketPrice } from "../domain/prices";
import type { Condition, PricePoint, WishItem } from "../domain/types";
import { CatalogCallError } from "./catalog";
import type { PriceRunner, PriceRunStatus } from "./priceRun";
import type { Remote } from "./remote";

/** How the fake answers when told otherwise (the fake build reads it from the device's storage). */
export type PriceRunControl = "offline" | "unavailable" | "limit_reached" | undefined;

/** Where the fake keeps its state in the device's storage. */
export const FAKE_PRICE_RUN_KEY = "stud-stephan-fake:price-run";

interface FakeRun {
  status: PriceRunStatus;
  queue: CatalogItem[];
}

export interface FakePriceRunOptions {
  readonly control?: () => PriceRunControl;
  readonly now?: () => Date;
  readonly storage?: Pick<Storage, "getItem" | "setItem"> | undefined;
  /** Items per call (the real function does as many as fit into 20 s). */
  readonly portion?: number;
}

/** The local day of a moment, "YYYY-MM-DD". */
function localDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export class FakePriceRunner implements PriceRunner {
  /** Every call, newest last. */
  readonly calls: string[] = [];
  private memory: FakeRun | undefined;

  constructor(
    private readonly remote: Pick<Remote, "load" | "savePrice">,
    private readonly options: FakePriceRunOptions = {},
  ) {}

  async status(): Promise<PriceRunStatus | null> {
    this.calls.push("status");
    if (this.options.control?.() === "offline") {
      throw new CatalogCallError("Keine Verbindung", "offline");
    }
    return this.read()?.status ?? null;
  }

  async run(start: boolean): Promise<PriceRunStatus | null> {
    this.calls.push(`run ${start}`);
    const control = this.options.control?.();
    if (control === "offline") throw new CatalogCallError("Keine Verbindung", "offline");
    if (control === "unavailable") throw new CatalogCallError("Dienst gestört", "unavailable");
    const now = this.now();
    let run = this.read();
    if (start && (run === undefined || run.status.finishedAt !== undefined)) {
      run = await this.begin(now);
    }
    if (run === undefined) return null;
    if (run.status.finishedAt === undefined) {
      if (control === "limit_reached") {
        const tomorrow = new Date(now);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(0, 5, 0, 0);
        run.status.pausedUntil = tomorrow.toISOString();
      } else {
        delete run.status.pausedUntil;
        await this.work(run, now);
      }
    }
    this.write(run);
    return structuredClone(run.status);
  }

  private async begin(now: Date): Promise<FakeRun> {
    const collection = await this.remote.load();
    const queue = itemsToPrice(collection);
    const run: FakeRun = {
      status: {
        trigger: "manual",
        day: localDay(now),
        startedAt: now.toISOString(),
        total: queue.length,
        updated: 0,
        empty: 0,
        failed: 0,
        open: queue.length,
        skipped: itemsWithoutNumber(collection),
        failedNumbers: [],
      },
      queue,
    };
    if (queue.length === 0) run.status.finishedAt = now.toISOString();
    return run;
  }

  private async work(run: FakeRun, now: Date): Promise<void> {
    const prices = (await this.remote.load()).prices;
    for (const item of run.queue.splice(0, this.options.portion ?? 2)) {
      const point = this.pointFor(item, prices, run.status.day);
      if (point) {
        await this.remote.savePrice(point);
        run.status.updated += 1;
      } else {
        run.status.empty += 1;
      }
      run.status.open -= 1;
    }
    if (run.queue.length === 0) run.status.finishedAt = now.toISOString();
  }

  /** The latest known price of each condition, 2 % up; nothing without any known price. */
  private pointFor(
    item: CatalogItem,
    prices: readonly PricePoint[],
    day: string,
  ): PricePoint | undefined {
    // The catalog item as a wish, which is what `marketPrice` looks prices up for.
    const wish: WishItem = {
      id: item.bricklinkId,
      type: item.itemType === "legoSet" ? "legoSet" : "minifig",
      name: item.bricklinkId,
      ...(item.itemType === "legoSet"
        ? { setNumber: item.bricklinkId }
        : { bricklinkId: item.bricklinkId }),
      manufacturer: { kind: "lego" },
      priority: "low",
      desiredCondition: "used",
      links: [],
      createdAt: day,
    };
    const cents: Partial<Record<Condition, number>> = {};
    for (const condition of ["new", "used"] as const) {
      const latest = marketPrice(wish, condition, prices);
      if (latest) cents[condition] = Math.round(latest.cents * 1.02);
    }
    if (Object.keys(cents).length === 0) return undefined;
    return {
      itemType: item.itemType,
      bricklinkId: item.bricklinkId,
      date: day,
      source: "bricklink",
      cents,
    };
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }

  private read(): FakeRun | undefined {
    const { storage } = this.options;
    if (!storage) return this.memory;
    try {
      const stored = storage.getItem(FAKE_PRICE_RUN_KEY);
      return stored ? (JSON.parse(stored) as FakeRun) : undefined;
    } catch {
      return undefined;
    }
  }

  private write(run: FakeRun): void {
    this.memory = run;
    try {
      this.options.storage?.setItem(FAKE_PRICE_RUN_KEY, JSON.stringify(run));
    } catch {
      // The run stays in memory.
    }
  }
}
