// BrickLink Store API v1: item by number, the minifigs in a set (subsets), the sets a minifig comes
// in (supersets), categories (P7) and the price guide (P11). BrickLink puts its own status into
// `meta.code`, also on HTTP 200.

import {
  CatalogError,
  decodeEntities,
  type Fetch,
  isRecord,
  type Json,
  list,
  num,
  secureUrl,
  str,
  toCents,
  year,
} from "./json.ts";
import { type OAuthCredentials, oauthHeader } from "./oauth.ts";

const BASE = "https://api.bricklink.com/api/store/v1";
/** How long one BrickLink call may take. */
const CALL_TIMEOUT_MS = 20_000;

/**
 * Minifigs and sets, parts for Big Figs ("Large Figure" parts such as the Rancor of 75005), and gear
 * and books for special parts (GWP, Insiders rewards).
 */
export type ItemType = "MINIFIG" | "PART" | "SET" | "GEAR" | "BOOK";

/**
 * What makes a part of a set a Big Fig (a figure BrickLink lists as a part, checked against the
 * real answer for 75005 "Rancor Pit", where the Rancor is `11323pb01c01` in the category "Animal,
 * Land" and not in "Large Figure"): its number is a printed, assembled part (`pb…c…`), and its
 * category is an animal or a large figure. The number alone is not enough (the torso assemblies of
 * minifigs are `973pb…c01`), the category alone neither (horses and heads are animals and figure
 * parts without a print and assembly in the number).
 */
const ASSEMBLED_PRINTED = /pb\d+c\d+$/i;
const BIG_FIG_CATEGORY = /^(animal|large figure)/i;

export interface BricklinkItem {
  number: string;
  name: string;
  year?: number;
  categoryId?: number;
  imageUrl?: string;
}

export interface BricklinkEntry {
  number: string;
  name: string;
  quantity: number;
  imageUrl?: string;
  /** `PART` for a Big Fig among the minifigs of a set; none for a minifig. */
  bricklinkType?: "PART";
}

export interface BricklinkCategory {
  name: string;
  parentId?: number;
}

/** The price guide in one condition: average sale price of the last 6 months in EUR. */
export interface BricklinkPrice {
  /** Missing if nothing was sold. */
  cents?: number;
  /** Pieces sold behind the average. */
  soldCount: number;
}

export interface BricklinkClient {
  item(type: ItemType, number: string): Promise<BricklinkItem>;
  /** The figures in a set: minifigs and Big Figs. */
  minifigsOfSet(setNumber: string): Promise<BricklinkEntry[]>;
  /**
   * What a set holds in one call: its figures and its sets. Figures are the minifigs and the Big
   * Figs (parts of the category "Large Figure", marked `bricklinkType: "PART"`). Collectible
   * minifigure series hold one set per figure ("coltlbm-1"), and only that set holds the minifig
   * (P12).
   */
  contentsOfSet(setNumber: string): Promise<{ minifigs: BricklinkEntry[]; sets: BricklinkEntry[] }>;
  /** The sets a minifig comes in. */
  setsOfMinifig(number: string): Promise<BricklinkEntry[]>;
  /** The sets an item (a minifig or a Big Fig part) comes in. */
  setsOf(type: "MINIFIG" | "PART", number: string): Promise<BricklinkEntry[]>;
  category(id: number): Promise<BricklinkCategory>;
  /** Price guide "sold", last 6 months, EUR (as checked in P2). */
  price(type: ItemType, number: string, condition: "new" | "used"): Promise<BricklinkPrice>;
}

export interface BricklinkOptions {
  readonly fetch: Fetch;
  readonly credentials: OAuthCredentials;
  /** Called before every request to BrickLink (counts the day's calls, may throw). */
  readonly beforeCall?: () => Promise<void>;
  readonly nonce?: () => string;
  readonly timestamp?: () => string;
}

/** The picture of a minifig in the BrickLink catalog (the lists do not carry one). */
export function minifigImage(number: string): string {
  return `https://img.bricklink.com/ItemImage/MN/0/${encodeURIComponent(number)}.png`;
}

