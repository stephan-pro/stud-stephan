// The HTTP side of the functions: sign-in check, reading the request, mapping failures to answers.
// The functions' `index.ts` only connects this to `Deno.serve` and the environment.

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
import { type LinkAnswer, LinkError, type LinkImageAnswer, MAX_LINK_LENGTH } from "./linkTypes.ts";
import {
  MANUAL_BUDGET_MS,
  type PriceRunDeps,
  SCHEDULED_BUDGET_MS,
  workOnPriceRuns,
} from "./priceRunService.ts";
import type { PriceRunAnswer } from "./priceRunTypes.ts";
import { MAX_PHOTO_BYTES, type RecognizeAnswer } from "./recognizeTypes.ts";
import {
  planSeries,
  type SeriesDeps,
  searchThemes,
  startSeries,
  workOnSeries,
} from "./seriesService.ts";
import { SERIES_MAX_SETS, type SeriesAnswer, type SeriesRequest } from "./seriesTypes.ts";
import { checkSources, type SourceProbes } from "./sourcesService.ts";

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
  return value === "minifig" || value === "legoSet" || value === "specialPart";
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
    // The reference of a special part or a figure may carry its BrickLink type: "GEAR:5010325",
    // "PART:11323pb01c01".
    const allowed = body.kind === "legoSet" ? /^[A-Za-z0-9._-]{1,50}$/ : /^[A-Za-z0-9._:-]{1,50}$/;
    if (ref === undefined || !allowed.test(ref)) return undefined;
    return { op: "item", kind: body.kind, ref };
  }
  return undefined;
}

export interface HandlerDeps {
  readonly signedIn: (request: Request) => Promise<boolean>;
  /** The services; nothing if the secrets are not set. */
  readonly services: () => CatalogDeps | undefined;
  /** One probe per data source for the settings (P14); without it the state is not offered. */
  readonly sources?: () => SourceProbes;
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
    // The app only learns "unavailable"; the reason belongs in the function's log (Supabase
    // Dashboard → Edge Functions → Logs). Messages carry no keys: those only travel in headers.
    console.error(
      error instanceof CatalogError
        ? `${error.failure}: ${error.message}`
        : `unerwarteter Fehler: ${String(error)}`,
    );
    if (error instanceof CatalogError) return failure(error.failure);
    return failure("unavailable");
  }
}

/**
 * The function `catalog`: `{op: "search", kind, query}` and `{op: "item", kind, ref}`, and
 * `{op: "sources"}` (P14), which answers the state of the four data sources and nothing else.
 */
