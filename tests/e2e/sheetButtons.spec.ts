import { expect, type Locator, type Page, test } from "@playwright/test";
import { DEMO_COLLECTION } from "../../src/demo/collection";
import { TEXTS } from "../../src/ui/texts";
import { expectNoAccessibilityViolations, PC, PHONE, signInDirectly, wishEntry } from "./helpers";

// Bug from the PO (02.11.2026): the buttons of the wish sheet stood in one line and ran out of the
// sheet on the right; "Von der Wunschliste entfernen" could not be reached. Now: stacked in full
// width in the wish sheet, and no sheet with several buttons runs out sideways. Plus a bin beside
// each wish with a question.

const W = TEXTS.wishlist;
const S = TEXTS.wishSheet;
const SIZES = [
  ["Handy", PHONE],
  ["kleines Handy", { width: 320, height: 640 }],
  ["PC", PC],
] as const;

/** Every button at the bottom of the sheet lies fully on screen and inside the sheet. */
async function expectActionsFit(dialog: Locator): Promise<void> {
  const footer = dialog.locator(".sheet__footer");
  const overflow = await footer.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow, "Knöpfe laufen seitlich aus dem Blatt").toBeLessThanOrEqual(0);
  const sheet = await dialog.boundingBox();
  const buttons = footer.getByRole("button");
  const count = await buttons.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index++) {
    const button = buttons.nth(index);
    await expect(button).toBeInViewport({ ratio: 1 });
    const box = await button.boundingBox();
    expect(box && sheet && box.x + box.width <= sheet.x + sheet.width + 1).toBe(true);
    expect(box && sheet && box.x >= sheet.x - 1).toBe(true);
  }
}

/** Without the slide-in of the sheets, so positions are measured where the sheet comes to rest. */
async function start(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signInDirectly(page, undefined, DEMO_COLLECTION);
}

async function openWishlist(page: Page, viewport: { width: number; height: number }) {
  await start(page, viewport);
  await page.goto("#/wunschliste");
  await expect(wishEntry(page, "Ahsoka Tano")).toBeVisible();
}

for (const [size, viewport] of SIZES) {
  test(`Wunschblatt ${size}: Speichern, Erhalten und Entfernen untereinander, alle sichtbar; Entfernen klappt`, async ({
    page,
  }) => {
    await openWishlist(page, viewport);
    await wishEntry(page, "Ahsoka Tano").click();
    const dialog = page.getByRole("dialog", { name: S.titleEdit });
    await expect(dialog).toBeVisible();

    const save = dialog.getByRole("button", { name: S.save });
    const received = dialog.getByRole("button", { name: S.received });
    const remove = dialog.getByRole("button", { name: S.remove });
    await expectActionsFit(dialog);
    // One below the other, in this order, each in the full width of the sheet.
    const boxes = await Promise.all([save, received, remove].map((button) => button.boundingBox()));
    const [first, second, third] = boxes;
    expect(first && second && third && first.y < second.y && second.y < third.y).toBe(true);
    expect(first && second && Math.abs(first.width - second.width) < 1).toBe(true);
    await expect(remove).toHaveClass(/button--danger/);
    await expectNoAccessibilityViolations(page);

    await remove.click();
    await expectActionsFit(dialog);
    await expect(dialog.getByRole("button", { name: S.removeKeep })).toBeInViewport({ ratio: 1 });
    await dialog.getByRole("button", { name: S.removeConfirm }).click();
    await expect(dialog).toBeHidden();
    await expect(wishEntry(page, "Ahsoka Tano")).toHaveCount(0);
  });

  test(`Wunschliste ${size}: Mülleimer je Eintrag, Rückfrage, dann ist der Wunsch weg`, async ({
    page,
  }) => {
    await openWishlist(page, viewport);
    const bin = page.getByRole("button", { name: W.remove.button("Battle Droid") });
    // Fully on screen once scrolled to (nothing cut off at the right edge).
    await bin.scrollIntoViewIfNeeded();
    await expect(bin).toBeInViewport({ ratio: 1 });
    await bin.click();
    const dialog = page.getByRole("dialog", { name: W.remove.title("Battle Droid") });
    await expect(dialog.getByText(W.remove.text)).toBeVisible();
    await expectActionsFit(dialog);
    await expectNoAccessibilityViolations(page);

    // "Behalten" keeps it.
    await dialog.getByRole("button", { name: W.remove.keep }).click();
    await expect(dialog).toBeHidden();
    await expect(wishEntry(page, "Battle Droid")).toBeVisible();

    await bin.click();
    await page
      .getByRole("dialog", { name: W.remove.title("Battle Droid") })
      .getByRole("button", { name: W.remove.confirm })
      .click();
    await expect(wishEntry(page, "Battle Droid")).toHaveCount(0);
    await expect(page.getByText(W.entries(DEMO_COLLECTION.wishlist.length - 1))).toBeVisible();
  });
}

test("Wunschliste: Auch ein Wunsch mit erreichtem Zielpreis hat einen Mülleimer", async ({
  page,
}) => {
  await openWishlist(page, PHONE);
  const reached = page.locator(".wish-item--reached").first();
  await expect(reached).toBeVisible();
  const bin = reached.getByRole("button", { name: /von der Wunschliste entfernen$/ });
  await expect(bin).toBeInViewport({ ratio: 1 });
  await bin.click();
  await expect(page.getByRole("dialog", { name: /entfernen\?$/ })).toBeVisible();
});

for (const [size, viewport] of SIZES) {
  test(`Andere Blätter ${size}: Filter, Löschen und Mod-Teil laufen nicht seitlich über`, async ({
    page,
  }) => {
    await start(page, viewport);

    await page.goto("#/vitrine");
    await page.getByRole("button", { name: TEXTS.showcase.filterButton }).click();
    await expectActionsFit(page.getByRole("dialog", { name: TEXTS.filter.title }));
    await page.keyboard.press("Escape");

    await page.getByText("Captain Rex").first().click();
    await page.getByRole("button", { name: TEXTS.actions.remove }).click();
    await expectActionsFit(page.getByRole("dialog", { name: TEXTS.remove.title("Captain Rex") }));
    await page.keyboard.press("Escape");

    await page.goto("#/erfassen/figur");
    await page.getByRole("button", { name: TEXTS.form.mods.add }).click();
    await expectActionsFit(page.getByRole("dialog", { name: TEXTS.mod.titleNew }));
  });
}
