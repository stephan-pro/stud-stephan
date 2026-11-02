// The objects of the collection (ANFORDERUNGEN.md section 3). Plain data without behaviour;
// the rules live in the other files of `src/domain/`.
// Money is always whole cents (1250 = 12,50 €), days are "YYYY-MM-DD", points in time ISO 8601.

/** Version of this data shape; goes into every export (F15) and is checked on import. */
export const SCHEMA_VERSION = 1;

export type Id = string;
export type Cents = number;
/** A day, "YYYY-MM-DD". */
export type IsoDate = string;
/** A point in time, ISO 8601 ("2026-10-31T09:15:00Z"). */
export type Timestamp = string;

export type Condition = "new" | "used";

/** LEGO, Bluebrixx, another manufacturer or a custom shop (name free). */
export type Manufacturer =
  | { kind: "lego" }
  | { kind: "bluebrixx" }
  | { kind: "other"; name: string }
  | { kind: "custom"; name: string };

export type ManufacturerKind = Manufacturer["kind"];

/** A value Stephan estimated himself ("Wert (selbst geschätzt)") and the day he entered it. */
export interface ManualValue {
  cents: Cents;
  enteredOn: IsoDate;
}

/** A point of a photo in percent from its top left corner, whole numbers from 0 to 100. */
export interface PhotoFocus {
  x: number;
  y: number;
}

/** Fields shared by minifigs, sets and special parts. */
interface ItemBase {
  id: Id;
  name: string;
  manufacturer: Manufacturer;
  /** Thema/Reihe, e.g. "Star Wars – The Clone Wars"; the part before " – " is the main theme. */
  theme?: string;
  condition: Condition;
  /** Where it was bought: free text or a link. */
  source?: string;
  acquiredOn?: IsoDate;
  purchasePrice?: Cents;
  manualValue?: ManualValue;
  /** Paths of own photos in storage, in order; the first one is the cover. */
  photos: string[];
  /** The part of a photo to show where it fills a box, by path; none means the middle. */
  photoFocus?: Record<string, PhotoFocus>;
  catalogImageUrl?: string;
  /** Links kept at the object (F3), e.g. the Rebrickable or SetDB page. */
  links: string[];
  note?: string;
  createdAt: Timestamp;
}

export type ModPosition =
  | "head"
  | "torso"
  | "arms"
  | "hands"
  | "legs"
  | "headgear"
  | "accessory"
  | "other";

/** A swapped part of a minifig (F6). Its price never counts towards the value of the figure. */
export interface ModPart {
  id: Id;
  position: ModPosition;
  description: string;
  vendor?: string;
  url?: string;
  price?: Cents;
  /** Where the original part went, free text ("in der Teilekiste"). */
  originalPart?: string;
}

/** "Stammt aus Set": what the catalog says, optionally linked to a set of the own collection. */
export interface FromSet {
  label?: string;
  setId?: Id;
}

/** One copy of a minifig; every copy is its own entry (F5). */
export interface Minifig extends ItemBase {
  type: "minifig";
  /**
   * BrickLink number ("sw0194"), the id of every official figure for recognition, catalog and
   * price (UMSETZUNG.md section 1). Customs and other manufacturers have none.
   */
  bricklinkId?: string;
  fromSet?: FromSet;
  mods: ModPart[];
  /** The one diorama the figure stands in (F8); none if missing. */
  dioramaId?: Id;
}

/** A figure as the BrickLink catalog lists it: in a set (F7) or in a series (F13). */
export interface CatalogFigure {
  name: string;
  bricklinkId?: string;
  imageUrl?: string;
  quantity?: number;
}

export type SetStatus = "complete" | "figuresRemoved" | "disassembled";

export interface LegoSet extends ItemBase {
  type: "legoSet";
  /** "75372-1", the same at Rebrickable and BrickLink; Bluebrixx and others have their own. */
  setNumber?: string;
  year?: number;
  pieceCount?: number;
  minifigCount?: number;
  status: SetStatus;
  containedFigures: CatalogFigure[];
}

export type SpecialPartKind = "gwp" | "coin" | "other";

export interface SpecialPart extends ItemBase {
  type: "specialPart";
  kind: SpecialPartKind;
  /** Optional; for LEGO the BrickLink number, which then gives the market value. */
  number?: string;
}

/** A Studio file (`.io`) stored at a diorama. */
export interface StudioFile {
  id: Id;
  fileName: string;
  sizeBytes: number;
  uploadedAt: Timestamp;
  /** Path in storage. */
  path: string;
}

export interface Diorama {
  type: "diorama";
  id: Id;
  name: string;
  photos: string[];
  photoFocus?: Record<string, PhotoFocus>;
  links: string[];
  pieceCount?: number;
  /** MOCs have no market value; Stephan may estimate one (F10). */
  manualValue?: ManualValue;
  studioFiles: StudioFile[];
  note?: string;
  createdAt: Timestamp;
}

export type Priority = "high" | "medium" | "low";

export interface WishItem {
  id: Id;
  type: "minifig" | "legoSet";
  name: string;
  /** For a wished figure. */
  bricklinkId?: string;
  /** For a wished set. */
  setNumber?: string;
  manufacturer: Manufacturer;
  theme?: string;
  priority: Priority;
  targetPrice?: Cents;
  desiredCondition: Condition;
  imageUrl?: string;
  links: string[];
  /** The series it was wished from (F13), e.g. "Star Wars – The Clone Wars". */
  fromSeries?: string;
  note?: string;
  createdAt: Timestamp;
}

/** Objects that can have a BrickLink market value. */
export type PricedType = "minifig" | "legoSet" | "specialPart";

/** One price run's result for one catalog item: new and used in one point (F10). */
export interface PricePoint {
  itemType: PricedType;
  /** BrickLink item number: "sw0194" for a figure, "75372-1" for a set. */
  bricklinkId: string;
  date: IsoDate;
  source: "bricklink";
  /** Average sale price of the last 6 months; missing if nothing was sold. */
  cents: Partial<Record<Condition, Cents>>;
  /** Number of sales behind the average. */
  soldCount?: Partial<Record<Condition, number>>;
}

export interface Collection {
  schemaVersion: number;
  minifigs: Minifig[];
  sets: LegoSet[];
  specialParts: SpecialPart[];
  dioramas: Diorama[];
  wishlist: WishItem[];
  prices: PricePoint[];
}

/** What the showcase shows (F11); dioramas have their own page. */
export type ShowcaseItem = Minifig | LegoSet | SpecialPart;

/** What can be deleted with a way back (P6, P10). */
export type RemovableObject = ShowcaseItem | Diorama;
