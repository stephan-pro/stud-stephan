// What an object is worth (F10).
// Official LEGO items: BrickLink market value in their own condition; mods change nothing.
// Without a market value: the value Stephan estimated, else the purchase price, else 0 € and
// "ohne Wert".

import { type MarketPrice, marketPrice, otherCondition } from "./prices";
import type {
  Cents,
  Condition,
  Diorama,
  IsoDate,
  ManualValue,
  Minifig,
  PricePoint,
  ShowcaseItem,
} from "./types";

export type ValueKind = "market" | "manual" | "purchase" | "none";

export interface Valuation {
  cents: Cents;
  kind: ValueKind;
  /** Day of the price point ("Stand vom …") or of the estimate ("Eingetragen am …"). */
  asOf?: IsoDate;
  /** The market price in the other condition, for comparison ("Neu wäre sie … wert"). */
  otherCondition?: MarketPrice & { condition: Condition };
  /** Value minus purchase price; only if a purchase price is known. */
  difference?: Cents;
  /** Neither a market value nor an entered value: counts as 0 € and is listed as "ohne Wert". */
  ownValueMissing: boolean;
}

function entered(
  manualValue: ManualValue | undefined,
  purchasePrice: Cents | undefined,
): Valuation {
  if (manualValue) {
    return {
      cents: manualValue.cents,
      kind: "manual",
      asOf: manualValue.enteredOn,
      ownValueMissing: false,
    };
  }
  if (purchasePrice !== undefined) {
    return { cents: purchasePrice, kind: "purchase", ownValueMissing: false };
  }
  return { cents: 0, kind: "none", ownValueMissing: true };
}

export function valueOfItem(
  item: ShowcaseItem | Diorama,
  prices: readonly PricePoint[],
): Valuation {
  if (item.type === "diorama") return entered(item.manualValue, undefined);
  const market = marketPrice(item, item.condition, prices);
  const valuation: Valuation = market
    ? { cents: market.cents, kind: "market", asOf: market.date, ownValueMissing: false }
    : entered(item.manualValue, item.purchasePrice);
  const condition = otherCondition(item.condition);
  const other = marketPrice(item, condition, prices);
  if (other) valuation.otherCondition = { ...other, condition };
  if (item.purchasePrice !== undefined) valuation.difference = valuation.cents - item.purchasePrice;
  return valuation;
}

/** A figure counts as modified as soon as one mod part is entered (F5, F6). */
export function isModified(minifig: Minifig): boolean {
  return minifig.mods.length > 0;
}

/** "Ausgaben für Mods" of one figure; never part of its value (F6). */
export function modSpend(minifig: Pick<Minifig, "mods">): Cents {
  return minifig.mods.reduce((sum, part) => sum + (part.price ?? 0), 0);
}
