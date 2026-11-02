import { describe, expect, it } from "vitest";
import { FakeRemote } from "../backend/fakeRemote";
import { RemoteError } from "../backend/remote";
import { aCollection, aMinifig, aPrice } from "../domain/fixtures";
import type { LegoSet, Minifig } from "../domain/types";
import {
  exportBytes,
  fillCollection,
  fingerprint,
  imageBytes,
  NOW,
  newPerson,
  type Parts,
  rebuild,
  zipBytes,
} from "./backup.fixtures";
import { estimateBackupBytes, exportBackup } from "./exportBackup";
import { BackupError, backupFileName, DATA_ENTRY } from "./format";
import { importBackup, makeBackup } from "./makeBackup";
import { readBackup } from "./readBackup";
import { RestoreError, restoreBackup } from "./restoreBackup";
import { blobSource, bytesSource } from "./zip";

const sleep = async () => {};

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return error instanceof BackupError ? error.code : `anderer Fehler: ${String(error)}`;
  }
  return undefined;
}

describe("Export", () => {
  it("F15 Die Sicherung enthält alle Daten, Fotos und Studio-Dateien mit Datenstand und Exportdatum", async () => {
    const { remote } = newPerson();
    await fillCollection(remote);

    const { bytes, result } = await exportBytes(remote);
    const parsed = await readBackup(bytesSource(bytes));

    expect(result.summary).toMatchObject({
      minifigs: 2,
      sets: 1,
      specialParts: 1,
      dioramas: 1,
      wishlist: 1,
      prices: 2,
      photos: 4,
      studioFiles: 1,
    });
    expect(parsed.manifest).toMatchObject({
      app: "stud-stephan",
      schemaVersion: 1,
      exportedAt: NOW.toISOString(),
    });
    expect(parsed.summary).toEqual(result.summary);
    expect(result.bytes).toBe(bytes.length);
    expect(result.skipped).toBe(0);
  });

  it("F15 Die Datei wird in vielen Stücken geschrieben, nicht als ein Block", async () => {
    const { remote } = newPerson();
    await fillCollection(remote);
    const chunks: Uint8Array[] = [];

    const { bytes } = await exportBytes(remote, chunks);

    expect(chunks.length).toBeGreaterThan(20);
    expect(Math.max(...chunks.map((chunk) => chunk.length))).toBeLessThan(bytes.length / 2);
  });

  it("F15 Die Datei nennt keine Speicherpfade und keine Konto-Kennung", async () => {
    const { remote } = newPerson();
    await fillCollection(remote);

    const { bytes } = await exportBytes(remote);
    const { manifest } = await readBackup(bytesSource(bytes));
    const text = JSON.stringify(manifest);

    expect(text).not.toContain((remote as FakeRemote).owner);
    expect(
      manifest.collection.minifigs[0]?.photos.every((p) => /^fotos\/\d{6}\.webp$/.test(p)),
    ).toBe(true);
    expect(manifest.collection.dioramas[0]?.studioFiles[0]?.path).toMatch(/^studio\/\d{6}\.io$/);
  });

  it("F15 Die ungefähre Größe vorab liegt knapp über der der fertigen Datei", async () => {
    const { remote } = newPerson();
    const collection = await fillCollection(remote);
    const usage = await remote.storageUsage();

    const { bytes } = await exportBytes(remote);
    const estimate = estimateBackupBytes(collection, usage);

    expect(estimate).toBeGreaterThanOrEqual(bytes.length);
    expect(estimate - bytes.length).toBeLessThan(5_000);
  });

  it("F15 Eine Datei, die im Speicher fehlt, bleibt aus der Sicherung heraus und wird gezählt", async () => {
    const { store, remote } = newPerson();
    const collection = await fillCollection(remote);
    const lost = collection.minifigs.find((m) => m.id === "minifig-rex")?.photos[1] as string;
    store.removeFile((remote as FakeRemote).owner, "photos", lost);

    const { bytes, result } = await exportBytes(remote);
    const parsed = await readBackup(bytesSource(bytes));

    expect(result.skipped).toBe(1);
    expect(
      parsed.manifest.collection.minifigs.find((m) => m.id === "minifig-rex")?.photos,
    ).toHaveLength(1);
  });

  it("F15 Ein Foto, das kein Bild ist, bleibt ebenfalls heraus", async () => {
    const { remote } = newPerson();
    const path = await remote.putFile("photos", "kaputt.webp", new Uint8Array(50), "image/webp");
    await remote.save("minifig", aMinifig({ id: "x", photos: [path] }));

    const { result } = await exportBytes(remote);

    expect(result.skipped).toBe(1);
    expect(result.summary.photos).toBe(0);
  });

  it("F15 Eine Verbindung, die kurz fehlt, wird abgewartet; eine, die bleibt, bricht die Sicherung ab", async () => {
    const { remote } = newPerson();
    await fillCollection(remote);
    const real = remote.getFile.bind(remote);
    let failures = 1;
    remote.getFile = async (bucket, path) => {
      if (failures-- > 0) throw new RemoteError("Keine Verbindung");
      return real(bucket, path);
    };
    const pauses: number[] = [];

    const done = await exportBackup({
      remote,
      now: NOW,
      write: () => {},
      sleep: async (ms) => {
        pauses.push(ms);
      },
    });
    expect(done.skipped).toBe(0);
    expect(pauses).toEqual([1000]);

    remote.getFile = async () => {
      throw new RemoteError("Keine Verbindung");
    };
    expect(await codeOf(exportBackup({ remote, now: NOW, write: () => {}, sleep }))).toBe(
      "fileTrouble",
    );
    remote.getFile = async () => {
      throw new RemoteError("Verboten", true, "invalid_path");
    };
    expect(await codeOf(exportBackup({ remote, now: NOW, write: () => {}, sleep }))).toBe(
      "fileTrouble",
    );
  });

  it("F15 Der Fortschritt zählt die Dateien", async () => {
    const { remote } = newPerson();
    await fillCollection(remote);
    const seen: number[] = [];

    await exportBackup({
      remote,
      now: NOW,
      write: () => {},
      onProgress: ({ done, total }) => seen.push(done / total),
    });

    expect(seen[0]).toBe(0);
    expect(seen.at(-1)).toBe(1);
  });

  it("F15 Eine Sicherung, die der Import nicht lesen würde, wird nicht herausgegeben", async () => {
    const { remote } = newPerson();
    // A figure without the list of links (older data) cannot be restored by the app's rules.
    await remote.save("minifig", { ...aMinifig({ id: "alt" }), links: undefined } as never);

    expect(await codeOf(makeBackup({ remote, now: NOW, sleep }))).toBe("selfCheck");
  });

  it("F15 Der Dateiname nennt den Tag", () => {
    expect(backupFileName("2026-11-02")).toBe("stud-stephan-sicherung-2026-11-02.zip");
  });
});

