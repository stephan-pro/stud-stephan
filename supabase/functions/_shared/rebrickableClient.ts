// Rebrickable API v3: name search for sets and minifigs, a set's piece count, themes. The key goes
// in the header `Authorization: key …`. Rebrickable allows about one request per second, so
// consecutive calls of one client wait (`pauseMs`).

import { CatalogError, type Fetch, isRecord, list, num, secureUrl, str, year } from "./json.ts";

const BASE = "https://rebrickable.com/api/v3/lego";

export interface RebrickableSet {
  number: string;
  name: string;
  year?: number;
  pieceCount?: number;
  themeId?: number;
  imageUrl?: string;
}

export interface RebrickableMinifig {
  /** Rebrickable's own number ("fig-014663"), not the BrickLink one. */
  figNum: string;
  name: string;
  pieceCount?: number;
  imageUrl?: string;
}

export interface RebrickableTheme {
  name: string;
  parentId?: number;
}

export interface RebrickableClient {
  searchSets(query: string): Promise<RebrickableSet[]>;
  searchMinifigs(query: string): Promise<RebrickableMinifig[]>;
  set(number: string): Promise<RebrickableSet>;
  minifig(figNum: string): Promise<RebrickableMinifig>;
  /** The numbers of the sets a minifig comes in. */
  setsOfMinifig(figNum: string): Promise<string[]>;
  theme(id: number): Promise<RebrickableTheme>;
}

export interface RebrickableOptions {
  readonly fetch: Fetch;
  readonly key: string;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly pauseMs?: number;
}

const HITS = "8";

function parseSet(raw: unknown): RebrickableSet | undefined {
  if (!isRecord(raw)) return undefined;
  const number = str(raw.set_num);
  const name = str(raw.name);
  if (number === undefined || name === undefined) return undefined;
  const set: RebrickableSet = { number, name };
  const released = year(raw.year);
  const pieceCount = num(raw.num_parts);
  const themeId = num(raw.theme_id);
  const imageUrl = secureUrl(raw.set_img_url);
  if (released !== undefined) set.year = released;
  if (pieceCount !== undefined) set.pieceCount = pieceCount;
  if (themeId !== undefined) set.themeId = themeId;
  if (imageUrl !== undefined) set.imageUrl = imageUrl;
  return set;
}

function parseMinifig(raw: unknown): RebrickableMinifig | undefined {
  if (!isRecord(raw)) return undefined;
  const figNum = str(raw.set_num);
  const name = str(raw.name);
  if (figNum === undefined || name === undefined) return undefined;
  const fig: RebrickableMinifig = { figNum, name };
  const pieceCount = num(raw.num_parts);
  const imageUrl = secureUrl(raw.set_img_url);
  if (pieceCount !== undefined) fig.pieceCount = pieceCount;
  if (imageUrl !== undefined) fig.imageUrl = imageUrl;
  return fig;
}

export function createRebrickable(options: RebrickableOptions): RebrickableClient {
  const sleep = options.sleep ?? ((ms: number) => new Promise((done) => setTimeout(done, ms)));
  const pauseMs = options.pauseMs ?? 1100;
  let first = true;

  async function get(path: string, query: Record<string, string> = {}): Promise<unknown> {
    const url = new URL(`${BASE}${path}`);
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!first) await sleep(pauseMs);
      first = false;
      let response: Response;
      try {
        response = await options.fetch(url, {
          headers: { Authorization: `key ${options.key}`, Accept: "application/json" },
        });
      } catch (error) {
        throw new CatalogError("unavailable", `Rebrickable nicht erreichbar: ${String(error)}`);
      }
      if (response.status === 429) {
        if (attempt === 0) {
          await sleep((Number(response.headers.get("retry-after")) || 3) * 1000);
          continue;
        }
        throw new CatalogError("limit_reached", "Rebrickable: zu viele Anfragen");
      }
      if (response.status === 404)
        throw new CatalogError("not_found", "Rebrickable: nicht gefunden");
      if (!response.ok) {
        throw new CatalogError("unavailable", `Rebrickable antwortet mit HTTP ${response.status}`);
      }
      try {
        return await response.json();
      } catch {
        throw new CatalogError("unavailable", "Rebrickable: Antwort ist kein JSON");
      }
    }
    throw new CatalogError("limit_reached", "Rebrickable: zu viele Anfragen");
  }

  const results = (body: unknown): unknown[] => (isRecord(body) ? list(body.results) : []);

  return {
    async searchSets(query) {
      const body = await get("/sets/", { search: query, page_size: HITS });
      return results(body).flatMap((raw) => parseSet(raw) ?? []);
    },

    async searchMinifigs(query) {
      const body = await get("/minifigs/", { search: query, page_size: HITS });
      return results(body).flatMap((raw) => parseMinifig(raw) ?? []);
    },

    async set(number) {
      const set = parseSet(await get(`/sets/${encodeURIComponent(number)}/`));
      if (!set) throw new CatalogError("unavailable", "Rebrickable: unerwartete Antwort beim Set");
      return set;
    },

    async minifig(figNum) {
      const fig = parseMinifig(await get(`/minifigs/${encodeURIComponent(figNum)}/`));
      if (!fig)
        throw new CatalogError("unavailable", "Rebrickable: unerwartete Antwort bei der Figur");
      return fig;
    },

    async setsOfMinifig(figNum) {
      const body = await get(`/minifigs/${encodeURIComponent(figNum)}/sets/`, { page_size: "5" });
      return results(body).flatMap((raw) => (isRecord(raw) ? (str(raw.set_num) ?? []) : []));
    },

    async theme(id) {
      const body = await get(`/themes/${id}/`);
      const name = isRecord(body) ? str(body.name) : undefined;
      if (!isRecord(body) || name === undefined) {
        throw new CatalogError("unavailable", "Rebrickable: Thema ohne Namen");
      }
      const parentId = num(body.parent_id);
      return parentId ? { name, parentId } : { name };
    },
  };
}
