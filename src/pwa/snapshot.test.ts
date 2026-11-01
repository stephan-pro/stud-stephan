import { describe, expect, it } from "vitest";
import { aCollection, aMinifig } from "../domain/fixtures";
import { MemorySnapshotStore, makeSnapshot, readSnapshot } from "./snapshot";

const NOW = new Date("2026-11-01T12:30:00Z");

describe("P15 Zuletzt geladener Sammlungsstand für das Lesen ohne Verbindung", () => {
  it("P15 Die Kopie enthält nur die Sammlung, den Zeitpunkt und das Konto – keine Sitzung", () => {
    const collection = aCollection({ minifigs: [aMinifig({ name: "Rex" })] });
    const snapshot = makeSnapshot("user-1", collection, NOW);
    expect(Object.keys(snapshot).sort()).toEqual(["collection", "savedAt", "userId"]);
    expect(snapshot.savedAt).toBe("2026-11-01T12:30:00.000Z");
    expect(JSON.stringify(snapshot)).not.toMatch(/token|access|refresh|session/i);
  });

  it("P15 Die Kopie eines anderen Kontos wird nie gezeigt", () => {
    const snapshot = makeSnapshot("user-1", aCollection(), NOW);
    expect(readSnapshot(snapshot, "user-1")?.collection).toEqual(aCollection());
    expect(readSnapshot(snapshot, "user-2")).toBeUndefined();
  });

  it("P15 Eine beschädigte oder alte Kopie gilt als keine", () => {
    const good = makeSnapshot("user-1", aCollection(), NOW);
    for (const bad of [
      undefined,
      null,
      "text",
      { ...good, savedAt: 5 },
      { ...good, savedAt: "gestern" },
      { ...good, collection: null },
      { ...good, collection: { ...good.collection, schemaVersion: 0 } },
      { ...good, collection: { ...good.collection, minifigs: "keine" } },
    ]) {
      expect(readSnapshot(bad, "user-1")).toBeUndefined();
    }
  });

  it("P15 Beim Abmelden verlässt die Kopie das Gerät", async () => {
    const store = new MemorySnapshotStore();
    await store.write(makeSnapshot("user-1", aCollection(), NOW));
    expect(await store.read("user-1")).toBeDefined();
    await store.clear();
    expect(await store.read("user-1")).toBeUndefined();
  });
});
