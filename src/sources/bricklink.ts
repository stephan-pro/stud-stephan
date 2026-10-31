// BrickLink Store API v1: price guide ("sold" = average of the sales of the last 6 months).
import { type Fetch, isRecord, num, str, toCents } from "./json.ts";
import { type OAuthCredentials, oauthHeader } from "./oauth.ts";

const BASE = "https://api.bricklink.com/api/store/v1";

export type PriceOutcome =
  | {
      kind: "ok";
      condition: "new" | "used";
      currency: string;
      averageCents?: number;
      minCents?: number;
      maxCents?: number;
      totalQuantity: number;
    }
  | { kind: "refused"; httpStatus: number; code?: number; message: string }
  | { kind: "error"; message: string };

/** Turns one BrickLink answer into an outcome. BrickLink puts its own status into `meta`. */
export function classifyPriceAnswer(
  httpStatus: number,
  body: unknown,
  condition: "new" | "used",
): PriceOutcome {
  const meta = isRecord(body) && isRecord(body.meta) ? body.meta : {};
  const code = num(meta.code) ?? httpStatus;
  const message = [str(meta.message), str(meta.description)].filter(Boolean).join(" – ");
  if (code === 401 || code === 403) {
    return { kind: "refused", httpStatus, code, message: message || "Zugriff verweigert" };
  }
  if (code !== 200 || !isRecord(body) || !isRecord(body.data)) {
    return {
      kind: "error",
      message: `HTTP ${httpStatus}, Code ${code}: ${message || "keine Daten"}`,
    };
  }
  const data = body.data;
  const outcome: PriceOutcome = {
    kind: "ok",
    condition,
    currency: str(data.currency_code) ?? "?",
    totalQuantity: num(data.total_quantity) ?? 0,
  };
  const average = toCents(data.avg_price);
  const min = toCents(data.min_price);
  const max = toCents(data.max_price);
  if (average !== undefined) outcome.averageCents = average;
  if (min !== undefined) outcome.minCents = min;
  if (max !== undefined) outcome.maxCents = max;
  return outcome;
}

export async function priceGuide(
  fetchFn: Fetch,
  credentials: OAuthCredentials,
  item: { type: "MINIFIG" | "SET"; no: string },
  condition: "new" | "used",
  now: { nonce: string; timestamp: string },
): Promise<PriceOutcome> {
  const url = `${BASE}/items/${item.type}/${item.no}/price`;
  const params = {
    guide_type: "sold",
    new_or_used: condition === "new" ? "N" : "U",
    currency_code: "EUR",
  };
  const header = oauthHeader("GET", url, params, credentials, now.nonce, now.timestamp);
  const response = await fetchFn(`${url}?${new URLSearchParams(params)}`, {
    headers: { Authorization: header, Accept: "application/json" },
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: "error", message: `HTTP ${response.status}, Antwort ist kein JSON` };
  }
  return classifyPriceAnswer(response.status, body, condition);
}
