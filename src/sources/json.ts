// Defensive readers for answers of external services: nothing is trusted, everything is checked.

export type Json = Record<string, unknown>;

export function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function str(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

export function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** "12.3400" (BrickLink sends prices as text) → 1234 whole cents; `undefined` if not a price. */
export function toCents(value: unknown): number | undefined {
  const amount = typeof value === "number" ? value : Number(str(value));
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : undefined;
}

export function formatCents(cents: number): string {
  const euros = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, "0");
  return `${euros},${rest} €`;
}

export type Fetch = typeof fetch;
