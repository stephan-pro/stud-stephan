import { describe, expect, it } from "vitest";
import { backupNotice, daysBetween, parseBackupDay, REMINDER_DAYS } from "./backupReminder";

describe("Erinnerung an die Datensicherung", () => {
  it("F15 Ohne bekannte Sicherung gibt es den Hinweis „noch keine“", () => {
    expect(backupNotice(undefined, "2026-11-02")).toEqual({ kind: "never" });
  });

  it("F15 Bis zu 29 Tage nach der Sicherung gibt es keine Erinnerung", () => {
    expect(backupNotice("2026-11-02", "2026-11-02")).toEqual({
      kind: "recent",
      date: "2026-11-02",
      days: 0,
    });
    expect(backupNotice("2026-10-04", "2026-11-02")).toMatchObject({ kind: "recent", days: 29 });
  });

  it("F15 Nach 30 Tagen erinnert die App sanft", () => {
    expect(REMINDER_DAYS).toBe(30);
    expect(backupNotice("2026-10-03", "2026-11-02")).toMatchObject({ kind: "due", days: 30 });
    expect(backupNotice("2026-01-01", "2026-11-02")).toMatchObject({ kind: "due", days: 305 });
  });

  it("F15 Ein Datum in der Zukunft (falsche Uhr) zählt als heute", () => {
    expect(backupNotice("2026-12-01", "2026-11-02")).toMatchObject({ kind: "recent", days: 0 });
  });

  it("Tage zwischen zwei Daten rechnen über Monats- und Jahreswechsel", () => {
    expect(daysBetween("2025-12-31", "2026-01-02")).toBe(2);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(daysBetween("2026-11-02", "2026-11-01")).toBe(-1);
  });

  it("Ein gespeicherter Tag wird nur gelesen, wenn er ein richtiger Tag ist", () => {
    expect(parseBackupDay("2026-11-02")).toBe("2026-11-02");
    expect(parseBackupDay("2026-02-30")).toBeUndefined();
    expect(parseBackupDay("gestern")).toBeUndefined();
    expect(parseBackupDay(null)).toBeUndefined();
    expect(parseBackupDay(undefined)).toBeUndefined();
  });
});
