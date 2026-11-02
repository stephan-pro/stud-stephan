import { useMemo, useState } from "preact/hooks";
import { latestPriceDate, mostValuable, themeShares } from "../../domain/dashboard";
import { formatDate } from "../../domain/dates";
import { formatMoney, formatMoneyWhole, formatMoneyWholeDifference } from "../../domain/money";
import { figuresNotOnDisplay } from "../../domain/placement";
import { galleryImages } from "../../domain/showcase";
import { totals } from "../../domain/totals";
import type { Collection } from "../../domain/types";
import { VALUE_PERIODS, type ValuePeriod, valueTrend } from "../../domain/valueHistory";
import { Cover } from "../components/Cover";
import { Icon } from "../components/Icon";
import { Scribbles } from "../components/Scribbles";
import { Unready } from "../components/Unready";
import { ValueChart } from "../components/ValueChart";
import { detailHash } from "../route";
import { TEXTS } from "../texts";
import type { LoadedCollection } from "../useCollection";

const T = TEXTS.dashboard;

function ValueSection({
  collection,
  today,
}: {
  readonly collection: Collection;
  readonly today: string;
}) {
  const [period, setPeriod] = useState<ValuePeriod>("year");
  const { value } = totals(collection);
  const trend = useMemo(() => valueTrend(collection, period, today), [collection, period, today]);
  const first = trend.points[0];
  const hasLine = trend.points.length >= 2;
  const changeText =
    trend.change === undefined
      ? undefined
      : `${formatMoneyWholeDifference(trend.change)} ${
          trend.partial && first ? T.changeSince(formatDate(first.date)) : T.changeIn[period]
        }`;

  return (
    <>
      <fieldset class="segmented">
        <legend class="visually-hidden">{T.periodGroup}</legend>
        {VALUE_PERIODS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            class="segmented__item pressable"
            aria-pressed={period === candidate}
            onClick={() => setPeriod(candidate)}
          >
            {T.periods[candidate]}
          </button>
        ))}
      </fieldset>
      <section class="value-card" aria-labelledby="dashboard-value-title">
        <Scribbles id="dashboard-value-scribbles" />
        <div class="value-card__content">
          <h2 class="value-card__label" id="dashboard-value-title">
            {T.value}
          </h2>
          <div class="dashboard-value">
            <p class="value-card__value">{formatMoneyWhole(value)}</p>
            {changeText && trend.change !== undefined && (
              <span class="badge">
                <Icon name={trend.change < 0 ? "trendDown" : "trendUp"} size={14} strokeWidth={3} />
                {changeText}
              </span>
            )}
          </div>
          <ValueChart points={trend.points} />
          {first && trend.since && (!hasLine || trend.partial) && (
            <p class="value-card__note">
              {hasLine
                ? T.historyFrom(formatDate(trend.since))
                : T.historyFirst(formatDate(first.date))}
            </p>
          )}
          {!first && <p class="value-card__note">{T.historyNone}</p>}
        </div>
      </section>
    </>
  );
}

function Tiles({ collection }: { readonly collection: Collection }) {
  const sums = totals(collection);
  return (
    <div class="stat-grid">
      <div class="stat">
        <span class="stat__label">{T.tiles.purchase}</span>
        <span class="stat__value">{formatMoneyWhole(sums.purchase)}</span>
      </div>
      <div class="stat">
        <span class="stat__label">{T.tiles.difference}</span>
        <span class="stat__value">{formatMoneyWholeDifference(sums.difference)}</span>
      </div>
      <div class="stat">
        <span class="stat__label">{T.tiles.mods}</span>
        <span class="stat__value">{formatMoneyWhole(sums.modSpend)}</span>
        <span class="stat__note">{T.tiles.modsNote}</span>
      </div>
      <div class="stat">
        <span class="stat__label">{T.tiles.withoutValue}</span>
        <span class="stat__value">{sums.withoutValue}</span>
        <span class="stat__note">{T.tiles.withoutValueNote}</span>
      </div>
    </div>
  );
}

