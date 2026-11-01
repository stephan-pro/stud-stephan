import { describe, expect, it } from "vitest";
import {
  blobSource,
  bytesSource,
  crc32,
  readZipDirectory,
  readZipEntry,
  type ZipEntry,
  ZipError,
  ZipWriter,
} from "./zip";

async function zipOf(files: [string, Uint8Array][]): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  const writer = new ZipWriter((chunk) => {
    parts.push(chunk);
  }, new Date("2026-11-02T10:00:00Z"));
  for (const [name, bytes] of files) await writer.add(name, bytes);
  await writer.finish();
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const text = (value: string) => new TextEncoder().encode(value);

describe("ZIP ohne Kompression", () => {
  it("Die Prüfsumme stimmt mit dem bekannten Wert überein", () => {
    expect(crc32(text("123456789"))).toBe(0xcbf43926);
    expect(crc32(text("6789"), crc32(text("12345")))).toBe(0xcbf43926);
  });

  it("Geschriebene Dateien kommen byte-gleich und in derselben Reihenfolge zurück", async () => {
    const big = new Uint8Array(70_000).map((_, index) => (index * 13) % 256);
    const bytes = await zipOf([
      ["fotos/000001.webp", big],
      ["leer.txt", new Uint8Array(0)],
      ["Größe ä.txt", text("Umlaute")],
    ]);
    const source = bytesSource(bytes);

    const entries = await readZipDirectory(source);

    expect(entries.map((entry) => entry.name)).toEqual([
      "fotos/000001.webp",
      "leer.txt",
      "Größe ä.txt",
    ]);
    expect(await readZipEntry(source, entries[0] as never)).toEqual(big);
    expect(await readZipEntry(source, entries[1] as never)).toEqual(new Uint8Array(0));
    expect(new TextDecoder().decode(await readZipEntry(source, entries[2] as never))).toBe(
      "Umlaute",
    );
  });

  it("Eine Datei kann auch als Blob in Stücken gelesen werden", async () => {
    const bytes = await zipOf([["a.txt", text("hallo")]]);
    const source = blobSource(new Blob([bytes as BlobPart]));

    const [entry] = await readZipDirectory(source);

    expect(new TextDecoder().decode(await readZipEntry(source, entry as never))).toBe("hallo");
  });

  it("Ein Kommentar am Ende der Datei stört nicht", async () => {
    const bytes = await zipOf([["a.txt", text("hallo")]]);
    const withComment = new Uint8Array(bytes.length + 3);
    withComment.set(bytes);
    withComment.set(text("abc"), bytes.length);
    new DataView(withComment.buffer).setUint16(bytes.length - 22 + 20, 3, true);

    const entries = await readZipDirectory(bytesSource(withComment));

    expect(entries.map((entry) => entry.name)).toEqual(["a.txt"]);
  });

  it("Ordner im Verzeichnis werden übergangen", async () => {
    const bytes = await zipOf([
      ["ordner/", new Uint8Array(0)],
      ["ordner/a.txt", text("x")],
    ]);

    const entries = await readZipDirectory(bytesSource(bytes));

    expect(entries.map((entry) => entry.name)).toEqual(["ordner/a.txt"]);
  });

  it("Zwei Einträge gleichen Namens und leere Namen werden nicht geschrieben", async () => {
    await expect(
      zipOf([
        ["a", text("1")],
        ["a", text("2")],
      ]),
    ).rejects.toMatchObject({
      problem: "unsupported",
    });
    await expect(zipOf([["", text("1")]])).rejects.toMatchObject({ problem: "unsupported" });
  });

  it("Kein ZIP: zu kurz, ohne Ende, Text", async () => {
    for (const bytes of [new Uint8Array(5), text("Das ist keine ZIP-Datei, nur Text.........")]) {
      await expect(readZipDirectory(bytesSource(bytes))).rejects.toMatchObject({
        problem: "notZip",
      });
    }
  });

  it("Eine abgeschnittene Datei wird erkannt", async () => {
    const bytes = await zipOf([["a.txt", text("hallo")]]);

    await expect(
      readZipDirectory(bytesSource(bytes.slice(0, bytes.length - 10))),
    ).rejects.toBeInstanceOf(ZipError);
  });

  it("Ein veränderter Byte im Inhalt fällt bei der Prüfsumme auf", async () => {
    const bytes = await zipOf([["a.txt", text("hallo welt")]]);
    const source = bytesSource(bytes);
    const [entry] = await readZipDirectory(source);
    bytes[30 + 5 + 2] = (bytes[30 + 5 + 2] as number) ^ 0xff;

    await expect(readZipEntry(source, entry as never)).rejects.toMatchObject({
      problem: "damaged",
    });
  });

  it("Gepackte, verschlüsselte und ZIP64-Einträge werden abgelehnt", async () => {
    const make = () => zipOf([["a.txt", text("hallo")]]);
    const directoryAt = (bytes: Uint8Array) =>
      new DataView(bytes.buffer).getUint32(bytes.length - 6, true);

    const packed = await make();
    new DataView(packed.buffer).setUint16(directoryAt(packed) + 10, 8, true);
    const encrypted = await make();
    new DataView(encrypted.buffer).setUint16(directoryAt(encrypted) + 8, 1, true);
    const zip64 = await make();
    new DataView(zip64.buffer).setUint32(directoryAt(zip64) + 42, 0xffffffff, true);
    const split = await make();
    new DataView(split.buffer).setUint16(split.length - 22 + 4, 1, true);

    for (const bytes of [packed, encrypted, zip64, split]) {
      await expect(readZipDirectory(bytesSource(bytes))).rejects.toMatchObject({
        problem: "unsupported",
      });
    }
  });

  it("Ein Verzeichnis außerhalb der Datei und ein kaputter Kopf werden erkannt", async () => {
    const outside = await zipOf([["a.txt", text("hallo")]]);
    new DataView(outside.buffer).setUint32(outside.length - 22 + 16, 9999, true);
    const broken = await zipOf([["a.txt", text("hallo")]]);
    const directory = new DataView(broken.buffer).getUint32(broken.length - 22 + 16, true);
    new DataView(broken.buffer).setUint32(directory, 0, true);

    await expect(readZipDirectory(bytesSource(outside))).rejects.toMatchObject({
      problem: "damaged",
    });
    await expect(readZipDirectory(bytesSource(broken))).rejects.toMatchObject({
      problem: "damaged",
    });
  });

  it("Ein Eintrag, dessen Kopf oder Inhalt fehlt, wird erkannt", async () => {
    const bytes = await zipOf([["a.txt", text("hallo")]]);
    const source = bytesSource(bytes);
    const [entry] = await readZipDirectory(source);

    const real = entry as ZipEntry;
    await expect(readZipEntry(source, { ...real, offset: bytes.length })).rejects.toMatchObject({
      problem: "damaged",
    });
    await expect(readZipEntry(source, { ...real, offset: 5 })).rejects.toMatchObject({
      problem: "damaged",
    });
    await expect(readZipEntry(source, { ...real, size: 9999 })).rejects.toMatchObject({
      problem: "damaged",
    });
  });
});
