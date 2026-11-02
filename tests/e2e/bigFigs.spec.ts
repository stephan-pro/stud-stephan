import { expect, type Page, test } from "@playwright/test";
import { DEMO_COLLECTION } from "../../src/demo/collection";
import { aMinifig, aPrice } from "../../src/domain/fixtures";
import { TEXTS } from "../../src/ui/texts";
import {
  expectNoAccessibilityViolations,
  heading,
  PC,
  PHONE,
  signInDirectly,
  style,
} from "./helpers";

// Big Figs: BrickLink lists the Rancor of 75005 as a part ("Large Figure", `11323pb01c01`), not as a
// minifig. As a figure it is found by number (minifig, then part), keeps its BrickLink type PART,
// counts as a figure everywhere, is counted among the figures of its set, and the price run asks for
// the part. The catalog is the example catalog of `src/demo/catalog.ts`; the real function and the
// order of the BrickLink types are tested in `supabase/functions/_shared/bigFig.test.ts`.

const S = TEXTS.search;
const C = TEXTS.catalogForm;
const F = TEXTS.form;
const D = TEXTS.detail;
const L = TEXTS.linkCapture;
const P = TEXTS.priceRun;
const SIZES = [
  ["Handy", PHONE],
  ["PC", PC],
] as const;

/** The mint tint of the filled fields (`--tint-mint`). */
const MINT = "rgb(181, 229, 204)";
const RANCOR = "Large Figure, Rancor";

const searchField = (page: Page) => page.getByRole("searchbox", { name: S.label });
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });
const row = (page: Page, label: string) =>
  page.locator(".rows__row").filter({ hasText: label }).locator("dd");

test.describe("Big Fig aus dem Katalog (S7b, S8)", () => {
  test.beforeEach(async ({ page }) => {
    await signInDirectly(page);
  });

  for (const [size, viewport] of SIZES) {
    test(`${size}: Die Nummer 11323pb01c01 findet den Rancor als Figur vom Typ Teil, keine axe-Verstöße`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/erfassen/suche/figur");
      await expect(searchField(page)).toHaveAttribute("placeholder", S.placeholder.minifig);
      await expect(page.getByText(S.idle)).toBeVisible();
      await expectNoAccessibilityViolations(page);

      await searchField(page).fill("11323pb01c01");
      await expect(page.getByText(S.results(1))).toBeVisible();
      const hit = page.getByRole("link", { name: S.pick(RANCOR) });
      await expect(hit).toContainText(`11323pb01c01 · ${S.bricklinkTypes.PART}`);
      await expectNoAccessibilityViolations(page);
    });
  }

  test("Ein Treffer öffnet das grüne Formular der Figur; gespeichert ist es eine Figur der Vitrine mit Typ Teil", async ({
    page,
  }) => {
    await page.goto("#/erfassen/suche/figur");
    await searchField(page).fill("11323pb01c01");
    await page.getByRole("link", { name: S.pick(RANCOR) }).click();

    await expect(page).toHaveURL(/#\/erfassen\/figur\/katalog\/PART%3A11323pb01c01$/);
    await expect(heading(page)).toHaveText(F.titleCatalog.minifig);
    await expect(field(page, F.fields.name)).toHaveValue(RANCOR);
    await expect(field(page, F.fields.number.minifig)).toHaveValue("11323pb01c01");
    await expect(field(page, F.fields.theme)).toHaveValue("Large Figure");
    await expect(field(page, F.fields.fromSet)).toHaveValue("75005");
    for (const label of [F.fields.name, F.fields.number.minifig]) {
      expect(await style(field(page, label), "background-color"), label).toBe(MINT);
    }
    await expect(field(page, F.fields.number.minifig)).toHaveAccessibleDescription(
      new RegExp(C.bricklinkTypeHint(S.bricklinkTypes.PART).slice(0, 30)),
    );
    await expectNoAccessibilityViolations(page);

    await page.getByRole("button", { name: F.save }).click();
    await expect(heading(page)).toHaveText(RANCOR);
    await expect(row(page, D.origin.bricklinkType)).toHaveText(S.bricklinkTypes.PART);
    await expectNoAccessibilityViolations(page);

    // It is a figure of the showcase, and the type is on the server.
    await page.reload();
    await expect(row(page, D.origin.bricklinkType)).toHaveText(S.bricklinkTypes.PART);
    await page.goto("#/vitrine");
    await expect(page.getByText(RANCOR).first()).toBeVisible();
  });

  test("„Weiteres Exemplar anlegen“ einer Big Fig bleibt ein Teil; wird die Nummer geändert, fällt der Typ weg", async ({
    page,
  }) => {
    await page.goto("#/erfassen/figur/katalog/PART%3A11323pb01c01");
    await page.getByRole("button", { name: F.save }).click();
    await expect(heading(page)).toHaveText(RANCOR);
    const firstUrl = page.url();

    await page.getByRole("link", { name: TEXTS.actions.copy }).click();
    await expect(heading(page)).toHaveText(F.titleCopy);
    await page.getByRole("button", { name: F.save }).click();
    await expect(heading(page)).toHaveText(RANCOR);
    await expect(page).not.toHaveURL(firstUrl);
    await expect(row(page, D.origin.bricklinkType)).toHaveText(S.bricklinkTypes.PART);

    // Another number is another item: no type.
    await page.getByRole("link", { name: TEXTS.actions.edit }).click();
    await field(page, F.fields.number.minifig).fill("sw0434");
    await page.getByRole("button", { name: F.save }).click();
    await expect(heading(page)).toHaveText(RANCOR);
    await expect(
      page.locator(".rows__row").filter({ hasText: D.origin.bricklinkType }),
    ).toHaveCount(0);
  });

  test("Eine Minifigur wird wie bisher gefunden: ohne Typ, ohne Zeile „BrickLink-Katalog“", async ({
    page,
  }) => {
    await page.goto("#/erfassen/suche/figur");
    await searchField(page).fill("sw0194");
    await page.getByRole("link", { name: S.pick("Captain Rex") }).click();
    await page.getByRole("button", { name: F.save }).click();
    await expect(heading(page)).toHaveText("Captain Rex");
    await expect(
      page.locator(".rows__row").filter({ hasText: D.origin.bricklinkType }),
    ).toHaveCount(0);
  });
});

