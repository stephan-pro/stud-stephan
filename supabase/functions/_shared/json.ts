// Defensive readers for answers of external services: nothing is trusted, everything is checked.

export type Json = Record<string, unknown>;
export type Fetch = typeof fetch;

/** A call to a service failed in a way the person can be told about. */
export class CatalogError extends Error {
  constructor(
    readonly failure: "not_found" | "limit_reached" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "CatalogError";
  }
}

export function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function str(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

export function num(value: unknown): number | undefined {
  const number = typeof value === "string" && value !== "" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : undefined;
}

export function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** "12.3400" (BrickLink sends prices as text) → 1234 whole cents; `undefined` if not a price. */
export function toCents(value: unknown): number | undefined {
  const amount = typeof value === "number" ? value : Number(str(value));
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : undefined;
}

/** A year from 1900 to 2100, else nothing. */
export function year(value: unknown): number | undefined {
  const number = num(value);
  return number !== undefined && Number.isInteger(number) && number >= 1900 && number <= 2100
    ? number
    : undefined;
}

/** BrickLink writes picture addresses as "//img.bricklink.com/…". */
export function secureUrl(value: unknown): string | undefined {
  const url = str(value);
  if (url === undefined) return undefined;
  const full = url.startsWith("//") ? `https:${url}` : url;
  return full.startsWith("https://") ? full : undefined;
}

/** "Star Wars" + "The Clone Wars" → "Star Wars – The Clone Wars"; the main theme alone if equal. */
export function joinTheme(main: string | undefined, sub: string | undefined): string | undefined {
  if (main === undefined) return sub;
  if (sub === undefined || sub === main) return main;
  return `${main} – ${sub}`;
}
