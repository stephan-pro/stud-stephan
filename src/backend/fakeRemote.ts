// `Remote` on top of `FakeStore`, in memory, for one signed-in person: what unit tests talk to.
// The connection can be cut (`online = false`) to play through working without network.

import type { Collection, Id, PricePoint } from "../domain/types";
import { SCHEMA_VERSION } from "../domain/types";
import { type FakeStore, Refusal } from "./fakeStore";
import { type Remote, RemoteError, removeReleased } from "./remote";
import type { Bucket, ObjectKind, ObjectOfKind } from "./rules";

export class FakeRemote implements Remote {
  /** When false, every call fails with a temporary `RemoteError`, as without a connection. */
  online = true;

  constructor(
    readonly store: FakeStore,
    readonly owner: string,
  ) {}

  async load(): Promise<Collection> {
    return this.call(() => this.store.load(this.owner));
  }

  async save<K extends ObjectKind>(kind: K, object: ObjectOfKind[K]): Promise<void> {
    const released = this.call(() => this.store.save(this.owner, kind, object, SCHEMA_VERSION));
    await removeReleased(this, released);
  }

  async remove(kind: ObjectKind, id: Id): Promise<void> {
    const released = this.call(() => this.store.remove(this.owner, kind, id));
    await removeReleased(this, released);
  }

  async savePrice(point: PricePoint): Promise<void> {
    this.call(() => this.store.savePrice(this.owner, point));
  }

  async putFile(
    bucket: Bucket,
    name: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<string> {
    return this.call(() => this.store.putFile(this.owner, bucket, name, bytes, contentType));
  }

  async getFile(bucket: Bucket, path: string): Promise<Uint8Array> {
    return this.call(() => this.store.getFile(this.owner, bucket, path));
  }

  async removeFile(bucket: Bucket, path: string): Promise<void> {
    this.call(() => this.store.removeFile(this.owner, bucket, path));
  }

  /** No server to open it: the address names the file as `fake-signed:<secret>`. */
  async signedUrl(bucket: Bucket, path: string): Promise<string> {
    return `fake-signed:${this.call(() => this.store.signFile(this.owner, bucket, path))}`;
  }

  async storageUsage(): Promise<number> {
    return this.call(() => this.store.usage(this.owner));
  }

  private call<T>(action: () => T): T {
    if (!this.online) {
      throw new RemoteError("Keine Verbindung zum Server.");
    }
    try {
      return action();
    } catch (error) {
      if (error instanceof Refusal) {
        throw new RemoteError(`Der Server lehnt ab: ${error.reason}`, true, error.reason);
      }
      throw error;
    }
  }
}
