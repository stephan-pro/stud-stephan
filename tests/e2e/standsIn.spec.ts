import { expect, type Page, test } from "@playwright/test";
import { DEMO_COLLECTION } from "../../src/demo/collection";
import type { Collection, LegoSet, Minifig } from "../../src/domain/types";
import { TEXTS } from "../../src/ui/texts";
import { expectNoAccessibilityViolations, heading, PC, PHONE, signInDirectly } from "./helpers";

// "Steht in": a figure is displayed in a diorama or in an own set, or nowhere. A figure out of a
// complete own set stands in it by itself. Texts come from `TEXTS`.

const S = TEXTS.detail.stand;
const D = TEXTS.dioramas;
const SIZES = [
  ["Handy", PHONE],
  ["PC", PC],
] as const;

const castle: LegoSet = {
  type: "legoSet",
  id: "set-castle",
  name: "Mini Disney Castle",
  setNumber: "40478-1",
  manufacturer: { kind: "lego" },
  theme: "Disney",
  condition: "new",
  status: "complete",
  containedFigures: [],
  photos: [],
  links: [],
  createdAt: "2026-10-01T10:00:00Z",
};
const mickey: Minifig = {
  type: "minifig",
  id: "minifig-mickey",
  name: "Mickey Mouse",
  bricklinkId: "dis057",
  manufacturer: { kind: "lego" },
  theme: "Disney",
  condition: "new",
  fromSet: { label: "40478-1", setId: "set-castle" },
  mods: [],
  photos: [],
  links: [],
  createdAt: "2026-10-02T10:00:00Z",
};
const COLLECTION: Collection = {
  ...DEMO_COLLECTION,
  sets: [...DEMO_COLLECTION.sets, castle],
  minifigs: [...DEMO_COLLECTION.minifigs, mickey],
};
const loose = DEMO_COLLECTION.minifigs.find((figure) => figure.id === "minifig-fives");
const inDiorama = DEMO_COLLECTION.minifigs.find((figure) => figure.id === "minifig-clone-pilot");
if (!loose || loose.dioramaId || !inDiorama?.dioramaId)
  throw new Error("Beispielsammlung passt nicht");

const section = (page: Page, title: string) => page.getByRole("region", { name: title });

