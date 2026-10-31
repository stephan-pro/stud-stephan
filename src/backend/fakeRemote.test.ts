import { describe, expect, it } from "vitest";
import { aMinifig } from "../domain/fixtures";
import { FakeRemote } from "./fakeRemote";
import { FakeStore } from "./fakeStore";
import { describeRemoteContract } from "./remote.contract";

describeRemoteContract("FakeRemote (im Speicher)", async () => {
  const store = new FakeStore();
  return {
    a: new FakeRemote(store, store.createUser()),
    b: new FakeRemote(store, store.createUser()),
  };
});

describe("FakeRemote", () => {
  it("Ohne Verbindung scheitert jeder Aufruf vorübergehend", async () => {
    const store = new FakeStore();
    const remote = new FakeRemote(store, store.createUser());
    remote.online = false;

    await expect(remote.load()).rejects.toMatchObject({ permanent: false });
    await expect(remote.save("minifig", aMinifig())).rejects.toMatchObject({ permanent: false });
    remote.online = true;
    expect((await remote.load()).minifigs).toEqual([]);
  });

  it("Ein unbekanntes Konto ist nicht angemeldet", async () => {
    const remote = new FakeRemote(new FakeStore(), "unbekannt");

    await expect(remote.load()).rejects.toMatchObject({
      permanent: true,
      reason: "not_signed_in",
    });
  });

  it("Eine gelöschte Figur gibt ihre Fotos auch im Speicher frei", async () => {
    const store = new FakeStore();
    const remote = new FakeRemote(store, store.createUser());
    const path = await remote.putFile("photos", "rex.webp", new Uint8Array(4), "image/webp");
    await remote.save("minifig", aMinifig({ id: "rex", photos: [path] }));

    await remote.remove("minifig", "rex");

    expect(store.hasFile("photos", path)).toBe(false);
  });
});
