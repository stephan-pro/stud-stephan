// Builds the services of the functions from the environment (Supabase secrets and the values it
// puts into every function). Missing secrets give nothing, which the handlers answer as
// "unavailable" instead of failing at start.

import { createBricklink } from "./bricklinkClient.ts";
import { createBrickognize } from "./brickognizeClient.ts";
import type { CatalogDeps } from "./catalogService.ts";
import { type CatalogStore, supabaseStore } from "./catalogStore.ts";
import {
  type BricklinkHandlerDeps,
  type HandlerDeps,
  isSignedIn,
  type LinkHandlerDeps,
  type RecognizeHandlerDeps,
  signedInUser,
} from "./handler.ts";
import { CatalogError, type Fetch } from "./json.ts";
import { fetchLinkImage, previewLink } from "./linkService.ts";
import type { PriceRunDeps } from "./priceRunService.ts";
import { supabasePriceRunStore } from "./priceRunStore.ts";
import { createRebrickable } from "./rebrickableClient.ts";
import type { Resolve } from "./safeFetch.ts";
import type { SeriesDeps } from "./seriesService.ts";
import { supabaseSeriesStore } from "./seriesStore.ts";

/** BrickLink allows 5,000 calls a day; the rest is left for the price run (P11). */
export const BRICKLINK_DAILY_CAP = 4500;

export type Environment = (name: string) => string | undefined;

/** BrickLink's day, as it is counted: the UTC date. */
function countDay(now: () => Date): string {
  return now().toISOString().slice(0, 10);
}

/** A BrickLink client whose every call is counted first with `count` (false = day used up). */
function bricklinkOf(
  env: Environment,
  send: Fetch,
  count: (day: string) => Promise<boolean>,
  now: () => Date,
) {
  const consumerKey = env("BRICKLINK_CONSUMER_KEY");
  const consumerSecret = env("BRICKLINK_CONSUMER_SECRET");
  const tokenValue = env("BRICKLINK_TOKEN_VALUE");
  const tokenSecret = env("BRICKLINK_TOKEN_SECRET");
  if (!consumerKey || !consumerSecret || !tokenValue || !tokenSecret) return undefined;
  return createBricklink({
    fetch: send,
    credentials: { consumerKey, consumerSecret, tokenValue, tokenSecret },
    beforeCall: async () => {
      if (!(await count(countDay(now)))) {
        throw new CatalogError("limit_reached", "Tageslimit für BrickLink erreicht");
      }
    },
  });
}

function catalogCount(store: CatalogStore) {
  return (day: string) => store.countCall("bricklink", day, BRICKLINK_DAILY_CAP);
}

function storeOf(env: Environment, send: Fetch): CatalogStore {
  const url = env("SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    // Without the database there is no cache and no count, but the catalog still answers.
    return { read: async () => undefined, write: async () => {}, countCall: async () => true };
  }
  return supabaseStore({ url, serviceRoleKey }, send);
}

export function catalogHandlerDeps(
  env: Environment,
  send: Fetch,
  now = () => new Date(),
): HandlerDeps {
  return {
    signedIn: (request) => isSignedIn(request, env("SUPABASE_URL") ?? "", send),
    services(): CatalogDeps | undefined {
      const store = storeOf(env, send);
      const bricklink = bricklinkOf(env, send, catalogCount(store), now);
      const key = env("REBRICKABLE_API_KEY");
      if (!bricklink || !key) return undefined;
      return { bricklink, rebrickable: createRebrickable({ fetch: send, key }), store, now };
    },
  };
}

/** Brickognize needs no key, so the function is always ready. */
export function recognizeHandlerDeps(env: Environment, send: Fetch): RecognizeHandlerDeps {
  return {
    signedIn: (request) => isSignedIn(request, env("SUPABASE_URL") ?? "", send),
    service: createBrickognize({ fetch: send }),
  };
}

/**
 * The page function needs no key. `resolve` looks up the addresses of a name (the function's
 * `index.ts` gives `Deno.resolveDns`); `send` fetches the pages.
 */
export function linkHandlerDeps(env: Environment, send: Fetch, resolve: Resolve): LinkHandlerDeps {
  return {
    signedIn: (request) => isSignedIn(request, env("SUPABASE_URL") ?? "", send),
    preview: (address) => previewLink({ fetch: send, resolve }, address),
    image: (address) => fetchLinkImage({ fetch: send, resolve }, address),
  };
}

/**
 * The price run (P11) needs the database (its queue, with the service role) and the BrickLink
 * secrets; its calls count on the price run's share of the day (`price_count_call`).
 */
function priceRunOf(env: Environment, send: Fetch, now: () => Date): PriceRunDeps | undefined {
  const url = env("SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return undefined;
  const store = supabasePriceRunStore({ url, serviceRoleKey }, send);
  const bricklink = bricklinkOf(env, send, (day) => store.countCall(day), now);
  return bricklink ? { store, bricklink, now } : undefined;
}

/**
 * Building a series (P12) needs the database (its queue and the cache), Rebrickable for the sets
 * of a theme and BrickLink for the figures of a set; its BrickLink calls count on the catalog's
 * share of the day, so a big build leaves the price run its own share.
 */
function seriesOf(env: Environment, send: Fetch, now: () => Date): SeriesDeps | undefined {
  const url = env("SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const key = env("REBRICKABLE_API_KEY");
  if (!url || !serviceRoleKey || !key) return undefined;
  const cache = supabaseStore({ url, serviceRoleKey }, send);
  const bricklink = bricklinkOf(env, send, catalogCount(cache), now);
  if (!bricklink) return undefined;
  return {
    store: supabaseSeriesStore({ url, serviceRoleKey }, send),
    cache,
    rebrickable: createRebrickable({ fetch: send, key }),
    bricklink,
    now,
  };
}

export function bricklinkHandlerDeps(
  env: Environment,
  send: Fetch,
  now = () => new Date(),
): BricklinkHandlerDeps {
  // The sign-in is asked once per request, also when both the check and the id are needed.
  const users = new WeakMap<Request, Promise<string | undefined>>();
  const user = (request: Request) => {
    let found = users.get(request);
    if (found === undefined) {
      found = signedInUser(request, env("SUPABASE_URL") ?? "", send);
      users.set(request, found);
    }
    return found;
  };
  return {
    signedIn: async (request) => (await user(request)) !== undefined,
    user,
    client: () => bricklinkOf(env, send, catalogCount(storeOf(env, send)), now),
    priceRun: () => priceRunOf(env, send, now),
    series: () => seriesOf(env, send, now),
    runSecret: env("PRICE_RUN_SECRET"),
  };
}
