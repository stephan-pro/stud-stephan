import { describe, expect, it } from "vitest";
import { formatScore, scorePercent } from "./recognition";

describe("Trefferquote der Fotoerkennung (F1)", () => {
  it("F1 rundet die Quote auf ganze Prozent: 0,78 ist 78 %", () => {
    expect(formatScore(0.78)).toBe("78 %");
    expect(formatScore(0.918)).toBe("92 %");
    expect(formatScore(0.004)).toBe("0 %");
  });

  it("hält die Quote zwischen 0 und 100 und kennt keine Unzahlen", () => {
    expect(scorePercent(1.4)).toBe(100);
    expect(scorePercent(-0.2)).toBe(0);
    expect(scorePercent(Number.NaN)).toBe(0);
    expect(scorePercent(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
