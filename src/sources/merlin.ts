// Merlins Steine SetDB: no API, so one pasted set page is read once and what is recognisable is taken.
import { isRecord, list, str } from "./json.ts";

export interface MerlinFields {
  name?: string;
  manufacturer?: string;
  setNumber?: string;
  pieceCount?: number;
  imageUrl?: string;
}

export interface MerlinResult {
  fields: MerlinFields;
  /** Labels of the page that look like "Name:" – shows what else could be read later. */
  labels: string[];
}

const LABELS = {
  manufacturer: /^(hersteller|marke|hersteller\/marke)$/i,
  setNumber: /^(set-?nr\.?|set-?nummer|setnummer|artikel-?nr\.?|artikelnummer|nummer)$/i,
  pieceCount: /^(teile|teilezahl|anzahl teile|teile gesamt|steine|anzahl steine)$/i,
} as const;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  auml: "ä",
  ouml: "ö",
  uuml: "ü",
  Auml: "Ä",
  Ouml: "Ö",
  Uuml: "Ü",
  szlig: "ß",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number(entity.slice(1)));
    return ENTITIES[entity] ?? whole;
  });
}

function metaContent(html: string, property: string): string | undefined {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    const content = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (key?.toLowerCase() === property && content) return decodeEntities(content).trim();
  }
  return undefined;
}

function tagText(html: string, tag: string): string | undefined {
  const inner = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(html)?.[1];
  return inner
    ? str(
        decodeEntities(inner.replace(/<[^>]+>/g, " "))
          .replace(/\s+/g, " ")
          .trim(),
      )
    : undefined;
}

function jsonLdProduct(html: string): Record<string, unknown> | undefined {
  const blocks = html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi);
  for (const block of blocks) {
    try {
      const parsed: unknown = JSON.parse(block[1] ?? "");
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const candidate of candidates) {
        if (isRecord(candidate) && /product/i.test(String(candidate["@type"]))) return candidate;
      }
    } catch {
      // not valid JSON: ignore this block
    }
  }
  return undefined;
}

/** Visible text as trimmed, non-empty lines (every tag is a line break). */
function textLines(html: string): string[] {
  const visible = html
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, "\n");
  return decodeEntities(visible)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function labelled(lines: string[], label: RegExp): string | undefined {
  for (const [index, line] of lines.entries()) {
    const match = /^([^:]{1,40}?)\s*:\s*(.*)$/.exec(line);
    const name = match ? match[1] : line;
    if (name === undefined || !label.test(name.trim())) continue;
    const value = match?.[2] || lines[index + 1];
    if (value) return value;
  }
  return undefined;
}

function toPieceCount(text: string | undefined): number | undefined {
  const digits = /\d[\d.]*/.exec(text ?? "")?.[0]?.replace(/\./g, "");
  const count = digits ? Number(digits) : Number.NaN;
  return Number.isInteger(count) && count > 0 ? count : undefined;
}

export function extractSetPage(html: string, pageUrl: string): MerlinResult {
  const ld = jsonLdProduct(html);
  const lines = textLines(html);
  const fields: MerlinFields = {};

  const brand = ld && isRecord(ld.brand) ? str(ld.brand.name) : str(ld?.brand);
  const ldImage = ld
    ? Array.isArray(ld.image)
      ? str(list(ld.image)[0])
      : str(ld.image)
    : undefined;
  const name =
    str(ld?.name) ?? metaContent(html, "og:title") ?? tagText(html, "h1") ?? tagText(html, "title");
  const manufacturer = brand ?? labelled(lines, LABELS.manufacturer);
  const setNumber = str(ld?.sku) ?? str(ld?.mpn) ?? labelled(lines, LABELS.setNumber);
  const pieceCount = toPieceCount(labelled(lines, LABELS.pieceCount));
  const image = metaContent(html, "og:image") ?? ldImage;

  if (name) fields.name = name;
  if (manufacturer) fields.manufacturer = manufacturer;
  if (setNumber) fields.setNumber = setNumber;
  if (pieceCount !== undefined) fields.pieceCount = pieceCount;
  if (image) {
    try {
      fields.imageUrl = new URL(image, pageUrl).href;
    } catch {
      // no usable address
    }
  }

  const labels = [...new Set(lines.flatMap((line) => /^([^:]{2,30}):/.exec(line)?.[1] ?? []))];
  return { fields, labels: labels.slice(0, 40) };
}