export function handleCatalog(request: Request, deps: HandlerDeps): Promise<Response> {
  return serve(request, deps, async (body) => {
    if (isRecord(body) && body.op === "sources") {
      return deps.sources
        ? answer(200, await checkSources(deps.sources()))
        : failure("unavailable");
    }
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
  /** The one picture at the address; throws `LinkError` for one that is not usable. */
  readonly image: (address: string) => Promise<{
    readonly bytes: Uint8Array;
    readonly contentType: LinkImageAnswer["contentType"];
  }>;
}

const LINK_STATUS = { blocked: 422, unreachable: 502 } as const;

/** Bytes as base64, in pieces (one `String.fromCharCode` call with 3 MB of arguments would fail). */
function toBase64(bytes: Uint8Array): string {
  let text = "";
  for (let start = 0; start < bytes.length; start += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return btoa(text);
}

/**
 * The function `link-preview` (P9): `{url}` in, what the address gives out (`LinkAnswer`), or
 * `{image}` in, the one picture at that address out (`LinkImageAnswer`, P10). The sign-in is
 * checked first, like in every function, before anything is fetched.
 */
export function handleLinkPreview(request: Request, deps: LinkHandlerDeps): Promise<Response> {
  return serve(request, deps, async (body) => {
    const page = isRecord(body) ? str(body.url) : undefined;
    const picture = isRecord(body) ? str(body.image) : undefined;
    // Exactly one of the two.
    const address = page ?? picture;
    if (address === undefined || (page !== undefined && picture !== undefined)) {
      return failure("bad_request");
    }
    if (address.length > MAX_LINK_LENGTH) return failure("bad_request");
    try {
      if (picture !== undefined) {
        const { bytes, contentType } = await deps.image(picture);
        const result: LinkImageAnswer = { kind: "image", contentType, data: toBase64(bytes) };
        return answer(200, result);
      }
      return answer(200, await deps.preview(address));
    } catch (error) {
      if (error instanceof LinkError) {
        return answer(LINK_STATUS[error.failure], { failure: error.failure });
      }
      throw error;
    }
  });
}

/** The id of the signed-in person the token belongs to, or nothing (like `isSignedIn`). */
export async function signedInUser(
  request: Request,
  authUrl: string,
  send: Fetch,
): Promise<string | undefined> {
  const token = request.headers.get("Authorization");
  const apikey = request.headers.get("apikey");
  if (!token || !apikey) return undefined;
  try {
    const response = await send(`${authUrl}/auth/v1/user`, {
      headers: { Authorization: token, apikey },
    });
    if (!response.ok) return undefined;
    const user: unknown = await response.json();
    return isRecord(user) ? str(user.id) : undefined;
  } catch {
    return undefined;
  }
}

/** The header the cron job proves itself with (P11): the secret `PRICE_RUN_SECRET`. */
export const RUN_SECRET_HEADER = "x-price-run-secret";
/** Shorter secrets are not taken: the value is made with 32 random bytes (64 hex digits). */
export const MIN_SECRET_LENGTH = 32;

/** Compares without stopping at the first difference, so the time says nothing about the secret. */
export function sameSecret(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < given.length; index++) {
    difference |= given.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export interface BricklinkHandlerDeps {
  readonly signedIn: HandlerDeps["signedIn"];
  /** The id of the signed-in person (asked once per request). */
  readonly user: (request: Request) => Promise<string | undefined>;
  readonly client: () => BricklinkClient | undefined;
  /** The price run (P11); nothing if the BrickLink secrets or the database are missing. */
  readonly priceRun: () => PriceRunDeps | undefined;
  /** Building series (P12); nothing if the database, Rebrickable or BrickLink secrets are missing. */
  readonly series: () => SeriesDeps | undefined;
  /** `PRICE_RUN_SECRET`, the cron job's proof; without it the cron job is turned away. */
  readonly runSecret: string | undefined;
}

/** Up to 10 digits: the id of a single set (`singleSetId`) is above 1,000,000,000. */
const THEME_ID = /^\d{1,10}$/;
const MAX_INT = 2_147_483_647;

function wholeId(value: unknown): number | undefined {
  const text = typeof value === "number" ? String(value) : "";
  return THEME_ID.test(text) && Number(text) <= MAX_INT ? Number(text) : undefined;
}

/** The series request of the app, or nothing if it is not one. */
export function parseSeriesRequest(body: unknown): SeriesRequest | undefined {
  if (!isRecord(body) || body.op !== "series") return undefined;
  switch (body.action) {
    case "search": {
      const query = str(body.query)?.trim();
      if (query === undefined || query === "" || query.length > MAX_QUERY_LENGTH) return undefined;
      return { op: "series", action: "search", query };
    }
    case "plan":
    case "start": {
      const themeId = wholeId(body.themeId);
      return themeId === undefined ? undefined : { op: "series", action: body.action, themeId };
    }
    case "work":
    case "remove": {
      const id = wholeId(body.id);
      return id === undefined ? undefined : { op: "series", action: body.action, id };
    }
    case "get": {
      const id = wholeId(body.id);
      if (id === undefined || typeof body.touch !== "boolean") return undefined;
      return { op: "series", action: "get", id, touch: body.touch };
    }
    case "list":
      return { op: "series", action: "list" };
    default:
      return undefined;
  }
}

/** The series calls of the app (P12), all with the person's sign-in. */
async function seriesCall(
  request: Request,
  body: unknown,
  deps: BricklinkHandlerDeps,
): Promise<Response> {
  const parsed = parseSeriesRequest(body);
  if (!parsed) return failure("bad_request");
  const owner = await deps.user(request);
  if (owner === undefined) return failure("not_signed_in");
  const series = deps.series();
  if (!series) return failure("unavailable");
  const reply = (result: SeriesAnswer) => answer(200, result);
  switch (parsed.action) {
    case "search":
      return reply({ action: "search", ...(await searchThemes(series, parsed.query)) });
    case "plan":
      return reply({ action: "plan", plan: await planSeries(series, parsed.themeId) });
    case "start": {
      // A theme that is too big is refused before anything is queued.
      const { setCount } = await planSeries(series, parsed.themeId);
      if (setCount > SERIES_MAX_SETS) return failure("bad_request");
      const summary = await startSeries(series, owner, parsed.themeId);
      return reply({ action: "start", summary });
    }
    case "work": {
      await workOnSeries(series, { owner, budgetMs: MANUAL_BUDGET_MS });
      const summary = await series.store.summary(owner, parsed.id);
      return summary ? reply({ action: "work", summary }) : failure("not_found");
    }
    case "list":
      return reply({ action: "list", series: await series.store.summaries(owner) });
    case "get":
      return reply({
        action: "get",
        detail: await series.store.detail(owner, parsed.id, parsed.touch),
      });
    case "remove":
      await series.store.remove(owner, parsed.id);
      return reply({ action: "remove" });
  }
}

/** The cron job's call (pg_net with the secret from the Vault): work on every open run. */
async function scheduledRun(request: Request, deps: BricklinkHandlerDeps): Promise<Response> {
  const expected = deps.runSecret?.trim() ?? "";
  const given = request.headers.get(RUN_SECRET_HEADER)?.trim() ?? "";
  if (expected.length < MIN_SECRET_LENGTH || !sameSecret(given, expected)) {
    return failure("not_signed_in");
  }
  const run = deps.priceRun();
  const series = deps.series();
  if (!run && !series) return failure("unavailable");
  try {
    const prices = run
      ? await workOnPriceRuns(run, { budgetMs: SCHEDULED_BUDGET_MS })
      : { processed: 0, paused: false };
    // The series builds (P12) go on with the same call, so one cron job serves both.
    return answer(
      200,
      series
        ? { ...prices, series: await workOnSeries(series, { budgetMs: SCHEDULED_BUDGET_MS }) }
        : prices,
    );
  } catch (error) {
    return failure(error instanceof CatalogError ? error.failure : "unavailable");
  }
}

/**
 * "Jetzt aktualisieren" (S12): `{op: "priceRun", start}`. With `start` a run begins unless one is
 * open; then a portion of the person's open run is done and the run's state comes back.
 */
async function manualRun(
  request: Request,
  body: Record<string, unknown>,
  deps: BricklinkHandlerDeps,
): Promise<Response> {
  if (body.start !== undefined && typeof body.start !== "boolean") return failure("bad_request");
  const owner = await deps.user(request);
  if (owner === undefined) return failure("not_signed_in");
  const run = deps.priceRun();
  if (!run) return failure("unavailable");
  if (body.start === true) await run.store.begin(owner, "manual");
  await workOnPriceRuns(run, { owner, budgetMs: MANUAL_BUDGET_MS });
  const result: PriceRunAnswer = { status: await run.store.status(owner) };
  return answer(200, result);
}

/**
 * The function `bricklink`: the catalog calls of the BrickLink client on their own (item, minifigs
 * of a set, sets of a minifig) and the price run (P11): from the cron job with the header
 * `x-price-run-secret`, from the app with the person's sign-in (`{op: "priceRun", start}`).
 */
export function handleBricklink(request: Request, deps: BricklinkHandlerDeps): Promise<Response> {
  if (request.method === "POST" && request.headers.has(RUN_SECRET_HEADER)) {
    return scheduledRun(request, deps);
  }
  return serve(request, deps, async (body) => {
    if (isRecord(body) && body.op === "priceRun") return manualRun(request, body, deps);
    if (isRecord(body) && body.op === "series") return seriesCall(request, body, deps);
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
