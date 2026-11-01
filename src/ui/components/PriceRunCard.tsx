import { useEffect, useRef, useState } from "preact/hooks";
import { CatalogCallError } from "../../backend/catalog";
import type { PriceRunner, PriceRunStatus } from "../../backend/priceRun";
import { formatDateTime } from "../../domain/dates";
import { nextPriceRun, priceRunDone, priceRunState } from "../../domain/priceRun";
import { TEXTS } from "../texts";
import { useWritable } from "../useCollection";
import { Rows } from "./DetailParts";
import { ReadOnlyNote } from "./WriteLink";

/** While a run started elsewhere (the weekly job) is going on, the card looks again this often. */
const POLL_MS = 15_000;

type Problem = keyof typeof TEXTS.priceRun.failures;

interface PriceRunCardProps {
  readonly runner: PriceRunner;
  /** New price points were written: the collection is read again (values, "Stand vom …"). */
  readonly onPricesChanged: () => void;
  readonly now?: () => Date;
}

/** The text of the row "Ergebnis". */
function resultOf(status: PriceRunStatus, now: string): string {
  const T = TEXTS.priceRun;
  const state = priceRunState(status, now);
  if (state === "running") return T.running(priceRunDone(status), status.total);
  if (state === "paused" && status.pausedUntil) {
    return T.paused(priceRunDone(status), status.total, formatDateTime(status.pausedUntil));
  }
  if (status.total === 0) return T.nothingToAsk;
  return T.done(status.updated, status.failed, status.empty);
}

/**
 * S12, card "Preisabruf" (P11): last run, result, next run as in the click dummy, and "Jetzt
 * aktualisieren", which works on the run portion by portion while the page is open (what is left
 * when it is closed, the server's job goes on with every five minutes).
 */
export function PriceRunCard({
  runner,
  onPricesChanged,
  now = () => new Date(),
}: PriceRunCardProps) {
  const T = TEXTS.priceRun;
  /** `undefined` while loading. */
  const [status, setStatus] = useState<PriceRunStatus | null | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const writable = useWritable();
  const [problem, setProblem] = useState<Problem | undefined>(undefined);
  const [finished, setFinished] = useState(false);
  const mounted = useRef(true);
  const shown = useRef<PriceRunStatus | null | undefined>(undefined);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const show = (next: PriceRunStatus | null) => {
    const before = shown.current;
    shown.current = next;
    setStatus(next);
    // A run that went on elsewhere wrote prices: show them.
    if (before && next && priceRunDone(next) > priceRunDone(before)) onPricesChanged();
  };

  useEffect(() => {
    let active = true;
    runner.status().then(
      (next) => {
        if (!active) return;
        setLoadFailed(false);
        show(next);
      },
      () => active && setLoadFailed(true),
    );
    return () => {
      active = false;
    };
  }, [runner, attempt]);

  // A run that goes on without this page (the weekly job): look again now and then.
  const state = status === undefined ? undefined : priceRunState(status, now().toISOString());
  useEffect(() => {
    if (busy || state !== "running") return;
    const timer = setTimeout(() => setAttempt((count) => count + 1), POLL_MS);
    return () => clearTimeout(timer);
  }, [busy, state, attempt]);

  const update = async () => {
    setBusy(true);
    setProblem(undefined);
    setFinished(false);
    try {
      let next = await runner.run(true);
      // Go on while there is work, as long as each call gets further.
      while (mounted.current && next && priceRunState(next, now().toISOString()) === "running") {
        show(next);
        const open = next.open;
        next = await runner.run(false);
        if (next && next.open >= open && priceRunState(next, now().toISOString()) === "running") {
          break;
        }
      }
      if (!mounted.current) return;
      show(next);
      setLoadFailed(false);
      setFinished(next?.finishedAt !== undefined);
      onPricesChanged();
    } catch (error) {
      if (!mounted.current) return;
      const failure = error instanceof CatalogCallError ? error.failure : "unavailable";
      setProblem(failure === "offline" || failure === "limit_reached" ? failure : "unavailable");
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const time = now().toISOString();
  let progress = "";
  if (busy) progress = status ? T.progress(priceRunDone(status), status.total) : T.updating;
  else if (finished) progress = T.finished;

  return (
    <section class="card price-run" aria-labelledby="price-run-title">
      <h2 class="card__title" id="price-run-title">
        {T.title}
      </h2>
      {status === undefined && !loadFailed && <p class="card__text">{T.loading}</p>}
      {status === undefined && loadFailed && (
        <>
          <p class="card__text" role="alert">
            {T.failedToLoad}
          </p>
          <button
            class="button button--secondary pressable"
            type="button"
            onClick={() => setAttempt(attempt + 1)}
          >
            {T.retry}
          </button>
        </>
      )}
      {status !== undefined && (
        <Rows
          rows={[
            {
              label: T.lastRun,
              value: status
                ? T.started(formatDateTime(status.startedAt), status.trigger === "manual")
                : T.never,
            },
            ...(status ? [{ label: T.result, value: resultOf(status, time) }] : []),
            ...(status && status.skipped > 0
              ? [{ label: T.skipped, value: T.withoutNumber(status.skipped) }]
              : []),
            ...(status && status.failedNumbers.length > 0
              ? [{ label: T.failedNumbers, value: status.failedNumbers.join(", ") }]
              : []),
            { label: T.nextRun, value: formatDateTime(nextPriceRun(time)) },
          ]}
        />
      )}
      {status !== undefined && (
        <>
          <p class="note">{T.note}</p>
          <p class="card__text" role="status">
            {progress}
          </p>
          {problem && (
            <p class="card__text" role="alert">
              {T.failures[problem]}
            </p>
          )}
          <ReadOnlyNote />
          <button
            class="button button--secondary pressable"
            type="button"
            disabled={busy || !writable}
            onClick={() => void update()}
          >
            {busy ? T.updating : T.update}
          </button>
        </>
      )}
    </section>
  );
}
