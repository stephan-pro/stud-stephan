import { expect, type Page, test } from "@playwright/test";
import { TEXTS } from "../../src/ui/texts";
import {
  expectNoAccessibilityViolations,
  heading,
  PC,
  PHONE,
  signInDirectly,
  style,
} from "./helpers";

// P7 (F2): "Nummer oder Suche" — search the catalog by number or name, open the form filled from
// the entry (green fields), save. The catalog is the example catalog of `src/demo/catalog.ts`; the
// real function is tested in `supabase/functions/_shared/`.

const S = TEXTS.search;
const C = TEXTS.catalogForm;
const F = TEXTS.form;
const SIZES = [
  ["Handy", PHONE],
  ["PC", PC],
] as const;

const FAILURE_KEY = "stud-stephan-fake:catalog-failure";
/** The mint tint of the filled fields (`--tint-mint`). */
const MINT = "rgb(181, 229, 204)";

const searchField = (page: Page) => page.getByRole("searchbox", { name: S.label });
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });

test.beforeEach(async ({ page }) => {
  await signInDirectly(page);
});

test.describe("Suche im Katalog (S7b)", () => {
  for (const [size, viewport] of SIZES) {
    test(`F2 ${size}: vom Erfassen-Blatt zur Suche, sw063 findet vier Figuren, keine axe-Verstöße`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/erfassen");
      await page
        .getByRole("dialog", { name: TEXTS.capture.title })
        .getByRole("link", { name: new RegExp(TEXTS.capture.ways.search.title) })
        .click();
      await expect(page).toHaveURL(/#\/erfassen\/suche\/figur$/);
      await expect(heading(page)).toHaveText(S.title);
      await expect(page.getByText(S.idle)).toBeVisible();
      await expectNoAccessibilityViolations(page);

      await searchField(page).fill("sw063");
      await expect(page.getByText(S.results(4))).toBeVisible();
      const hits = page.getByRole("list").getByRole("link");
      await expect(hits).toHaveCount(4);
      await expect(hits.first()).toContainText("Clone Trooper Phase II");
      await expect(hits.first()).toContainText("sw0631 · Star Wars – The Clone Wars · 2015");
      await expectNoAccessibilityViolations(page);
    });
  }

  test("F2 Die Chips wechseln zwischen Figuren und Sets, die Adresse folgt", async ({ page }) => {
    await page.goto("#/erfassen/suche/figur");
    await expect(searchField(page)).toHaveAttribute("placeholder", S.placeholder.minifig);
    await page.getByRole("button", { name: S.kinds.legoSet }).click();
    await expect(page).toHaveURL(/#\/erfassen\/suche\/set$/);
    await expect(searchField(page)).toHaveAttribute("placeholder", S.placeholder.legoSet);
    await searchField(page).fill("75372");
    await expect(page.getByText(S.results(1))).toBeVisible();
    await expect(
      page.getByRole("link", { name: S.pick("Clone Trooper & Battle Droid Battle Pack") }),
    ).toBeVisible();
    // The same text finds nothing among the figures.
    await page.getByRole("button", { name: S.kinds.minifig }).click();
    await expect(page.getByText(S.none)).toBeVisible();
  });

  test("F2 Ohne Treffer: Hinweis und „Manuell anlegen“ führt zum leeren Formular", async ({
    page,
  }) => {
    await page.goto("#/erfassen/suche/figur");
    await searchField(page).fill("zzzz");
    await expect(page.getByText(S.none)).toBeVisible();
    await expect(page.getByText(S.noneHint)).toBeVisible();
    await expectNoAccessibilityViolations(page);
    await page.getByRole("link", { name: S.manual }).click();
    await expect(heading(page)).toHaveText(F.titleNew.minifig);
    await expect(field(page, F.fields.name)).toHaveValue("");
  });

  test("F2 Eine Zeile mit nur einem Buchstaben fragt den Katalog noch nicht", async ({ page }) => {
    await page.goto("#/erfassen/suche/figur");
    await searchField(page).fill("s");
    await expect(page.getByText(S.idle)).toBeVisible();
    await searchField(page).fill("");
    await expect(page.getByText(S.idle)).toBeVisible();
  });

  test("F2 Ist der Katalog nicht erreichbar, steht es da, und „Noch einmal suchen“ klappt danach", async ({
    page,
  }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "unavailable"), FAILURE_KEY);
    await page.goto("#/erfassen/suche/figur");
    await searchField(page).fill("sw0194");
    const alert = page.getByRole("alert");
    await expect(alert).toContainText(S.failed.unavailable);
    await expectNoAccessibilityViolations(page);
    // The way out by hand stays.
    await expect(page.getByRole("link", { name: S.manual })).toBeVisible();

    await page.evaluate((key) => localStorage.removeItem(key), FAILURE_KEY);
    await alert.getByRole("button", { name: S.retry }).click();
    await expect(page.getByText(S.results(1))).toBeVisible();
  });

  test("F2 Ohne Verbindung und bei verbrauchtem Tageslimit sagt die Suche das jeweils", async ({
    page,
  }) => {
    await page.goto("#/erfassen/suche/figur");
    await page.evaluate((key) => localStorage.setItem(key, "offline"), FAILURE_KEY);
    await searchField(page).fill("sw0194");
    await expect(page.getByRole("alert")).toContainText(S.failed.offline);
    await page.evaluate((key) => localStorage.setItem(key, "limit_reached"), FAILURE_KEY);
    await searchField(page).fill("sw0194 ");
    await expect(page.getByRole("alert")).toContainText(S.failed.limit_reached);
  });
});

