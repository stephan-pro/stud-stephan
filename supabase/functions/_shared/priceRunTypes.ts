// The price run (P11) as the function `bricklink` and the database function `price_run_status`
// answer it. Shared by the functions and by the app, which only imports the types.

/** The latest run of the person: what the settings (S12) show. */
export interface PriceRunStatus {
  /** `schedule` = the weekly job, `manual` = "Jetzt aktualisieren". */
  trigger: "schedule" | "manual";
  /** The day every price point of the run carries, "YYYY-MM-DD". */
  day: string;
  /** ISO 8601. */
  startedAt: string;
  /** Missing while the run is open. */
  finishedAt?: string;
  /** The day's BrickLink calls are used up; the run goes on after this time. */
  pausedUntil?: string;
  /** Catalog items to ask for (each number once). */
  total: number;
  /** Items that got a new price point. */
  updated: number;
  /** Items BrickLink knows, but nothing was sold in 6 months: no new price point. */
  empty: number;
  /** Items BrickLink did not answer for (or does not know): no new price point. */
  failed: number;
  /** Items still to do. */
  open: number;
  /** Official figures, sets and wishes without a BrickLink number: not asked for. */
  skipped: number;
  /** Numbers of the failed items (at most 20). */
  failedNumbers: string[];
  /** Why each failed item failed, by its number: BrickLink's code and message, short. */
  failedReasons?: Record<string, string>;
}

/** `{op: "priceRun", start}` of the app: `start` begins a run if none is open. */
export interface PriceRunAnswer {
  status: PriceRunStatus | null;
}
