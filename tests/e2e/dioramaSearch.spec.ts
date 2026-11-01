import { expect, test } from "@playwright/test";
import { DEMO_COLLECTION } from "../../src/demo/collection";
import { TEXTS } from "../../src/ui/texts";
import { expectNoAccessibilityViolations, PC, PHONE, signInDirectly } from "./helpers";

// P15, deviation from P10: the search of the diorama list as in Dioramen.dc.html (magnifier top
// right; on the PC the field is always open, as in the showcase).

const T = TEXTS.dioramas;

test.beforeEach(async ({ page }) => {
  await signInDirectly(page, undefined, DEMO_COLLECTION);
});

test("P15 Handy: Die Lupe öffnet die Suche, sie filtert die Dioramen; Schließen zeigt wieder alle", async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await page.goto("#/dioramen");
  const cards = page.locator(".diorama-card__name");
  await expect(cards).toHaveCount(DEMO_COLLECTION.dioramas.length);
  const field = page.getByLabel(T.searchLabel);
  await expect(field).toBeHidden();

  await page.getByRole("button", { name: TEXTS.showcase.searchOpen }).click();
  await expect(field).toBeFocused();
  await field.fill("kamino");
  await expect(cards).toHaveText(["Kamino-Hangar"]);
  await expectNoAccessibilityViolations(page);

  await field.fill("gibt es nicht");
  await expect(page.getByText(T.noMatch("gibt es nicht"))).toBeVisible();

  await page.getByRole("button", { name: TEXTS.showcase.searchClose }).click();
  await expect(cards).toHaveCount(DEMO_COLLECTION.dioramas.length);
});

test("P15 PC: Das Suchfeld der Dioramen steht immer da", async ({ page }) => {
  await page.setViewportSize(PC);
  await page.goto("#/dioramen");
  await expect(page.getByRole("button", { name: TEXTS.showcase.searchOpen })).toBeHidden();
  await page.getByLabel(T.searchLabel).fill("umbara");
  await expect(page.locator(".diorama-card__name")).toHaveText(["Umbara-Gefecht"]);
  await expectNoAccessibilityViolations(page);
});
