import { expect, test } from "@playwright/test";
import { DEMO_COLLECTION } from "../../src/demo/collection";
import type { Collection } from "../../src/domain/types";
import { TEXTS } from "../../src/ui/texts";
import { expectNoAccessibilityViolations, PC, PHONE, signInDirectly } from "./helpers";

// F7/F13: figures of a complete own set that are not captured on their own are "im Set" (no
// "fehlt", no wish button) and count as there; a Big Fig shows its picture.

const D = TEXTS.detail.set;
const R = TEXTS.series;

const RANCOR_PICTURE = "https://img.bricklink.com/ItemImage/PN/88/11323pb01c01.png";

function collectionWith(status: "complete" | "figuresRemoved"): Collection {
  const base = DEMO_COLLECTION.sets[0];
  if (!base) throw new Error("Die Beispielsammlung hat kein Set");
  return {
    ...DEMO_COLLECTION,
    sets: [
      {
        ...base,
        status,
        containedFigures: [
          { name: "Plo Koon", bricklinkId: "sw0225" },
          { name: "Clone Trooper", bricklinkId: "sw0631", quantity: 1 },
          {
            name: "Rancor",
            bricklinkId: "11323pb01c01",
            bricklinkType: "PART",
            imageUrl: RANCOR_PICTURE,
          },
        ],
      },
    ],
  };
}

for (const [size, viewport] of [
  ["Handy", PHONE],
  ["PC", PC],
] as const) {
  test.describe(size, () => {
    test.use({ viewport });

    test(`F7 ${size}: Bei „vollständig“ heißen nicht erfasste Figuren „im Set“, ohne Wunschliste-Knopf, mit Zähler und Bild der Big Fig`, async ({
      page,
    }) => {
      const collection = collectionWith("complete");
      await signInDirectly(page, undefined, collection);
      await page.goto(`#/vitrine/set/${collection.sets[0]?.id}`);
      const figures = page.getByRole("region", { name: D.figuresTitle });
      await expect(
        figures.getByRole("img", { name: "3 von 3 Figuren vorhanden, 1 einzeln erfasst" }),
      ).toHaveText("3 / 3 · 1 einzeln erfasst");
      await expect(figures.getByText(D.inSet)).toHaveCount(2);
      await expect(figures.getByText(D.missing)).toHaveCount(0);
      await expect(figures.getByRole("button")).toHaveCount(0);
      await expect(figures.locator(`img[src="${RANCOR_PICTURE}"]`)).toHaveCount(1);
      await expectNoAccessibilityViolations(page);
    });

    test(`F7 ${size}: Bei „Figuren entnommen“ fehlen nicht erfasste Figuren weiter, mit Wunschliste-Knopf`, async ({
      page,
    }) => {
      const collection = collectionWith("figuresRemoved");
      await signInDirectly(page, undefined, collection);
      await page.goto(`#/vitrine/set/${collection.sets[0]?.id}`);
      const figures = page.getByRole("region", { name: D.figuresTitle });
      await expect(figures.getByText(D.missing)).toHaveCount(2);
      await expect(figures.getByText(D.inSet)).toHaveCount(0);
      await expect(figures.getByRole("button", { name: D.addWishLabel("Plo Koon") })).toBeVisible();
      await expect(figures.getByRole("img", { name: "1 von 3 Figuren vorhanden" })).toBeVisible();
    });

    test(`F13 ${size}: Eine Figur aus einem vollständigen eigenen Set zählt in der Reihe als vorhanden und führt zum Set`, async ({
      page,
    }) => {
      const collection = collectionWith("complete");
      await signInDirectly(page, undefined, collection);
      await page.goto("#/wunschliste/reihen");
      await page.getByRole("searchbox", { name: R.searchLabel }).fill("clone wars");
      await page.getByRole("button", { name: /Star Wars – The Clone Wars/ }).click();
      await page.getByRole("dialog").getByRole("button", { name: R.plan.create }).click();
      await expect(page).toHaveURL(/#\/wunschliste\/reihen\/\d+$/);
      // Plo Koon sits in the complete set: 3 own figures and Plo Koon.
      await expect(page.locator(".series-hero__number")).toHaveText("4");
      await expectNoAccessibilityViolations(page);
      await page.getByRole("link", { name: /Plo Koon/ }).click();
      await expect(page).toHaveURL(new RegExp(`#/vitrine/set/${collection.sets[0]?.id}$`));
    });
  });
}
