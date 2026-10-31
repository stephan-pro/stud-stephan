// Rebrickable API v3: catalogue of official sets and minifigs. Key in the header `Authorization: key …`.
import { type Fetch, isRecord, list, num, str } from "./json.ts";

const BASE = "https://rebrickable.com/api/v3/lego";
/** Rebrickable allows about one request per second. */
const PAUSE_MS = 1100;

export interface MinifigInfo {
  figNum: string;
  name: string;
  numParts?: number;
  imageUrl?: string;
  url?: string;
  /** Other numbering systems, e.g. `{ BrickLink: ["sw0194"] }` – only if Rebrickable sends them. */
  externalIds?: Record<string, string[]>;
}

export interface SetInfo {
  setNum: string;
  name: string;
  year?: number;
  numParts?: number;
  imageUrl?: string;
  minifigs: { figNum: string; name: string; quantity: number; info?: MinifigInfo }[];
}

export interface RebrickableClient {
  get(path: string, query?: Record<string, string>): Promise<unknown>;
}

export function createClient(
  fetchFn: Fetch,
  key: string,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): RebrickableClient {
  let first = true;
  return {
    async get(path, query = {}) {
      const url = new URL(path.startsWith("http") ? path : `${BASE}${path}`);
      for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!first) await sleep(PAUSE_MS);
        first = false;
        const response = await fetchFn(url, { headers: { Authorization: `key ${key}` } });
        if (response.status === 429) {
          await sleep((Number(response.headers.get("retry-after")) || 5) * 1000);
          continue;
        }
        if (!response.ok) throw new Error(`Rebrickable antwortet mit HTTP ${response.status}`);
        return response.json();
      }
      throw new Error("Rebrickable: zu viele Anfragen (HTTP 429), bitte später noch einmal");
    },
  };
}

function externalIds(value: unknown): Record<string, string[]> | undefined {
  if (!isRecord(value)) return undefined;
  const ids: Record<string, string[]> = {};
  for (const [system, entries] of Object.entries(value)) {
    const found = (Array.isArray(entries) ? entries : [entries]).flatMap((entry) =>
      typeof entry === "string" || typeof entry === "number" ? [String(entry)] : [],
    );
    if (found.length > 0) ids[system] = found;
  }
  return Object.keys(ids).length > 0 ? ids : undefined;
}

export function parseMinifig(raw: unknown): MinifigInfo | undefined {
  if (!isRecord(raw)) return undefined;
  const figNum = str(raw.set_num);
  const name = str(raw.name);
  if (!figNum || !name) return undefined;
  const info: MinifigInfo = { figNum, name };
  const numParts = num(raw.num_parts);
  const imageUrl = str(raw.set_img_url);
  const url = str(raw.set_url);
  const ids = externalIds(raw.external_ids);
  if (numParts !== undefined) info.numParts = numParts;
  if (imageUrl) info.imageUrl = imageUrl;
  if (url) info.url = url;
  if (ids) info.externalIds = ids;
  return info;
}

/** Looks a minifig up by free text (Rebrickable's own search; BrickLink numbers may not match). */
export async function searchMinifigs(
  client: RebrickableClient,
  search: string,
): Promise<{ total: number; results: MinifigInfo[] }> {
  const body = await client.get("/minifigs/", { search, page_size: "5" });
  if (!isRecord(body)) throw new Error("Rebrickable: unerwartete Antwort bei der Figurensuche");
  const results = list(body.results).flatMap((entry) => parseMinifig(entry) ?? []);
  return { total: num(body.count) ?? results.length, results };
}

/** A set with all its minifigs; for up to `detailLimit` figs the detail page is read, too. */
export async function lookupSet(
  client: RebrickableClient,
  setNum: string,
  detailLimit = 6,
): Promise<SetInfo> {
  const raw = await client.get(`/sets/${setNum}/`);
  if (!isRecord(raw)) throw new Error("Rebrickable: unerwartete Antwort beim Set");
  const name = str(raw.name);
  if (!name) throw new Error("Rebrickable: Set ohne Namen");
  const set: SetInfo = { setNum: str(raw.set_num) ?? setNum, name, minifigs: [] };
  const year = num(raw.year);
  const numParts = num(raw.num_parts);
  const imageUrl = str(raw.set_img_url);
  if (year !== undefined) set.year = year;
  if (numParts !== undefined) set.numParts = numParts;
  if (imageUrl) set.imageUrl = imageUrl;

  let next: string | undefined = `/sets/${setNum}/minifigs/`;
  while (next) {
    const page: unknown = await client.get(next);
    if (!isRecord(page)) break;
    for (const entry of list(page.results)) {
      if (!isRecord(entry)) continue;
      const figNum = str(entry.set_num);
      if (!figNum) continue;
      set.minifigs.push({
        figNum,
        name: str(entry.set_name) ?? figNum,
        quantity: num(entry.quantity) ?? 1,
      });
    }
    next = str(page.next);
  }
  for (const fig of set.minifigs.slice(0, detailLimit)) {
    const info = parseMinifig(await client.get(`/minifigs/${fig.figNum}/`));
    if (info) fig.info = info;
  }
  return set;
}
