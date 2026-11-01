import { expect, test } from "@playwright/test";
import {
  expectNoAccessibilityViolations,
  heading,
  mainNavigation,
  PC,
  PHONE,
  signInDirectly,
} from "./helpers";

// P1: every route has an h1 and says what will come; axe finds nothing in the light scheme, on the
// phone and on the PC. Signed in from the start (P4b; the sign-in page: `signIn.spec.ts`).

test.beforeEach(async ({ page }) => {
  await signInDirectly(page);
});

// The showcase has its content since P5 (`showcase.spec.ts`), capturing since P6 (`capture.spec.ts`),
// the dioramas since P10 (`dioramas.spec.ts`), the wishlist since P12 (`wishlist.spec.ts`), the
// dashboard since P13 (`dashboard.spec.ts`), the settings since P14 (`backup.spec.ts`): every
// page has its content now. The settings stay in the list for the h1, the tab title and axe.
const PAGES = [
  {
    hash: "#/einstellungen",
    heading: "Einstellungen",
    tab: "Einstellungen",
  },
] as const;

for (const [size, viewport] of [
  ["Handy", PHONE],
  ["PC", PC],
] as const) {
  test.describe(size, () => {
    test.use({ viewport });

    for (const page of PAGES) {
      test(`P1 ${size}: ${page.hash} zeigt eine h1, einen Tab-Titel und hat keine axe-Verstöße (hell)`, async ({
        page: browser,
      }) => {
        await browser.goto(page.hash);
        await expect(heading(browser)).toHaveText(page.heading);
        await expect(heading(browser)).toHaveCount(1);
        await expect(browser).toHaveTitle(`${page.tab} – Stud Stephan`);
        await expectNoAccessibilityViolations(browser);
      });
    }
  });
}

test("P1 Eine leere Adresse öffnet die Vitrine", async ({ page }) => {
  await page.goto("");
  await expect(heading(page)).toHaveText("Hey Stephan");
  await expect(page).toHaveURL(/#\/vitrine$/);
});

test("P1 Eine unbekannte Adresse öffnet die Vitrine und zeigt deren Adresse", async ({ page }) => {
  await page.goto("#/gibt-es-nicht");
  await expect(heading(page)).toHaveText("Hey Stephan");
  await expect(page).toHaveURL(/#\/vitrine$/);
});

test("P1 Nach einem Seitenwechsel hat die Überschrift der neuen Seite den Fokus", async ({
  page,
}) => {
  await page.goto("#/vitrine");
  await mainNavigation(page).getByRole("link", { name: "Dioramen" }).click();
  await expect(heading(page)).toHaveText("Dioramen");
  await expect(heading(page)).toBeFocused();
});

test("P1 „Zum Inhalt springen“ setzt den Fokus auf die Überschrift, die Adresse bleibt", async ({
  page,
}) => {
  await page.goto("#/dashboard");
  await page.getByRole("button", { name: "Zum Inhalt springen" }).focus();
  await page.keyboard.press("Enter");
  await expect(heading(page)).toBeFocused();
  await expect(page).toHaveURL(/#\/dashboard$/);
});

test("P1 „Zurück“ im Browser führt zur vorigen Seite", async ({ page }) => {
  await page.goto("#/vitrine");
  await mainNavigation(page).getByRole("link", { name: "Wunschliste" }).click();
  await expect(heading(page)).toHaveText("Wunschliste");
  await page.goBack();
  await expect(heading(page)).toHaveText("Hey Stephan");
});
