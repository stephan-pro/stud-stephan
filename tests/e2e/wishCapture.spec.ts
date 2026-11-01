import { expect, type Page, test } from "@playwright/test";
import { DEMO_COLLECTION } from "../../src/demo/collection";
import { MERLIN_LINK } from "../../src/demo/links";
import { TEXTS } from "../../src/ui/texts";
import {
  expectNoAccessibilityViolations,
  heading,
  PC,
  PHONE,
  signInDirectly,
  wishEntry,
} from "./helpers";

// P15, gaps from P12: a wish straight from the capture sheet (number, search, link), and a set
// received from the wishlist gets its contained figures like a set from the catalog.

const W = TEXTS.wishCapture;
const S = TEXTS.wishSheet;
const SIZES = [
  ["Handy", PHONE],
  ["PC", PC],
] as const;

function wishSheet(page: Page) {
  return page.getByRole("dialog", { name: new RegExp(`${S.titleNew}|${S.titleEdit}`) });
}

async function openWishWay(page: Page, way: "search" | "link") {
  await page.goto("#/erfassen");
  const capture = page.getByRole("dialog", { name: TEXTS.capture.title });
  await capture.getByRole("button", { name: TEXTS.capture.what.wish }).click();
  await expect(capture.getByText(TEXTS.capture.wishHint)).toBeVisible();
  await capture.getByRole("link", { name: new RegExp(TEXTS.capture.ways[way].title) }).click();
}

for (const [size, viewport] of SIZES) {
  test(`P15 ${size}: Wunsch per Nummer aus dem Erfassen-Blatt, keine axe-Verstöße`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await signInDirectly(page, undefined, DEMO_COLLECTION);
    await page.goto("#/erfassen");
    const capture = page.getByRole("dialog", { name: TEXTS.capture.title });
    await capture.getByRole("button", { name: TEXTS.capture.what.wish }).click();
    // Photo and "Manuell" make no wish.
    await expect(
      capture.getByRole("button", { name: new RegExp(TEXTS.capture.ways.photo.title) }),
    ).toBeDisabled();
    await expect(
      capture.getByRole("button", { name: new RegExp(TEXTS.capture.ways.manual.title) }),
    ).toBeDisabled();
    await expectNoAccessibilityViolations(page);

    await capture.getByRole("link", { name: new RegExp(TEXTS.capture.ways.search.title) }).click();
    await expect(page).toHaveURL(/#\/erfassen\/suche\/figur\/wunsch$/);
    await expect(heading(page)).toHaveText(W.searchTitle);
    await page.getByRole("button", { name: TEXTS.search.kinds.legoSet }).click();
    await expect(page).toHaveURL(/#\/erfassen\/suche\/set\/wunsch$/);
    await page.getByLabel(TEXTS.search.label).fill("75372");
    await page
      .getByRole("button", { name: W.pick("Clone Trooper & Battle Droid Battle Pack") })
      .click();

    const sheet = wishSheet(page);
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("Clone Trooper & Battle Droid Battle Pack")).toBeVisible();
    await expectNoAccessibilityViolations(page);
    await sheet.getByRole("button", { name: S.add }).click();

    await expect(page).toHaveURL(/#\/wunschliste$/);
    await expect(
      page.locator(".wish-row__name", { hasText: "Clone Trooper & Battle Droid Battle Pack" }),
    ).toBeVisible();
  });
}

test("P15 Steht der Wunsch schon auf der Liste, öffnet sich dieser statt eines zweiten", async ({
  page,
}) => {
  await signInDirectly(page, undefined, DEMO_COLLECTION);
  await openWishWay(page, "search");
  // Commander Cody (sw0196) is on the example wishlist; the example catalog knows sw0194 only,
  // so the wish is made first and then found again.
  await page.getByLabel(TEXTS.search.label).fill("sw0194");
  await page.getByRole("button", { name: W.pick("Captain Rex") }).click();
  await wishSheet(page).getByRole("button", { name: S.add }).click();
  await expect(page).toHaveURL(/#\/wunschliste$/);

  await openWishWay(page, "search");
  await page.getByLabel(TEXTS.search.label).fill("sw0194");
  await page.getByRole("button", { name: W.pick("Captain Rex") }).click();
  await expect(page.getByRole("dialog", { name: S.titleEdit })).toBeVisible();
});

test("P15 Wunsch per Link: Seite gelesen, Wunsch mit Name, Hersteller und Link", async ({
  page,
}) => {
  await signInDirectly(page, undefined, DEMO_COLLECTION);
  await openWishWay(page, "link");
  await expect(page).toHaveURL(/#\/erfassen\/link\/set\/wunsch$/);
  await expect(heading(page)).toHaveText(W.linkTitle);
  await page.getByLabel(TEXTS.linkCapture.label).fill(MERLIN_LINK);
  await expect(page.getByRole("heading", { name: TEXTS.linkCapture.recognized })).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await page.getByRole("button", { name: W.next }).click();

  const sheet = wishSheet(page);
  await expect(sheet.getByText("Burgtor mit Zugbrücke")).toBeVisible();
  await sheet.getByRole("button", { name: S.add }).click();
  await expect(page).toHaveURL(/#\/wunschliste$/);
  await wishEntry(page, "Burgtor mit Zugbrücke").click();
  await expect(page.getByRole("dialog", { name: S.titleEdit })).toBeVisible();
});

test("P15 Ein erhaltenes Set aus der Wunschliste bekommt seine enthaltenen Figuren aus dem Katalog", async ({
  page,
}) => {
  await signInDirectly(page, undefined, DEMO_COLLECTION);
  await openWishWay(page, "search");
  await page.getByRole("button", { name: TEXTS.search.kinds.legoSet }).click();
  await page.getByLabel(TEXTS.search.label).fill("75372");
  await page
    .getByRole("button", { name: W.pick("Clone Trooper & Battle Droid Battle Pack") })
    .click();
  await wishSheet(page).getByRole("button", { name: S.add }).click();

  await wishEntry(page, "Clone Trooper & Battle Droid Battle Pack").click();
  await page
    .getByRole("dialog", { name: S.titleEdit })
    .getByRole("button", { name: S.received })
    .click();
  await expect(heading(page)).toHaveText(TEXTS.form.titleWish.legoSet);
  await expect(page.getByLabel(TEXTS.form.fields.minifigCount)).toHaveValue("5");
  await expectNoAccessibilityViolations(page);
  await page.getByRole("button", { name: TEXTS.form.save }).click();

  await expect(page).toHaveURL(/#\/vitrine\/set\//);
  await expect(page.getByText("Commander Bly")).toBeVisible();
  await expect(page.getByText("Battle Droid, Security")).toBeVisible();
});
