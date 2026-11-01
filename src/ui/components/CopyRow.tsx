import { formatMonth } from "../../domain/dates";
import { formatMoney } from "../../domain/money";
import type { Minifig, PricePoint } from "../../domain/types";
import { valueOfItem } from "../../domain/value";
import { detailHash } from "../route";
import { TEXTS } from "../texts";
import { Cover } from "./Cover";

/** One copy of a figure in a list: small photo, condition, origin, mods and value; opens the copy. */
export function CopyRow({
  copy,
  prices,
}: {
  readonly copy: Minifig;
  readonly prices: readonly PricePoint[];
}) {
  const T = TEXTS.showcase.copies;
  const valuation = valueOfItem(copy, prices);
  const details = [
    TEXTS.conditions[copy.condition],
    copy.acquiredOn ? T.acquired(formatMonth(copy.acquiredOn)) : undefined,
    copy.mods.length > 0 ? T.mods(copy.mods.length) : undefined,
  ].filter(Boolean);
  const photo = copy.photos[0];
  return (
    <a class="copy-row pressable" href={detailHash({ type: "minifig", id: copy.id })}>
      <Cover
        image={photo ? { kind: "photo", path: photo } : undefined}
        alt=""
        tintKey={copy.id}
        scribbleId={`copy-${copy.id}`}
        variant="small"
      />
      <span class="copy-row__text">
        <span class="copy-row__name">{copy.name}</span>
        <span class="tile__meta">{details.join(" · ")}</span>
      </span>
      <span class="copy-row__value">
        {valuation.ownValueMissing
          ? TEXTS.showcase.tile.withoutValue
          : formatMoney(valuation.cents)}
      </span>
    </a>
  );
}
