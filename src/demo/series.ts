// A few example themes for the demo and the end-to-end tests (`FakeSeriesBuilder`), after the click
// dummy (Reihen.dc.html, Reihe.dc.html). Not the real catalog: numbers and names are examples; the
// figures of "Star Wars – The Clone Wars" are the ones of the example collection (`DEMO_SERIES`).

import type { FakeSeriesCatalog } from "../backend/fakeSeriesBuilder";
import type { SeriesFigureInfo } from "../backend/seriesBuilder";

const MN = "https://img.bricklink.com/ItemImage/MN/0/";

const figure = (number: string, name: string): SeriesFigureInfo => ({
  number,
  name,
  imageUrl: `${MN}${number}.png`,
});

/** A theme with this many sets and no figures: only the warning before creating it needs it. */
const MANY_SETS = Array.from({ length: 320 }, (_, index) => `9${String(index).padStart(3, "0")}-1`);

export const DEMO_SERIES_CATALOG: FakeSeriesCatalog = {
  themes: [
    {
      id: 1,
      name: "Star Wars – The Clone Wars",
      sets: ["75372-1", "75345-1", "7675-1", "75021-1"],
    },
    {
      id: 2,
      name: "Collectible Minifigures – The LEGO Batman Movie Series",
      sets: ["71017-1", "71017-2"],
    },
    { id: 3, name: "Ninjago – Alle Staffeln", sets: MANY_SETS },
  ],
  figuresOfSet: {
    "75372-1": [figure("sw0194", "Captain Rex"), figure("sw0631", "Clone Trooper Phase II")],
    "75345-1": [figure("sw0542", "ARC Trooper Fives"), figure("sw0196", "Commander Cody")],
    "7675-1": [figure("sw0219", "Ahsoka Tano"), figure("sw0001", "Battle Droid")],
    "75021-1": [figure("sw0225", "Plo Koon"), figure("sw0333", "Asajj Ventress")],
    "71017-1": [figure("coltlbm01", "Batman"), figure("coltlbm02", "Robin")],
    "71017-2": [figure("coltlbm03", "The Joker"), figure("coltlbm04", "Harley Quinn")],
  },
};
