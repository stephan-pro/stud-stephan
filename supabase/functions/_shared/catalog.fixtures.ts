// Fake internet for the tests of the functions: answers in the shapes the documented APIs of
// BrickLink and Rebrickable send (as seen in P2), and a store in memory.

import type { CatalogStore } from "./catalogStore.ts";
import type { Fetch } from "./json.ts";

type Answer = () => Response;
export type Route = [match: string, answer: Answer];

/** A fake internet: the first route whose text is part of the address answers; every call is logged. */
export function fakeFetch(routes: Route[], log: string[] = []): Fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    log.push(`${init?.method ?? "GET"} ${url}`);
    const route = routes.find(([match]) => url.includes(match));
    return route ? route[1]() : new Response("not found", { status: 404 });
  }) as Fetch;
}

export const ok =
  (body: unknown, status = 200): Answer =>
  () =>
    Response.json(body, { status });

/** BrickLink wraps every answer: `meta` carries its own status, `data` the content. */
export const brickLink = (data: unknown, code = 200, message = "OK"): Answer =>
  ok({ meta: { code, message, description: message }, data });

export const brickLinkFailure = (code: number, message: string): Answer =>
  ok({ meta: { code, message, description: message } });

export const noSleep = async () => {};

export class MemoryStore implements CatalogStore {
  readonly values = new Map<string, { value: unknown; fetchedAt: string }>();
  readonly counts = new Map<string, number>();
  /** Calls of the service allowed per day in this fake. */
  broken = false;

  async read(key: string, notBefore: string) {
    const entry = this.values.get(key);
    return entry && entry.fetchedAt >= notBefore ? entry.value : undefined;
  }

  async write(key: string, value: unknown, now: string) {
    this.values.set(key, { value, fetchedAt: now });
  }

  async countCall(service: string, day: string, cap: number) {
    const key = `${service}:${day}`;
    const calls = this.counts.get(key) ?? 0;
    if (calls >= cap) return false;
    this.counts.set(key, calls + 1);
    return true;
  }
}

export const CREDENTIALS = {
  consumerKey: "ck",
  consumerSecret: "cs",
  tokenValue: "tv",
  tokenSecret: "ts",
};

// -- BrickLink -------------------------------------------------------------------------------

export const BL_REX = {
  no: "sw0194",
  name: "Captain Rex, Phase 2 Armor",
  type: "MINIFIG",
  category_id: 65,
  image_url: "//img.bricklink.com/ItemImage/MN/0/sw0194.png",
  thumbnail_url: "//img.bricklink.com/ItemImage/MT/0/sw0194.png",
  year_released: 2012,
};

export const BL_SET = {
  no: "75372-1",
  name: "Clone Trooper & Battle Droid Battle Pack",
  type: "SET",
  category_id: 65,
  image_url: "//img.bricklink.com/ItemImage/SN/0/75372-1.png",
  year_released: 2024,
};

export const BL_SUBSETS = [
  {
    match_no: 0,
    entries: [
      {
        item: {
          no: "sw1306",
          name: "Clone Trooper, 332nd Company",
          type: "MINIFIG",
          category_id: 65,
        },
        color_id: 0,
        quantity: 2,
      },
      {
        item: {
          no: "sw1307",
          name: "Clone Trooper, 501st Legion",
          type: "MINIFIG",
          category_id: 65,
        },
        color_id: 0,
        quantity: 1,
      },
      { item: { no: "3001", name: "Brick 2 x 4", type: "PART", category_id: 5 }, quantity: 4 },
    ],
  },
];

export const BL_SUPERSETS = [
  {
    color_id: 0,
    entries: [
      { item: { no: "75372-1", name: "Battle Pack", type: "SET", category_id: 65 }, quantity: 1 },
      {
        item: { no: "75345-1", name: "501st Battle Pack", type: "SET", category_id: 65 },
        quantity: 1,
      },
    ],
  },
];

// Special parts at BrickLink: gear, a (promotional) set or a book. Shaped like the documented item
// answers; the numbers and names of the set and the book are made up.
export const BL_GEAR = {
  no: "5010325",
  name: "The Mandalorian and Grogu Metal Card",
  type: "GEAR",
  category_id: 250,
  image_url: "//img.bricklink.com/ItemImage/GN/0/5010325.png",
  year_released: 2026,
};

export const BL_PROMO_SET = {
  no: "5008889-1",
  name: "Promo Polybag",
  type: "SET",
  category_id: 65,
  image_url: "//img.bricklink.com/ItemImage/SN/0/5008889-1.png",
  year_released: 2023,
};

export const BL_BOOK = {
  no: "5000001",
  name: "Sample Book",
  type: "BOOK",
  category_id: 251,
  year_released: 2019,
};

// A Big Fig: BrickLink lists the Rancor of 75005 "Rancor Pit" as a part of the category "Large
// Figure" (`P=11323pb01c01`), not as a minifig. Shaped like the documented answers; the category
// number and the picture address are made up.
export const BL_RANCOR = {
  no: "11323pb01c01",
  name: "Large Figure, Rancor",
  type: "PART",
  category_id: 1081,
  image_url: "//img.bricklink.com/ItemImage/PN/0/11323pb01c01.png",
  year_released: 2013,
};

export const BL_RANCOR_PIT = {
  no: "75005-1",
  name: "Rancor Pit",
  type: "SET",
  category_id: 65,
  image_url: "//img.bricklink.com/ItemImage/SN/0/75005-1.png",
  year_released: 2013,
};

