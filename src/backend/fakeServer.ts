// The fake server of the end-to-end tests, without the network part (`fakeHttpServer.ts` puts HTTP
// in front of it): requests in, answers out, on top of `FakeStore`. A test makes an account with
// `POST /test/user` and hands the returned secret to the app (`Authorization: Bearer <token>`).
//
//   GET    /health                    ready check
//   POST   /test/user                 → {token, owner} a new account
//   GET    /collection                the whole collection (`Remote.load`)
//   POST   /objects/<kind>?schemaVersion=  one object as JSON → {releasedFiles}
//   DELETE /objects/<kind>/<id>       → {releasedFiles}
//   POST   /prices                    one price point as JSON
//   PUT    /files/<bucket>/<name>     the bytes, with Content-Type → {path}
//   GET    /files/<bucket>/<path>     the bytes
//   DELETE /files/<bucket>/<path>
//
// Refusals answer `{reason}` with 400 (404 for `not_found`, 413 too large, 415 wrong type); a
// missing or unknown secret answers 401, like an expired session.

import { FakeStore, Refusal } from "./fakeStore";
import type { RefusalReason } from "./rules";

export interface FakeRequest {
  readonly method: string;
  /** Still URL-encoded, e.g. "/files/photos/abc/minifig-1.webp". */
  readonly path: string;
  readonly query: Readonly<Record<string, string>>;
  readonly token?: string | undefined;
  readonly contentType?: string | undefined;
  readonly body: Uint8Array;
}

export type FakeAnswer =
  | { readonly status: number; readonly json: unknown }
  | { readonly status: number; readonly bytes: Uint8Array; readonly contentType: string };

const STATUS: Partial<Record<RefusalReason, number>> = {
  not_found: 404,
  file_too_large: 413,
  file_type: 415,
};

function json(status: number, body: unknown): FakeAnswer {
  return { status, json: body };
}

function readJson(body: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new Refusal("invalid_object");
  }
}

export class FakeServer {
  readonly store = new FakeStore();
  private readonly owners = new Map<string, string>();

  handle(request: FakeRequest): FakeAnswer {
    let segments: string[];
    try {
      segments = request.path.split("/").filter(Boolean).map(decodeURIComponent);
    } catch {
      return json(400, { reason: "invalid_path" });
    }
    const [area, first, ...rest] = segments;
    const { method } = request;

    if (method === "GET" && area === "health") return json(200, "ok");
    if (method === "POST" && area === "test" && first === "user") {
      const owner = this.store.createUser();
      const token = crypto.randomUUID();
      this.owners.set(token, owner);
      return json(200, { token, owner });
    }

    const owner = request.token === undefined ? undefined : this.owners.get(request.token);
    if (owner === undefined) return json(401, { reason: "not_signed_in" });

    try {
      if (method === "GET" && area === "collection" && first === undefined) {
        return json(200, this.store.load(owner));
      }
      if (area === "objects" && first !== undefined) {
        if (method === "POST" && rest.length === 0) {
          const schemaVersion = Number(request.query.schemaVersion);
          const released = this.store.save(owner, first, readJson(request.body), schemaVersion);
          return json(200, { releasedFiles: released });
        }
        if (method === "DELETE" && rest.length === 1) {
          return json(200, { releasedFiles: this.store.remove(owner, first, rest[0]) });
        }
      }
      if (method === "POST" && area === "prices" && first === undefined) {
        this.store.savePrice(owner, readJson(request.body));
        return json(200, {});
      }
      if (area === "files" && first !== undefined && rest.length > 0) {
        const name = rest.join("/");
        if (method === "PUT") {
          const contentType = request.contentType ?? "";
          return json(200, {
            path: this.store.putFile(owner, first, name, request.body, contentType),
          });
        }
        if (method === "GET") {
          const stored = this.store.getFile(owner, first, name);
          return { status: 200, bytes: stored, contentType: "application/octet-stream" };
        }
        if (method === "DELETE") {
          this.store.removeFile(owner, first, name);
          return json(200, {});
        }
      }
    } catch (error) {
      if (error instanceof Refusal) {
        return json(STATUS[error.reason] ?? 400, { reason: error.reason });
      }
      throw error;
    }
    return json(404, { reason: "not_found" });
  }
}