test.describe("Big Figs in Sets (S8, F7)", () => {
  test.beforeEach(async ({ page }) => {
    await signInDirectly(page);
  });

  test("Rancor Pit 75005: Luke und der Rancor zählen als Figuren des Sets, auch auf der Detailseite", async ({
    page,
  }) => {
    await page.goto("#/erfassen/suche/set");
    await searchField(page).fill("75005");
    await page.getByRole("link", { name: S.pick("Rancor Pit") }).click();
    await expect(field(page, F.fields.number.legoSet)).toHaveValue("75005-1");
    await expect(field(page, F.fields.minifigCount)).toHaveValue("2");
    await expectNoAccessibilityViolations(page);

    await page.getByRole("button", { name: F.save }).click();
    await expect(heading(page)).toHaveText("Rancor Pit");
    await expect(page.getByText("Luke Skywalker")).toBeVisible();
    await expect(page.getByText(RANCOR)).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });
});

test.describe("Big Fig per Link (S7c)", () => {
  test.beforeEach(async ({ page }) => {
    await signInDirectly(page);
  });

  for (const [size, viewport] of SIZES) {
    test(`${size}: Ein BrickLink-Link mit ?P= führt über den Katalog in das grüne Formular der Figur, keine axe-Verstöße`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const address = "https://www.bricklink.com/v2/catalog/catalogitem.page?P=11323pb01c01#T=C";
      await page.goto("#/erfassen/link/figur");
      await page.getByLabel(L.label, { exact: true }).fill(address);
      await expect(page.getByText(L.sources.bricklink, { exact: true })).toBeVisible();
      await expect(page.getByText(L.kinds.minifig, { exact: true })).toBeVisible();
      await expect(page.getByText("11323pb01c01", { exact: true })).toBeVisible();
      await expectNoAccessibilityViolations(page);

      await page.getByRole("link", { name: L.next }).click();
      await expect(page).toHaveURL(/#\/erfassen\/figur\/katalog\/PART%3A11323pb01c01\/link\//);
      await expect(heading(page)).toHaveText(F.titleCatalog.minifig);
      await expect(field(page, F.fields.name)).toHaveValue(RANCOR);
      expect(await style(field(page, F.fields.name), "background-color")).toBe(MINT);
      await expect(field(page, F.fields.links)).toHaveValue(address);
      await expectNoAccessibilityViolations(page);
      await page.getByRole("button", { name: F.save }).click();
      await expect(row(page, D.origin.bricklinkType)).toHaveText(S.bricklinkTypes.PART);
    });
  }

  test("Der Link auf ein Teil führt auch dann zur Figur, wenn „Set“ gewählt war", async ({
    page,
  }) => {
    await page.goto("#/erfassen/link/set");
    await page
      .getByLabel(L.label, { exact: true })
      .fill("https://www.bricklink.com/catalogitem.asp?P=11323pb01c01");
    await expect(page.getByText(L.kinds.minifig, { exact: true })).toBeVisible();
    await page.getByRole("link", { name: L.next }).click();
    await expect(heading(page)).toHaveText(F.titleCatalog.minifig);
  });
});

test.describe("Preisabruf für Big Figs (S12)", () => {
  /** The demo collection plus a Rancor and a minifig, with a price point of last week for the part. */
  const withRancor = () => ({
    ...DEMO_COLLECTION,
    minifigs: [
      ...DEMO_COLLECTION.minifigs,
      aMinifig({
        id: "minifig-rancor",
        name: RANCOR,
        bricklinkId: "11323pb01c01",
        bricklinkType: "PART",
        condition: "used",
      }),
      // The same number without the type is a minifig: it is not the part's price.
      aMinifig({ id: "minifig-nummer", name: "Gleiche Nummer", bricklinkId: "11323pb01c01" }),
    ],
    prices: [
      ...DEMO_COLLECTION.prices,
      aPrice("PART:11323pb01c01", "2026-10-26", { used: 8000, new: 12000 }),
    ],
  });

  test("„Jetzt aktualisieren“ fragt die Big Fig als Teil ab; die Wert-Karte zeigt den neuen Stand, die Figur mit gleicher Nummer ohne Typ nicht", async ({
    page,
  }) => {
    await signInDirectly(page, undefined, withRancor());
    await page.goto("#/vitrine/figur/minifig-rancor");
    const card = page.locator(".value-card");
    await expect(card).toContainText("80,00 €");
    await expect(card).toContainText(D.value.market("gebraucht"));
    await expectNoAccessibilityViolations(page);

    await page.goto("#/einstellungen");
    await page.getByRole("button", { name: P.update }).click();
    await expect(page.getByRole("status").filter({ hasText: P.finished })).toBeVisible();

    await page.goto("#/vitrine/figur/minifig-rancor");
    // The fake run adds 2 % to the last price: 80,00 € → 81,60 €.
    await expect(page.locator(".value-card")).toContainText("81,60 €");

    await page.goto("#/vitrine/figur/minifig-nummer");
    await expect(page.locator(".value-card")).not.toContainText(D.value.market("gebraucht"));
  });
});
