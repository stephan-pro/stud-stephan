// Brickognize (free photo recognition, no key): the photo goes as form field `query_image`, the
// answer lists guesses with their BrickLink number and a score (shapes seen in P2, docs/DATENQUELLEN.md).
// Three endpoints: figures (`/predict/figs/`), sets (`/predict/sets/`) and everything
// (`/predict/`, whose entries say `type`: part, fig, set …).

import { CatalogError, type Fetch, isRecord, list, num, secureUrl, str } from "./json.ts";
import {
  GOOD_SCORE,
  MAX_SUGGESTIONS,
  type RecognizeKind,
  type Suggestion,
} from "./recognizeTypes.ts";

const BASE_URL = "https://api.brickognize.com/predict/";
export const BRICKOGNIZE_URL = `${BASE_URL}figs/`;
export const BRICKOGNIZE_SETS_URL = `${BASE_URL}sets/`;
export const BRICKOGNIZE_ANY_URL = BASE_URL;

/** How long the service may think; the person is waiting with the photo on the screen. */
const TIMEOUT_MS = 25_000;

const NUMBER = /^[A-Za-z0-9._-]{1,50}$/;

/** An entry of an answer that has what every suggestion needs. */
interface Reading {
  readonly number: string;
  readonly name: string;
  readonly score: number;
  readonly imageUrl?: string;
  /** What the entry says it is (lower case): "part", "fig", "set" … ; nothing if it does not say. */
  readonly type?: string;
}

/**
 * The usable entries of an answer. Entries without a usable BrickLink number are left out (nothing
 * to open the catalog with), and so are entries that name other sites but not BrickLink, since
 * their number would be somebody else's.
 */
function readings(body: unknown): Reading[] {
  if (!isRecord(body)) return [];
  return list(body.items).flatMap((entry): Reading[] => {
    if (!isRecord(entry)) return [];
    const number = str(entry.id);
    const score = num(entry.score);
    if (number === undefined || !NUMBER.test(number) || score === undefined) return [];
    const sites = list(entry.external_sites).flatMap((site) =>
      isRecord(site) && str(site.name) ? [String(site.name).toLowerCase()] : [],
    );
    if (sites.length > 0 && !sites.includes("bricklink")) return [];
    const imageUrl = secureUrl(entry.img_url);
    const type = str(entry.type)?.toLowerCase();
    return [
      {
        number,
        name: str(entry.name) ?? number,
        score: Math.min(1, Math.max(0, score)),
        ...(imageUrl ? { imageUrl } : {}),
        ...(type ? { type } : {}),
      },
    ];
  });
}

function plain(reading: Reading, number = reading.number): Suggestion {
  const suggestion: Suggestion = { number, name: reading.name, score: reading.score };
  if (reading.imageUrl) suggestion.imageUrl = reading.imageUrl;
  return suggestion;
}

/** A set number always has its variant ("75005" is "75005-1"), as everywhere in the app. */
function setNumber(number: string): string {
  return number.includes("-") ? number : `${number}-1`;
}

/** The most sure guesses, one per number (the list is keyed by it). */
function best(found: Suggestion[], limit: number): Suggestion[] {
  const seen = new Set<string>();
  return found
    .sort((a, b) => b.score - a.score)
    .filter((suggestion) => !seen.has(suggestion.number) && seen.add(suggestion.number))
    .slice(0, limit);
}

/** The best guesses of an answer of the figure endpoint, most sure first. */
export function parseSuggestions(body: unknown, limit = MAX_SUGGESTIONS): Suggestion[] {
  return best(
    readings(body).map((reading) => plain(reading)),
    limit,
  );
}

/** The best guesses of an answer of the set endpoint: set numbers with their variant. */
export function parseSetSuggestions(body: unknown, limit = MAX_SUGGESTIONS): Suggestion[] {
  return best(
    readings(body).map((reading) => plain(reading, setNumber(reading.number))),
    limit,
  );
}

/**
 * The guesses of an answer of the general endpoint that fit what was asked for. For a figure
 * those are parts (a Big Fig such as the Rancor, `11323pb01c01`, is a part at BrickLink; opened as
 * "PART:…") and figures; for a special part sets, gear and books (opened by their type) and
 * entries that do not say what they are (opened by the number alone, the catalog tries the types).
 */
export function parseAnySuggestions(
  body: unknown,
  kind: RecognizeKind,
  limit = MAX_SUGGESTIONS,
): Suggestion[] {
  const found = readings(body).flatMap((reading): Suggestion[] => {
    const { type } = reading;
    if (kind === "minifig") {
      if (type === "fig") return [plain(reading)];
      if (type !== "part") return [];
      return [{ ...plain(reading), ref: `PART:${reading.number}`, bricklinkType: "PART" }];
    }
    if (kind === "specialPart") {
      if (type === "set") {
        const number = setNumber(reading.number);
        return [{ ...plain(reading, number), ref: `SET:${number}` }];
      }
      if (type === "gear" || type === "book") {
        return [{ ...plain(reading), ref: `${type.toUpperCase()}:${reading.number}` }];
      }
      return type === undefined ? [plain(reading)] : [];
    }
    return [];
  });
  return best(found, limit);
}

export interface Brickognize {
  recognize(
    photo: Uint8Array<ArrayBuffer>,
    contentType: string,
    kind?: RecognizeKind,
  ): Promise<Suggestion[]>;
}

export function createBrickognize(deps: { fetch: Fetch }): Brickognize {
  /** One call; the answer's body as sent. */
  async function ask(
    url: string,
    photo: Uint8Array<ArrayBuffer>,
    contentType: string,
  ): Promise<unknown> {
    const form = new FormData();
    form.append("query_image", new Blob([photo], { type: contentType }), "foto");
    let response: Response;
    try {
      response = await deps.fetch(url, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new CatalogError("unavailable", "Brickognize nicht erreichbar");
    }
    if (response.status === 429) {
      throw new CatalogError("limit_reached", "Brickognize: zu viele Anfragen");
    }
    if (!response.ok) {
      throw new CatalogError("unavailable", `Brickognize antwortet mit HTTP ${response.status}`);
    }
    try {
      return await response.json();
    } catch {
      throw new CatalogError("unavailable", "Brickognize: unlesbare Antwort");
    }
  }

  return {
    async recognize(photo, contentType, kind = "minifig") {
      if (kind === "legoSet") {
        return parseSetSuggestions(await ask(BRICKOGNIZE_SETS_URL, photo, contentType));
      }
      if (kind === "specialPart") {
        // Nothing here has an endpoint of its own: ask for everything (an attempt, GWPs are often
        // not known).
        return parseAnySuggestions(await ask(BRICKOGNIZE_ANY_URL, photo, contentType), kind);
      }
      const figures = parseSuggestions(await ask(BRICKOGNIZE_URL, photo, contentType));
      if ((figures[0]?.score ?? 0) >= GOOD_SCORE) return figures;
      // No good figure: perhaps a part BrickLink lists as one (Big Fig). A failure of this extra
      // question only costs the extra, unless there is nothing else to show.
      let parts: Suggestion[];
      try {
        parts = parseAnySuggestions(await ask(BRICKOGNIZE_ANY_URL, photo, contentType), kind);
      } catch (error) {
        if (figures.length === 0) throw error;
        return figures;
      }
      const known = new Set(figures.map((suggestion) => suggestion.number));
      return best(
        [...figures, ...parts.filter((part) => !known.has(part.number))],
        MAX_SUGGESTIONS,
      );
    },
  };
}
