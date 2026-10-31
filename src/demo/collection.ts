// Sample collection for `npm run demo` and the E2E tests, taken from the click dummy
// (docs/design/dummy/): Captain Rex with two mods, three Clone Troopers, the Battle Pack, the GWP
// coin, three dioramas and the wishlist. Smaller than the dummy's numbers (286 figures …).
// Catalog numbers are only given where they are certain; the rest is valued by purchase price.

import {
  type CatalogFigure,
  type Collection,
  type Diorama,
  type Minifig,
  type PricePoint,
  SCHEMA_VERSION,
} from "../domain/types";

/** "Today" of the demo: the day after the last price run. */
export const DEMO_TODAY = "2026-10-31";

const CLONE_WARS = "Star Wars – The Clone Wars";
const lego = { kind: "lego" } as const;
const bluebrixx = { kind: "bluebrixx" } as const;

const dioramas: Diorama[] = [
  {
    type: "diorama",
    id: "diorama-umbara",
    name: "Umbara-Gefecht",
    photos: [],
    links: ["https://rebrickable.com/mocs/"],
    pieceCount: 1240,
    studioFiles: [
      {
        id: "studio-umbara-3",
        fileName: "umbara-gefecht-v3.io",
        sizeBytes: 2_400_000,
        uploadedAt: "2026-10-12T19:30:00Z",
        path: "demo/umbara-gefecht-v3.io",
      },
      {
        id: "studio-umbara-2",
        fileName: "umbara-gefecht-v2.io",
        sizeBytes: 2_100_000,
        uploadedAt: "2026-08-28T18:00:00Z",
        path: "demo/umbara-gefecht-v2.io",
      },
    ],
    note: "Beleuchtung fehlt noch. Platz für zwei weitere Klone links.",
    createdAt: "2026-06-01T10:00:00Z",
  },
  {
    type: "diorama",
    id: "diorama-kamino",
    name: "Kamino-Hangar",
    photos: [],
    links: [],
    pieceCount: 2860,
    studioFiles: [],
    createdAt: "2026-04-10T10:00:00Z",
  },
  {
    type: "diorama",
    id: "diorama-burgtor",
    name: "Burgtor",
    photos: [],
    links: [],
    pieceCount: 780,
    studioFiles: [],
    createdAt: "2026-02-20T10:00:00Z",
  },
];

/** A figure with the fields most demo figures share. */
function figure(fields: Partial<Minifig> & Pick<Minifig, "id" | "name" | "createdAt">): Minifig {
  return {
    type: "minifig",
    manufacturer: lego,
    theme: CLONE_WARS,
    condition: "used",
    photos: [],
    links: [],
    mods: [],
    ...fields,
  };
}

