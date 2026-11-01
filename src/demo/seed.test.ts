import { describe, expect, it } from "vitest";
import { FakeRemote } from "../backend/fakeRemote";
import { FakeStore } from "../backend/fakeStore";
import { DEMO_COLLECTION } from "./collection";
import { seedDemoStore } from "./seed";

describe("Demo-Server", () => {
  it("P14 Der Speicher der Demo enthält die gezeigte Beispielsammlung, damit Export und Import etwas haben", async () => {
    const store = new FakeStore();
    const owner = store.createUser();

    seedDemoStore(store, owner, DEMO_COLLECTION);
    const loaded = await new FakeRemote(store, owner).load();

    expect(loaded.minifigs.map((m) => m.id).sort()).toEqual(
      DEMO_COLLECTION.minifigs.map((m) => m.id).sort(),
    );
    expect(loaded.sets).toHaveLength(DEMO_COLLECTION.sets.length);
    expect(loaded.specialParts).toHaveLength(DEMO_COLLECTION.specialParts.length);
    expect(loaded.dioramas).toHaveLength(DEMO_COLLECTION.dioramas.length);
    expect(loaded.wishlist).toHaveLength(DEMO_COLLECTION.wishlist.length);
    expect(loaded.prices).toHaveLength(DEMO_COLLECTION.prices.length);
  });

  it("P14 Die Studio-Dateien des Beispiels sind echte Dateien im Demo-Speicher", async () => {
    const store = new FakeStore();
    const owner = store.createUser();
    seedDemoStore(store, owner, DEMO_COLLECTION);
    const remote = new FakeRemote(store, owner);

    const files = (await remote.load()).dioramas.flatMap((diorama) => diorama.studioFiles);

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect((await remote.getFile("studio-files", file.path)).length).toBe(file.sizeBytes);
    }
  });
});
