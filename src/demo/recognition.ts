// What the demo and the end-to-end tests "recognize" (`FakeRecognizer`), after the click dummy
// (Foto.dc.html): three suggestions, the first one sure. All three are in `DEMO_CATALOG`, so a
// pick opens a filled form.

import type { Suggestion } from "../backend/recognition";

const MN = "https://img.bricklink.com/ItemImage/MN/0/";

export const DEMO_SUGGESTIONS: readonly Suggestion[] = [
  { number: "sw0194", name: "Captain Rex", score: 0.92, imageUrl: `${MN}sw0194.png` },
  { number: "sw0631", name: "Clone Trooper Phase II", score: 0.61, imageUrl: `${MN}sw0631.png` },
  { number: "sw0634", name: "Clone Pilot", score: 0.44 },
];