const minifigs: Minifig[] = [
  figure({
    id: "minifig-rex",
    name: "Captain Rex",
    catalogNumber: "sw0194",
    source: "BrickLink-Händler",
    acquiredOn: "2025-03-14",
    purchasePrice: 2500,
    fromSet: { label: "einzeln gekauft" },
    dioramaId: "diorama-umbara",
    mods: [
      {
        id: "mod-rex-arms",
        position: "arms",
        description: "Bedruckt mit Phase-II-Markierungen",
        vendor: "Custom-Shop",
        price: 600,
        originalPart: "in der Teilekiste",
      },
      {
        id: "mod-rex-helmet",
        position: "headgear",
        description: "Helm mit Visier",
        vendor: "Custom-Shop",
        price: 850,
        originalPart: "in der Teilekiste",
      },
    ],
    note: "Steht ganz vorne im Diorama. Helm sitzt etwas locker.",
    createdAt: "2026-10-28T18:20:00Z",
  }),
  // Two copies come from the Battle Pack, the third was bought on its own.
  ...[1, 2, 3].map((copy) =>
    figure({
      id: `minifig-trooper-${copy}`,
      name: "Clone Trooper Phase II",
      catalogNumber: "sw0631",
      source: copy < 3 ? "LEGO Store Köln" : "Kleinanzeigen",
      acquiredOn: copy < 3 ? "2025-01-18" : "2026-10-02",
      fromSet:
        copy < 3
          ? { label: "75372-1 Clone Trooper & Battle Droid Battle Pack", setId: "set-75372" }
          : { label: "einzeln gekauft" },
      dioramaId: "diorama-umbara",
      createdAt: `2026-10-2${copy}T17:00:00Z`,
    }),
  ),
  figure({
    id: "minifig-fives",
    name: "ARC Trooper Fives",
    catalogNumber: "sw0542",
    source: "Kleinanzeigen",
    acquiredOn: "2026-09-30",
    purchasePrice: 1800,
    createdAt: "2026-10-20T12:00:00Z",
  }),
  figure({
    id: "minifig-appo",
    name: "Commander Appo",
    purchasePrice: 1800,
    dioramaId: "diorama-umbara",
    createdAt: "2026-07-02T10:00:00Z",
  }),
  figure({
    id: "minifig-umbaran",
    name: "Umbaraner",
    purchasePrice: 900,
    dioramaId: "diorama-umbara",
    createdAt: "2026-07-01T10:00:00Z",
  }),
  figure({
    id: "minifig-temple-guard",
    name: "Jedi-Tempelwache",
    theme: "Star Wars",
    manualValue: { cents: 1990, enteredOn: "2026-05-02" },
    purchasePrice: 1500,
    dioramaId: "diorama-kamino",
    createdAt: "2026-05-02T10:00:00Z",
  }),
  figure({
    id: "minifig-clone-commander",
    name: "Clone Commander",
    manualValue: { cents: 2280, enteredOn: "2026-04-12" },
    dioramaId: "diorama-kamino",
    createdAt: "2026-04-12T10:00:00Z",
  }),
  figure({
    id: "minifig-clone-pilot",
    name: "Clone Pilot",
    purchasePrice: 700,
    dioramaId: "diorama-kamino",
    createdAt: "2026-04-11T10:00:00Z",
  }),
  figure({
    id: "minifig-wookiee",
    name: "Wookiee-Krieger",
    theme: "Star Wars",
    purchasePrice: 1200,
    createdAt: "2026-03-08T10:00:00Z",
  }),
  figure({
    id: "minifig-burgwache",
    name: "Burgwache",
    manufacturer: bluebrixx,
    theme: "Ritter",
    condition: "new",
    purchasePrice: 400,
    dioramaId: "diorama-burgtor",
    createdAt: "2026-10-25T09:00:00Z",
  }),
  figure({
    id: "minifig-knight",
    name: "Ritter",
    manufacturer: bluebrixx,
    theme: "Ritter",
    condition: "new",
    dioramaId: "diorama-burgtor",
    note: "Kaufpreis vergessen.",
    createdAt: "2026-02-21T10:00:00Z",
  }),
  figure({
    id: "minifig-kai",
    name: "Kai",
    theme: "Ninjago – Staffel 1",
    purchasePrice: 350,
    createdAt: "2026-01-15T10:00:00Z",
  }),
  figure({
    id: "minifig-medic",
    name: "Clone Medic",
    manufacturer: { kind: "custom", name: "Clone Army Customs" },
    purchasePrice: 3500,
    createdAt: "2025-12-03T10:00:00Z",
  }),
];

/** Weekly price points, oldest first; the last run was on Tuesday 27.10.2026. */
function weekly(
  itemType: PricePoint["itemType"],
  catalogNumber: string,
  steps: PricePoint["cents"][],
): PricePoint[] {
  const last = Date.UTC(2026, 9, 27);
  return steps.map((cents, index) => ({
    itemType,
    catalogNumber,
    date: new Date(last - (steps.length - 1 - index) * 7 * 86_400_000).toISOString().slice(0, 10),
    source: "bricklink",
    cents,
  }));
}

const prices: PricePoint[] = [
  ...weekly("minifig", "sw0194", [
    { used: 3500, new: 4900 },
    { used: 3650, new: 5000 },
    { used: 3720, new: 5100 },
    { used: 3850, new: 5200 },
  ]),
  ...weekly("minifig", "sw0631", [
    { used: 600, new: 900 },
    { used: 620, new: 950 },
  ]),
  ...weekly("minifig", "sw0542", [
    { used: 2300, new: 3500 },
    { used: 2400, new: 3600 },
  ]),
  ...weekly("legoSet", "75372-1", [
    { used: 2050, new: 2700 },
    { used: 2100, new: 2750 },
  ]),
  ...weekly("minifig", "sw0196", [{ used: 1890, new: 2900 }]),
  ...weekly("minifig", "sw0219", [{ used: 4100, new: 6000 }]),
  ...weekly("legoSet", "75021-1", [{ used: 9900, new: 14999 }]),
  ...weekly("minifig", "sw0001", [{ used: 340, new: 800 }]),
];