function Kinds({ collection }: { readonly collection: Collection }) {
  const { counts } = totals(collection);
  const kinds = [
    T.kinds.figures(counts.minifigs, counts.minifigsInSets),
    T.kinds.sets(counts.sets),
    T.kinds.dioramas(counts.dioramas),
    T.kinds.specialParts(counts.specialParts),
  ];
  return (
    <section class="card" aria-labelledby="dashboard-kinds-title">
      <h2 class="card__title" id="dashboard-kinds-title">
        {T.kinds.title}
      </h2>
      <ul class="kind-list">
        {kinds.map((text, index) => (
          <li key={text} class={`kind-pill kind-pill--${index}`}>
            {text}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Themes({ collection }: { readonly collection: Collection }) {
  const shares = themeShares(collection);
  return (
    <section class="card" aria-labelledby="dashboard-themes-title">
      <h2 class="card__title" id="dashboard-themes-title">
        {T.themes.title}
      </h2>
      {shares.length === 0 ? (
        <p class="card__text">{T.themes.empty}</p>
      ) : (
        <ul class="share-list">
          {shares.map((share, index) => {
            const name =
              share.kind === "theme"
                ? share.name
                : share.kind === "none"
                  ? T.themes.none
                  : T.themes.rest;
            return (
              <li key={`${share.kind}-${name}`} class="share">
                <div class="share__head">
                  <span class="share__name">{name}</span>
                  <span>{share.percent} %</span>
                </div>
                <div class="share__bar" role="img" aria-label={T.themes.share(name, share.percent)}>
                  <div
                    class={`share__fill share__fill--${index % 5}`}
                    style={{ width: `${share.percent}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Top({ collection }: { readonly collection: Collection }) {
  const ranked = mostValuable(collection);
  return (
    <section class="card" aria-labelledby="dashboard-top-title">
      <h2 class="card__title" id="dashboard-top-title">
        {T.top.title}
      </h2>
      {ranked.length === 0 ? (
        <p class="card__text">{T.top.empty}</p>
      ) : (
        <ol class="top-list">
          {ranked.map(({ item, cents }, index) => (
            <li key={item.id}>
              <a class="top-row pressable" href={detailHash({ type: item.type, id: item.id })}>
                <span class="top-row__rank" aria-hidden="true">
                  {index + 1}
                </span>
                <Cover
                  image={galleryImages(item)[0]}
                  alt=""
                  tintKey={item.id}
                  scribbleId={`top-${item.id}`}
                  variant="thumb"
                />
                <span class="top-row__name">{item.name}</span>
                <span class="top-row__value">{formatMoney(cents)}</span>
              </a>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * S11: the total value with its history, the sums, the counts, the share per sub theme, the most
 * valuable objects and the figures that are not displayed.
 */
export function DashboardPage({
  data,
  today,
  onShowNotOnDisplay,
}: {
  readonly data: LoadedCollection;
  /** "YYYY-MM-DD", the day the periods end on. */
  readonly today: string;
  /** Shows the showcase with the filter "nicht ausgestellt". */
  readonly onShowNotOnDisplay: () => void;
}) {
  if (data.state.status !== "ready") return <Unready data={data} />;
  const { collection } = data.state;
  const without = figuresNotOnDisplay(collection).length;
  const priced = latestPriceDate(collection, today);
  const B = TEXTS.dioramas.withoutBanner;

  return (
    <>
      <ValueSection collection={collection} today={today} />
      <Tiles collection={collection} />
      <Kinds collection={collection} />
      <Themes collection={collection} />
      <Top collection={collection} />
      {without > 0 && (
        <button type="button" class="without-banner pressable" onClick={onShowNotOnDisplay}>
          <Scribbles id="dashboard-without-scribbles" />
          <span class="without-banner__text">
            <span class="without-banner__count">{B.count(without)}</span>
            <span class="without-banner__label">{TEXTS.dashboard.notOnDisplay}</span>
          </span>
          <span class="without-banner__action">{B.action}</span>
        </button>
      )}
      <p class="dashboard-footer">{priced ? T.footer(formatDate(priced)) : T.footerNone}</p>
    </>
  );
}
