// What the demo and the end-to-end tests "read" from pasted links (`FakeLinkPreviewer`), after the
// click dummy (Link.dc.html). Rebrickable and BrickLink addresses need no entry here: the fake reads
// the number from the address like the real function and the example catalog (`DEMO_CATALOG`)
// answers for it.

import type { LinkAnswer } from "../backend/linkPreview";

export const MERLIN_LINK = "https://www.merlinssteine.de/sets/bluebrixx-110374/";
export const SHOP_LINK = "https://shop.example.com/burgtor";
export const EMPTY_PAGE_LINK = "https://shop.example.com/leer";

/** The pictures the example pages have; the fake "fetches" them (`FakeLinkPreviewer.image`). */
export const MERLIN_IMAGE = "https://www.merlinssteine.de/media/sets/bluebrixx-110374.jpg";
export const SHOP_IMAGE = "https://cdn.example.com/drachenburg.jpg";
export const DEMO_LINK_IMAGES: readonly string[] = [MERLIN_IMAGE, SHOP_IMAGE];

/** A 1 × 1 pixel PNG (base64) that stands in for every example picture. */
export const DEMO_IMAGE_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export const DEMO_LINK_PAGES: Readonly<Record<string, LinkAnswer>> = {
  // As in the dummy: name, manufacturer, piece count and picture found, the set number not.
  [MERLIN_LINK]: {
    kind: "page",
    source: "merlin",
    fields: {
      name: "Burgtor mit Zugbrücke",
      manufacturer: "BlueBrixx",
      pieceCount: 1520,
      imageUrl: MERLIN_IMAGE,
    },
  },
  // A shop or an MOC page gives title and picture only.
  [SHOP_LINK]: {
    kind: "page",
    source: "page",
    fields: { name: "Drachenburg MOC", imageUrl: SHOP_IMAGE },
  },
  // A page that was read but had nothing to recognise.
  [EMPTY_PAGE_LINK]: { kind: "page", source: "page", fields: {} },
};