describe("Prüfung vor dem Import", () => {
  async function goodBackup() {
    const { remote } = newPerson();
    await fillCollection(remote);
    return (await exportBytes(remote)).bytes;
  }

  async function broken(change: (parts: Parts) => void): Promise<string | undefined> {
    return codeOf(readBackup(bytesSource(await rebuild(await goodBackup(), change))));
  }

  it("F15 Eine Datei, die kein ZIP ist, wird abgelehnt", async () => {
    expect(
      await codeOf(
        readBackup(bytesSource(new TextEncoder().encode("Das ist ein Brief, kein ZIP."))),
      ),
    ).toBe("notZip");
  });

  it("F15 Ein ZIP ohne Datenstand ist keine Sicherung", async () => {
    const zip = await zipBytes([["fotos/000001.webp", imageBytes(1)]]);

    expect(await codeOf(readBackup(bytesSource(zip)))).toBe("notBackup");
  });

  it("F15 Zusätzliche Einträge, die kein Objekt nennt, stören nicht", async () => {
    expect(await broken((p) => p.files.set("fotos/000099.webp", imageBytes(9)))).toBeUndefined();
  });

  it("F15 Eine beschädigte Datei im ZIP fällt bei der Prüfsumme auf", async () => {
    const bytes = await goodBackup();
    // Somewhere in the first photo (it follows the 30-byte header and the 17-byte name).
    bytes[30 + 17 + 50] = (bytes[30 + 17 + 50] as number) ^ 0xff;

    expect(await codeOf(readBackup(bytesSource(bytes)))).toBe("damaged");
  });

  it("F15 Mehr als der aktuelle Datenstand oder ein fremdes Format wird abgelehnt", async () => {
    expect(await broken((p) => ((p.manifest as { schemaVersion: number }).schemaVersion = 2))).toBe(
      "tooNew",
    );
    expect(await broken((p) => ((p.manifest as { format: number }).format = 2))).toBe("tooNew");
    expect(await broken((p) => ((p.manifest as { schemaVersion: number }).schemaVersion = 0))).toBe(
      "notBackup",
    );
    expect(await broken((p) => ((p.manifest as { app: string }).app = "kruemel"))).toBe(
      "notBackup",
    );
    expect(await broken((p) => ((p.manifest as { format: number }).format = 0))).toBe("notBackup");
  });

  it("F15 Ein Datenstand von früher, für den es keine Umstellung gibt, wird abgelehnt", async () => {
    const source = bytesSource(await goodBackup());

    expect(await codeOf(readBackup(source, 2))).toBe("tooOld");
    expect(await codeOf(readBackup(source, 0))).toBe("tooNew");
    expect(await codeOf(readBackup(source, 1))).toBeUndefined();
  });

  it("F15 Pflichtfelder: fehlende Liste, kaputtes Datum, fehlender Name", async () => {
    expect(
      await broken((p) => {
        (p.manifest as unknown as { collection: Record<string, unknown> }).collection.prices =
          undefined;
      }),
    ).toBe("invalidData");
    expect(
      await broken((p) => ((p.manifest as { exportedAt: string }).exportedAt = "gestern")),
    ).toBe("invalidData");
    expect(
      await broken((p) => {
        (p.manifest.collection.minifigs[0] as { name: unknown }).name = "";
      }),
    ).toBe("invalidData");
    expect(
      await broken((p) => {
        (p.manifest as unknown as { collection: unknown }).collection = null;
      }),
    ).toBe("invalidData");
  });

  it("F15 Grenzen aus den Regeln: falsche Art, zu großes Objekt, unbekannte Herstellerart", async () => {
    expect(
      await broken((p) => {
        (p.manifest.collection.minifigs[0] as { type: string }).type = "legoSet";
      }),
    ).toBe("invalidData");
    expect(
      await broken((p) => {
        (p.manifest.collection.minifigs[0] as { note: string }).note = "x".repeat(40_000);
      }),
    ).toBe("invalidData");
    expect(
      await broken((p) => {
        (p.manifest.collection.sets[0] as { manufacturer: unknown }).manufacturer = { kind: "x" };
      }),
    ).toBe("invalidData");
    expect(
      await broken((p) => {
        (p.manifest.collection.sets[0] as { status: string }).status = "kaputt";
      }),
    ).toBe("invalidData");
  });

  it("F15 Doppelte Kennungen, Verweise ins Leere und Preisstände ohne Sinn werden abgelehnt", async () => {
    expect(
      await broken((p) => {
        const cody = p.manifest.collection.minifigs.find((m) => m.id === "minifig-cody");
        p.manifest.collection.minifigs.push({ ...(cody as Minifig) });
      }),
    ).toBe("invalidData");
    expect(
      await broken((p) => {
        (p.manifest.collection.minifigs[1] as { dioramaId: string }).dioramaId = "gibt-es-nicht";
      }),
    ).toBe("invalidData");
    expect(
      await broken((p) => {
        (p.manifest.collection.minifigs[0] as { fromSet: unknown }).fromSet = {
          setId: "gibt-es-nicht",
        };
      }),
    ).toBe("invalidData");
    expect(
      await broken((p) => {
        p.manifest.collection.prices.push(p.manifest.collection.prices[0] as never);
      }),
    ).toBe("invalidData");
    expect(
      await broken((p) => {
        p.manifest.collection.prices.push({ itemType: "minifig" } as never);
      }),
    ).toBe("invalidData");
    expect(
      await broken((p) => {
        const diorama = p.manifest.collection.dioramas[0];
        (diorama as { studioFiles: unknown[] }).studioFiles.push({
          ...(diorama?.studioFiles[0] as object),
          path: "studio/000002.io",
        });
        (p.manifest as unknown as { files: unknown[] }).files.push({
          entry: "studio/000002.io",
          bucket: "studio-files",
          contentType: "application/octet-stream",
          bytes: 10,
        });
        p.files.set("studio/000002.io", new Uint8Array(10));
      }),
    ).toBe("invalidData");
  });

  it("F15 Dateien: fehlend, falscher Inhalt, falscher Typ, ungültiger oder doppelter Name, zu groß", async () => {
    expect(await broken((p) => p.files.delete("fotos/000001.webp"))).toBe("missingFile");
    expect(await broken((p) => p.files.set("fotos/000001.webp", new Uint8Array(312)))).toBe(
      "badFile",
    );
    expect(await broken((p) => p.files.set("fotos/000001.webp", imageBytes(1, 99)))).toBe(
      "badFile",
    );
    expect(
      await broken((p) => {
        (p.manifest.files[0] as { contentType: string }).contentType = "image/gif";
      }),
    ).toBe("badFile");
    expect(
      await broken((p) => {
        (p.manifest.files[0] as { entry: string }).entry = "../../etc/passwd.webp";
      }),
    ).toBe("badFile");
    expect(
      await broken((p) => {
        (p.manifest.files[1] as { entry: string }).entry = p.manifest.files[0]?.entry as string;
      }),
    ).toBe("badFile");
    expect(
      await broken((p) => {
        (p.manifest.files[0] as { bytes: number }).bytes = 3 * 1024 * 1024;
      }),
    ).toBe("badFile");
    expect(
      await broken((p) => {
        (p.manifest.files[0] as { bytes: number }).bytes = 0;
      }),
    ).toBe("badFile");
    expect(
      await broken((p) => {
        (p.manifest as unknown as { files: unknown[] }).files[0] = "nein";
      }),
    ).toBe("invalidData");
  });

  it("F15 Eine Datei, die zwei Objekte nennen, und ein Foto im Studio-Fach werden abgelehnt", async () => {
    expect(
      await broken((p) => {
        const rex = p.manifest.collection.minifigs.find((m) => m.id === "minifig-rex");
        const photo = rex?.photos[0] as string;
        (p.manifest.collection.sets[0] as { photos: string[] }).photos = [photo];
      }),
    ).toBe("badFile");
    expect(
      await broken((p) => {
        (p.manifest.collection.sets[0] as { photos: string[] }).photos = ["studio/000001.io"];
      }),
    ).toBe("badFile");
    expect(
      await broken((p) => {
        (p.manifest.collection.sets[0] as { photos: unknown }).photos = "foto";
      }),
    ).toBe("invalidData");
    expect(
      await broken((p) => {
        (p.manifest.collection.dioramas[0] as { studioFiles: unknown }).studioFiles = [1];
      }),
    ).toBe("invalidData");
  });

  it("F15 Mehr Dateien, als der Speicher fasst, werden abgelehnt", async () => {
    expect(
      await broken((p) => {
        const files = p.manifest.files as unknown as { bytes: number }[];
        for (const file of files) file.bytes = 2 * 1024 * 1024;
        // 4 photos of 2 MB are far below 1 GB; list many more to pass the limit of storage.
        for (let index = 0; index < 600; index++) {
          files.push({
            entry: `fotos/${String(100 + index).padStart(6, "0")}.webp`,
            bucket: "photos",
            contentType: "image/webp",
            bytes: 2 * 1024 * 1024,
          } as never);
        }
      }),
    ).toBe("tooBig");
    expect(
      await broken((p) => {
        const files = p.manifest.files as unknown as unknown[];
        for (let index = 0; index < 20_001; index++) files.push(files[0]);
      }),
    ).toBe("tooBig");
  });

  it("F15 Ein ZIP mit gepackten Einträgen oder ohne lesbare Daten wird mit dem passenden Grund abgelehnt", async () => {
    const bytes = await goodBackup();
    const directory = new DataView(bytes.buffer).getUint32(bytes.length - 6, true);
    new DataView(bytes.buffer).setUint16(directory + 10, 8, true);
    expect(await codeOf(readBackup(bytesSource(bytes)))).toBe("unsupportedZip");

    const noJson = await zipBytes([[DATA_ENTRY, new TextEncoder().encode("{ kein JSON")]]);
    expect(await codeOf(readBackup(bytesSource(noJson)))).toBe("notBackup");
  });

  it("F15 Ein Blob aus dem Browser lässt sich genauso prüfen", async () => {
    const bytes = await goodBackup();

    const parsed = await readBackup(blobSource(new Blob([bytes as BlobPart])));

    expect(parsed.summary.minifigs).toBe(2);
  });
});

