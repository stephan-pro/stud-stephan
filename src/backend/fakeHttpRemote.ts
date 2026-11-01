// `Remote` for the fake server of the end-to-end tests (`fakeServer.ts`): the same calls over
// HTTP. This is what the app will run on in the end-to-end tests, so a real browser can play
// through everything without Supabase.

import type { Collection, Id, PricePoint } from "../domain/types";
import { SCHEMA_VERSION } from "../domain/types";
import { isTemporaryStatus, type Remote, RemoteError, removeReleased } from "./remote";
import {
  type Bucket,
  isRefusalReason,
  isValidFileName,
  type ObjectKind,
  type ObjectOfKind,
  type StoredFile,
} from "./rules";

export interface FakeHttpRemoteOptions {
  /** e.g. "http://localhost:4180" */
  readonly baseUrl: string;
  /** The secret of the account (`POST /test/user` hands it out); a function reads it per call. */
  readonly token: string | (() => string);
  /** Default: the browser's `fetch`. */
  readonly fetch?: typeof fetch;
}

/** A path with every part URL-encoded, the slashes kept. */
function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export function createFakeHttpRemote(options: FakeHttpRemoteOptions): Remote {
  const { baseUrl } = options;
  const token = () => (typeof options.token === "string" ? options.token : options.token());
  const send = options.fetch ?? ((input, init) => fetch(input, init));

  async function request(path: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await send(`${baseUrl}${path}`, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${token()}` },
      });
    } catch (error) {
      throw new RemoteError(`Keine Verbindung zum Server: ${String(error)}`);
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { reason?: unknown };
      const reason = isRefusalReason(body.reason) ? body.reason : undefined;
      throw new RemoteError(
        `Der Server antwortet mit ${response.status}.`,
        !isTemporaryStatus(response.status),
        reason,
      );
    }
    return response;
  }

  async function call<T>(path: string, init: RequestInit): Promise<T> {
    const response = await request(path, init);
    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new RemoteError(`Unlesbare Antwort des Servers: ${String(error)}`);
    }
  }

  const sendJson = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const remote: Remote = {
    load: () => call<Collection>("/collection", { method: "GET" }),

    async save<K extends ObjectKind>(kind: K, object: ObjectOfKind[K]) {
      const { releasedFiles } = await call<{ releasedFiles: StoredFile[] }>(
        `/objects/${kind}?schemaVersion=${SCHEMA_VERSION}`,
        sendJson("POST", object),
      );
      await removeReleased(remote, releasedFiles);
    },

    async remove(kind: ObjectKind, id: Id) {
      const { releasedFiles } = await call<{ releasedFiles: StoredFile[] }>(
        `/objects/${kind}/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      await removeReleased(remote, releasedFiles);
    },

    async savePrice(point: PricePoint) {
      await call("/prices", sendJson("POST", point));
    },

    async putFile(bucket: Bucket, name: string, bytes: Uint8Array, contentType: string) {
      // Checked here as well: the address would swallow a "../" before the server sees it.
      if (!isValidFileName(name)) {
        throw new RemoteError(`Ungültiger Dateiname: ${name}`, true, "invalid_path");
      }
      const { path } = await call<{ path: string }>(`/files/${bucket}/${encodePath(name)}`, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: contentType }),
      });
      return path;
    },

    async getFile(bucket: Bucket, path: string) {
      const response = await request(`/files/${bucket}/${encodePath(path)}`, { method: "GET" });
      return new Uint8Array(await response.arrayBuffer());
    },

    async removeFile(bucket: Bucket, path: string) {
      await call(`/files/${bucket}/${encodePath(path)}`, { method: "DELETE" });
    },

    async signedUrl(bucket: Bucket, path: string) {
      const { token: secret } = await call<{ token: string }>(
        `/sign/${bucket}/${encodePath(path)}`,
        { method: "POST" },
      );
      return `${baseUrl}/signed/${encodeURIComponent(secret)}`;
    },

    async storageUsage() {
      return (await call<{ usedBytes: number }>("/usage", { method: "GET" })).usedBytes;
    },
  };
  return remote;
}
