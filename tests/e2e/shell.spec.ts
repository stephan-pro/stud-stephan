import { expect, test } from "@playwright/test";
import { TEXTS } from "../../src/ui/texts";
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

// The showcase has its content since P5 (`showcase.spec.ts`), capturing since P6 (`capture.spec.ts`);
// the others still say what will come.
const PAGES = [
  { hash: "#/dioramen", heading: "Dioramen", tab: "Dioramen", text: TEXTS.routes.dioramas },
  {
    hash: "#/wunschliste",
    heading: "Wunschliste",
    tab: "Wunschliste",
    text: TEXTS.routes.wishlist,
  },
  { hash: "#/dashboard", heading: "Dashboard", tab: "Dashboard", text: TEXTS.routes.dashboard },
  {
    hash: "#/einstellungen",
    heading: "Einstellungen",
    tab: "Einstellungen",
    text: TEXTS.routes.settings,
  },
] as const;

for (const [size, viewport] of [
  ["Handy", PHONE],
  ["PC", PC],
] as const) {
  test.describe(size, () => {
    test.use({ viewport });

    for (const page of PAGES) {
      test(`P1 ${size}: ${page.hash} zeigt eine h1, sagt was kommt und hat keine axe-Verstöße (hell)`, async ({
        page: browser,
      }) => {
        await browser.goto(page.hash);
        await expect(heading(browser)).toHaveText(page.heading);
        await expect(heading(browser)).toHaveCount(1);
        await expect(browser).toHaveTitle(`${page.tab} – Stud Stephan`);
        await expect(browser.getByRole("heading", { level: 2, name: "Kommt bald" })).toBeVisible();
        await expect(browser.getByText(page.text.comingSoon)).toBeVisible();
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
