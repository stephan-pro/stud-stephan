// What the demo and the end-to-end tests "read" from pasted links (`FakeLinkPreviewer`), after the
// click dummy (Link.dc.html). Rebrickable and BrickLink addresses need no entry here: the fake reads
// the number from the address like the real function and the example catalog (`DEMO_CATALOG`)
// answers for it.

import type { LinkAnswer } from "../backend/linkPreview";

export const MERLIN_LINK = "https://www.merlinssteine.de/sets/bluebrixx-110374/";
export const SHOP_LINK = "https://shop.example.com/burgtor";
export const EMPTY_PAGE_LINK = "https://shop.example.com/leer";

export const DEMO_LINK_PAGES: Readonly<Record<string, LinkAnswer>> = {
  // As in the dummy: name, manufacturer, piece count and picture found, the set number not.
  [MERLIN_LINK]: {
    kind: "page",
    source: "merlin",
    fields: {
      name: "Burgtor mit Zugbrücke",
      manufacturer: "BlueBrixx",
      pieceCount: 1520,
      imageUrl: "https://www.merlinssteine.de/media/sets/bluebrixx-110374.jpg",
    },
  },
  // A shop or an MOC page gives title and picture only.
  [SHOP_LINK]: {
    kind: "page",
    source: "page",
    fields: { name: "Drachenburg MOC", imageUrl: "https://cdn.example.com/drachenburg.jpg" },
  },
  // A page that was read but had nothing to recognise.
  [EMPTY_PAGE_LINK]: { kind: "page", source: "page", fields: {} },
};