/** The parts and minifigs of 75005: Luke, the Rancor (a Large Figure part) and an ordinary brick. */
export const BL_RANCOR_PIT_SUBSETS = [
  {
    match_no: 0,
    entries: [
      {
        item: { no: "sw0434", name: "Luke Skywalker", type: "MINIFIG", category_id: 65 },
        quantity: 1,
      },
      {
        item: { no: "11323pb01c01", name: "Large Figure, Rancor", type: "PART", category_id: 1081 },
        quantity: 1,
      },
      { item: { no: "3001", name: "Brick 2 x 4", type: "PART", category_id: 5 }, quantity: 12 },
    ],
  },
];

export const BL_RANCOR_SUPERSETS = [
  {
    color_id: 0,
    entries: [
      { item: { no: "75005-1", name: "Rancor Pit", type: "SET", category_id: 65 }, quantity: 1 },
    ],
  },
];

export const BL_CATEGORIES: Record<number, unknown> = {
  65: { category_id: 65, category_name: "The Clone Wars", parent_id: 7 },
  7: { category_id: 7, category_name: "Star Wars", parent_id: 0 },
  1081: { category_id: 1081, category_name: "Large Figure", parent_id: 0 },
  250: { category_id: 250, category_name: "Miscellaneous", parent_id: 249 },
  249: { category_id: 249, category_name: "Gear", parent_id: 0 },
  251: { category_id: 251, category_name: "Books", parent_id: 0 },
};

/** The routes of a working BrickLink with the data above. */
export function brickLinkRoutes(): Route[] {
  return [
    ["/items/MINIFIG/sw0194/supersets", brickLink(BL_SUPERSETS)],
    ["/items/MINIFIG/sw0194", brickLink(BL_REX)],
    ["/items/SET/75372-1/subsets", brickLink(BL_SUBSETS)],
    ["/items/SET/75372-1", brickLink(BL_SET)],
    ["/items/MINIFIG/sw1306/supersets", brickLink([])],
    [
      "/items/MINIFIG/sw1306",
      brickLink({ ...BL_REX, no: "sw1306", name: "Clone Trooper, 332nd Company" }),
    ],
    ["/items/PART/11323pb01c01/supersets", brickLink(BL_RANCOR_SUPERSETS)],
    ["/items/PART/11323pb01c01", brickLink(BL_RANCOR)],
    ["/items/SET/75005-1/subsets", brickLink(BL_RANCOR_PIT_SUBSETS)],
    ["/items/SET/75005-1", brickLink(BL_RANCOR_PIT)],
    ["/items/GEAR/5010325", brickLink(BL_GEAR)],
    ["/items/SET/5008889-1", brickLink(BL_PROMO_SET)],
    ["/items/BOOK/5000001", brickLink(BL_BOOK)],
    ["/categories/65", brickLink(BL_CATEGORIES[65])],
    ["/categories/7", brickLink(BL_CATEGORIES[7])],
    ["/categories/250", brickLink(BL_CATEGORIES[250])],
    ["/categories/249", brickLink(BL_CATEGORIES[249])],
    ["/categories/251", brickLink(BL_CATEGORIES[251])],
    ["/categories/1081", brickLink(BL_CATEGORIES[1081])],
    // The whole category list (no number after the slash): it must stay behind the ones above.
    ["/categories", brickLink(Object.values(BL_CATEGORIES))],
    ["/items/MINIFIG/", brickLinkFailure(404, "RESOURCE_NOT_FOUND")],
    ["/items/PART/", brickLinkFailure(404, "RESOURCE_NOT_FOUND")],
    ["/items/SET/", brickLinkFailure(404, "RESOURCE_NOT_FOUND")],
    ["/items/GEAR/", brickLinkFailure(404, "RESOURCE_NOT_FOUND")],
    ["/items/BOOK/", brickLinkFailure(404, "RESOURCE_NOT_FOUND")],
  ];
}

// -- Rebrickable -----------------------------------------------------------------------------

export const RB_SET = {
  set_num: "75372-1",
  name: "Clone Trooper & Battle Droid Battle Pack",
  year: 2024,
  theme_id: 158,
  num_parts: 215,
  set_img_url: "https://cdn.rebrickable.com/media/sets/75372-1.jpg",
};

export const RB_FIGS = [
  {
    set_num: "fig-014663",
    name: "Clone Trooper, 332nd Company",
    num_parts: 4,
    set_img_url: "https://cdn.rebrickable.com/media/minifigs/fig-014663.jpg",
  },
  { set_num: "fig-000001", name: "Unknown Person", num_parts: 4, set_img_url: null },
];

export function rebrickableRoutes(): Route[] {
  return [
    ["/sets/?", ok({ count: 1, results: [RB_SET] })],
    ["/sets/75372-1/", ok(RB_SET)],
    ["/minifigs/?", ok({ count: 2, results: RB_FIGS })],
    ["/minifigs/fig-014663/sets/", ok({ results: [{ set_num: "75372-1" }] })],
    ["/minifigs/fig-014663/", ok(RB_FIGS[0])],
    ["/minifigs/fig-000001/sets/", ok({ results: [{ set_num: "75372-1" }] })],
    ["/minifigs/fig-000001/", ok(RB_FIGS[1])],
    ["/themes/158/", ok({ id: 158, name: "Battle Packs", parent_id: 18 })],
    ["/themes/18/", ok({ id: 18, name: "Star Wars", parent_id: null })],
  ];
}
