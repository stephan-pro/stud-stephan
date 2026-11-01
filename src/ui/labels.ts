// Small pure helpers of the interface: names of manufacturers, safe links, colours of placeholders.

import type { Manufacturer } from "../domain/types";
import { TEXTS } from "./texts";

/** "LEGO", "Bluebrixx", or the free name of another manufacturer or custom shop. */
export function manufacturerLabel(manufacturer: Manufacturer): string {
  return "name" in manufacturer ? manufacturer.name : TEXTS.manufacturers[manufacturer.kind];
}

/**
 * The address if it is a web address (http or https), else nothing. Links are free text typed by
 * the person (F3), so one like "javascript:…" must never become a link.
 */
export function safeUrl(text: string | undefined): string | undefined {
  if (!text) return undefined;
  try {
    const url = new URL(text.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** "www.rebrickable.com/mocs/x" → "rebrickable.com": what a link shows. */
export function linkLabel(text: string): string {
  const url = safeUrl(text);
  return url ? new URL(url).hostname.replace(/^www\./, "") : text;
}

/** Number of placeholder colours (`--tint-blue` … `--tint-lilac`). */
export const TINT_COUNT = 5;

/** The same key always gets the same colour, so a tile keeps its colour from visit to visit. */
export function tintIndex(key: string): number {
  let sum = 0;
  for (const char of key) sum = (sum * 31 + char.charCodeAt(0)) % 9973;
  return sum % TINT_COUNT;
}
