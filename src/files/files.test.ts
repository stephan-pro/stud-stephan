import { describe, expect, it } from "vitest";
import { FakeRemote } from "../backend/fakeRemote";
import { FakeStore } from "../backend/fakeStore";
import { formatBytes } from "./bytes";
import { fitWithin, PHOTO_TARGET_BYTES, shrinkToTarget } from "./photoSize";
import {
  photoStorageName,
  STUDIO_MAX_BYTES,
  studioFileEntry,
  studioFileProblem,
  studioStorageName,
} from "./studioFile";
import { type UploadProgress, uploadFile } from "./upload";

describe("Fotos verkleinern: Maße", () => {
  it("P4c Ein 12-Megapixel-Querformat wird auf 1.600 px an der langen Seite verkleinert", () => {
    expect(fitWithin({ width: 4000, height: 3000 }, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it("P4c Hochformat wird an der Höhe begrenzt, die Proportionen bleiben", () => {
    expect(fitWithin({ width: 3000, height: 4000 }, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin({ width: 3023, height: 4031 }, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("P4c Kleine Fotos werden nie vergrößert", () => {
    expect(fitWithin({ width: 800, height: 600 }, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin({ width: 1600, height: 900 }, 1600)).toEqual({ width: 1600, height: 900 });
  });

  it("P4c Ein extrem schmales Bild behält mindestens einen Pixel", () => {
    expect(fitWithin({ width: 10_000, height: 3 }, 1600)).toEqual({ width: 1600, height: 1 });
  });
});

describe("Fotos verkleinern: Qualitätsstufen", () => {
  const source = { width: 4000, height: 3000 };

  it("P4c Reicht die erste Stufe, bleibt es bei voller Größe und bester Qualität", async () => {
    const tried: [number, number][] = [];
    const result = await shrinkToTarget(source, async (size, quality) => {
      tried.push([size.width, quality]);
      return { size: 100_000 };
    });

    expect(result.size).toBe(100_000);
    expect(tried).toEqual([[1600, 0.8]]);
  });

  it("P4c Ist das Bild zu groß, sinkt erst die Qualität, dann die Größe, bis es ≤ Ziel ist", async () => {
    const tried: [number, number][] = [];
    const result = await shrinkToTarget(source, async (size, quality) => {
      tried.push([size.width, quality]);
      return { size: size.width === 1280 && quality <= 0.7 ? PHOTO_TARGET_BYTES : 900_000 };
    });

    expect(result.size).toBe(PHOTO_TARGET_BYTES);
    expect(tried.slice(0, 6)).toEqual([
      [1600, 0.8],
      [1600, 0.7],
      [1600, 0.6],
      [1600, 0.5],
      [1600, 0.4],
      [1280, 0.8],
    ]);
    expect(tried.at(-1)).toEqual([1280, 0.7]);
  });

  it("P4c Schafft es keine Stufe, kommt das kleinste Ergebnis zurück", async () => {
    const sizes = [900, 700, 800];
    let call = 0;
    const result = await shrinkToTarget(
      source,
      async () => ({ size: sizes[call++ % 3] as number }),
      100,
    );

    expect(result.size).toBe(700);
  });
});

describe("Hochladen mit Wiederholung", () => {
  const BYTES = new Uint8Array([1, 2, 3]);

  function setup() {
    const store = new FakeStore();
    return { store, remote: new FakeRemote(store, store.createUser()) };
  }

  it("P4c Der Fortschritt zeigt Senden und Fertig, die Datei liegt im Speicher", async () => {
    const { remote } = setup();
    const seen: UploadProgress[] = [];

    const path = await uploadFile(remote, "photos", "rex/1.webp", BYTES, "image/webp", {
      onProgress: (progress) => seen.push(progress),
    });

    expect(seen).toEqual([
      { step: "sending", attempt: 1, attempts: 4 },
      { step: "done", path },
    ]);
    expect(await remote.getFile("photos", path)).toEqual(BYTES);
  });

  it("P4c Ohne Verbindung wartet der Upload und klappt beim nächsten Versuch", async () => {
    const { remote } = setup();
    remote.online = false;
    const pauses: number[] = [];
    const seen: string[] = [];

    const path = await uploadFile(remote, "photos", "rex/1.webp", BYTES, "image/webp", {
      onProgress: (progress) => seen.push(progress.step),
      sleep: async (ms) => {
        pauses.push(ms);
        if (pauses.length === 2) remote.online = true;
      },
    });

    expect(pauses).toEqual([1000, 2000]);
    expect(seen).toEqual(["sending", "waiting", "sending", "waiting", "sending", "done"]);
    expect(await remote.getFile("photos", path)).toEqual(BYTES);
  });

  it("P4c Nach allen Versuchen kommt der letzte Fehler zurück", async () => {
    const { remote } = setup();
    remote.online = false;

    await expect(
      uploadFile(remote, "photos", "rex/1.webp", BYTES, "image/webp", {
        attempts: 3,
        sleep: async () => {},
      }),
    ).rejects.toMatchObject({ permanent: false });
  });

  it("P4c Eine Ablehnung (zu groß) wird nicht wiederholt", async () => {
    const { remote } = setup();
    let pauses = 0;

    const failure = uploadFile(
      remote,
      "photos",
      "rex/1.webp",
      new Uint8Array(3_000_000),
      "image/webp",
      {
        sleep: async () => {
          pauses++;
        },
      },
    );

    await expect(failure).rejects.toMatchObject({ permanent: true, reason: "file_too_large" });
    expect(pauses).toBe(0);
  });

  it("P4c Ein Fehler, der kein RemoteError ist, wird sofort weitergereicht", async () => {
    const broken = {
      putFile: async () => {
        throw new TypeError("kaputt");
      },
    };

    await expect(uploadFile(broken, "photos", "a.webp", BYTES, "image/webp")).rejects.toThrow(
      TypeError,
    );
  });
});

describe("Studio-Dateien", () => {
  it("F8 Nur .io-Dateien bis 25 MB sind erlaubt", () => {
    expect(studioFileProblem({ name: "Umbara.io", size: 300_000 })).toBeUndefined();
    expect(studioFileProblem({ name: "UMBARA.IO", size: STUDIO_MAX_BYTES })).toBeUndefined();
    expect(studioFileProblem({ name: "Umbara.zip", size: 300_000 })).toBe("not_io");
    expect(studioFileProblem({ name: "Umbara.io", size: 0 })).toBe("empty");
    expect(studioFileProblem({ name: "Umbara.io", size: STUDIO_MAX_BYTES + 1 })).toBe("too_large");
  });

  it("F8 Der Speichername hängt nicht vom Dateinamen der Person ab, die Anzeige schon", () => {
    const file = { name: "Umbara (final) ä.io", size: 1234 };
    const entry = studioFileEntry("s-1", file, "u/umbara/s-1.io", "2026-11-01T10:00:00Z");

    expect(studioStorageName("umbara", "s-1")).toBe("umbara/s-1.io");
    expect(entry).toEqual({
      id: "s-1",
      fileName: "Umbara (final) ä.io",
      sizeBytes: 1234,
      uploadedAt: "2026-11-01T10:00:00Z",
      path: "u/umbara/s-1.io",
    });
  });

  it("P4c Fotos heißen nach Objekt und Foto-Kennung, mit der Endung ihres Formats", () => {
    expect(photoStorageName("rex", "p1", "image/webp")).toBe("rex/p1.webp");
    expect(photoStorageName("rex", "p1", "image/jpeg")).toBe("rex/p1.jpg");
    expect(photoStorageName("rex", "p1", "image/png")).toBe("rex/p1.png");
  });
});

describe("Speicheranzeige", () => {
  it("P4c Größen werden deutsch und gerundet ausgegeben", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(999)).toBe("999 B");
    expect(formatBytes(1500)).toBe("1,5 KB");
    expect(formatBytes(1000)).toBe("1 KB");
    expect(formatBytes(250_000_000)).toBe("250 MB");
    expect(formatBytes(1_000_000_000)).toBe("1 GB");
    expect(formatBytes(-5)).toBe("0 B");
  });
});
