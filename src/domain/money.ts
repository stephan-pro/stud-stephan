// Money is whole cents everywhere (1250 = 12,50 €); these functions are the only way to show it.
// A non-breaking space keeps the amount and "€" on one line.

import type { Cents } from "./types";

const SPACE = " ";
const MINUS = "−";

function withThousands(euros: number): string {
  return String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** 1250 → "12,50 €", 124000 → "1.240,00 €", −150 → "−1,50 €". */
export function formatMoney(cents: Cents): string {
  const amount = Math.abs(Math.round(cents));
  const sign = cents < 0 && amount > 0 ? MINUS : "";
  const rest = String(amount % 100).padStart(2, "0");
  return `${sign}${withThousands(Math.floor(amount / 100))},${rest}${SPACE}€`;
}

/** Rounded to whole euros for large sums: 482000 → "4.820 €". */
export function formatMoneyWhole(cents: Cents): string {
  const euros = Math.round(Math.abs(cents) / 100);
  const sign = cents < 0 && euros > 0 ? MINUS : "";
  return `${sign}${withThousands(euros)}${SPACE}€`;
}

/** A difference always with its sign: 1350 → "+13,50 €", −101 → "−1,01 €", 0 → "0,00 €". */
export function formatMoneyDifference(cents: Cents): string {
  return Math.round(cents) > 0 ? `+${formatMoney(cents)}` : formatMoney(cents);
}