test.describe("Steht in: Seite einer Figur", () => {
  test.beforeEach(async ({ page }) => {
    await signInDirectly(page, undefined, COLLECTION);
  });

  for (const [size, viewport] of SIZES) {
    test(`Steht in ${size}: Figur in ein Set stellen (mit Suche), wieder herausnehmen, axe ist ruhig`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto(`#/vitrine/figur/${loose.id}`);
      const stand = section(page, S.title);
      await expect(stand).toContainText(S.none);

      await stand.getByRole("button", { name: S.choose }).click();
      const sheet = page.getByRole("dialog", { name: S.sheetTitle });
      await sheet.getByRole("button", { name: S.kinds.set }).click();
      // The sets with a search: only the castle is left after typing.
      await sheet.getByLabel(S.searchSets, { exact: true }).fill("castle");
      await expect(sheet.getByRole("button", { name: /Battle Pack/ })).toHaveCount(0);
      await expectNoAccessibilityViolations(page);
      await sheet.getByRole("button", { name: /Mini Disney Castle/ }).click();

      const row = stand.getByRole("link", { name: /Mini Disney Castle/ });
      await expect(row).toContainText(S.kinds.set);
      await page.reload();
      await expect(
        section(page, S.title).getByRole("link", { name: /Mini Disney Castle/ }),
      ).toBeVisible();

      // Both ways: the set lists the figure under "Ausgestellte Figuren".
      await section(page, S.title)
        .getByRole("link", { name: /Mini Disney Castle/ })
        .click();
      await expect(heading(page)).toHaveText("Mini Disney Castle");
      await expect(
        section(page, TEXTS.detail.set.displayedTitle).getByRole("link", { name: loose.name }),
      ).toBeVisible();

      await page.goBack();
      await page.getByRole("button", { name: S.takeFromSet }).click();
      await expect(section(page, S.title)).toContainText(S.none);
      await page.reload();
      await expect(section(page, S.title)).toContainText(S.none);
    });
  }

  test("Steht in: Ein Diorama statt eines Sets wählen ersetzt das Set, nie beides", async ({
    page,
  }) => {
    await page.goto(`#/vitrine/figur/${loose.id}`);
    await section(page, S.title).getByRole("button", { name: S.choose }).click();
    const sheet = page.getByRole("dialog", { name: S.sheetTitle });
    await sheet.getByRole("button", { name: S.kinds.set }).click();
    await sheet.getByRole("button", { name: /Mini Disney Castle/ }).click();
    await expect(section(page, S.title)).toContainText(S.takeFromSet);

    // The figure is taken out of the set first; only then it can go into a diorama.
    await page.getByRole("button", { name: S.takeFromSet }).click();
    await section(page, S.title).getByRole("button", { name: S.choose }).click();
    await page
      .getByRole("dialog", { name: S.sheetTitle })
      .getByRole("button", { name: /Kamino-Hangar/ })
      .click();
    await page.reload();
    const stand = section(page, S.title);
    await expect(stand.getByRole("link", { name: /Kamino-Hangar/ })).toContainText(S.kinds.diorama);
    await expect(stand.getByRole("button", { name: S.takeFromDiorama })).toBeVisible();
    await page.goto("#/vitrine/set/set-castle");
    await expect(section(page, TEXTS.detail.set.displayedTitle)).not.toContainText(loose.name);
  });

  for (const [size, viewport] of SIZES) {
    test(`Steht in ${size}: Automatik – eine Figur aus einem vollständigen Set steht in diesem Set`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto(`#/vitrine/figur/${mickey.id}`);
      const stand = section(page, S.title);
      await expect(stand.getByRole("link", { name: /Mini Disney Castle/ })).toContainText(
        S.automatic,
      );
      await expect(stand).toContainText(S.automaticHint);
      await expect(stand.getByRole("button", { name: S.chooseElsewhere })).toBeVisible();
      await expect(stand.getByRole("button", { name: S.takeFromSet })).toBeVisible();
      await expectNoAccessibilityViolations(page);

      await page.goto("#/vitrine/set/set-castle");
      const displayed = section(page, TEXTS.detail.set.displayedTitle);
      await expect(displayed.getByRole("link", { name: /Mickey Mouse/ })).toContainText(
        TEXTS.detail.set.displayedAutomatic,
      );
      await expectNoAccessibilityViolations(page);
    });
  }

  test("Steht in: Eine automatisch ausgestellte Figur lässt sich aus dem Set nehmen, der Status des Sets bleibt", async ({
    page,
  }) => {
    await page.goto(`#/vitrine/figur/${mickey.id}`);
    await page.getByRole("button", { name: S.takeFromSet }).click();
    await expect(section(page, S.title)).toContainText(S.none);
    await page.reload();
    await expect(section(page, S.title)).toContainText(S.none);
    await expect(section(page, S.title).getByRole("button", { name: S.choose })).toBeVisible();

    await page.goto("#/vitrine/set/set-castle");
    await expect(section(page, TEXTS.detail.set.displayedTitle)).not.toContainText("Mickey Mouse");
    await expect(page.getByText(TEXTS.setStatus.complete).first()).toBeVisible();
    // Back into the set on purpose: the choice replaces the "no".
    await page.goto(`#/vitrine/set/set-castle/zuordnen`);
    await page.getByLabel(TEXTS.dioramas.assign.searchLabel, { exact: true }).fill("Mickey");
    await page.locator(".pick", { hasText: "Mickey Mouse" }).click();
    await page.getByRole("button", { name: TEXTS.dioramas.assign.submit(1) }).click();
    await expect(
      section(page, TEXTS.detail.set.displayedTitle).getByRole("link", { name: /Mickey Mouse/ }),
    ).toBeVisible();
  });

  test("Steht in: Setzt der PO den Status auf „Figuren entnommen“, ist die Figur nicht mehr ausgestellt", async ({
    page,
  }) => {
    await page.goto("#/vitrine/set/set-castle/bearbeiten");
    await page.getByRole("button", { name: TEXTS.setStatus.figuresRemoved }).click();
    await page.getByRole("button", { name: TEXTS.form.save }).click();
    await expect(heading(page)).toHaveText("Mini Disney Castle");
    await page.goto(`#/vitrine/figur/${mickey.id}`);
    await expect(section(page, S.title)).toContainText(S.none);
  });
});

test.describe("Steht in: nicht ausgestellt (Marker, Banner, Filter)", () => {
  test.beforeEach(async ({ page }) => {
    await signInDirectly(page, undefined, COLLECTION);
  });

  for (const [size, viewport] of SIZES) {
    test(`Steht in ${size}: Eine Figur im Set ist nicht mehr „nicht ausgestellt“ (Marker, Banner, Filter)`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const notShown = COLLECTION.minifigs.filter(
        (figure) => !figure.dioramaId && !figure.fromSet?.setId,
      ).length;
      await page.goto("#/dioramen");
      const banner = page.getByRole("button", { name: /nicht ausgestellt/ });
      // Mickey stands in the castle by itself, so he is not counted.
      await expect(banner).toContainText(D.withoutBanner.count(notShown));

      // Putting the loose figure into the castle makes the banner one smaller.
      await page.goto(`#/vitrine/figur/${loose.id}`);
      await section(page, S.title).getByRole("button", { name: S.choose }).click();
      const sheet = page.getByRole("dialog", { name: S.sheetTitle });
      await sheet.getByRole("button", { name: S.kinds.set }).click();
      await sheet.getByRole("button", { name: /Mini Disney Castle/ }).click();
      await expect(section(page, S.title)).toContainText(S.takeFromSet);
      await page.goto("#/dioramen");
      await expect(page.getByRole("button", { name: /nicht ausgestellt/ })).toContainText(
        D.withoutBanner.count(notShown - 1),
      );

      // The banner opens the showcase with the filter; the tile of Mickey has no marker.
      await page.getByRole("button", { name: /nicht ausgestellt/ }).click();
      await expect(page).toHaveURL(/#\/vitrine$/);
      await expect(
        page.getByRole("button", { name: TEXTS.showcase.filterButtonActive(1) }),
      ).toBeVisible();
      await expect(page.locator(".tile", { hasText: "Mickey Mouse" })).toHaveCount(0);
      await expect(page.locator(".tile", { hasText: loose.name })).toHaveCount(0);
      await expect(
        page.locator(".tile", { hasText: TEXTS.showcase.tile.notOnDisplay }).first(),
      ).toBeVisible();
    });
  }

  test("Steht in: Ohne Filter zeigt die Kachel von Mickey keinen Marker, die einer losen Figur schon", async ({
    page,
  }) => {
    await page.goto("#/vitrine");
    const marker = TEXTS.showcase.tile.notOnDisplay;
    await expect(page.locator(".tile", { hasText: "Mickey Mouse" })).not.toContainText(marker);
    await expect(page.locator(".tile", { hasText: loose.name })).toContainText(marker);
  });
});

