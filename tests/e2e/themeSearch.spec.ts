import { expect, type Page, test } from "@playwright/test";
import { TEXTS } from "../../src/ui/texts";
import { expectNoAccessibilityViolations, PC, PHONE, signInDirectly } from "./helpers";

// P12 (Nacharbeit): die Themensuche der Reihen (S10) findet auch nach Hauptthemen, Set- und
// Figurennummern und deutschen Begriffen und sagt bei keinem Treffer, was man eingeben kann. Die
// Beispielthemen stehen in `src/demo/series.ts`.

const R = TEXTS.series;
const SERIES_KEY = "stud-stephan-fake:series-control";

async function search(page: Page, text: string): Promise<void> {
  await page.goto("#/wunschliste/reihen");
  await page.getByRole("searchbox", { name: R.searchLabel }).fill(text);
}

for (const [size, viewport] of [
  ["Handy", PHONE],
  ["PC", PC],
] as const) {
  test.describe(`${size} Themensuche`, () => {
    test.use({ viewport });

    test(`P12 ${size}: Ein Hauptthema steht als nicht wählbare Überschrift mit seinen Unterthemen darunter`, async ({
      page,
    }) => {
      await signInDirectly(page);
      await search(page, "star wars");
      const items = page.locator(".series-results > li");
      await expect(items).toHaveCount(3);

      const main = items.nth(0);
      await expect(main).toContainText("Star Wars");
      await expect(main).toContainText(R.tooBigTheme);
      await expect(main.getByRole("button")).toHaveCount(0);

      await expect(items.nth(1).getByRole("button")).toContainText("Star Wars – Battle Packs");
      await expect(items.nth(2).getByRole("button")).toContainText("Star Wars – The Clone Wars");
      await expectNoAccessibilityViolations(page);

      await items.nth(2).getByRole("button").click();
      await expect(page.getByRole("dialog")).toContainText("Star Wars – The Clone Wars");
    });

    test(`P12 ${size}: Eine Setnummer führt zum Thema des Sets, mit und ohne „-1“`, async ({
      page,
    }) => {
      await signInDirectly(page);
      for (const typed of ["75372", "75372-1"]) {
        await search(page, typed);
        const hit = page.getByRole("button", { name: /Star Wars – The Clone Wars/ });
        await expect(hit).toBeVisible();
        await expect(hit).toContainText(R.foundBy.set("75372-1"));
        await expect(page.locator(".series-results > li")).toHaveCount(1);
      }
      await expectNoAccessibilityViolations(page);
    });

    test(`P12 ${size}: Eine Figurennummer führt zum Thema der Figur`, async ({ page }) => {
      await signInDirectly(page);
      await search(page, "sw0194");
      const hit = page.getByRole("button", { name: /Star Wars – The Clone Wars/ });
      await expect(hit).toContainText(R.foundBy.figure("sw0194"));
      await expectNoAccessibilityViolations(page);
    });

    test(`P12 ${size}: Deutsche Begriffe finden den englischen Namen`, async ({ page }) => {
      await signInDirectly(page);
      await search(page, "Klonkriege");
      await expect(page.getByRole("button", { name: /Star Wars – The Clone Wars/ })).toBeVisible();
      await search(page, "Krieg der Sterne Klonkrieger");
      await expect(page.getByRole("button", { name: /Star Wars – The Clone Wars/ })).toBeVisible();
    });

    test(`P12 ${size}: Ohne Treffer gibt es einen Tipp, bei einer Störung eine Fehlermeldung statt „keine Treffer“`, async ({
      page,
    }) => {
      await signInDirectly(page);
      await search(page, "Gibtesnicht");
      await expect(page.getByText(R.noThemes)).toBeVisible();
      await expect(page.getByText(R.noThemes)).toContainText("Clone Wars");
      await expect(page.getByText(R.noThemes)).toContainText("75372");
      await expectNoAccessibilityViolations(page);

      await page.evaluate((key) => localStorage.setItem(key, "unavailable"), SERIES_KEY);
      await page.getByRole("searchbox", { name: R.searchLabel }).fill("Clone Wars");
      await expect(page.locator(".banner--error")).toHaveText(R.searchFailed.unavailable);
      await expect(page.getByText(R.noThemes)).toHaveCount(0);
    });
  });
}
