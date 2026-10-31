// The fake of the database and the storage: in memory, for the unit tests and the fake server of
// the end-to-end tests. It follows the rules of the database (`supabase/migrations/`): every row
// and every file belongs to one owner, nobody else reads or changes it; objects are checked as
// `rules.ts` says; photos and Studio files are kept apart and joined back on loading.

import type { Collection, Id, PricePoint, StudioFile } from "../domain/types";
import { SCHEMA_VERSION } from "../domain/types";
import {
  type Bucket,
  checkObject,
  checkPricePoint,
  FILE_TYPES,
  isOwnPath,
  isValidFileName,
  MAX_FILE_BYTES,
  OBJECT_KINDS,
  type ObjectKind,
  type RefusalReason,
  type StoredFile,
} from "./rules";

/** The server refused the call for good; `reason` as the database says it. */
export class Refusal extends Error {
  constructor(readonly reason: RefusalReason) {
    super(reason);
    this.name = "Refusal";
  }
}

type Json = Record<string, unknown>;

interface PhotoRow {
  kind: ObjectKind;
  itemId: Id;
  position: number;
}

interface StudioFileRow {
  dioramaId: Id;
  file: StudioFile;
  position: number;
}

interface OwnerData {
  readonly objects: Record<ObjectKind, Map<Id, Json>>;
  /** By path. */
  readonly photos: Map<string, PhotoRow>;
  /** By id. */
  readonly studioFiles: Map<Id, StudioFileRow>;
  /** By item type, BrickLink number and day. */
  readonly prices: Map<string, PricePoint>;
}

