import { describe, expect, it } from "vitest";
import { formatMoney, formatMoneyDifference, formatMoneyWhole, parseMoney } from "./money";

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

describe("F4 Beträge aus Eingaben lesen", () => {
  it.each([
    ["25", 2500],
    ["25,5", 2550],
    ["25,00 €", 2500],
    ["25,00 €", 2500],
    ["1.240,50", 124050],
    ["1.240", 124000],
    ["25.50", 2550],
    ["0,05", 5],
    ["  7 EUR ", 700],
    ["1.000.000,00", 100000000],
  ])("„%s“ → %i Cent", (text, cents) => {
    expect(parseMoney(text)).toBe(cents);
  });

  it.each(["", "abc", "-5", "1,234", "1,2,3", "12.345,6.7", "1.2.3", "1.000.000,01", "€"])(
    "„%s“ ist kein Betrag",
    (text) => {
      expect(parseMoney(text)).toBeUndefined();
    },
  );

  it("F4 Was formatMoney zeigt, liest parseMoney wieder", () => {
    for (const cents of [0, 5, 1250, 124000, 99999999]) {
      expect(parseMoney(formatMoney(cents))).toBe(cents);
    }
  });
});