test.describe("Steht in: Zuordnen-Seite eines Sets (S6a)", () => {
  test.beforeEach(async ({ page }) => {
    await signInDirectly(page, undefined, COLLECTION);
  });

  for (const [size, viewport] of SIZES) {
    test(`Steht in ${size}: Figuren dem Set zuordnen, eine aus einem Diorama erst nach Rückfrage`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/vitrine/set/set-castle");
      await page.getByRole("link", { name: TEXTS.detail.set.displayedAssign }).click();
      await expect(page).toHaveURL(/#\/vitrine\/set\/set-castle\/zuordnen$/);
      await expect(heading(page)).toHaveText(D.assign.title);
      // Figures that are displayed nowhere are offered first, Mickey stands there already.
      await expect(page.locator(".pick", { hasText: "Mickey Mouse" })).toHaveCount(0);
      await expect(page.getByText(/^steht in:/)).toHaveCount(0);
      await expectNoAccessibilityViolations(page);

      await page.getByRole("button", { name: D.assign.all }).click();
      await page.getByLabel(D.assign.searchLabel, { exact: true }).fill(inDiorama.name);
      const pick = page.locator(".pick", { hasText: inDiorama.name }).first();
      await expect(pick).toContainText(D.assign.standsIn("Kamino-Hangar"));
      await pick.click();
      await page.getByRole("button", { name: D.assign.submit(1) }).click();
      const sheet = page.getByRole("dialog", { name: D.assign.move.title(1) });
      await expect(sheet).toContainText("Kamino-Hangar");
      await expectNoAccessibilityViolations(page);
      await sheet.getByRole("button", { name: D.assign.move.confirm }).click();

      await expect(page).toHaveURL(/#\/vitrine\/set\/set-castle$/);
      const displayed = section(page, TEXTS.detail.set.displayedTitle);
      await expect(displayed.getByRole("link", { name: inDiorama.name })).toBeVisible();
      // Out of the diorama, in the set only.
      await page.goto("#/dioramen/diorama-kamino");
      await expect(
        section(page, D.detail.figuresTitle).getByRole("link", { name: inDiorama.name }),
      ).toHaveCount(0);
    });
  }

  test("Steht in: Ein unbekanntes Set sagt es auf der Zuordnen-Seite", async ({ page }) => {
    await page.goto("#/vitrine/set/gibt-es-nicht/zuordnen");
    await expect(page.getByText(TEXTS.detail.notFound.text)).toBeVisible();
  });

  test("Steht in: Set löschen → die Figur bleibt und ist wieder nicht ausgestellt", async ({
    page,
  }) => {
    await page.goto(`#/vitrine/figur/${loose.id}`);
    await section(page, S.title).getByRole("button", { name: S.choose }).click();
    const sheet = page.getByRole("dialog", { name: S.sheetTitle });
    await sheet.getByRole("button", { name: S.kinds.set }).click();
    await sheet.getByRole("button", { name: /Mini Disney Castle/ }).click();
    await expect(section(page, S.title)).toContainText(S.takeFromSet);

    await page.goto("#/vitrine/set/set-castle");
    await page.getByRole("button", { name: TEXTS.actions.remove }).click();
    await page.getByRole("dialog").getByRole("button", { name: TEXTS.remove.confirm }).click();
    const toast = page.locator(".toast", { hasText: TEXTS.remove.done("Mini Disney Castle") });
    await expect(toast).toBeHidden({ timeout: 15_000 });

    await page.reload();
    await page.goto(`#/vitrine/figur/${loose.id}`);
    await expect(heading(page)).toHaveText(loose.name);
    await expect(section(page, S.title)).toContainText(S.none);
    await page.goto(`#/vitrine/figur/${mickey.id}`);
    await expect(section(page, S.title)).toContainText(S.none);
  });
});