/** Turns BrickLink's status into the error the app can word. */
function failureOf(httpStatus: number, body: unknown): CatalogError | undefined {
  const meta = isRecord(body) && isRecord(body.meta) ? body.meta : {};
  const code = num(meta.code) ?? httpStatus;
  if (code === 200 || code === 201) return undefined;
  const text = [str(meta.message), str(meta.description)].filter(Boolean).join(" – ");
  if (code === 404) return new CatalogError("not_found", `BrickLink: nicht gefunden (${text})`);
  if (code === 429) return new CatalogError("limit_reached", "BrickLink: zu viele Abfragen");
  return new CatalogError("unavailable", `BrickLink: Code ${code} ${text}`.trim());
}

/** Whether an item of a list is a part that looks like a Big Fig by its number (still to be checked by its category). */
function looksLikeBigFig(item: Json): boolean {
  return item.type === "PART" && ASSEMBLED_PRINTED.test(str(item.no) ?? "");
}

/** The categories of the parts that look like Big Figs: what is worth looking up. */
function bigFigCategoryIds(data: unknown): Set<number> {
  const ids = new Set<number>();
  for (const group of list(data)) {
    if (!isRecord(group)) continue;
    for (const entry of list(group.entries)) {
      if (!isRecord(entry) || !isRecord(entry.item) || !looksLikeBigFig(entry.item)) continue;
      const id = num(entry.item.category_id);
      if (id !== undefined) ids.add(id);
    }
  }
  return ids;
}

/**
 * The entries of one item type in the lists of BrickLink's subsets and supersets, each number once
 * with its quantities added. With `accept` only the items it accepts count.
 */
function entriesOf(
  data: unknown,
  wanted: ItemType,
  accept?: (item: Json) => boolean,
): BricklinkEntry[] {
  const found = new Map<string, BricklinkEntry>();
  for (const group of list(data)) {
    if (!isRecord(group)) continue;
    for (const entry of list(group.entries)) {
      if (!isRecord(entry) || !isRecord(entry.item) || entry.item.type !== wanted) continue;
      if (accept && !accept(entry.item)) continue;
      const number = str(entry.item.no);
      const rawName = str(entry.item.name);
      const name = rawName === undefined ? undefined : decodeEntities(rawName);
      if (number === undefined || name === undefined) continue;
      const quantity = num(entry.quantity) ?? 1;
      const known = found.get(number);
      if (known) known.quantity += quantity;
      else {
        found.set(number, {
          number,
          name,
          quantity,
          ...(wanted === "PART" ? { bricklinkType: "PART" as const } : {}),
        });
      }
    }
  }
  return [...found.values()];
}

