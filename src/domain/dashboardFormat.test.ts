import { describe, expect, it } from "vitest";
import { formatMonthShort } from "./dates";
import { formatMoneyWholeDifference, formatPercentChange } from "./money";

describe("F12 Anzeige von Veränderungen", () => {
  it.each([
    [61249, "+612 €"],
    [-87050, "−871 €"],
    [0, "0 €"],
    [20, "0 €"],
  ])("Differenz in ganzen Euro: %i Cent → %s", (cents, text) => {
    expect(formatMoneyWholeDifference(cents)).toBe(text);
  });

  it.each([
    [2.54, "+2,5 %"],
    [-1.26, "−1,3 %"],
    [0, "0,0 %"],
    [0.04, "0,0 %"],
    [12, "+12,0 %"],
  ])("Prozent mit Vorzeichen: %f → %s", (percent, text) => {
    expect(formatPercentChange(percent)).toBe(text);
  });

  it("Monat kurz unter dem Diagramm", () => {
    expect(formatMonthShort("2026-10-27")).toBe("Okt 2026");
    expect(formatMonthShort("2026-03-01")).toBe("Mär 2026");
    expect(formatMonthShort("kein Tag")).toBe("kein Tag");
  });
});
