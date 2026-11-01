// The HTTP side of the two functions: sign-in check, reading the request, mapping failures to
// answers. The functions' `index.ts` only connects this to `Deno.serve` and the environment.

import type { BricklinkClient } from "./bricklinkClient.ts";
import type { Brickognize } from "./brickognizeClient.ts";
import { type CatalogDeps, loadItem, searchCatalog } from "./catalogService.ts";
import {
  type CatalogAnswer,
  type CatalogFailure,
  type CatalogKind,
  type CatalogRequest,
  MAX_QUERY_LENGTH,
} from "./catalogTypes.ts";
import { CatalogError, type Fetch, isRecord, str } from "./json.ts";
import { type LinkAnswer, LinkError, MAX_LINK_LENGTH } from "./linkTypes.ts";
import { MAX_PHOTO_BYTES, type RecognizeAnswer } from "./recognizeTypes.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STATUS: Readonly<Record<CatalogFailure, number>> = {
  bad_request: 400,
  not_signed_in: 401,
  not_found: 404,
  limit_reached: 429,
  unavailable: 502,
};

function answer(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: CORS });
}

function failure(reason: CatalogFailure): Response {
  return answer(STATUS[reason], { failure: reason });
}

/** Whether the request comes from a signed-in person: the project's auth service knows the token. */
export async function isSignedIn(request: Request, authUrl: string, send: Fetch): Promise<boolean> {
  const token = request.headers.get("Authorization");
  const apikey = request.headers.get("apikey");
  if (!token || !apikey) return false;
  try {
    const response = await send(`${authUrl}/auth/v1/user`, {
      headers: { Authorization: token, apikey },
    });
    return response.ok;
  } catch {
    return false;
  }
}

function isKind(value: unknown): value is CatalogKind {
  return value === "minifig" || value === "legoSet";
}

/** The request of the app, or nothing if it is not one. */
export function parseCatalogRequest(body: unknown): CatalogRequest | undefined {
  if (!isRecord(body) || !isKind(body.kind)) return undefined;
  if (body.op === "search") {
    const query = str(body.query)?.trim();
    if (query === undefined || query === "" || query.length > MAX_QUERY_LENGTH) return undefined;
    return { op: "search", kind: body.kind, query };
  }
  if (body.op === "item") {
    const ref = str(body.ref);
    if (ref === undefined || !/^[A-Za-z0-9._-]{1,50}$/.test(ref)) return undefined;
    return { op: "item", kind: body.kind, ref };
  }
  return undefined;
}

export interface HandlerDeps {
  readonly signedIn: (request: Request) => Promise<boolean>;
  /** The services; nothing if the secrets are not set. */
  readonly services: () => CatalogDeps | undefined;
}

async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/** Shared frame: method, sign-in, body, and the failures of the services. */
async function serve(
  request: Request,
  deps: Pick<HandlerDeps, "signedIn">,
  run: (body: unknown) => Promise<Response>,
  read: (request: Request) => Promise<unknown> = readBody,
): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return failure("bad_request");
  if (!(await deps.signedIn(request))) return failure("not_signed_in");
  try {
    return await run(await read(request));
  } catch (error) {
    if (error instanceof CatalogError) return failure(error.failure);
    return failure("unavailable");
  }
}

/** The function `catalog`: `{op: "search", kind, query}` and `{op: "item", kind, ref}`. */
export function handleCatalog(request: Request, deps: HandlerDeps): Promise<Response> {
  return serve(request, deps, async (body) => {
    const parsed = parseCatalogRequest(body);
    if (!parsed) return failure("bad_request");
    const services = deps.services();
    if (!services) return failure("unavailable");
    const result: CatalogAnswer =
      parsed.op === "search"
        ? { op: "search", hits: await searchCatalog(services, parsed.kind, parsed.query) }
        : { op: "item", item: await loadItem(services, parsed.kind, parsed.ref) };
    return answer(200, result);
  });
}

export interface RecognizeHandlerDeps {
  readonly signedIn: HandlerDeps["signedIn"];
  readonly service: Brickognize;
}

/** The photos the app sends: made small in the browser as WebP, or JPEG where WebP is not possible. */
const PHOTO_TYPES = ["image/webp", "image/jpeg", "image/png"];

interface PhotoBody {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly contentType: string;
}

/** The photo of the request, or nothing if the body is empty, too big or not a picture type. */
async function readPhoto(request: Request): Promise<PhotoBody | undefined> {
  const contentType = (request.headers.get("Content-Type") ?? "").split(";")[0]?.trim() ?? "";
  if (!PHOTO_TYPES.includes(contentType)) return undefined;
  try {
    const bytes = new Uint8Array(await request.arrayBuffer());
    return bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES
      ? undefined
      : { bytes, contentType };
  } catch {
    return undefined;
  }
}

/**
 * The function `recognize` (P8): the body is the photo itself (`Content-Type: image/webp` …); the
 * answer is `{suggestions}` with up to five figures, best first.
 */
export function handleRecognize(request: Request, deps: RecognizeHandlerDeps): Promise<Response> {
  return serve(
    request,
    deps,
    async (photo) => {
      if (!photo) return failure("bad_request");
      const { bytes, contentType } = photo as PhotoBody;
      const suggestions = await deps.service.recognize(bytes, contentType);
      const result: RecognizeAnswer = { suggestions };
      return answer(200, result);
    },
    readPhoto,
  );
}

export interface LinkHandlerDeps {
  readonly signedIn: HandlerDeps["signedIn"];
  /** What the address gives; throws `LinkError` for an address or page that is not usable. */
  readonly preview: (address: string) => Promise<LinkAnswer>;
}

const LINK_STATUS = { blocked: 422, unreachable: 502 } as const;

/**
 * The function `link-preview` (P9): `{url}` in, what the address gives out (`LinkAnswer`). The
 * sign-in is checked first, like in every function, before anything is fetched.
 */
export function handleLinkPreview(request: Request, deps: LinkHandlerDeps): Promise<Response> {
  return serve(request, deps, async (body) => {
    const address = isRecord(body) ? str(body.url) : undefined;
    if (address === undefined || address.length > MAX_LINK_LENGTH) return failure("bad_request");
    try {
      return answer(200, await deps.preview(address));
    } catch (error) {
      if (error instanceof LinkError) {
        return answer(LINK_STATUS[error.failure], { failure: error.failure });
      }
      throw error;
    }
  });
}

export interface BricklinkHandlerDeps {
  readonly signedIn: HandlerDeps["signedIn"];
  readonly client: () => BricklinkClient | undefined;
}

/**
 * The function `bricklink`: the catalog calls of the BrickLink client on their own (item, minifigs
 * of a set, sets of a minifig). P11 adds the price guide here.
 */
export function handleBricklink(request: Request, deps: BricklinkHandlerDeps): Promise<Response> {
  return serve(request, deps, async (body) => {
    const number = isRecord(body) ? str(body.number) : undefined;
    if (!isRecord(body) || number === undefined || !/^[A-Za-z0-9._-]{1,50}$/.test(number)) {
      return failure("bad_request");
    }
    const client = deps.client();
    if (!client) return failure("unavailable");
    if (body.op === "item" && (body.type === "MINIFIG" || body.type === "SET")) {
      return answer(200, await client.item(body.type, number));
    }
    if (body.op === "subsets") return answer(200, await client.minifigsOfSet(number));
    if (body.op === "supersets") return answer(200, await client.setsOfMinifig(number));
    return failure("bad_request");
  });
}