export function createBricklink(options: BricklinkOptions): BricklinkClient {
  const nonce = options.nonce ?? (() => crypto.randomUUID().replaceAll("-", ""));
  const timestamp = options.timestamp ?? (() => String(Math.floor(Date.now() / 1000)));

  async function get(path: string, params: Record<string, string> = {}): Promise<unknown> {
    await options.beforeCall?.();
    const url = `${BASE}${path}`;
    const header = await oauthHeader("GET", url, params, options.credentials, nonce(), timestamp());
    const query = Object.keys(params).length > 0 ? `?${new URLSearchParams(params)}` : "";
    let response: Response;
    try {
      response = await options.fetch(`${url}${query}`, {
        headers: { Authorization: header, Accept: "application/json" },
        // A hanging answer must not use up the time of the function (price run: many calls).
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      });
    } catch (error) {
      throw new CatalogError("unavailable", `BrickLink nicht erreichbar: ${String(error)}`);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new CatalogError("unavailable", `BrickLink: HTTP ${response.status}, kein JSON`);
    }
    const failure = failureOf(response.status, body);
    if (failure) throw failure;
    return isRecord(body) ? body.data : undefined;
  }

  async function loadCategory(id: number): Promise<BricklinkCategory> {
    const data = await get(`/categories/${id}`);
    const name = isRecord(data) ? str(data.category_name) : undefined;
    if (!isRecord(data) || name === undefined) {
      throw new CatalogError("unavailable", "BrickLink: Kategorie ohne Namen");
    }
    const parentId = num(data.parent_id);
    return parentId ? { name, parentId } : { name };
  }

  // The names of categories asked for a set's parts, once each per client (a failure is not kept).
  const categoryNames = new Map<number, Promise<string>>();
  function nameOfCategory(id: number): Promise<string> {
    let known = categoryNames.get(id);
    if (!known) {
      known = loadCategory(id).then((category) => category.name);
      known.catch(() => categoryNames.delete(id));
      categoryNames.set(id, known);
    }
    return known;
  }

  const enc = encodeURIComponent;
  return {
    async item(type, number) {
      const data = await get(`/items/${type}/${enc(number)}`);
      if (!isRecord(data)) throw new CatalogError("unavailable", "BrickLink: unerwartete Antwort");
      const rawName = str(data.name);
      if (rawName === undefined)
        throw new CatalogError("not_found", "BrickLink: Eintrag ohne Namen");
      const name = decodeEntities(rawName);
      const item: BricklinkItem = { number: str(data.no) ?? number, name };
      const released = year(data.year_released);
      const categoryId = num(data.category_id);
      const imageUrl = secureUrl(data.image_url) ?? secureUrl(data.thumbnail_url);
      if (released !== undefined) item.year = released;
      if (categoryId !== undefined) item.categoryId = categoryId;
      if (imageUrl !== undefined) item.imageUrl = imageUrl;
      return item;
    },

    async minifigsOfSet(setNumber) {
      return (await this.contentsOfSet(setNumber)).minifigs;
    },

    async contentsOfSet(setNumber) {
      const data = await get(`/items/SET/${enc(setNumber)}/subsets`, {
        break_minifigs: "false",
        break_build: "false",
      });
      const minifigs: BricklinkEntry[] = entriesOf(data, "MINIFIG").map((entry) => ({
        ...entry,
        imageUrl: minifigImage(entry.number),
      }));
      // Big Figs are parts that look like assembled, printed figures (the Rancor of 75005 is
      // "11323pb01c01") in an animal or large figure category. Only the categories of such parts are
      // looked up, one call each (the torso assemblies "973pb…c01" are in one category: one call).
      // They have no picture in the lists.
      const wanted = new Set<number>();
      for (const id of bigFigCategoryIds(data)) {
        if (BIG_FIG_CATEGORY.test((await nameOfCategory(id)).trim())) wanted.add(id);
      }
      if (wanted.size > 0) {
        minifigs.push(
          ...entriesOf(
            data,
            "PART",
            (item) => looksLikeBigFig(item) && wanted.has(num(item.category_id) ?? -1),
          ),
        );
      }
      return { minifigs, sets: entriesOf(data, "SET") };
    },

    async setsOfMinifig(number) {
      return this.setsOf("MINIFIG", number);
    },

    async setsOf(type, number) {
      return entriesOf(await get(`/items/${type}/${enc(number)}/supersets`), "SET");
    },

    category: loadCategory,

    async price(type, number, condition) {
      const data = await get(`/items/${type}/${enc(number)}/price`, {
        guide_type: "sold",
        new_or_used: condition === "new" ? "N" : "U",
        currency_code: "EUR",
      });
      if (!isRecord(data)) throw new CatalogError("unavailable", "BrickLink: Preis ohne Daten");
      const currency = str(data.currency_code);
      if (currency !== undefined && currency !== "EUR") {
        throw new CatalogError("unavailable", `BrickLink: Preis in ${currency} statt EUR`);
      }
      const soldCount = num(data.total_quantity) ?? 0;
      const cents = toCents(data.avg_price);
      // Without a sale BrickLink answers an average of 0.
      return soldCount > 0 && cents !== undefined && cents > 0
        ? { cents, soldCount }
        : { soldCount: 0 };
    },
  };
}