test.describe("Formular aus dem Katalog (S8)", () => {
  for (const [size, viewport] of SIZES) {
    test(`F2 ${size}: Figur sw0194 — Name, Nummer, Thema und Set kommen aus dem Katalog, grün markiert`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/erfassen/suche/figur");
      await searchField(page).fill("sw0194");
      await page.getByRole("link", { name: S.pick("Captain Rex") }).click();

      await expect(page).toHaveURL(/#\/erfassen\/figur\/katalog\/sw0194$/);
      await expect(heading(page)).toHaveText(F.titleCatalog.minifig);
      await expect(page.getByText(C.banner)).toBeVisible();
      await expect(field(page, F.fields.name)).toHaveValue("Captain Rex");
      await expect(field(page, F.fields.number.minifig)).toHaveValue("sw0194");
      await expect(field(page, F.fields.theme)).toHaveValue("Star Wars – The Clone Wars");
      await expect(field(page, F.fields.fromSet)).toHaveValue("75372");
      // Green, and said so to screen readers as well.
      expect(await style(field(page, F.fields.name), "background-color")).toBe(MINT);
      await expect(field(page, F.fields.name)).toHaveAccessibleDescription(C.prefilledNote);
      // What the catalog does not tell stays empty and white.
      await expect(field(page, F.fields.source)).toHaveValue("");
      expect(await style(field(page, F.fields.source), "background-color")).not.toBe(MINT);
      await expectNoAccessibilityViolations(page);
    });
  }

  test("F2 Ein geändertes Feld ist nicht mehr grün; gespeichert hat die Figur Nummer und Katalogbild", async ({
    page,
  }) => {
    await page.goto("#/erfassen/figur/katalog/sw0194");
    await field(page, F.fields.name).fill("Captain Rex (Phase 2)");
    expect(await style(field(page, F.fields.name), "background-color")).not.toBe(MINT);
    expect(await style(field(page, F.fields.number.minifig), "background-color")).toBe(MINT);
    await page.getByRole("button", { name: F.save }).click();

    await expect(heading(page)).toHaveText("Captain Rex (Phase 2)");
    await expect(page.getByText("sw0194").first()).toBeVisible();
    // Reload: it is on the server, with the catalog's picture address.
    await page.reload();
    await expect(heading(page)).toHaveText("Captain Rex (Phase 2)");
  });

  test("F2 Set 75372: Jahr, Teile und Zahl der Figuren kommen mit; die Figuren des Sets stehen auf der Detailseite (F7)", async ({
    page,
  }) => {
    await page.goto("#/erfassen/suche/set");
    await searchField(page).fill("75372");
    await page
      .getByRole("link", { name: S.pick("Clone Trooper & Battle Droid Battle Pack") })
      .click();

    await expect(heading(page)).toHaveText(F.titleCatalog.legoSet);
    await expect(field(page, F.fields.number.legoSet)).toHaveValue("75372-1");
    await expect(field(page, F.fields.year)).toHaveValue("2024");
    await expect(field(page, F.fields.pieceCount)).toHaveValue("215");
    await expect(field(page, F.fields.minifigCount)).toHaveValue("5");
    await expect(field(page, F.fields.theme)).toHaveValue("Star Wars – Battle Packs");
    await expectNoAccessibilityViolations(page);

    await page.getByRole("button", { name: F.save }).click();
    await expect(heading(page)).toHaveText("Clone Trooper & Battle Droid Battle Pack");
    await expect(page.getByText("Commander Bly")).toBeVisible();
    await expect(page.getByText("Clone Trooper, 332nd Company")).toBeVisible();
  });

  test("F2 Kommt die Figur in mehreren Sets vor, steht ‚Kommt vor in‘ als Hinweis und das Feld bleibt leer", async ({
    page,
  }) => {
    await page.goto("#/erfassen/figur/katalog/sw0631");
    await expect(field(page, F.fields.fromSet)).toHaveValue("");
    await expect(page.getByText(C.fromSetHint(["75372", "75345"]))).toBeVisible();
  });

  test("F2 Ein Eintrag, den es nicht gibt, sagt es und lässt den Weg von Hand", async ({
    page,
  }) => {
    await page.goto("#/erfassen/figur/katalog/sw9999");
    const alert = page.getByRole("alert");
    await expect(alert).toContainText(C.failed.notFound);
    await expectNoAccessibilityViolations(page);
    await alert.getByRole("link", { name: C.failed.manual }).click();
    await expect(heading(page)).toHaveText(F.titleNew.minifig);
  });

  test("F2 Ein Katalog, der gerade nicht antwortet: Hinweis, nach „Noch einmal versuchen“ öffnet das Formular", async ({
    page,
  }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "unavailable"), FAILURE_KEY);
    await page.goto("#/erfassen/figur/katalog/sw0194");
    const alert = page.getByRole("alert");
    await expect(alert).toContainText(C.failed.text);
    await page.evaluate((key) => localStorage.removeItem(key), FAILURE_KEY);
    await alert.getByRole("button", { name: C.failed.retry }).click();
    await expect(heading(page)).toHaveText(F.titleCatalog.minifig);
    await expect(field(page, F.fields.name)).toHaveValue("Captain Rex");
  });

  test("F2 „Abbrechen“ im Katalogformular führt zurück zur Suche", async ({ page }) => {
    await page.goto("#/erfassen/figur/katalog/sw0194");
    await page.getByRole("link", { name: F.cancel }).click();
    await expect(page).toHaveURL(/#\/erfassen\/suche\/figur$/);
  });
});
