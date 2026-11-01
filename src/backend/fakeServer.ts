// The fake server of the end-to-end tests, without the network part (`fakeHttpServer.ts` puts HTTP
// in front of it): requests in, answers out, on top of `FakeStore` and the sign-in service
// `FakeAuth`. The app signs in with a code (`FakeHttpAuth`) and sends the secret it got with every
// call (`Authorization: Bearer <token>`); a test may skip the sign-in page with `POST /test/user`.
//
//   GET    /health                    ready check
//   POST   /auth/code     {email}     a code "by mail" (read with /test/code); an address without
//                                     an account gets none, with the same answer
//   POST   /auth/verify   {email, code}  → {token, session}
//   GET    /auth/session              the session of the secret, 401 if it ended
//   POST   /auth/sign-out             ends the session of the secret
//   GET    /test/code?email=          → {code}, the last code sent to the address (404: none)
//   POST   /test/user     {email?}    → {token, owner, email} an account made by hand, signed in
//   GET    /collection                the whole collection (`Remote.load`)
//   POST   /objects/<kind>?schemaVersion=  one object as JSON → {releasedFiles}
//   DELETE /objects/<kind>/<id>       → {releasedFiles}
//   POST   /prices                    one price point as JSON
//   PUT    /files/<bucket>/<name>     the bytes, with Content-Type → {path}
//   GET    /files/<bucket>/<path>     the bytes
//   DELETE /files/<bucket>/<path>
//   POST   /sign/<bucket>/<path>      → {token}; the file is then open without a secret at
//   GET    /signed/<token>            the bytes (what an `<img>` or a download link needs)
//   GET    /usage                     → {usedBytes} of all the person's files
//
// Refusals answer `{reason}` with 400 (404 for `not_found`, 413 too large, 415 wrong type); a
// missing or unknown secret answers 401, like an expired session. Refused sign-in steps answer
// `{failure}` (an `AuthFailure`) with 400, too many tries with 429.

import { AuthError } from "../auth/auth";
import { FakeAuth, type FakeAuthOptions } from "../auth/fakeAuth";
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

export interface FakeServerOptions {
  /** Clock and codes of the sign-in service (unit tests). */
  readonly auth?: FakeAuthOptions;
}

/** The fields of a sign-in request; a missing one is an empty text. */
function authFields(body: Uint8Array): { email: string; code: string } {
  const fields = (body.length === 0 ? {} : readJson(body)) as Record<string, unknown> | null;
  const text = (name: string) => (typeof fields?.[name] === "string" ? fields[name] : "");
  return { email: text("email"), code: text("code") };
}

export class FakeServer {
  readonly store = new FakeStore();
  readonly auth: FakeAuth;

  constructor(options: FakeServerOptions = {}) {
    // Every account owns a collection of its own in the store.
    this.auth = new FakeAuth({ newUserId: () => this.store.createUser(), ...options.auth });
  }

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
    if (area === "auth" || area === "test") {
      const answer = this.handleAuth(request, `${area}/${first ?? ""}`);
      if (answer !== undefined) return answer;
    }

    if (method === "GET" && area === "signed" && first !== undefined && rest.length === 0) {
      // The secret in the address is the permission, like a real signed address.
      try {
        return { status: 200, bytes: this.store.signedFile(first), contentType: "image/webp" };
      } catch (error) {
        if (error instanceof Refusal) return json(404, { reason: error.reason });
        throw error;
      }
    }

    const owner = this.auth.sessionFor(request.token)?.userId;
    if (owner === undefined) return json(401, { reason: "not_signed_in" });

    try {
      if (method === "GET" && area === "usage" && first === undefined) {
        return json(200, { usedBytes: this.store.usage(owner) });
      }
      if (method === "POST" && area === "sign" && first !== undefined && rest.length > 0) {
        return json(200, { token: this.store.signFile(owner, first, rest.join("/")) });
      }
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

  /** The sign-in and the tests' shortcuts; `undefined` for any other address. */
  private handleAuth(request: FakeRequest, route: string): FakeAnswer | undefined {
    const { method, token } = request;
    try {
      if (method === "POST" && route === "auth/code") {
        this.auth.requestCode(authFields(request.body).email);
        return json(200, {});
      }
      if (method === "POST" && route === "auth/verify") {
        const { email, code } = authFields(request.body);
        return json(200, this.auth.verifyCode(email, code));
      }
      if (method === "GET" && route === "auth/session") {
        const session = this.auth.sessionFor(token);
        return session === undefined ? json(401, { failure: "unknown" }) : json(200, session);
      }
      if (method === "POST" && route === "auth/sign-out") {
        this.auth.signOut(token);
        return json(200, {});
      }
      if (method === "GET" && route === "test/code") {
        const code = this.auth.lastCode(request.query.email ?? "");
        return code === undefined ? json(404, { reason: "not_found" }) : json(200, { code });
      }
      if (method === "POST" && route === "test/user") {
        const email = authFields(request.body).email || `test-${crypto.randomUUID()}@beispiel.de`;
        const { token: secret, session } = this.auth.signInDirectly(email);
        return json(200, { token: secret, owner: session.userId, email: session.email });
      }
    } catch (error) {
      if (error instanceof AuthError) {
        return json(error.failure === "tooManyTries" ? 429 : 400, { failure: error.failure });
      }
      if (error instanceof Refusal) return json(400, { reason: error.reason });
      throw error;
    }
    return undefined;
  }
}
