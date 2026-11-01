import { describe, expect, it } from "vitest";
import {
  buildDiorama,
  type DioramaFormValues,
  emptyDioramaForm,
  firstDioramaError,
  formFromDiorama,
  validateDioramaForm,
} from "./dioramaForm";
import { aDiorama } from "./fixtures";

const context = { id: "diorama-1", createdAt: "2026-11-01T10:00:00Z", today: "2026-11-01" };
const filled = (fields: Partial<DioramaFormValues> = {}): DioramaFormValues => ({
  ...emptyDioramaForm(),
  name: "Umbara-Gefecht",
  ...fields,
});

describe("F8 Formular für ein Diorama", () => {
  it("F8 Ein Diorama braucht einen Namen; alles andere ist freiwillig", () => {
    expect(validateDioramaForm(emptyDioramaForm())).toEqual({ name: "required" });
    expect(validateDioramaForm(filled())).toEqual({});
    expect(validateDioramaForm(filled({ name: "x".repeat(201) }))).toEqual({ name: "tooLong" });
  });

  it("F8 Teilezahl, Wert, Links und Notiz werden geprüft", () => {
    const errors = validateDioramaForm(
      filled({
        pieceCount: "viele",
        manualValue: "abc",
        links: "https://rebrickable.com/mocs/MOC-1/\nkeine Adresse",
        note: "n".repeat(5001),
      }),
    );
    expect(errors).toEqual({
      pieceCount: "wholeNumber",
      manualValue: "money",
      links: "url",
      note: "tooLong",
    });
    expect(firstDioramaError(errors)).toBe("pieceCount");
    expect(firstDioramaError({})).toBeUndefined();
  });

  it("F8 Mehr als 20 Links sind zu viele", () => {
    const links = Array.from({ length: 21 }, (_, index) => `https://beispiel.de/${index}`);
    expect(validateDioramaForm(filled({ links: links.join("\n") }))).toEqual({ links: "tooLong" });
  });

  it("F8 Das Diorama aus dem Formular: leere Felder fehlen, Links einer pro Zeile", () => {
    const diorama = buildDiorama(
      filled({
        pieceCount: " 1240 ",
        manualValue: "150,50",
        links: "https://rebrickable.com/mocs/MOC-1/\n\nhttps://rebrickable.com/mocs/MOC-1/",
        photos: ["owner/a.webp"],
      }),
      context,
    );
    expect(diorama).toEqual({
      type: "diorama",
      id: "diorama-1",
      name: "Umbara-Gefecht",
      photos: ["owner/a.webp"],
      links: ["https://rebrickable.com/mocs/MOC-1/"],
      studioFiles: [],
      createdAt: "2026-11-01T10:00:00Z",
      pieceCount: 1240,
      manualValue: { cents: 15050, enteredOn: "2026-11-01" },
    });
    const bare = buildDiorama(filled(), context);
    expect(bare).not.toHaveProperty("pieceCount");
    expect(bare).not.toHaveProperty("manualValue");
    expect(bare).not.toHaveProperty("note");
  });

  it("F8 Beim Bearbeiten bleiben Anlegedatum und Tag des Wertes, solange der Wert gleich bleibt", () => {
    const existing = aDiorama({
      id: "diorama-1",
      createdAt: "2026-01-01T10:00:00Z",
      manualValue: { cents: 15050, enteredOn: "2026-02-02" },
      pieceCount: 10,
      note: "alt",
      links: ["https://beispiel.de/"],
    });
    const same = buildDiorama(formFromDiorama(existing), { ...context, existing });
    expect(same).toEqual(existing);
    const changed = buildDiorama(
      { ...formFromDiorama(existing), manualValue: "200,00" },
      { ...context, existing },
    );
    expect(changed.manualValue).toEqual({ cents: 20000, enteredOn: "2026-11-01" });
    expect(changed.createdAt).toBe("2026-01-01T10:00:00Z");
  });

  it("F8 Die Studio-Dateien und Fotos gehen unverändert durch das Formular", () => {
    const file = {
      id: "studio-1",
      fileName: "umbara.io",
      sizeBytes: 2400,
      uploadedAt: "2026-10-12T19:30:00Z",
      path: "owner/diorama-1/studio-1.io",
    };
    const existing = aDiorama({ id: "diorama-1", photos: ["owner/a.webp"], studioFiles: [file] });
    const form = formFromDiorama(existing);
    expect(form.studioFiles).toEqual([file]);
    expect(form.studioFiles[0]).not.toBe(file);
    expect(buildDiorama(form, { ...context, existing }).studioFiles).toEqual([file]);
  });
});
