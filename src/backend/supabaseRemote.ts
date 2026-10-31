// `Remote` for Supabase: objects and price points through the database functions of
// `supabase/migrations/` (one call each, so an object and its photos are saved together), files
// through Supabase Storage in the person's folder `<user id>/…`. The client is a signed-in one; the
// database's row level security and the storage policies make sure it only reaches its own data.
//
// Errors: no connection, a timeout, an expired session (401), a server failure (5xx) or a function
// the server does not have yet can be tried again later (`RemoteError`). Everything else is the
// server refusing the call (`RemoteError` with `permanent`, `reason` from the database's message).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Collection, Id, PricePoint } from "../domain/types";
import { SCHEMA_VERSION } from "../domain/types";
import { isTemporaryStatus, type Remote, RemoteError, removeReleased } from "./remote";
import {
  type Bucket,
  isRefusalReason,
  isValidFileName,
  type ObjectKind,
  type ObjectOfKind,
  type RefusalReason,
  type StoredFile,
} from "./rules";

export interface SupabaseRemoteOptions {
  /** How long a database call may take before it counts as failed; default 20 s. */
  readonly timeoutMs?: number;
}

/** Whether a failed call may work later (HTTP status of the answer; 0 = no answer). */
export function isTemporary(status: number, code: string | undefined): boolean {
  return isTemporaryStatus(status) || (status === 404 && code === "PGRST202");
}

/** What Supabase Storage answers on failure, as far as it is read here. */
interface StorageFailure {
  readonly message: string;
  readonly status?: number | string;
  readonly statusCode?: number | string;
}

/** The reason for a refused file call, from Storage's message. */
export function storageReason(message: string): RefusalReason | undefined {
  if (/maximum allowed size|too large/i.test(message)) return "file_too_large";
  if (/mime type|not supported/i.test(message)) return "file_type";
  if (/not found/i.test(message)) return "not_found";
  if (/row-level security|unauthorized|invalid key/i.test(message)) return "invalid_path";
  return undefined;
}

export function storageError(action: string, error: StorageFailure): RemoteError {
  const status = Number(error.status ?? error.statusCode ?? 0);
  const reason = storageReason(error.message);
  return new RemoteError(
    `Dateispeicher (${action}): ${error.message} (${status})`,
    reason !== undefined || !isTemporaryStatus(status),
    reason,
  );
}

interface RpcAnswer {
  readonly data: unknown;
  readonly error: { readonly message: string; readonly code?: string } | null;
  readonly status: number;
}

const LISTS = ["minifigs", "sets", "specialParts", "dioramas", "wishlist", "prices"] as const;

export class SupabaseRemote implements Remote {
  private readonly timeoutMs: number;

  constructor(
    private readonly client: SupabaseClient,
    options: SupabaseRemoteOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? 20_000;
  }

  async load(): Promise<Collection> {
    const data = (await this.rpc("load_collection", {})) as Record<string, unknown> | null;
    if (data === null || LISTS.some((list) => !Array.isArray(data[list]))) {
      throw new RemoteError("Unlesbare Antwort des Servers auf das Laden.");
    }
    return {
      ...(data as unknown as Omit<Collection, "schemaVersion">),
      schemaVersion: SCHEMA_VERSION,
    };
  }

  async save<K extends ObjectKind>(kind: K, object: ObjectOfKind[K]): Promise<void> {
    const answer = await this.rpc("save_object", {
      p_kind: kind,
      p_object: object,
      p_schema_version: SCHEMA_VERSION,
    });
    await removeReleased(this, released(answer));
  }

  async remove(kind: ObjectKind, id: Id): Promise<void> {
    const answer = await this.rpc("delete_object", { p_kind: kind, p_id: id });
    await removeReleased(this, released(answer));
  }

  async savePrice(point: PricePoint): Promise<void> {
    await this.rpc("save_price_point", { p_point: point });
  }

  async putFile(
    bucket: Bucket,
    name: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<string> {
    if (!isValidFileName(name)) {
      throw new RemoteError(`Ungültiger Dateiname: ${name}`, true, "invalid_path");
    }
    const path = `${await this.userId()}/${name}`;
    const { error } = await this.client.storage
      .from(bucket)
      .upload(path, bytes, { contentType, upsert: true });
    if (error) throw storageError("hochladen", error as StorageFailure);
    return path;
  }

  async getFile(bucket: Bucket, path: string): Promise<Uint8Array> {
    const { data, error } = await this.client.storage.from(bucket).download(path);
    if (error) throw storageError("laden", error as StorageFailure);
    return new Uint8Array(await data.arrayBuffer());
  }

  async removeFile(bucket: Bucket, path: string): Promise<void> {
    const { error } = await this.client.storage.from(bucket).remove([path]);
    if (error) throw storageError("löschen", error as StorageFailure);
  }

  private async userId(): Promise<string> {
    const { data } = await this.client.auth.getSession();
    const id = data.session?.user.id;
    if (id === undefined) throw new RemoteError("Nicht angemeldet.", true, "not_signed_in");
    return id;
  }

  private async rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
    let answer: RpcAnswer;
    try {
      answer = await this.client.rpc(name, args).abortSignal(AbortSignal.timeout(this.timeoutMs));
    } catch (error) {
      throw new RemoteError(`Keine Verbindung zum Server: ${String(error)}`);
    }
    const { data, error, status } = answer;
    if (error !== null) {
      const permanent = !isTemporary(status, error.code);
      const reason = isRefusalReason(error.message) ? error.message : undefined;
      throw new RemoteError(`${name}: ${error.message} (${status})`, permanent, reason);
    }
    return data;
  }
}

function released(answer: unknown): StoredFile[] {
  const files = (answer as { releasedFiles?: unknown } | null)?.releasedFiles;
  return Array.isArray(files) ? (files as StoredFile[]) : [];
}
