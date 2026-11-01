import { describe, expect, it } from "vitest";
import { formatDate, formatMonth } from "./dates";

describe("F5 Tage in der Anzeige", () => {
  it("F5 Ein Tag steht als 27.10.2026", () => {
    expect(formatDate("2026-10-27")).toBe("27.10.2026");
    expect(formatDate("2026-01-05T10:00:00Z")).toBe("05.01.2026");
  });

  it("F5 „Erworben“ nennt Monat und Jahr", () => {
    expect(formatMonth("2025-03-14")).toBe("März 2025");
    expect(formatMonth("2025-12-01")).toBe("Dezember 2025");
  });

  it("F5 Text, der kein Tag ist, bleibt unverändert", () => {
    expect(formatDate("irgendwann")).toBe("irgendwann");
    expect(formatMonth("2025-13-01")).toBe("2025-13-01");
  });
});
