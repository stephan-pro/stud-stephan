import { describe, expect, it } from "vitest";
import { MemoryStore } from "./auth.fixtures";
import { CODE_STEP_KEY, rememberedStep, rememberStep } from "./codeStep";

describe("Gemerkter Schritt der Anmeldung", () => {
  it("P4b Nach dem Neuladen geht es mit der Code-Eingabe weiter, solange der Code gilt", () => {
    const store = new MemoryStore();
    const step = { email: "stephan@beispiel.de", sentAt: 1_000 };

    rememberStep(store, step);

    expect(rememberedStep(store, 1_000 + 9 * 60_000)).toEqual(step);
    expect(rememberedStep(store, 1_000 + 10 * 60_000)).toBeUndefined();
    rememberStep(store, undefined);
    expect(rememberedStep(store, 1_000)).toBeUndefined();
  });

  it("Unlesbarer oder gesperrter Speicher: Start mit der Adresse, kein Fehler", () => {
    const store = new MemoryStore();
    store.items.set(CODE_STEP_KEY, "kein JSON");
    expect(rememberedStep(store, 0)).toBeUndefined();
    store.items.set(CODE_STEP_KEY, JSON.stringify({ email: 1, sentAt: 0 }));
    expect(rememberedStep(store, 0)).toBeUndefined();

    store.failWith = new Error("gesperrt");
    expect(() => rememberStep(store, { email: "a@b.de", sentAt: 0 })).not.toThrow();
    expect(rememberedStep(store, 0)).toBeUndefined();
  });
});
