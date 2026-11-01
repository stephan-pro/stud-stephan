import { expect, type Page, test } from "@playwright/test";
import { DEMO_COLLECTION } from "../../src/demo/collection";
import type { Collection } from "../../src/domain/types";
import { TEXTS } from "../../src/ui/texts";
import {
  expectNoAccessibilityViolations,
  heading,
  PC,
  PHONE,
  signInDirectly,
  wishEntry,
} from "./helpers";

// P12: the wishlist (S9) with its wish sheet (S9a), the series (S10) with the plan before creating
// one, the series page (S10a) and the way from a missing figure to the wishlist. The example
// collection has the wishes Cody (target reached: 18,90 € against 20,00 €), Ahsoka, the Gunship and
// Battle Droid; the example themes are in `src/demo/series.ts`.

const W = TEXTS.wishlist;
const S = TEXTS.wishSheet;
const R = TEXTS.series;
const SERIES_KEY = "stud-stephan-fake:series-control";

const sheet = (page: Page) => page.getByRole("dialog");

async function createClonesSeries(page: Page, control?: string): Promise<void> {
  await page.goto("#/wunschliste/reihen");
  if (control) {
    await page.evaluate(
      ([key, value]) => localStorage.setItem(key as string, value as string),
      [SERIES_KEY, control],
    );
  }
  await page.getByRole("searchbox", { name: R.searchLabel }).fill("clone wars");
  await page.getByRole("button", { name: /Star Wars – The Clone Wars/ }).click();
  await sheet(page).getByRole("button", { name: R.plan.create }).click();
  await expect(page).toHaveURL(/#\/wunschliste\/reihen\/\d+$/);
}

for (const [size, viewport] of [
  ["Handy", PHONE],
  ["PC", PC],
] as const) {
  test.describe(size, () => {
    test.use({ viewport });

    test(`P12 ${size}: Die Wunschliste zeigt „Zielpreis erreicht“ oben, dann die Liste, ohne axe-Verstöße`, async ({
      page,
    }) => {
      await signInDirectly(page, undefined, DEMO_COLLECTION);
      await page.goto("#/wunschliste");
      await expect(heading(page)).toHaveText("Wunschliste");
      await expect(heading(page)).toHaveCount(1);

      const reached = page.locator(".wish-reached");
      await expect(reached).toHaveCount(1);
      await expect(reached).toContainText(W.reached);
      await expect(reached).toContainText("Commander Cody");
      await expect(reached).toContainText("18,90 €");
      await expect(reached).toContainText("Ziel 20,00 €");

      // F14: by priority, the one with the reached target price is not in the list again.
      const names = page.locator(".wish-list .wish-row__name");
      await expect(names).toHaveText(["Ahsoka Tano", "Republic Gunship", "Battle Droid"]);
      await expect(page.getByText(W.entries(4))).toBeVisible();
      await expect(page.locator(".wish-row").first()).toContainText("sw0219 · gebraucht");
      await expect(page.locator(".wish-row").first()).toContainText("41,00 €");
      await expect(page.locator(".wish-row").first()).toContainText("Ziel 30,00 €");
      await expect(page.locator(".wish-row").last()).toContainText(
        W.fromSeries("Star Wars – The Clone Wars"),
      );
      await expectNoAccessibilityViolations(page);
    });

    test(`P12 ${size}: Das Wunschblatt ändert Priorität und Zielpreis, prüft den Betrag und ist barrierefrei`, async ({
      page,
    }) => {
      await signInDirectly(page, undefined, DEMO_COLLECTION);
      await page.goto("#/wunschliste");
      await wishEntry(page, "Ahsoka Tano").click();
      await expect(sheet(page).getByRole("heading", { name: S.titleEdit })).toBeVisible();
      await expect(sheet(page)).toContainText(
        /Marktpreis 41,00\s€ · Stand vom \d{2}\.\d{2}\.\d{4}/,
      );
      await expectNoAccessibilityViolations(page);

      await sheet(page).getByLabel(S.targetPrice).fill("zwanzig");
      await sheet(page).getByRole("button", { name: S.save }).click();
      await expect(sheet(page).getByText(S.errors.money)).toBeVisible();
      await expectNoAccessibilityViolations(page);

      await sheet(page).getByLabel(S.targetPrice).fill("45,00");
      await sheet(page).getByRole("button", { name: W.priorityChoices.low }).click();
      await sheet(page).getByRole("button", { name: S.save }).click();
      await expect(sheet(page)).toHaveCount(0);

      // F14: with 45,00 € against a market price of 41,00 € the target price is reached.
      await expect(page.locator(".wish-reached")).toHaveCount(2);
      await page.reload();
      await expect(page.locator(".wish-reached").filter({ hasText: "Ahsoka Tano" })).toContainText(
        "Ziel 45,00 €",
      );
    });
  });
}

test("P12 F14 Die Sortierung wechselt zwischen Priorität, Preis und Name", async ({ page }) => {
  await signInDirectly(page, undefined, DEMO_COLLECTION);
  await page.goto("#/wunschliste");
  const names = page.locator(".wish-list .wish-row__name");
  await page.getByRole("button", { name: `${W.sortLabel}: ${W.sorts.priority}` }).click();
  await expect(names).toHaveText(["Battle Droid", "Ahsoka Tano", "Republic Gunship"]);
  await page.getByRole("button", { name: `${W.sortLabel}: ${W.sorts.price}` }).click();
  await expect(names).toHaveText(["Ahsoka Tano", "Battle Droid", "Republic Gunship"]);
});

test("P12 F14 Ohne Zielpreis oder bei zu hohem Marktpreis gibt es keine Markierung", async ({
  page,
}) => {
  await signInDirectly(page, undefined, DEMO_COLLECTION);
  await page.goto("#/wunschliste");
  await wishEntry(page, "Commander Cody").click();
  await sheet(page).getByLabel(S.targetPrice).fill("18,89");
  await sheet(page).getByRole("button", { name: S.save }).click();
  await expect(page.locator(".wish-reached")).toHaveCount(0);
  await wishEntry(page, "Commander Cody").click();
  await sheet(page).getByLabel(S.targetPrice).fill("");
  await sheet(page).getByRole("button", { name: S.save }).click();
  await expect(page.locator(".wish-reached")).toHaveCount(0);
  await expect(page.locator(".wish-row").filter({ hasText: "Commander Cody" })).toBeVisible();
});

test("P12 A6 „Erhalten“ öffnet das Formular aus dem Wunsch; nach dem Speichern ist der Wunsch weg", async ({
  page,
}) => {
  await signInDirectly(page, undefined, DEMO_COLLECTION);
  await page.goto("#/wunschliste");
  await wishEntry(page, "Ahsoka Tano").click();
  await sheet(page).getByRole("button", { name: S.received }).click();
  await expect(page).toHaveURL(/#\/erfassen\/figur\/wunsch\/wish-ahsoka$/);
  await expect(heading(page)).toHaveText(TEXTS.form.titleWish.minifig);
  await expect(page.getByLabel(TEXTS.form.fields.name)).toHaveValue("Ahsoka Tano");
  await expect(page.getByLabel(TEXTS.form.fields.number.minifig)).toHaveValue("sw0219");
  await expectNoAccessibilityViolations(page);

  await page.getByRole("button", { name: TEXTS.form.save }).click();
  await expect(page).toHaveURL(/#\/vitrine\/figur\//);
  await page.goto("#/wunschliste");
  await expect(page.locator(".wish-list .wish-row__name")).toHaveText([
    "Republic Gunship",
    "Battle Droid",
  ]);
});

test("P12 Ein Wunsch lässt sich nach einer Rückfrage von der Liste entfernen", async ({ page }) => {
  await signInDirectly(page, undefined, DEMO_COLLECTION);
  await page.goto("#/wunschliste");
  await wishEntry(page, "Battle Droid").click();
  await sheet(page).getByRole("button", { name: S.remove }).click();
  await expect(sheet(page).getByRole("button", { name: S.removeKeep })).toBeVisible();
  await sheet(page).getByRole("button", { name: S.removeKeep }).click();
  await expect(sheet(page).getByRole("button", { name: S.remove })).toBeVisible();
  await sheet(page).getByRole("button", { name: S.remove }).click();
  await sheet(page).getByRole("button", { name: S.removeConfirm }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.locator(".wish-list .wish-row__name")).toHaveText([
    "Ahsoka Tano",
    "Republic Gunship",
  ]);
});

test("P12 Die leere Wunschliste führt zu den Reihen", async ({ page }) => {
  await signInDirectly(page);
  await page.goto("#/wunschliste");
  await expect(page.getByRole("heading", { name: W.empty.title })).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await page.getByRole("link", { name: W.empty.action }).click();
  await expect(page).toHaveURL(/#\/wunschliste\/reihen$/);
});

for (const [size, viewport] of [
  ["Handy", PHONE],
  ["PC", PC],
] as const) {
  test.describe(`${size} Reihen`, () => {
    test.use({ viewport });

    test(`P12 ${size}: Die Reihen-Seite sucht Themen und zeigt vor dem Anlegen Sets und Abfragen`, async ({
      page,
    }) => {
      await signInDirectly(page, undefined, DEMO_COLLECTION);
      await page.goto("#/wunschliste/reihen");
      await expect(heading(page)).toHaveText("Wunschliste");
      await expect(page.getByRole("link", { name: W.tabs.series })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(page.getByText(R.empty)).toBeVisible();
      await expectNoAccessibilityViolations(page);

      await page.getByRole("searchbox", { name: R.searchLabel }).fill("Batman Movie Sammelserie");
      await page
        .getByRole("button", { name: /Collectible Minifigures – The LEGO Batman Movie Series/ })
        .click();
      await expect(sheet(page)).toContainText(R.plan.summary(R.plan.sets(2), R.plan.calls(2)));
      await expect(sheet(page).getByRole("alert")).toHaveCount(0);
      await expectNoAccessibilityViolations(page);
    });

    test(`P12 ${size}: Über 300 Sets warnt die App vor dem Anlegen`, async ({ page }) => {
      await signInDirectly(page);
      await page.goto("#/wunschliste/reihen");
      await page.getByRole("searchbox", { name: R.searchLabel }).fill("ninjago");
      await page.getByRole("button", { name: /Ninjago – Alle Staffeln/ }).click();
      await expect(sheet(page)).toContainText(R.plan.summary(R.plan.sets(320), R.plan.calls(320)));
      await expect(sheet(page).getByRole("alert")).toContainText(R.plan.warning(300));
      await expect(sheet(page).getByRole("button", { name: R.plan.createAnyway })).toBeEnabled();
      await expectNoAccessibilityViolations(page);
    });

    test(`P12 ${size}: F13 Die Reihe zeigt vorhanden, auf der Wunschliste und fehlt; Filter und Wunsch aus der Reihe`, async ({
      page,
    }) => {
      await signInDirectly(page, undefined, DEMO_COLLECTION);
      await createClonesSeries(page);
      // The example build works two sets per call and goes on while the page is open.
      await expect(page.locator(".series-hero__number")).toHaveText("3");
      await expect(page.getByText("von 8 Figuren")).toBeVisible();
      await expect(page.getByText(R.detail.missingLine(5, 3))).toBeVisible();
      await expect(page.locator(".series-hero ~ .banner")).toHaveCount(0);
      await expectNoAccessibilityViolations(page);

      const grid = page.locator(".figure-grid .figure-tile__name");
      await expect(grid).toHaveCount(8);
      await page.getByRole("button", { name: R.detail.filters.missing }).click();
      await expect(grid).toHaveText([
        "Ahsoka Tano",
        "Asajj Ventress",
        "Battle Droid",
        "Commander Cody",
        "Plo Koon",
      ]);
      await page.getByRole("button", { name: R.detail.filters.present }).click();
      await expect(grid).toHaveText(
        ["Captain Rex", "Clone Trooper Phase II", "ARC Trooper Fives"].sort(),
      );

      // F13: a missing figure goes onto the wishlist with priority and target price.
      await page.getByRole("button", { name: R.detail.filters.all }).click();
      await page.getByRole("button", { name: /Plo Koon/ }).click();
      await expect(sheet(page).getByRole("heading", { name: S.titleNew })).toBeVisible();
      await expectNoAccessibilityViolations(page);
      await sheet(page).getByRole("button", { name: W.priorityChoices.high }).click();
      await sheet(page).getByLabel(S.targetPrice).fill("15,00");
      await sheet(page).getByRole("button", { name: S.add }).click();
      await expect(sheet(page)).toHaveCount(0);
      await expect(page.getByText(R.detail.missingLine(5, 4))).toBeVisible();

      await page.goto("#/wunschliste");
      await expect(page.locator(".wish-row").filter({ hasText: "Plo Koon" })).toContainText(
        `${W.priorities.high}`,
      );
      await expect(page.locator(".wish-row").filter({ hasText: "Plo Koon" })).toContainText(
        W.fromSeries("Star Wars – The Clone Wars"),
      );
    });
  });
}

test("P12 Meine Reihen zeigt Fortschritt und die zuletzt geöffnete Reihe zuerst", async ({
  page,
}) => {
  await signInDirectly(page, undefined, DEMO_COLLECTION);
  await createClonesSeries(page);
  await expect(page.getByText("von 8 Figuren")).toBeVisible();
  await page.goto("#/wunschliste/reihen");
  const card = page.locator(".series-card").first();
  await expect(card).toContainText("Star Wars – The Clone Wars");
  await expect(card).toContainText(R.progress(3, 8));
  await expect(card.getByRole("img", { name: R.progressLabel(3, 8) })).toBeVisible();

  await page.getByRole("searchbox", { name: R.searchLabel }).fill("batman");
  await page.getByRole("button", { name: /Batman Movie Series/ }).click();
  await sheet(page).getByRole("button", { name: R.plan.create }).click();
  await expect(page.getByText("von 4 Figuren")).toBeVisible();
  await page.goto("#/wunschliste/reihen");
  await expect(page.locator(".series-card").first()).toContainText("Batman Movie Series");
  await expect(page.locator(".series-card")).toHaveCount(2);
});

test("P12 Beim Tageslimit wartet der Aufbau und geht danach von selbst weiter", async ({
  page,
}) => {
  await signInDirectly(page, undefined, DEMO_COLLECTION);
  await createClonesSeries(page, "limit_reached");
  await expect(page.locator(".banner").filter({ hasText: "Tageslimit" })).toBeVisible();
  await expect(page.locator(".series-hero__number")).toHaveText("0");
  await expectNoAccessibilityViolations(page);

  await page.evaluate((key) => localStorage.removeItem(key), SERIES_KEY);
  await page.reload();
  await expect(page.locator(".series-hero__number")).toHaveText("3");
  await expect(page.getByText("von 8 Figuren")).toBeVisible();
});

test("P12 Ohne Verbindung sagt die Suche es; eine Reihe lässt sich löschen, die Figuren bleiben", async ({
  page,
}) => {
  await signInDirectly(page, undefined, DEMO_COLLECTION);
  await page.goto("#/wunschliste/reihen");
  await page.evaluate((key) => localStorage.setItem(key, "offline"), SERIES_KEY);
  await page.getByRole("searchbox", { name: R.searchLabel }).fill("clone");
  await expect(page.locator(".banner--error")).toHaveText(R.searchFailed.offline);
  await page.evaluate((key) => localStorage.removeItem(key), SERIES_KEY);

  await createClonesSeries(page);
  await expect(page.getByText("von 8 Figuren")).toBeVisible();
  await page.getByRole("button", { name: R.detail.remove }).click();
  await page.getByRole("button", { name: R.detail.removeConfirm }).click();
  await expect(page).toHaveURL(/#\/wunschliste\/reihen$/);
  await expect(page.getByText(R.empty)).toBeVisible();
  await page.goto("#/vitrine");
  await expect(page.getByText("Captain Rex").first()).toBeVisible();
});

test("P12 Eine unbekannte Reihe sagt es", async ({ page }) => {
  await signInDirectly(page);
  await page.goto("#/wunschliste/reihen/999");
  await expect(page.getByRole("heading", { name: R.detail.notFound.title })).toBeVisible();
  await expectNoAccessibilityViolations(page);
});

test("P12 F13 Eine fehlende Figur eines Sets geht mit „+ Wunschliste“ auf die Wunschliste", async ({
  page,
}) => {
  const base = DEMO_COLLECTION.sets[0];
  if (!base) throw new Error("Die Beispielsammlung hat kein Set");
  const collection: Collection = {
    ...DEMO_COLLECTION,
    sets: [
      {
        ...base,
        containedFigures: [
          { name: "Plo Koon", bricklinkId: "sw0225" },
          { name: "Clone Trooper", bricklinkId: "sw0631", quantity: 1 },
        ],
      },
    ],
  };
  await signInDirectly(page, undefined, collection);
  await page.goto(`#/vitrine/set/${base.id}`);
  await page.getByRole("button", { name: TEXTS.detail.set.addWishLabel("Plo Koon") }).click();
  await expect(sheet(page).getByRole("heading", { name: S.titleNew })).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await sheet(page).getByRole("button", { name: S.add }).click();
  await expect(sheet(page)).toHaveCount(0);
  // It is on the list now; the button offers to change the wish.
  await expect(page.getByRole("button", { name: `Plo Koon: ${S.titleEdit}` })).toHaveText(
    S.titleEdit,
  );
  await page.goto("#/wunschliste");
  await expect(page.locator(".wish-row__name")).toContainText(["Plo Koon"]);
});
