// A few catalog entries for the demo and the end-to-end tests (`FakeCatalog`), after the click
// dummy (Suche.dc.html, Formular.dc.html). Not the real catalog: numbers and names are examples.

import type { CatalogItem } from "../backend/catalog";

const MN = "https://img.bricklink.com/ItemImage/MN/0/";

export const DEMO_CATALOG: readonly CatalogItem[] = [
  {
    kind: "minifig",
    number: "sw0194",
    name: "Captain Rex",
    year: 2012,
    theme: "Star Wars – The Clone Wars",
    imageUrl: `${MN}sw0194.png`,
    sets: [{ number: "75372-1", name: "Clone Trooper & Battle Droid Battle Pack" }],
  },
  {
    kind: "minifig",
    number: "sw0631",
    name: "Clone Trooper Phase II",
    year: 2015,
    theme: "Star Wars – The Clone Wars",
    imageUrl: `${MN}sw0631.png`,
    sets: [
      { number: "75372-1", name: "Clone Trooper & Battle Droid Battle Pack" },
      { number: "75345-1", name: "501st Clone Troopers Battle Pack" },
    ],
  },
  {
    kind: "minifig",
    number: "sw0632",
    name: "Clone Trooper Phase II, 501st",
    year: 2015,
    theme: "Star Wars – The Clone Wars",
  },
  {
    kind: "minifig",
    number: "sw0634",
    name: "Clone Pilot",
    year: 2015,
    theme: "Star Wars – The Clone Wars",
  },
  {
    kind: "minifig",
    number: "sw0636",
    name: "Clone Gunner",
    year: 2015,
    theme: "Star Wars – The Clone Wars",
  },
  {
    kind: "legoSet",
    number: "75372-1",
    name: "Clone Trooper & Battle Droid Battle Pack",
    year: 2024,
    theme: "Star Wars – Battle Packs",
    pieceCount: 215,
    imageUrl: "https://img.bricklink.com/ItemImage/SN/0/75372-1.png",
    figures: [
      { number: "sw1306", name: "Clone Trooper, 332nd Company", quantity: 2 },
      { number: "sw1307", name: "Battle Droid, Security", quantity: 2 },
      { number: "sw1308", name: "Commander Bly", quantity: 1 },
    ],
  },
  // A Big Fig: BrickLink lists the Rancor of 75005 as a part ("Large Figure"), not as a minifig.
  {
    kind: "minifig",
    number: "11323pb01c01",
    bricklinkType: "PART",
    name: "Large Figure, Rancor",
    year: 2013,
    theme: "Large Figure",
    sets: [{ number: "75005-1", name: "Rancor Pit" }],
  },
  {
    kind: "legoSet",
    number: "75005-1",
    name: "Rancor Pit",
    year: 2013,
    theme: "Star Wars – Episode 6",
    pieceCount: 380,
    figures: [
      { number: "sw0434", name: "Luke Skywalker", quantity: 1 },
      { number: "11323pb01c01", name: "Large Figure, Rancor", quantity: 1, bricklinkType: "PART" },
    ],
  },
  {
    kind: "legoSet",
    number: "75345-1",
    name: "501st Clone Troopers Battle Pack",
    year: 2022,
    theme: "Star Wars – Battle Packs",
    pieceCount: 119,
    figures: [{ number: "sw1195", name: "Clone Trooper, 501st Legion", quantity: 4 }],
  },
  // Special parts: BrickLink knows them as gear, set or book, and the catalog finds them by number.
  {
    kind: "specialPart",
    number: "5010325",
    bricklinkType: "GEAR",
    name: "The Mandalorian and Grogu Metal Card",
    year: 2026,
    theme: "Gear – Miscellaneous",
    imageUrl: "https://img.bricklink.com/ItemImage/GN/0/5010325.png",
  },
  {
    kind: "specialPart",
    number: "5008889-1",
    bricklinkType: "SET",
    name: "Promo-Set (Beispiel)",
    year: 2023,
    theme: "Star Wars",
  },
];
