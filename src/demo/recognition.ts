// What the demo and the end-to-end tests "recognize" (`FakeRecognizer`), after the click dummy
// (Foto.dc.html): three suggestions for a figure, the first one sure. The numbers are in
// `DEMO_CATALOG`, so a pick opens a filled form. A set photo finds the Rancor Pit and the battle
// pack, a special part photo the metal card of the catalog; a figure photo that the
// service knows only as a part (the Rancor, a Big Fig) is answered with it on the control "bigFig".

import type { RecognizeKind, Suggestion } from "../backend/recognition";

const MN = "https://img.bricklink.com/ItemImage/MN/0/";
const SN = "https://img.bricklink.com/ItemImage/SN/0/";

export const DEMO_SUGGESTIONS: readonly Suggestion[] = [
  { number: "sw0194", name: "Captain Rex", score: 0.92, imageUrl: `${MN}sw0194.png` },
  { number: "sw0631", name: "Clone Trooper Phase II", score: 0.61, imageUrl: `${MN}sw0631.png` },
  { number: "sw0634", name: "Clone Pilot", score: 0.44 },
];

export const DEMO_SET_SUGGESTIONS: readonly Suggestion[] = [
  { number: "75005-1", name: "Rancor Pit", score: 0.88, imageUrl: `${SN}75005-1.png` },
  { number: "75372-1", name: "Clone Trooper & Battle Droid Battle Pack", score: 0.35 },
];

export const DEMO_SPECIAL_PART_SUGGESTIONS: readonly Suggestion[] = [
  {
    number: "5010325",
    name: "The Mandalorian and Grogu Metal Card",
    score: 0.31,
    ref: "GEAR:5010325",
  },
];

/** What the service answers for a figure photo it knows only as a part: the Rancor, a Big Fig. */
export const DEMO_BIG_FIG_SUGGESTIONS: readonly Suggestion[] = [
  {
    number: "11323pb01c01",
    name: "Large Figure, Rancor",
    score: 0.4,
    ref: "PART:11323pb01c01",
    bricklinkType: "PART",
  },
];

export const DEMO_RECOGNITION = {
  minifig: DEMO_SUGGESTIONS,
  legoSet: DEMO_SET_SUGGESTIONS,
  specialPart: DEMO_SPECIAL_PART_SUGGESTIONS,
  /** Told by the control `"bigFig"` (the fake build reads it from the device's storage). */
  bigFig: DEMO_BIG_FIG_SUGGESTIONS,
} satisfies Record<RecognizeKind | "bigFig", readonly Suggestion[]>;
