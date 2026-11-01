// Brickognize (free photo recognition, no key): the photo goes as form field `query_image`, the
// answer lists figures with their BrickLink number and a score (shapes seen in P2, docs/DATENQUELLEN.md).

import { CatalogError, type Fetch, isRecord, list, num, secureUrl, str } from "./json.ts";
import { MAX_SUGGESTIONS, type Suggestion } from "./recognizeTypes.ts";

export const BRICKOGNIZE_URL = "https://api.brickognize.com/predict/figs/";

/** How long the service may think; the person is waiting with the photo on the screen. */
const TIMEOUT_MS = 25_000;

const NUMBER = /^[A-Za-z0-9._-]{1,50}$/;

/**
 * The best guesses of an answer, most sure first. Entries without a usable BrickLink number are
 * left out (nothing to open the catalog with), and so are entries that name other sites but not
 * BrickLink, since their number would be somebody else's.
 */
export function parseSuggestions(body: unknown, limit = MAX_SUGGESTIONS): Suggestion[] {
  if (!isRecord(body)) return [];
  const found = list(body.items).flatMap((entry): Suggestion[] => {
    if (!isRecord(entry)) return [];
    const number = str(entry.id);
    const score = num(entry.score);
    if (number === undefined || !NUMBER.test(number) || score === undefined) return [];
    const sites = list(entry.external_sites).flatMap((site) =>
      isRecord(site) && str(site.name) ? [String(site.name).toLowerCase()] : [],
    );
    if (sites.length > 0 && !sites.includes("bricklink")) return [];
    const suggestion: Suggestion = {
      number,
      name: str(entry.name) ?? number,
      score: Math.min(1, Math.max(0, score)),
    };
    const imageUrl = secureUrl(entry.img_url);
    if (imageUrl) suggestion.imageUrl = imageUrl;
    return [suggestion];
  });
  return found.sort((a, b) => b.score - a.score).slice(0, limit);
}

export interface Brickognize {
  recognize(photo: Uint8Array<ArrayBuffer>, contentType: string): Promise<Suggestion[]>;
}

export function createBrickognize(deps: { fetch: Fetch }): Brickognize {
  return {
    async recognize(photo, contentType) {
      const form = new FormData();
      form.append("query_image", new Blob([photo], { type: contentType }), "foto");
      let response: Response;
      try {
        response = await deps.fetch(BRICKOGNIZE_URL, {
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
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new CatalogError("unavailable", "Brickognize: unlesbare Antwort");
      }
      return parseSuggestions(body);
    },
  };
}
