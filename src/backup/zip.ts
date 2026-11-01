// A ZIP file without compression ("stored"), written piece by piece and read without unpacking.
// Photos (WebP, JPEG, PNG) and Studio files (`.io`, themselves ZIP) are compressed already, so
// compressing again saves nothing; stored entries also mean nothing can blow up when reading
// (no decompression), and the sizes are known from the directory at the end of the file.
// Not supported: compression, encryption, ZIP64 (the free storage is 1 GB, far below 4 GB).

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
const LOCAL_HEADER = 30;
const CENTRAL_HEADER = 46;
const END_RECORD = 22;
/** The comment after the end record may be this long (16 bits). */
const MAX_COMMENT = 0xffff;
/** Names are written and read as UTF-8 (general purpose bit 11). */
const UTF8_FLAG = 0x0800;
const ENCRYPTED_FLAG = 0x0001;
const MAX_ENTRIES = 0xfffe;
const MAX_OFFSET = 0xfffffffe;

export type ZipProblem = "notZip" | "unsupported" | "damaged" | "tooLarge";

/** The bytes are not a ZIP file this code can read, or one it cannot write. */
export class ZipError extends Error {
  constructor(
    readonly problem: ZipProblem,
    message: string,
  ) {
    super(message);
    this.name = "ZipError";
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 of the bytes (the checksum ZIP keeps for every entry); `previous` continues a sum. */
export function crc32(bytes: Uint8Array, previous = 0): number {
  let crc = ~previous >>> 0;
  for (let index = 0; index < bytes.length; index++) {
    crc = (CRC_TABLE[(crc ^ (bytes[index] as number)) & 0xff] as number) ^ (crc >>> 8);
  }
  return ~crc >>> 0;
}

/** DOS time and date of a moment (two seconds, 1980 to 2107), as ZIP keeps them. */
function dosDateTime(moment: Date): { time: number; date: number } {
  const year = Math.min(2107, Math.max(1980, moment.getUTCFullYear()));
  return {
    time:
      (moment.getUTCHours() << 11) | (moment.getUTCMinutes() << 5) | (moment.getUTCSeconds() >> 1),
    date: ((year - 1980) << 9) | ((moment.getUTCMonth() + 1) << 5) | moment.getUTCDate(),
  };
}

interface Written {
  readonly name: Uint8Array;
  readonly crc: number;
  readonly size: number;
  readonly offset: number;
}

/**
 * Writes entries one after the other to `sink` (which may keep or forward the pieces), then the
 * directory. Only one entry's bytes are held at a time by the writer itself.
 */
export class ZipWriter {
  private readonly written: Written[] = [];
  private offset = 0;
  private readonly stamp: { time: number; date: number };

  constructor(
    private readonly sink: (chunk: Uint8Array) => void | Promise<void>,
    moment: Date = new Date(),
  ) {
    this.stamp = dosDateTime(moment);
  }

  /** Adds a file. Names must be unique; the order is kept. */
  async add(name: string, bytes: Uint8Array): Promise<void> {
    const encoded = new TextEncoder().encode(name);
    if (encoded.length === 0 || encoded.length > 0xffff) {
      throw new ZipError("unsupported", "Der Name eines Eintrags ist leer oder zu lang.");
    }
    if (this.written.some((entry) => sameBytes(entry.name, encoded))) {
      throw new ZipError("unsupported", `Der Eintrag ${name} kommt doppelt vor.`);
    }
    if (this.written.length >= MAX_ENTRIES) {
      throw new ZipError("tooLarge", "Zu viele Einträge für eine ZIP-Datei.");
    }
    if (
      bytes.length > MAX_OFFSET ||
      this.offset + LOCAL_HEADER + encoded.length + bytes.length > MAX_OFFSET
    ) {
      throw new ZipError("tooLarge", "Die ZIP-Datei würde größer als 4 GB.");
    }
    const crc = crc32(bytes);
    const header = new Uint8Array(LOCAL_HEADER);
    const view = new DataView(header.buffer);
    view.setUint32(0, LOCAL_SIGNATURE, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, UTF8_FLAG, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, this.stamp.time, true);
    view.setUint16(12, this.stamp.date, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, bytes.length, true);
    view.setUint32(22, bytes.length, true);
    view.setUint16(26, encoded.length, true);
    view.setUint16(28, 0, true);
    this.written.push({ name: encoded, crc, size: bytes.length, offset: this.offset });
    await this.sink(header);
    await this.sink(encoded);
    await this.sink(bytes);
    this.offset += LOCAL_HEADER + encoded.length + bytes.length;
  }

  /** Writes the directory; the file is complete after this. */
  async finish(): Promise<void> {
    const directoryOffset = this.offset;
    let directorySize = 0;
    for (const entry of this.written) {
      const header = new Uint8Array(CENTRAL_HEADER);
      const view = new DataView(header.buffer);
      view.setUint32(0, CENTRAL_SIGNATURE, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint16(8, UTF8_FLAG, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, this.stamp.time, true);
      view.setUint16(14, this.stamp.date, true);
      view.setUint32(16, entry.crc, true);
      view.setUint32(20, entry.size, true);
      view.setUint32(24, entry.size, true);
      view.setUint16(28, entry.name.length, true);
      view.setUint32(42, entry.offset, true);
      await this.sink(header);
      await this.sink(entry.name);
      directorySize += CENTRAL_HEADER + entry.name.length;
    }
    const end = new Uint8Array(END_RECORD);
    const view = new DataView(end.buffer);
    view.setUint32(0, END_SIGNATURE, true);
    view.setUint16(8, this.written.length, true);
    view.setUint16(10, this.written.length, true);
    view.setUint32(12, directorySize, true);
    view.setUint32(16, directoryOffset, true);
    await this.sink(end);
  }
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** A file to read from in pieces: a `File` of the browser, or bytes in memory (tests). */
export interface ByteSource {
  readonly size: number;
  /** The bytes from `start` up to (not including) `end`. */
  read(start: number, end: number): Promise<Uint8Array>;
}

export function bytesSource(bytes: Uint8Array): ByteSource {
  return { size: bytes.length, read: async (start, end) => bytes.slice(start, end) };
}

export function blobSource(blob: Blob): ByteSource {
  return {
    size: blob.size,
    read: async (start, end) => new Uint8Array(await blob.slice(start, end).arrayBuffer()),
  };
}

export interface ZipEntry {
  readonly name: string;
  readonly size: number;
  readonly crc: number;
  /** Where the entry's local header starts. */
  readonly offset: number;
}

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** The entries listed in the directory at the end of the file (folders are left out). */
export async function readZipDirectory(source: ByteSource): Promise<ZipEntry[]> {
  if (source.size < END_RECORD) throw new ZipError("notZip", "Die Datei ist zu klein für ein ZIP.");
  const tailStart = Math.max(0, source.size - END_RECORD - MAX_COMMENT);
  const tail = await source.read(tailStart, source.size);
  let end = -1;
  for (let index = tail.length - END_RECORD; index >= 0; index--) {
    if (view(tail).getUint32(index, true) !== END_SIGNATURE) continue;
    // The comment length must lead exactly to the end of the file.
    if (index + END_RECORD + view(tail).getUint16(index + 20, true) === tail.length) {
      end = index;
      break;
    }
  }
  if (end < 0) throw new ZipError("notZip", "Das Ende der ZIP-Datei fehlt.");
  const record = view(tail);
  const count = record.getUint16(end + 10, true);
  const directorySize = record.getUint32(end + 12, true);
  const directoryOffset = record.getUint32(end + 16, true);
  if (
    record.getUint16(end + 4, true) !== 0 ||
    record.getUint16(end + 6, true) !== 0 ||
    record.getUint16(end + 8, true) !== count
  ) {
    throw new ZipError("unsupported", "Mehrteilige ZIP-Dateien werden nicht gelesen.");
  }
  if (count === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
    throw new ZipError("unsupported", "ZIP64 wird nicht gelesen.");
  }
  if (directoryOffset + directorySize > source.size) {
    throw new ZipError("damaged", "Das Inhaltsverzeichnis liegt außerhalb der Datei.");
  }
  const directory = await source.read(directoryOffset, directoryOffset + directorySize);
  const data = view(directory);
  const entries: ZipEntry[] = [];
  const names = new Set<string>();
  let position = 0;
  for (let n = 0; n < count; n++) {
    if (
      position + CENTRAL_HEADER > directory.length ||
      data.getUint32(position, true) !== CENTRAL_SIGNATURE
    ) {
      throw new ZipError("damaged", "Das Inhaltsverzeichnis ist beschädigt.");
    }
    const flags = data.getUint16(position + 8, true);
    const method = data.getUint16(position + 10, true);
    const crc = data.getUint32(position + 16, true);
    const packed = data.getUint32(position + 20, true);
    const size = data.getUint32(position + 24, true);
    const nameLength = data.getUint16(position + 28, true);
    const extraLength = data.getUint16(position + 30, true);
    const commentLength = data.getUint16(position + 32, true);
    const offset = data.getUint32(position + 42, true);
    const next = position + CENTRAL_HEADER + nameLength + extraLength + commentLength;
    if (next > directory.length) {
      throw new ZipError("damaged", "Das Inhaltsverzeichnis ist beschädigt.");
    }
    let name: string;
    try {
      name = new TextDecoder("utf-8", { fatal: true }).decode(
        directory.subarray(position + CENTRAL_HEADER, position + CENTRAL_HEADER + nameLength),
      );
    } catch {
      throw new ZipError("damaged", "Ein Name im ZIP ist kein gültiger Text.");
    }
    position = next;
    if (name.endsWith("/")) continue;
    if (flags & ENCRYPTED_FLAG)
      throw new ZipError("unsupported", "Verschlüsselte ZIPs werden nicht gelesen.");
    if (method !== 0 || packed !== size) {
      throw new ZipError("unsupported", "Gepackte ZIP-Einträge werden nicht gelesen.");
    }
    if (size === 0xffffffff || offset === 0xffffffff) {
      throw new ZipError("unsupported", "ZIP64 wird nicht gelesen.");
    }
    if (names.has(name)) throw new ZipError("damaged", `Der Eintrag ${name} kommt doppelt vor.`);
    names.add(name);
    entries.push({ name, size, crc, offset });
  }
  return entries;
}

/** The bytes of an entry; fails if they do not match the checksum or lie outside the file. */
export async function readZipEntry(source: ByteSource, entry: ZipEntry): Promise<Uint8Array> {
  if (entry.offset + LOCAL_HEADER > source.size) {
    throw new ZipError("damaged", `Der Eintrag ${entry.name} liegt außerhalb der Datei.`);
  }
  const header = await source.read(entry.offset, entry.offset + LOCAL_HEADER);
  const data = view(header);
  if (header.length < LOCAL_HEADER || data.getUint32(0, true) !== LOCAL_SIGNATURE) {
    throw new ZipError("damaged", `Der Kopf von ${entry.name} ist beschädigt.`);
  }
  const start = entry.offset + LOCAL_HEADER + data.getUint16(26, true) + data.getUint16(28, true);
  if (start + entry.size > source.size) {
    throw new ZipError("damaged", `Der Eintrag ${entry.name} ist abgeschnitten.`);
  }
  const bytes = entry.size === 0 ? new Uint8Array(0) : await source.read(start, start + entry.size);
  if (bytes.length !== entry.size || crc32(bytes) !== entry.crc) {
    throw new ZipError("damaged", `Die Prüfsumme von ${entry.name} stimmt nicht.`);
  }
  return bytes;
}
