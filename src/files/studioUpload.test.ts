import { describe, expect, it } from "vitest";
import { FakeRemote } from "../backend/fakeRemote";
import { FakeStore } from "../backend/fakeStore";
import { STUDIO_MAX_BYTES } from "./studioFile";
import { StudioFileRefused, uploadStudioFile } from "./studioUpload";

/** A chosen file with the bytes of the test. */
function chosen(name: string, bytes: Uint8Array, size = bytes.length) {
  return { name, size, arrayBuffer: async () => bytes.slice().buffer };
}

async function setup() {
  const store = new FakeStore();
  return new FakeRemote(store, store.createUser());
}

describe("F8 Studio-Datei hochladen", () => {
  const original = Uint8Array.from({ length: 3000 }, (_, index) => (index * 13 + 5) % 256);

  it("F8 Die hochgeladene Studio-Datei kommt byte-gleich wieder heraus", async () => {
    const remote = await setup();
    const entry = await uploadStudioFile(
      remote,
      "diorama-1",
      "studio-1",
      chosen("umbara-v3.io", original),
      "2026-11-01T10:00:00Z",
    );
    expect(entry).toEqual({
      id: "studio-1",
      fileName: "umbara-v3.io",
      sizeBytes: 3000,
      uploadedAt: "2026-11-01T10:00:00Z",
      path: expect.stringMatching(/\/diorama-1\/studio-1\.io$/),
    });
    expect(await remote.getFile("studio-files", entry.path)).toEqual(original);
  });

  it("F8 Eine Datei ohne .io, eine leere und eine zu große gehen gar nicht erst hoch", async () => {
    const remote = await setup();
    const send = (file: ReturnType<typeof chosen>) =>
      uploadStudioFile(remote, "diorama-1", "studio-1", file, "2026-11-01T10:00:00Z");
    await expect(send(chosen("foto.jpg", original))).rejects.toMatchObject({ problem: "not_io" });
    await expect(send(chosen("leer.io", new Uint8Array()))).rejects.toMatchObject({
      problem: "empty",
    });
    await expect(send(chosen("riesig.io", original, STUDIO_MAX_BYTES + 1))).rejects.toBeInstanceOf(
      StudioFileRefused,
    );
    expect(await remote.storageUsage()).toBe(0);
  });

  it("F8 Die Endung .io zählt auch groß geschrieben", async () => {
    const remote = await setup();
    const entry = await uploadStudioFile(
      remote,
      "diorama-1",
      "studio-2",
      chosen("MOC.IO", original),
      "2026-11-01T10:00:00Z",
    );
    expect(entry.fileName).toBe("MOC.IO");
  });
});