describe("Ersetzen", () => {
  async function backupOf(remote: FakeRemote) {
    const { bytes } = await exportBytes(remote);
    const source = bytesSource(bytes);
    return { source, backup: await readBackup(source) };
  }

  it("F15 Export → Import in ein leeres Konto stellt alles wieder her, die Dateien byte-gleich", async () => {
    const original = newPerson();
    await fillCollection(original.remote);
    const { source, backup } = await backupOf(original.remote);
    const other = newPerson();

    await restoreBackup({ remote: other.remote, source, backup, sleep });

    expect(await fingerprint(other.remote)).toEqual(await fingerprint(original.remote));
    expect(await other.remote.storageUsage()).toBe(await original.remote.storageUsage());
  });

  it("F15 Der Bildausschnitt eines Fotos folgt dem Foto auf den neuen Pfad", async () => {
    const original = newPerson();
    await fillCollection(original.remote);
    const { source, backup } = await backupOf(original.remote);
    const other = newPerson();

    await restoreBackup({ remote: other.remote, source, backup, sleep });

    const rex = (await other.remote.load()).minifigs.find((m) => m.id === "minifig-rex");
    expect(rex?.photos).toHaveLength(2);
    expect(rex?.photoFocus).toEqual({ [rex?.photos[1] ?? ""]: { x: 30, y: 70 } });
    expect(JSON.stringify(backup.manifest.collection)).toContain("fotos/000002.webp");
    const inFile = backup.manifest.collection.minifigs.find((m) => m.id === "minifig-rex");
    expect(Object.keys(inFile?.photoFocus ?? {})).toEqual([
      expect.stringMatching(/^fotos\/\d{6}\.webp$/),
    ]);
  });

  it("F15 Die Dateien bekommen neue Pfade; Namen aus der Datei werden nie als Speicherpfad übernommen", async () => {
    const original = newPerson();
    await fillCollection(original.remote);
    const { source, backup } = await backupOf(original.remote);
    const other = newPerson();

    await restoreBackup({ remote: other.remote, source, backup, sleep, token: "abcd1234" });

    const restored = await other.remote.load();
    const paths = [
      ...restored.minifigs.flatMap((m) => m.photos),
      ...restored.dioramas.flatMap((d) => d.studioFiles.map((f) => f.path)),
    ];
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path).toMatch(
        new RegExp(`^${other.remote.owner}/wiederherstellung-abcd1234/\\d{6}\\.(webp|io)$`),
      );
    }
    expect(JSON.stringify(restored)).not.toContain("fotos/");
  });

  it("F15 Round trip im selben Konto: nach Änderungen bringt der Import den Stand der Sicherung zurück", async () => {
    const person = newPerson();
    await fillCollection(person.remote);
    const before = await fingerprint(person.remote);
    const { source, backup } = await backupOf(person.remote);
    // Changes after the backup: a figure deleted, a set renamed, a new figure with a photo.
    await person.remote.remove("minifig", "minifig-rex");
    const set = (await person.remote.load()).sets[0];
    await person.remote.save("legoSet", { ...(set as LegoSet), name: "Umbenannt" });
    const photo = await person.remote.putFile("photos", "neu.webp", imageBytes(77), "image/webp");
    await person.remote.save("minifig", aMinifig({ id: "neu", photos: [photo] }));

    await restoreBackup({ remote: person.remote, source, backup, sleep });

    expect(await fingerprint(person.remote)).toEqual(before);
  });

  it("F15 Was die Sicherung nicht kennt, verschwindet samt Dateien; Preisstände von später bleiben", async () => {
    const person = newPerson();
    await fillCollection(person.remote);
    const { source, backup } = await backupOf(person.remote);
    const photo = await person.remote.putFile("photos", "neu.webp", imageBytes(77), "image/webp");
    await person.remote.save("minifig", aMinifig({ id: "neu", photos: [photo] }));
    await person.remote.savePrice(aPrice("sw0999", "2026-11-09", { used: 100 }));

    await restoreBackup({ remote: person.remote, source, backup, sleep });

    const restored = await person.remote.load();
    expect(restored.minifigs.map((m) => m.id)).toEqual(["minifig-cody", "minifig-rex"]);
    await expect(person.remote.getFile("photos", photo)).rejects.toMatchObject({
      reason: "not_found",
    });
    expect(restored.prices.map((p) => p.bricklinkId)).toContain("sw0999");
  });

  it("F15 Die alten Dateien bleiben bis zum Schluss; danach liegen nur die der Sicherung im Speicher", async () => {
    const person = newPerson();
    await fillCollection(person.remote);
    const { source, backup } = await backupOf(person.remote);
    const filesBefore = person.store.fileCount();

    await restoreBackup({ remote: person.remote, source, backup, sleep });

    expect(person.store.fileCount()).toBe(filesBefore);
  });

  it("F15 Preisstände, die schon so da sind, werden nicht noch einmal geschrieben", async () => {
    const person = newPerson();
    await fillCollection(person.remote);
    const { source, backup } = await backupOf(person.remote);
    let written = 0;
    const real = person.remote.savePrice.bind(person.remote);
    person.remote.savePrice = async (point) => {
      written++;
      return real(point);
    };

    await restoreBackup({ remote: person.remote, source, backup, sleep });
    expect(written).toBe(0);

    await person.remote.savePrice(aPrice("sw0194", "2026-10-26", { used: 1 }));
    written = 0;
    await restoreBackup({ remote: person.remote, source, backup, sleep });
    expect(written).toBe(1);
    expect(
      (await person.remote.load()).prices.find((p) => p.date === "2026-10-26")?.cents.used,
    ).toBe(3850);
  });

  it("F15 Der Fortschritt läuft durch Dateien, Objekte, Preise und Aufräumen", async () => {
    const person = newPerson();
    await fillCollection(person.remote);
    const { source, backup } = await backupOf(person.remote);
    const phases: string[] = [];

    await restoreBackup({
      remote: person.remote,
      source,
      backup,
      sleep,
      onProgress: ({ phase }) => {
        if (phases.at(-1) !== phase) phases.push(phase);
      },
    });

    expect(phases).toEqual(["files", "objects", "prices", "cleanup"]);
  });

  it("F15 Scheitert das Ersetzen mittendrin, ist der alte Stand ganz zurück – nie ein halber", async () => {
    const person = newPerson();
    await fillCollection(person.remote);
    const original = await fingerprint(person.remote);
    const { source, backup } = await backupOf(person.remote);
    // The current state differs from the backup, so the replacing really changes things.
    await person.remote.remove("minifig", "minifig-rex");
    const photo = await person.remote.putFile("photos", "neu.webp", imageBytes(77), "image/webp");
    await person.remote.save("minifig", aMinifig({ id: "neu", name: "Neu", photos: [photo] }));
    const stateBefore = await fingerprint(person.remote);
    const filesBefore = person.store.fileCount();
    const real = person.remote.saveKeeping.bind(person.remote);
    let calls = 0;
    person.remote.saveKeeping = async (kind, object) => {
      if (++calls === 4) throw new RemoteError("Der Server lehnt ab", true, "too_large");
      return real(kind, object);
    };

    const failure = await restoreBackup({ remote: person.remote, source, backup, sleep }).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(RestoreError);
    expect(failure).toMatchObject({ stage: "objects", restored: true });
    expect(await fingerprint(person.remote)).toEqual(stateBefore);
    expect(stateBefore).not.toEqual(original);
    expect(person.store.fileCount()).toBe(filesBefore);
  });

  it("F15 Scheitert ein Preis erst nach den Objekten, wird auch dann alles zurückgenommen", async () => {
    const person = newPerson();
    await fillCollection(person.remote);
    const { source, backup } = await backupOf(person.remote);
    await person.remote.remove("minifig", "minifig-cody");
    await person.remote.savePrice(aPrice("sw0194", "2026-10-26", { used: 1 }));
    const stateBefore = await fingerprint(person.remote);
    const real = person.remote.savePrice.bind(person.remote);
    let calls = 0;
    person.remote.savePrice = async (point) => {
      calls++;
      // The change back after the failure must work.
      if (calls === 1) throw new RemoteError("Der Server lehnt ab", true, "invalid_object");
      return real(point);
    };

    await expect(
      restoreBackup({ remote: person.remote, source, backup, sleep }),
    ).rejects.toMatchObject({
      restored: true,
    });
    expect(await fingerprint(person.remote)).toEqual(stateBefore);
  });

  it("F15 Scheitert schon das Hochladen, ist nichts verändert und nichts liegt herum", async () => {
    const person = newPerson();
    await fillCollection(person.remote);
    const { source, backup } = await backupOf(person.remote);
    await person.remote.remove("minifig", "minifig-cody");
    const stateBefore = await fingerprint(person.remote);
    const filesBefore = person.store.fileCount();
    const real = person.remote.putFile.bind(person.remote);
    let calls = 0;
    person.remote.putFile = async (...args) => {
      if (++calls === 3) throw new RemoteError("Der Server lehnt ab", true, "file_too_large");
      return real(...args);
    };

    await expect(
      restoreBackup({ remote: person.remote, source, backup, sleep }),
    ).rejects.toMatchObject({
      stage: "files",
      restored: true,
    });
    expect(await fingerprint(person.remote)).toEqual(stateBefore);
    expect(person.store.fileCount()).toBe(filesBefore);
  });

  it("F15 Schon das Lesen des alten Stands zu Beginn ist ein Fehler ohne Folgen", async () => {
    const person = newPerson();
    await fillCollection(person.remote);
    const { source, backup } = await backupOf(person.remote);
    person.remote.online = false;

    await expect(
      restoreBackup({ remote: person.remote, source, backup, sleep }),
    ).rejects.toMatchObject({
      stage: "files",
      restored: true,
    });
  });

  it("F15 Fällt auch das Zurücknehmen aus, sagt der Fehler es und die neuen Dateien bleiben liegen", async () => {
    const person = newPerson();
    await fillCollection(person.remote);
    const { source, backup } = await backupOf(person.remote);
    await person.remote.remove("minifig", "minifig-cody");
    const real = person.remote.saveKeeping.bind(person.remote);
    let calls = 0;
    person.remote.saveKeeping = async (kind, object) => {
      calls++;
      if (calls === 3) throw new RemoteError("Der Server lehnt ab", true, "too_large");
      // From the third call on the server stays unreachable for good: the putting back fails too.
      if (calls > 3) throw new RemoteError("Der Server lehnt ab", true, "too_large");
      return real(kind, object);
    };
    const filesAfterUpload = person.store.fileCount();

    const failure = await restoreBackup({ remote: person.remote, source, backup, sleep }).catch(
      (error: unknown) => error,
    );

    expect(failure).toMatchObject({ stage: "objects", restored: false });
    // The new files were not removed: objects may still list them.
    expect(person.store.fileCount()).toBeGreaterThan(filesAfterUpload);
  });

  it("F15 Eine Verbindung, die kurz fehlt, wird abgewartet", async () => {
    const person = newPerson();
    await fillCollection(person.remote);
    const { source, backup } = await backupOf(person.remote);
    const real = person.remote.saveKeeping.bind(person.remote);
    let failed = false;
    person.remote.saveKeeping = async (kind, object) => {
      if (!failed) {
        failed = true;
        throw new RemoteError("Keine Verbindung");
      }
      return real(kind, object);
    };
    const pauses: number[] = [];

    await restoreBackup({
      remote: person.remote,
      source,
      backup,
      sleep: async (ms) => {
        pauses.push(ms);
      },
    });

    expect(pauses).toEqual([1000]);
  });

  it("F15 Ein Eintrag, der beim Ersetzen aus der Datei verschwunden ist, bricht vor jeder Änderung ab", async () => {
    const person = newPerson();
    await fillCollection(person.remote);
    const { backup } = await backupOf(person.remote);
    const stateBefore = await fingerprint(person.remote);

    const other = (await exportBytes(person.remote)).bytes.slice(0, 40);
    await expect(
      restoreBackup({ remote: person.remote, source: bytesSource(other), backup, sleep }),
    ).rejects.toMatchObject({ stage: "files", restored: true });
    expect(await fingerprint(person.remote)).toEqual(stateBefore);
  });
});