interface StoredBytes {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

/** A deep copy, as the data would come back over the network. */
function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Byte order of the ids, like the database's `collate "C"` for the usual characters. */
function byText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export class FakeStore {
  private readonly owners = new Map<string, OwnerData>();
  private readonly files = new Map<string, StoredBytes>();

  /** A new account; answers its id (a uuid, like `auth.uid()`). */
  createUser(): string {
    const owner = crypto.randomUUID();
    this.owners.set(owner, {
      objects: {
        minifig: new Map(),
        legoSet: new Map(),
        specialPart: new Map(),
        diorama: new Map(),
        wishItem: new Map(),
      },
      photos: new Map(),
      studioFiles: new Map(),
      prices: new Map(),
    });
    return owner;
  }

  load(owner: string): Collection {
    const data = this.data(owner);
    const photosOf = (kind: ObjectKind, id: Id) =>
      [...data.photos]
        .filter(([, row]) => row.kind === kind && row.itemId === id)
        .sort(([, a], [, b]) => a.position - b.position)
        .map(([path]) => path);
    const list = (kind: ObjectKind) =>
      [...data.objects[kind].values()].sort((a, b) => byText(a.id as string, b.id as string));
    const withPhotos = (kind: ObjectKind) =>
      list(kind).map(
        (object): Json => ({ ...object, photos: photosOf(kind, object.id as string) }),
      );
    const dioramas = withPhotos("diorama").map((diorama) => ({
      ...diorama,
      studioFiles: [...data.studioFiles.values()]
        .filter((row) => row.dioramaId === diorama.id)
        .sort((a, b) => a.position - b.position)
        .map((row) => row.file),
    }));
    const prices = [...data.prices.values()].sort(
      (a, b) =>
        byText(a.itemType, b.itemType) ||
        byText(a.bricklinkId, b.bricklinkId) ||
        byText(a.date, b.date),
    );
    return copy({
      schemaVersion: SCHEMA_VERSION,
      minifigs: withPhotos("minifig"),
      sets: withPhotos("legoSet"),
      specialParts: withPhotos("specialPart"),
      dioramas,
      wishlist: list("wishItem"),
      prices,
    }) as unknown as Collection;
  }

  /** Saves an object; answers the files it no longer lists (the client removes them). */
  save(owner: string, kind: string, object: unknown, schemaVersion: unknown): StoredFile[] {
    const data = this.data(owner);
    const checked = checkObject(owner, kind, object, schemaVersion);
    if (typeof checked === "string") throw new Refusal(checked);
    const objectKind = kind as ObjectKind;
    data.objects[objectKind].set(checked.id, copy(checked.data));
    const released: StoredFile[] = [];

    if (objectKind !== "wishItem") {
      for (const [path, row] of data.photos) {
        if (
          row.kind === objectKind &&
          row.itemId === checked.id &&
          !checked.photos.includes(path)
        ) {
          data.photos.delete(path);
          released.push({ bucket: "photos", path });
        }
      }
      checked.photos.forEach((path, position) => {
        data.photos.set(path, { kind: objectKind, itemId: checked.id, position });
      });
    }

    if (objectKind === "diorama") {
      for (const [id, row] of data.studioFiles) {
        const kept = checked.studioFiles.some(
          (file) => file.id === id && file.path === row.file.path,
        );
        if (row.dioramaId === checked.id && !kept) {
          data.studioFiles.delete(id);
          released.push({ bucket: "studio-files", path: row.file.path });
        }
      }
      checked.studioFiles.forEach((file, position) => {
        const { id, fileName, sizeBytes, uploadedAt, path } = file;
        data.studioFiles.set(id, {
          dioramaId: checked.id,
          file: { id, fileName, sizeBytes, uploadedAt, path },
          position,
        });
      });
    }
    return released;
  }

  /** Deletes an object; answers its files (the client removes them). */
  remove(owner: string, kind: string, id: unknown): StoredFile[] {
    const data = this.data(owner);
    if (!OBJECT_KINDS.includes(kind as ObjectKind) || typeof id !== "string") {
      throw new Refusal("invalid_object");
    }
    const objectKind = kind as ObjectKind;
    const released: StoredFile[] = [];
    if (objectKind !== "wishItem") {
      for (const [path, row] of data.photos) {
        if (row.kind === objectKind && row.itemId === id) {
          data.photos.delete(path);
          released.push({ bucket: "photos", path });
        }
      }
    }
    if (objectKind === "diorama") {
      for (const [fileId, row] of data.studioFiles) {
        if (row.dioramaId === id) {
          data.studioFiles.delete(fileId);
          released.push({ bucket: "studio-files", path: row.file.path });
        }
      }
      for (const minifig of data.objects.minifig.values()) {
        if (minifig.dioramaId === id) delete minifig.dioramaId;
      }
    }
    if (objectKind === "legoSet") {
      for (const minifig of data.objects.minifig.values()) {
        const fromSet = minifig.fromSet as Json | undefined;
        if (fromSet?.setId === id) {
          delete fromSet.setId;
          if (Object.keys(fromSet).length === 0) delete minifig.fromSet;
        }
      }
    }
    data.objects[objectKind].delete(id);
    return released;
  }

  savePrice(owner: string, point: unknown): void {
    const data = this.data(owner);
    const checked = checkPricePoint(point);
    if (typeof checked === "string") throw new Refusal(checked);
    data.prices.set(`${checked.itemType}|${checked.bricklinkId}|${checked.date}`, copy(checked));
  }

  /** Stores a file under `<owner>/<name>` (replacing one there) and answers the path. */
  putFile(
    owner: string,
    bucket: string,
    name: string,
    bytes: Uint8Array,
    contentType: string,
  ): string {
    this.data(owner);
    const target = this.bucket(bucket);
    if (!isValidFileName(name)) throw new Refusal("invalid_path");
    if (bytes.length > MAX_FILE_BYTES[target]) throw new Refusal("file_too_large");
    if (!FILE_TYPES[target].includes(contentType)) throw new Refusal("file_type");
    const path = `${owner}/${name}`;
    this.files.set(`${target}|${path}`, { bytes: bytes.slice(), contentType });
    return path;
  }

  getFile(owner: string, bucket: string, path: string): Uint8Array {
    this.data(owner);
    const stored = this.files.get(`${this.bucket(bucket)}|${path}`);
    if (stored === undefined || !isOwnPath(owner, path)) throw new Refusal("not_found");
    return stored.bytes.slice();
  }

  removeFile(owner: string, bucket: string, path: string): void {
    this.data(owner);
    if (isOwnPath(owner, path)) this.files.delete(`${this.bucket(bucket)}|${path}`);
  }

  /** Whether a file exists at all, whoever it belongs to (for tests). */
  hasFile(bucket: Bucket, path: string): boolean {
    return this.files.has(`${bucket}|${path}`);
  }

  private data(owner: string): OwnerData {
    const data = this.owners.get(owner);
    if (data === undefined) throw new Refusal("not_signed_in");
    return data;
  }

  private bucket(bucket: string): Bucket {
    if (bucket !== "photos" && bucket !== "studio-files") throw new Refusal("not_found");
    return bucket;
  }
}
