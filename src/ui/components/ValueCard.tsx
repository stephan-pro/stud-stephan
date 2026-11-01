import { formatDate } from "../../domain/dates";
import { formatMoney, formatMoneyDifference } from "../../domain/money";
import type { PriceStep } from "../../domain/prices";
import type { Cents, Condition, ShowcaseItem } from "../../domain/types";
import type { Valuation } from "../../domain/value";
import { TEXTS } from "../texts";
import { Scribbles } from "./Scribbles";

/** The mini chart: the market price over the price runs (needs at least two points). */
function Sparkline({ steps }: { readonly steps: readonly PriceStep[] }) {
  const T = TEXTS.detail.value;
  const first = steps[0];
  const last = steps.at(-1);
  if (!first || !last || steps.length < 2) return null;
  const low = Math.min(...steps.map((step) => step.cents));
  const high = Math.max(...steps.map((step) => step.cents));
  const span = Math.max(high - low, 1);
  const points = steps
    .map((step, index) => {
      const x = (index / (steps.length - 1)) * 200;
      const y = 44 - ((step.cents - low) / span) * 40;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      class="sparkline"
      viewBox="0 0 200 48"
      preserveAspectRatio="none"
      role="img"
      aria-label={T.history(
        formatMoney(first.cents),
        formatDate(first.date),
        formatMoney(last.cents),
        formatDate(last.date),
      )}
    >
      <polyline points={points} fill="none" vector-effect="non-scaling-stroke" />
    </svg>
  );
}

interface ValueCardProps {
  /** Which object it is, for "Neu wäre sie / es … wert". */
  readonly type: ShowcaseItem["type"];
  readonly valuation: Valuation;
  readonly condition: Condition;
  readonly purchasePrice?: Cents | undefined;
  readonly history: readonly PriceStep[];
  readonly id: string;
}

/**
 * The value card of S2, S3 and S4 as in `Figur.dc.html`: value, purchase price and difference,
 * the price in the other condition, history, "Stand vom …".
 */
export function ValueCard({
  type,
  valuation,
  condition,
  purchasePrice,
  history,
  id,
}: ValueCardProps) {
  const T = TEXTS.detail.value;
  const label = {
    market: T.market(TEXTS.conditions[condition].toLowerCase()),
    manual: T.manual,
    purchase: T.purchase,
    none: T.none,
  }[valuation.kind];
  const notes: string[] = [];
  if (valuation.kind === "purchase") notes.push(T.noMarketPurchase);
  else if (valuation.kind === "none") notes.push(T.noValueAtAll);
  else if (valuation.kind === "manual") notes.push(T.noMarket);
  if (valuation.asOf) {
    const date = formatDate(valuation.asOf);
    if (valuation.kind !== "market") notes.push(T.asOfManual(date));
    else if (valuation.soldCount === undefined) notes.push(T.asOfMarket(date));
    else notes.push(T.asOfMarketSold(date, valuation.soldCount));
  }
  const other = valuation.otherCondition;

  return (
    <section class="value-card" aria-labelledby={`${id}-title`}>
      <Scribbles id={`${id}-scribbles`} />
      <div class="value-card__content">
        <h2 class="value-card__label" id={`${id}-title`}>
          {label}
        </h2>
        <p class="value-card__value">
          {valuation.ownValueMissing ? T.withoutValue : formatMoney(valuation.cents)}
        </p>
        {purchasePrice !== undefined && (
          <p class="value-card__line">
            {T.purchasePrice} {formatMoney(purchasePrice)}
            {valuation.difference !== undefined && (
              <>
                {" · "}
                <strong>{formatMoneyDifference(valuation.difference)}</strong>
              </>
            )}
          </p>
        )}
        {other && (
          <p class="value-card__line">
            {T.otherCondition(
              TEXTS.conditions[other.condition],
              formatMoney(other.cents),
              T.pronoun[type],
            )}
          </p>
        )}
        <Sparkline steps={history} />
        {notes.map((note) => (
          <p key={note} class="value-card__note">
            {note}
          </p>
        ))}
      </div>
    </section>
  );
}
