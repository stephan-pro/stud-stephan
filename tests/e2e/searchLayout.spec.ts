import { expect, test } from "@playwright/test";
import { DEMO_COLLECTION } from "../../src/demo/collection";
import { TEXTS } from "../../src/ui/texts";
import { PC, PHONE, signInDirectly } from "./helpers";

// Nacharbeit zu P15: Auf dem PC wurde ein Suchfeld in einer Seite (Reihen, Suche) 360 px hoch, die
// Lupe schwebte links in der leeren Fläche. Jedes Suchfeld ist so hoch wie sein Eingabefeld, die
// Lupe sitzt links darin, mittig.

const PAGES = [
  { name: "Reihen", hash: "#/wunschliste/reihen", label: TEXTS.series.searchLabel, toggle: false },
  {
    name: "Nummer oder Suche",
    hash: "#/erfassen/suche/set",
    label: TEXTS.search.label,
    toggle: false,
  },
  { name: "Vitrine", hash: "#/vitrine", label: TEXTS.showcase.searchLabel, toggle: true },
  { name: "Dioramen", hash: "#/dioramen", label: TEXTS.dioramas.searchLabel, toggle: true },
] as const;

for (const [size, viewport] of [
  ["Handy", PHONE],
  ["PC", PC],
] as const) {
  for (const entry of PAGES) {
    test(`Suchfeld ${size} ${entry.name}: so hoch wie das Eingabefeld, die Lupe steht links darin`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await signInDirectly(page, undefined, DEMO_COLLECTION);
      await page.goto(entry.hash);
      const field = page.getByLabel(entry.label);
      if (entry.toggle && size === "Handy") {
        await page.getByRole("button", { name: TEXTS.showcase.searchOpen }).click();
      }
      await expect(field).toBeVisible();

      const wrapper = field.locator("xpath=..");
      const fieldBox = await field.boundingBox();
      const wrapperBox = await wrapper.boundingBox();
      const iconBox = await wrapper.locator(".search__icon svg").boundingBox();
      if (!fieldBox || !wrapperBox || !iconBox) throw new Error("Suchfeld ohne Maße");

      expect(wrapperBox.height).toBeLessThanOrEqual(fieldBox.height + 1);
      expect(iconBox.x).toBeGreaterThanOrEqual(fieldBox.x);
      expect(iconBox.x + iconBox.width).toBeLessThan(fieldBox.x + fieldBox.width / 2);
      const iconMiddle = iconBox.y + iconBox.height / 2;
      const fieldMiddle = fieldBox.y + fieldBox.height / 2;
      expect(Math.abs(iconMiddle - fieldMiddle)).toBeLessThanOrEqual(2);
    });
  }
}
