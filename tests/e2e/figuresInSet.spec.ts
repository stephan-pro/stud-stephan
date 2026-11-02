import { expect, test } from "@playwright/test";
import { aCollection, aMinifig, aSet } from "../../src/domain/fixtures";
import { totals } from "../../src/domain/totals";
import type { Collection, Minifig } from "../../src/domain/types";
import { TEXTS } from "../../src/ui/texts";
import { expectNoAccessibilityViolations, PC, PHONE, signInDirectly } from "./helpers";

// Figures in a complete own set: "Figuren einzeln anlegen", the value that is already in the set
// ("Wert im Set enthalten") and the count "· N im Set".

const D = TEXTS.detail.set;
const V = TEXTS.detail.value;

const SET_ID = "set-75372";
const SET_NAME = "Clone Trooper & Battle Droid Battle Pack";

function completeSet(): Collection {
  const own = (id: string, fields: Partial<Minifig> = {}) =>
    aMinifig({ id, fromSet: { label: "75372", setId: SET_ID }, ...fields });
  return aCollection({
    minifigs: [
      own("figure-in-set", {
        name: "Battle Droid im Set",
        bricklinkId: "sw0001",
        manualValue: { cents: 700, enteredOn: "2026-10-01" },
      }),
      own("trooper-1", { name: "Clone Trooper", bricklinkId: "sw0631" }),
      own("trooper-2", { name: "Clone Trooper", bricklinkId: "sw0631" }),
    ],
    sets: [
      aSet({
        id: SET_ID,
        name: SET_NAME,
        setNumber: "75372-1",
        status: "complete",
        containedFigures: [
          { name: "Plo Koon", bricklinkId: "sw0225" },
          { name: "Clone Trooper", bricklinkId: "sw0631", quantity: 2 },
          { name: "Kit Fisto", bricklinkId: "sw0226", quantity: 2 },
        ],
      }),
    ],
  });
}

for (const [size, viewport] of [
  ["Handy", PHONE],
  ["PC", PC],
] as const) {
  test.describe(size, () => {
    test.use({ viewport });

    test(`F10 ${size}: Eine Figur im vollständigen Herkunfts-Set zeigt „Wert im Set enthalten“ mit Link zum Set`, async ({
      page,
    }) => {
      await signInDirectly(page, undefined, completeSet());
      await page.goto("#/vitrine/figur/figure-in-set");
      const card = page.getByRole("region", { name: V.inSet });
      await expect(card).toBeVisible();
      await expect(card).toContainText(V.alone("7,00 €"));
      await expectNoAccessibilityViolations(page);
      await card.getByRole("link", { name: V.inSetLink(SET_NAME) }).click();
      await expect(page).toHaveURL(new RegExp(`#/vitrine/set/${SET_ID}$`));
    });

    test(`F10 ${size}: Ist das Set zerlegt, zählt die Figur wieder selbst`, async ({ page }) => {
      const collection = completeSet();
      const apart = {
        ...collection,
        sets: collection.sets.map((set) => ({ ...set, status: "disassembled" as const })),
      };
      await signInDirectly(page, undefined, apart);
      await page.goto("#/vitrine/figur/figure-in-set");
      await expect(page.getByRole("region", { name: V.inSet })).toHaveCount(0);
      await expect(page.getByText("7,00 €").first()).toBeVisible();
    });

    test(`F12 ${size}: Die Sammlungskarte zählt Figuren „im Set“ zusätzlich`, async ({ page }) => {
      const collection = completeSet();
      const { counts } = totals(collection);
      await signInDirectly(page, undefined, collection);
      await page.goto("#/vitrine");
      // Plo Koon and two Kit Fistos are only "im Set"; both Clone Troopers have a copy of their own.
      await expect(page.getByText(`${counts.minifigs} Figuren · 3 im Set`)).toBeVisible();
      await page.goto("#/dashboard");
      await expect(
        page
          .getByRole("region", { name: TEXTS.dashboard.kinds.title })
          .getByText(`${counts.minifigs} Figuren · 3 im Set`),
      ).toBeVisible();
    });

    test(`F7 ${size}: „Figuren einzeln anlegen“ legt die gewählten Figuren an, im Set und ohne Kaufpreis`, async ({
      page,
    }) => {
      await signInDirectly(page, undefined, completeSet());
      await page.goto(`#/vitrine/set/${SET_ID}`);
      await page.getByRole("button", { name: D.createAction }).click();
      const sheet = page.getByRole("dialog", { name: D.createTitle });
      await expect(sheet.getByRole("button", { name: "Clone Trooper" })).toHaveCount(0);
      await expectNoAccessibilityViolations(page);
      await expect(sheet.getByRole("button", { name: D.createSubmit(0) })).toBeDisabled();
      await sheet.getByRole("button", { name: "Plo Koon" }).click();
      await sheet.getByRole("button", { name: D.createOption("Kit Fisto", 2) }).click();
      await sheet.getByRole("button", { name: D.createSubmit(2) }).click();
      await expect(sheet).toBeHidden();

      const figures = page.getByRole("region", { name: D.figuresTitle });
      await expect(figures.getByText(D.inSet)).toHaveCount(0);
      await expect(figures.getByRole("link", { name: /Plo Koon/ })).toBeVisible();
      await expect(page.getByRole("button", { name: D.createAction })).toHaveCount(0);
      // The new figures stand in the set by themselves.
      const displayed = page.getByRole("region", { name: D.displayedTitle });
      await expect(displayed.getByRole("link", { name: /Plo Koon/ })).toContainText(
        D.displayedAutomatic,
      );
      await expect(displayed.getByRole("link", { name: /Kit Fisto/ })).toHaveCount(2);

      await displayed.getByRole("link", { name: /Plo Koon/ }).click();
      const origin = page.getByRole("region", { name: TEXTS.detail.origin.title });
      await expect(origin).not.toContainText(TEXTS.detail.origin.purchasePrice);
      await expect(origin.getByRole("link", { name: /75372/ })).toBeVisible();
      await expect(page.getByRole("region", { name: V.inSet })).toBeVisible();
    });
  });
}
