import { describe, expect, it } from "vitest";
import { chartMarks, describeChart } from "./chartText";

// The space before "€" is a non-breaking one (money.ts).
const nbsp = (text: string) => text.replace(/ €/g, " €");

describe("F12 Beschreibung des Verlaufsdiagramms", () => {
  const points = [
    { date: "2026-10-06", cents: 100_000 },
    { date: "2026-10-13", cents: 130_050 },
    { date: "2026-10-20", cents: 90_000 },
    { date: "2026-10-27", cents: 120_000 },
  ];

  it("F12 Die Beschreibung nennt Anfang, Ende, Richtung, höchsten und niedrigsten Wert und die Zahl der Punkte", () => {
    expect(describeChart(points)).toBe(
      nbsp(
        "Gesamtwert vom 06.10.2026 bis 27.10.2026, 4 Preisstände: von 1.000,00 € auf 1.200,00 €, gestiegen. Höchster Wert 1.300,50 € am 13.10.2026, niedrigster Wert 900,00 € am 20.10.2026.",
      ),
    );
  });

  it("F12 Fallender und gleichbleibender Verlauf", () => {
    expect(describeChart([points[1], points[2]].filter(Boolean) as typeof points)).toContain(
      "gefallen",
    );
    expect(
      describeChart([
        { date: "2026-10-06", cents: 500 },
        { date: "2026-10-13", cents: 500 },
      ]),
    ).toContain("gleich geblieben");
  });

  it("F12 Unter zwei Punkten gibt es keine Beschreibung, weil es kein Diagramm gibt", () => {
    expect(describeChart([])).toBe("");
    expect(describeChart([{ date: "2026-10-06", cents: 1 }])).toBe("");
  });

  it("F12 Beschriftung unter der Linie: Monate bei langem, Tage bei kurzem Zeitraum", () => {
    expect(
      chartMarks([
        { date: "2025-11-01", cents: 1 },
        { date: "2026-10-27", cents: 2 },
      ]),
    ).toEqual(["Nov 2025", "Apr 2026", "Okt 2026"]);
    expect(chartMarks(points)).toEqual(["06.10.2026", "16.10.2026", "27.10.2026"]);
    expect(
      chartMarks([
        { date: "2026-10-20", cents: 1 },
        { date: "2026-10-27", cents: 2 },
      ]),
    ).toEqual(["20.10.2026", "27.10.2026"]);
  });
});
