// The state of the four data sources for the settings (P14): one cheap, harmless call each, all at
// once. Nothing of a key or of an answer's content leaves here; only the state.

import type { BricklinkClient } from "./bricklinkClient.ts";
import { BRICKOGNIZE_URL } from "./brickognizeClient.ts";
import { CatalogError, type Fetch } from "./json.ts";
import { SOURCE_IDS, type SourceId, type SourceState, type SourcesAnswer } from "./sourcesTypes.ts";

export type Probe = () => Promise<SourceState>;
export type SourceProbes = Record<SourceId, Probe>;

/** A source that does not answer within this time counts as unreachable. */
const TIMEOUT_MS = 6_000;

export const MERLIN_URL = "https://www.merlinssteine.de/";
const REBRICKABLE_URL = "https://rebrickable.com/api/v3/lego/themes/?page_size=1";
/** A set that will always exist at BrickLink; the call is as small as a call gets. */
const BRICKLINK_SAMPLE = "75372-1";

/** A service without a key: reachable if it answers at all with something other than a server error. */
export function reachable(send: Fetch, url: string): Probe {
  return async () => {
    try {
      const response = await send(url, { method: "GET", signal: AbortSignal.timeout(TIMEOUT_MS) });
      await response.body?.cancel();
      return response.status < 500 ? "ok" : "unreachable";
    } catch {
      return "unreachable";
    }
  };
}

export const brickognizeProbe = (send: Fetch): Probe => reachable(send, BRICKOGNIZE_URL);
export const merlinProbe = (send: Fetch): Probe => reachable(send, MERLIN_URL);

/** Rebrickable: one theme asked for, with the key; 401 and 403 mean the key was turned down. */
export function rebrickableProbe(send: Fetch, key: string | undefined): Probe {
  return async () => {
    if (!key) return "missingKeys";
    try {
      const response = await send(REBRICKABLE_URL, {
        headers: { Authorization: `key ${key}`, Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403) return "refused";
      return response.ok ? "ok" : "unreachable";
    } catch {
      return "unreachable";
    }
  };
}

/** BrickLink: one set asked for through the counted client; the limit being reached still means the key works. */
export function bricklinkProbe(client: BricklinkClient | undefined): Probe {
  return async () => {
    if (!client) return "missingKeys";
    try {
      await client.item("SET", BRICKLINK_SAMPLE);
      return "ok";
    } catch (error) {
      if (error instanceof CatalogError) {
        if (error.failure === "not_found" || error.failure === "limit_reached") return "ok";
        if (/Code (400|401|403)\b/.test(error.message)) return "refused";
      }
      return "unreachable";
    }
  };
}

/** The state of every source; a probe that fails on its own counts as unreachable. */
export async function checkSources(probes: SourceProbes): Promise<SourcesAnswer> {
  const states = await Promise.all(
    SOURCE_IDS.map(async (id): Promise<[SourceId, SourceState]> => {
      try {
        return [id, await probes[id]()];
      } catch {
        return [id, "unreachable"];
      }
    }),
  );
  return { op: "sources", sources: Object.fromEntries(states) as SourcesAnswer["sources"] };
}
