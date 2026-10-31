// Small builders for the unit tests: a valid object with defaults, changed only where a test cares.

import {
  type Collection,
  type Diorama,
  type LegoSet,
  type Minifig,
  type PricedType,
  type PricePoint,
  SCHEMA_VERSION,
  type SpecialPart,
  type WishItem,
} from "./types";

let next = 0;
const id = (prefix: string) => `${prefix}-${++next}`;

export function aMinifig(fields: Partial<Minifig> = {}): Minifig {
  return {
    type: "minifig",
    id: id("minifig"),
    name: "Captain Rex",
    catalogNumber: "sw0194",
    manufacturer: { kind: "lego" },
    theme: "Star Wars – The Clone Wars",
    condition: "used",
    photos: [],
    links: [],
    mods: [],
    createdAt: "2026-10-01T10:00:00Z",
    ...fields,
  };
}

export function aSet(fields: Partial<LegoSet> = {}): LegoSet {
  return {
    type: "legoSet",
    id: id("set"),
    name: "Clone Trooper & Battle Droid Battle Pack",
    catalogNumber: "75372-1",
    manufacturer: { kind: "lego" },
    theme: "Star Wars",
    condition: "used",
    status: "complete",
    containedFigures: [],
    photos: [],
    links: [],
    createdAt: "2026-10-01T10:00:00Z",
    ...fields,
  };
}

export function aSpecialPart(fields: Partial<SpecialPart> = {}): SpecialPart {
  return {
    type: "specialPart",
    id: id("part"),
    kind: "coin",
    name: "Sammelmünze",
    manufacturer: { kind: "lego" },
    condition: "new",
    photos: [],
    links: [],
    createdAt: "2026-10-01T10:00:00Z",
    ...fields,
  };
}

export function aDiorama(fields: Partial<Diorama> = {}): Diorama {
  return {
    type: "diorama",
    id: id("diorama"),
    name: "Umbara-Gefecht",
    photos: [],
    links: [],
    studioFiles: [],
    createdAt: "2026-10-01T10:00:00Z",
    ...fields,
  };
}

export function aWish(fields: Partial<WishItem> = {}): WishItem {
  return {
    id: id("wish"),
    type: "minifig",
    name: "Commander Cody",
    catalogNumber: "sw0196",
    manufacturer: { kind: "lego" },
    priority: "medium",
    desiredCondition: "used",
    links: [],
    createdAt: "2026-10-01T10:00:00Z",
    ...fields,
  };
}

export function aPrice(
  catalogNumber: string,
  date: string,
  cents: PricePoint["cents"],
  itemType: PricedType = "minifig",
): PricePoint {
  return { itemType, catalogNumber, date, source: "bricklink", cents };
}

export function aCollection(parts: Partial<Collection> = {}): Collection {
  return {
    schemaVersion: SCHEMA_VERSION,
    minifigs: [],
    sets: [],
    specialParts: [],
    dioramas: [],
    wishlist: [],
    prices: [],
    ...parts,
  };
}
