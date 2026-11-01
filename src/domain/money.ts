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

/** A difference in whole euros with its sign: 61200 → "+612 €", −150 → "−2 €". */
export function formatMoneyWholeDifference(cents: Cents): string {
  const text = formatMoneyWhole(cents);
  return Math.round(cents / 100) > 0 ? `+${text}` : text;
}

/** A change in percent with its sign and one decimal: 2.54 → "+2,5 %", −1.2 → "−1,2 %". */
export function formatPercentChange(percent: number): string {
  const rounded = Math.round(percent * 10) / 10;
  const text = `${String(Math.abs(rounded).toFixed(1)).replace(".", ",")}${SPACE}%`;
  if (rounded > 0) return `+${text}`;
  return rounded < 0 ? `${MINUS}${text}` : text;
}

/** The most an amount typed into a form may be (1 million euros); more is surely a typo. */
export const MAX_CENTS: Cents = 100_000_000;

/**
 * What a person types for an amount, as whole cents: "25", "25,5", "25,00 €", "1.240,50", "25.50".
 * Nothing (an empty text), a negative amount, more than two decimals or any other text is
 * `undefined`. A dot with exactly three digits behind it is a thousands dot ("1.240" = 1240 €).
 */
export function parseMoney(text: string): Cents | undefined {
  const cleaned = text.replace(/[\s €]|EUR/gi, "");
  let normal: string;
  if (cleaned.includes(",")) {
    if (!/^\d{1,3}(\.\d{3})*,\d{1,2}$|^\d+,\d{1,2}$/.test(cleaned)) return undefined;
    normal = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normal = cleaned.replace(/\./g, "");
  } else if (/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    normal = cleaned;
  } else {
    return undefined;
  }
  const cents = Math.round(Number(normal) * 100);
  return cents <= MAX_CENTS ? cents : undefined;
}

/** A difference always with its sign: 1350 → "+13,50 €", −101 → "−1,01 €", 0 → "0,00 €". */
export function formatMoneyDifference(cents: Cents): string {
  return Math.round(cents) > 0 ? `+${formatMoney(cents)}` : formatMoney(cents);
}