describe("Import mit Sicherung vorab", () => {
  it("F15 Erst wird der aktuelle Stand zum Herunterladen angeboten, dann ersetzt", async () => {
    const original = newPerson();
    await fillCollection(original.remote);
    const bytes = (await exportBytes(original.remote)).bytes;
    const source = bytesSource(bytes);
    const backup = await readBackup(source);
    const person = newPerson();
    await person.remote.save("minifig", aMinifig({ id: "heute", name: "Heute" }));
    const order: string[] = [];
    let delivered: { name: string; blob: Blob } | undefined;
    let whenDelivered: ReturnType<FakeRemote["load"]> | undefined;

    await importBackup({
      remote: person.remote,
      source,
      backup,
      now: NOW,
      sleep,
      deliver: (blob, name) => {
        order.push("geliefert");
        delivered = { name, blob };
        // The fake reads at once: this is the state at the moment of the delivery.
        whenDelivered = person.remote.load();
      },
      onProgress: ({ step }) => {
        if (order.at(-1) !== step) order.push(step);
      },
    });

    expect(delivered?.name).toBe("stud-stephan-sicherung-2026-11-02-vor-import.zip");
    expect(order).toEqual(["backup", "geliefert", "replace"]);
    expect((await whenDelivered)?.minifigs.map((m) => m.id)).toEqual(["heute"]);
    // The offered file is the state before: one figure, "Heute".
    const offered = await readBackup(blobSource(delivered?.blob as Blob));
    expect(offered.manifest.collection.minifigs.map((m) => m.name)).toEqual(["Heute"]);
    expect((await person.remote.load()).minifigs.map((m) => m.id)).toEqual([
      "minifig-cody",
      "minifig-rex",
    ]);
  });

  it("F15 Gelingt die Sicherung vorab nicht, bleibt der Stand unberührt und nichts wird geliefert", async () => {
    const original = newPerson();
    await fillCollection(original.remote);
    const source = bytesSource((await exportBytes(original.remote)).bytes);
    const backup = await readBackup(source);
    const person = newPerson();
    await fillCollection(person.remote);
    const stateBefore = await fingerprint(person.remote);
    person.remote.getFile = async () => {
      throw new RemoteError("Keine Verbindung");
    };
    let delivered = false;

    const code = await codeOf(
      importBackup({
        remote: person.remote,
        source,
        backup,
        now: NOW,
        sleep,
        deliver: () => {
          delivered = true;
        },
      }),
    );

    expect(code).toBe("fileTrouble");
    expect(delivered).toBe(false);
    person.remote.getFile = FakeRemote.prototype.getFile.bind(person.remote);
    expect(await fingerprint(person.remote)).toEqual(stateBefore);
  });

  it("F15 Die Sammlung der Sicherung ersetzt auch eine volle Sammlung ganz", async () => {
    const small = newPerson();
    await small.remote.save("minifig", aMinifig({ id: "einzig" }));
    const source = bytesSource((await exportBytes(small.remote)).bytes);
    const backup = await readBackup(source);
    const big = newPerson();
    await fillCollection(big.remote);

    await importBackup({ remote: big.remote, source, backup, now: NOW, sleep, deliver: () => {} });

    const after = await big.remote.load();
    expect(after).toEqual({
      ...aCollection({ minifigs: [expect.objectContaining({ id: "einzig" })] }),
      // Market data is not replaced, only added to (see `restoreBackup.ts`).
      prices: after.prices,
    });
    expect(big.store.fileCount()).toBe(0);
  });
});