export const DEMO_COLLECTION: Collection = {
  schemaVersion: SCHEMA_VERSION,
  minifigs,
  sets: [
    {
      type: "legoSet",
      id: "set-75372",
      name: "Clone Trooper & Battle Droid Battle Pack",
      catalogNumber: "75372-1",
      manufacturer: lego,
      theme: "Star Wars",
      year: 2024,
      pieceCount: 215,
      minifigCount: 4,
      condition: "used",
      status: "figuresRemoved",
      source: "LEGO Store Köln",
      acquiredOn: "2025-01-18",
      purchasePrice: 1999,
      containedFigures: [
        { name: "Clone Trooper", catalogNumber: "sw0631", quantity: 2 },
        { name: "Battle Droid", catalogNumber: "sw0001", quantity: 2 },
      ],
      photos: [],
      links: [],
      createdAt: "2026-10-26T16:00:00Z",
    },
  ],
  specialParts: [
    {
      type: "specialPart",
      id: "part-coin",
      kind: "gwp",
      name: "Sammelmünze",
      manufacturer: lego,
      theme: "Star Wars",
      condition: "new",
      source: "Beigabe zu einer Bestellung",
      acquiredOn: "2025-05-12",
      manualValue: { cents: 990, enteredOn: "2025-05-12" },
      photos: [],
      links: [],
      note: "Liegt in der Schublade unter der Vitrine.",
      createdAt: "2026-10-19T08:00:00Z",
    },
  ],
  dioramas,
  wishlist: [
    {
      id: "wish-cody",
      type: "minifig",
      name: "Commander Cody",
      catalogNumber: "sw0196",
      manufacturer: lego,
      theme: CLONE_WARS,
      priority: "medium",
      targetPrice: 2000,
      desiredCondition: "used",
      links: [],
      createdAt: "2026-09-01T10:00:00Z",
    },
    {
      id: "wish-ahsoka",
      type: "minifig",
      name: "Ahsoka Tano",
      catalogNumber: "sw0219",
      manufacturer: lego,
      theme: CLONE_WARS,
      priority: "high",
      targetPrice: 3000,
      desiredCondition: "used",
      links: [],
      createdAt: "2026-09-02T10:00:00Z",
    },
    {
      id: "wish-gunship",
      type: "legoSet",
      name: "Republic Gunship",
      catalogNumber: "75021-1",
      manufacturer: lego,
      theme: "Star Wars",
      priority: "medium",
      targetPrice: 12000,
      desiredCondition: "new",
      links: [],
      createdAt: "2026-09-03T10:00:00Z",
    },
    {
      id: "wish-battle-droid",
      type: "minifig",
      name: "Battle Droid",
      catalogNumber: "sw0001",
      manufacturer: lego,
      theme: CLONE_WARS,
      priority: "low",
      targetPrice: 300,
      desiredCondition: "used",
      links: [],
      fromSeries: CLONE_WARS,
      createdAt: "2026-09-04T10:00:00Z",
    },
  ],
  prices,
};

/** Part of the series "Star Wars – The Clone Wars" as the catalog would list it (S10a). */
export const DEMO_SERIES: { name: string; figures: CatalogFigure[] } = {
  name: CLONE_WARS,
  figures: [
    { name: "Captain Rex", catalogNumber: "sw0194" },
    { name: "Clone Trooper Phase II", catalogNumber: "sw0631" },
    { name: "ARC Trooper Fives", catalogNumber: "sw0542" },
    { name: "Commander Cody", catalogNumber: "sw0196" },
    { name: "Ahsoka Tano", catalogNumber: "sw0219" },
    { name: "Battle Droid", catalogNumber: "sw0001" },
    { name: "Plo Koon" },
    { name: "Asajj Ventress" },
  ],
};
