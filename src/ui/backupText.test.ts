import { describe, expect, it } from "vitest";
import { BackupError, type BackupSummary } from "../backup/format";
import { counted, problemText, summaryText } from "./backupText";
import { TEXTS } from "./texts";

const SUMMARY: BackupSummary = {
  minifigs: 286,
  sets: 1,
  specialParts: 0,
  dioramas: 7,
  wishlist: 12,
  prices: 1234,
  photos: 340,
  studioFiles: 1,
  bytes: 1000,
  exportedAt: "2026-11-02T10:00:00Z",
};

describe("Wörter zur Datensicherung", () => {
  it("F15 Die Zusammenfassung nennt Figuren, Sets … mit der richtigen Einzahl und Mehrzahl", () => {
    expect(summaryText(SUMMARY)).toBe(
      "286 Figuren, 1 Set, 7 Dioramen, 12 Wünsche, 1.234 Preisstände, 340 Fotos, 1 Studio-Datei",
    );
    expect(counted("minifigs", 1)).toBe("1 Figur");
  });

  it("F15 Eine leere Sicherung sagt es", () => {
    const empty = { ...SUMMARY, minifigs: 0, sets: 0, dioramas: 0, wishlist: 0, prices: 0 };
    expect(summaryText({ ...empty, photos: 0, studioFiles: 0 })).toBe("keine Einträge");
  });

  it("F15 Jeder Grund einer abgelehnten Datei hat einen eigenen deutschen Satz", () => {
    const codes = [
      "notZip",
      "damaged",
      "unsupportedZip",
      "notBackup",
      "tooNew",
      "tooOld",
      "invalidData",
      "missingFile",
      "badFile",
      "tooBig",
      "fileTrouble",
      "selfCheck",
    ] as const;
    const texts = codes.map((code) =>
      problemText(new BackupError(code, { entry: "fotos/000001.webp" })),
    );
    expect(new Set(texts).size).toBe(codes.length);
    expect(texts.join(" ")).not.toContain("undefined");
  });

  it("F15 Eine fehlerhafte Angabe nennt Art, Kennung und Feld", () => {
    const text = problemText(
      new BackupError("invalidData", { kind: "minifig", id: "rex", reason: "name" }),
    );
    expect(text).toContain("Figur · rex · name");
  });

  it("F15 Vor dem Ersetzen heißt es, dass nichts verändert wurde; ein unbekannter Fehler hat einen Standardsatz", () => {
    expect(problemText(new BackupError("notZip"), true)).toContain(
      TEXTS.backup.problems.nothingChanged,
    );
    expect(problemText(new BackupError("notZip"))).not.toContain(
      TEXTS.backup.problems.nothingChanged,
    );
    expect(problemText(new Error("x"))).toBe(TEXTS.backup.problems.unknown);
  });

  it("F15 Ein Fehlerbild ohne Namen der Datei bleibt lesbar", () => {
    expect(problemText(new BackupError("badFile"))).not.toContain("undefined");
    expect(problemText(new BackupError("missingFile"))).toContain("?");
  });
});
