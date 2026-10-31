import { describe, expect, it } from "vitest";
import { formatMoney, formatMoneyDifference, formatMoneyWhole } from "./money";

// The space before "€" is a non-breaking one, so amount and currency never wrap apart.
const euro = (text: string) => text.replace(/ €/g, " €");

describe("Geld in ganzen Cent, Anzeige in Euro", () => {
  it.each([
    [1250, "12,50 €"],
    [5, "0,05 €"],
    [0, "0,00 €"],
    [124000, "1.240,00 €"],
    [123456789, "1.234.567,89 €"],
    [-150, "−1,50 €"],
  ])("%i Cent → %s", (cents, text) => {
    expect(formatMoney(cents)).toBe(euro(text));
  });

  it.each([
    [482000, "4.820 €"],
    [61249, "612 €"],
    [-87050, "−871 €"],
    [-49, "0 €"],
  ])("ganze Euro: %i Cent → %s", (cents, text) => {
    expect(formatMoneyWhole(cents)).toBe(euro(text));
  });

  it.each([
    [1350, "+13,50 €"],
    [101, "+1,01 €"],
    [-101, "−1,01 €"],
    [0, "0,00 €"],
  ])("Differenz: %i Cent → %s", (cents, text) => {
    expect(formatMoneyDifference(cents)).toBe(euro(text));
  });
});
