// Test helpers for the backup: people with a filled collection, files that pass as pictures,
// a backup taken apart and put together again with one thing changed, and a fingerprint of a
// person's data that does not depend on where their files lie.

import { FakeRemote } from "../backend/fakeRemote";
import { FakeStore } from "../backend/fakeStore";
import type { Remote } from "../backend/remote";
import {
  aCollection,
  aDiorama,
  aMinifig,
  aPrice,
  aSet,
  aSpecialPart,
  aWish,
} from "../domain/fixtures";
import type { Collection } from "../domain/types";
import { BlobSink } from "./blobSink";
import { type ExportResult, exportBackup } from "./exportBackup";
import { type BackupManifest, DATA_ENTRY } from "./format";
import { bytesSource, crc32, readZipDirectory, readZipEntry, ZipWriter } from "./zip";

export const NOW = new Date("2026-11-02T10:00:00Z");

export function newPerson(): { readonly store: FakeStore; readonly remote: FakeRemote } {
  const store = new FakeStore();
  return { store, remote: new FakeRemote(store, store.createUser()) };
}

/** Bytes that start like a WebP picture, followed by `length` bytes that depend on `seed`. */
export function imageBytes(seed: number, length = 300): Uint8Array {
  const bytes = new Uint8Array(12 + length);
  bytes.set(new TextEncoder().encode("RIFF"), 0);
  bytes.set(new TextEncoder().encode("WEBP"), 8);
  for (let index = 12; index < bytes.length; index++) bytes[index] = (seed * 31 + index) % 256;
  return bytes;
}

export const STUDIO_TYPE = "application/octet-stream";

/** A person with two figures, a set, a special part, a diorama with a Studio file, a wish and prices. */
export async function fillCollection(remote: Remote): Promise<Collection> {
  const put = (name: string, seed: number) =>
    remote.putFile("photos", name, imageBytes(seed), "image/webp");
  const rexOne = await put("rex-1.webp", 1);
  const rexTwo = await put("rex-2.webp", 2);
  const setPhoto = await put("set-1.webp", 3);
  const dioramaPhoto = await put("diorama-1.webp", 4);
  const studioBytes = new Uint8Array(2000).map((_, index) => (index * 7) % 256);
  const studioPath = await remote.putFile(
    "studio-files",
    "diorama/umbara.io",
    studioBytes,
    STUDIO_TYPE,
  );

  await remote.save("legoSet", aSet({ id: "set-75372", photos: [setPhoto] }));
  await remote.save(
    "diorama",
    aDiorama({
      id: "diorama-umbara",
      photos: [dioramaPhoto],
      studioFiles: [
        {
          id: "studio-a",
          fileName: "Umbara.io",
          sizeBytes: studioBytes.length,
          uploadedAt: "2026-10-30T09:00:00Z",
          path: studioPath,
        },
      ],
    }),
  );
  await remote.save(
    "minifig",
    aMinifig({
      id: "minifig-rex",
      photos: [rexOne, rexTwo],
      photoFocus: { [rexTwo]: { x: 30, y: 70 } },
      dioramaId: "diorama-umbara",
      fromSet: { label: "75372-1", setId: "set-75372" },
      mods: [{ id: "mod-1", position: "head", description: "Neuer Kopf", price: 450 }],
    }),
  );
  await remote.save(
    "minifig",
    aMinifig({ id: "minifig-cody", name: "Commander Cody", standsInSetId: "set-75372" }),
  );
  await remote.save("specialPart", aSpecialPart({ id: "part-coin" }));
  await remote.save("wishItem", aWish({ id: "wish-1" }));
  await remote.savePrice(aPrice("sw0194", "2026-10-26", { used: 3850, new: 5200 }));
  await remote.savePrice(aPrice("sw0194", "2026-11-02", { used: 3900 }));
  return remote.load();
}

export interface Exported {
  readonly bytes: Uint8Array;
  readonly result: ExportResult;
}

/** The backup of a person as one array of bytes. */
export async function exportBytes(remote: Remote, chunks?: Uint8Array[]): Promise<Exported> {
  const sink = new BlobSink();
  const result = await exportBackup({
    remote,
    now: NOW,
    sleep: async () => {},
    write: (chunk) => {
      chunks?.push(chunk);
      sink.write(chunk);
    },
  });
  return { bytes: new Uint8Array(await sink.toBlob().arrayBuffer()), result };
}

/** A ZIP of exactly these files. */
export async function zipBytes(files: [string, Uint8Array][]): Promise<Uint8Array> {
  const out: Uint8Array[] = [];
  const writer = new ZipWriter((chunk) => {
    out.push(chunk.slice());
  }, NOW);
  for (const [name, content] of files) await writer.add(name, content);
  await writer.finish();
  const joined = new Uint8Array(out.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of out) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  return joined;
}

export interface Parts {
  manifest: BackupManifest;
  /** Entry name → bytes, without `daten.json`. */
  files: Map<string, Uint8Array>;
}

/** Takes a backup apart, lets `change` alter the parts, and puts it together again. */
export async function rebuild(
  bytes: Uint8Array,
  change: (parts: Parts) => void,
): Promise<Uint8Array> {
  const source = bytesSource(bytes);
  const files = new Map<string, Uint8Array>();
  let manifest: BackupManifest | undefined;
  for (const entry of await readZipDirectory(source)) {
    const content = await readZipEntry(source, entry);
    if (entry.name === DATA_ENTRY) {
      manifest = JSON.parse(new TextDecoder().decode(content)) as BackupManifest;
    } else {
      files.set(entry.name, content);
    }
  }
  const parts = { manifest: manifest as BackupManifest, files };
  change(parts);
  return zipBytes([
    ...parts.files,
    [DATA_ENTRY, new TextEncoder().encode(JSON.stringify(parts.manifest))],
  ]);
}

/**
 * A person's data with every file path replaced by the checksum of the file's bytes and the
 * Studio files' ids blanked: equal fingerprints mean equal data and byte-identical files.
 */
export async function fingerprint(remote: Remote): Promise<unknown> {
  const collection = await remote.load();
  const sum = async (bucket: "photos" | "studio-files", path: string) =>
    crc32(await remote.getFile(bucket, path));
  // Photos and the points keyed by their paths, both by the checksum of the photo.
  const withPhotos = async <T extends { photos: string[]; photoFocus?: Record<string, unknown> }>(
    o: T,
  ) => ({
    ...o,
    photos: await Promise.all(o.photos.map((path) => sum("photos", path))),
    photoFocus: Object.fromEntries(
      await Promise.all(
        Object.entries(o.photoFocus ?? {}).map(async ([path, point]) => [
          String(await sum("photos", path)),
          point,
        ]),
      ),
    ),
  });
  return {
    ...collection,
    minifigs: await Promise.all(collection.minifigs.map(withPhotos)),
    sets: await Promise.all(collection.sets.map(withPhotos)),
    specialParts: await Promise.all(collection.specialParts.map(withPhotos)),
    dioramas: await Promise.all(
      collection.dioramas.map(async (o) => ({
        ...(await withPhotos(o)),
        studioFiles: await Promise.all(
          o.studioFiles.map(async (file) => ({
            ...file,
            id: "",
            path: String(await sum("studio-files", file.path)),
          })),
        ),
      })),
    ),
  };
}

export { aCollection };
