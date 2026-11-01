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
  type RecognizeHandlerDeps,
} from "./handler.ts";
import { CatalogError, type Fetch } from "./json.ts";
import { createRebrickable } from "./rebrickableClient.ts";

/** BrickLink allows 5,000 calls a day; the rest is left for the price run (P11). */
export const BRICKLINK_DAILY_CAP = 4500;

export type Environment = (name: string) => string | undefined;

function bricklinkOf(env: Environment, send: Fetch, store: CatalogStore, now: () => Date) {
  const credentials = {
    consumerKey: env("BRICKLINK_CONSUMER_KEY"),
    consumerSecret: env("BRICKLINK_CONSUMER_SECRET"),
    tokenValue: env("BRICKLINK_TOKEN_VALUE"),
    tokenSecret: env("BRICKLINK_TOKEN_SECRET"),
  };
  const { consumerKey, consumerSecret, tokenValue, tokenSecret } = credentials;
  if (!consumerKey || !consumerSecret || !tokenValue || !tokenSecret) return undefined;
  return createBricklink({
    fetch: send,
    credentials: { consumerKey, consumerSecret, tokenValue, tokenSecret },
    beforeCall: async () => {
      const day = now().toISOString().slice(0, 10);
      if (!(await store.countCall("bricklink", day, BRICKLINK_DAILY_CAP))) {
        throw new CatalogError("limit_reached", "Tageslimit für BrickLink erreicht");
      }
    },
  });
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
      const bricklink = bricklinkOf(env, send, store, now);
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

export function bricklinkHandlerDeps(
  env: Environment,
  send: Fetch,
  now = () => new Date(),
): BricklinkHandlerDeps {
  return {
    signedIn: (request) => isSignedIn(request, env("SUPABASE_URL") ?? "", send),
    client: () => bricklinkOf(env, send, storeOf(env, send), now),
  };
}
