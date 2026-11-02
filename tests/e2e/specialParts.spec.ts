import { expect, type Page, test } from "@playwright/test";
import { DEMO_COLLECTION } from "../../src/demo/collection";
import { aPrice, aSpecialPart } from "../../src/domain/fixtures";
import { TEXTS } from "../../src/ui/texts";
import {
  expectNoAccessibilityViolations,
  heading,
  PC,
  PHONE,
  signInDirectly,
  style,
} from "./helpers";

// Special parts (GWP, Insiders reward) from the BrickLink catalog: "Nummer oder Suche" finds them by
// number as gear, set or book, the form fills green, the type is kept, and the price run asks for
// them. The catalog is the example catalog of `src/demo/catalog.ts`; the real function and the
// order of the BrickLink types are tested in `supabase/functions/_shared/specialPart.test.ts`.

const S = TEXTS.search;
const C = TEXTS.catalogForm;
const F = TEXTS.form;
const D = TEXTS.detail;
const P = TEXTS.priceRun;
const SIZES = [
  ["Handy", PHONE],
  ["PC", PC],
] as const;

/** The mint tint of the filled fields (`--tint-mint`). */
const MINT = "rgb(181, 229, 204)";
const CARD = "The Mandalorian and Grogu Metal Card";

const searchField = (page: Page) => page.getByRole("searchbox", { name: S.label });
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });
const row = (page: Page, label: string) =>
  page.locator(".rows__row").filter({ hasText: label }).locator("dd");

test.describe("Sonderteil aus dem Katalog (S7b, S8)", () => {
  test.beforeEach(async ({ page }) => {
    await signInDirectly(page);
  });

  for (const [size, viewport] of SIZES) {
    test(`${size}: Erfassen → Sonderteil → „Nummer oder Suche“, die Nummer 5010325 findet das Gear, keine axe-Verstöße`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/erfassen");
      const sheet = page.getByRole("dialog", { name: TEXTS.capture.title });
      await sheet.getByRole("button", { name: TEXTS.capture.what.specialPart }).click();
      const way = sheet.getByRole("link", { name: new RegExp(TEXTS.capture.ways.search.title) });
      await expect(way).toContainText(TEXTS.capture.partsSearch);
      await way.click();

      await expect(page).toHaveURL(/#\/erfassen\/suche\/sonderteil$/);
      await expect(heading(page)).toHaveText(S.title);
      await expect(searchField(page)).toHaveAttribute("placeholder", S.placeholder.specialPart);
      await expect(page.getByText(S.idleParts)).toBeVisible();
      await expect(page.getByRole("button", { name: S.kinds.specialPart })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expectNoAccessibilityViolations(page);

      await searchField(page).fill("5010325");
      await expect(page.getByText(S.results(1))).toBeVisible();
      const hit = page.getByRole("link", { name: S.pick(CARD) });
      await expect(hit).toBeVisible();
      await expect(hit).toContainText(`5010325 · ${S.bricklinkTypes.GEAR}`);
      await expectNoAccessibilityViolations(page);
    });
  }

  test("Sonderteile werden nur über die Nummer gefunden: ein Name gibt keinen Treffer, mit Hinweis", async ({
    page,
  }) => {
    await page.goto("#/erfassen/suche/sonderteil");
    await searchField(page).fill("Metal Card");
    await expect(page.getByText(S.none)).toBeVisible();
    await expect(page.getByText(S.noneParts)).toBeVisible();
    await expectNoAccessibilityViolations(page);
    await page.getByRole("link", { name: S.manual }).click();
    await expect(heading(page)).toHaveText(F.titleNew.specialPart);
  });

  test("Ein Treffer öffnet das grüne Formular mit Name, Nummer, Kategorie und Jahr; gespeichert zeigt die Seite den BrickLink-Typ", async ({
    page,
  }) => {
    await page.goto("#/erfassen/suche/sonderteil");
    await searchField(page).fill("5010325");
    await page.getByRole("link", { name: S.pick(CARD) }).click();

    await expect(page).toHaveURL(/#\/erfassen\/sonderteil\/katalog\/GEAR%3A5010325$/);
    await expect(heading(page)).toHaveText(F.titleCatalog.specialPart);
    await expect(page.getByText(C.banner)).toBeVisible();
    await expect(field(page, F.fields.name)).toHaveValue(CARD);
    await expect(field(page, F.fields.number.specialPart)).toHaveValue("5010325");
    await expect(field(page, F.fields.theme)).toHaveValue("Gear – Miscellaneous");
    await expect(field(page, F.fields.year)).toHaveValue("2026");
    for (const label of [F.fields.name, F.fields.number.specialPart, F.fields.year]) {
      expect(await style(field(page, label), "background-color"), label).toBe(MINT);
    }
    // The type the number was found under is said at the number.
    await expect(field(page, F.fields.number.specialPart)).toHaveAccessibleDescription(
      new RegExp(C.bricklinkTypeHint(S.bricklinkTypes.GEAR).slice(0, 30)),
    );
    await expectNoAccessibilityViolations(page);

    await page.getByRole("button", { name: F.save }).click();
    await expect(heading(page)).toHaveText(CARD);
    await expect(row(page, D.origin.number)).toHaveText("5010325");
    await expect(row(page, D.origin.bricklinkType)).toHaveText(S.bricklinkTypes.GEAR);
    await expect(row(page, D.origin.year)).toHaveText("2026");
    await expectNoAccessibilityViolations(page);

    // It is on the server with its type.
    await page.reload();
    await expect(row(page, D.origin.bricklinkType)).toHaveText(S.bricklinkTypes.GEAR);
  });

  test("Ein Sonderteil vom Typ Set (5008889) wird gefunden, auch wenn die Nummer ohne „-1“ eingegeben wird", async ({
    page,
  }) => {
    await page.goto("#/erfassen/suche/sonderteil");
    await searchField(page).fill("5008889");
    const hit = page.getByRole("link", { name: S.pick("Promo-Set (Beispiel)") });
    await expect(hit).toContainText(`5008889-1 · ${S.bricklinkTypes.SET}`);
    await hit.click();
    await expect(page).toHaveURL(/#\/erfassen\/sonderteil\/katalog\/SET%3A5008889-1$/);
    await expect(field(page, F.fields.number.specialPart)).toHaveValue("5008889-1");
  });

  test("Wird die Nummer im Formular geändert, ist sie nicht mehr grün, der Hinweis zum Typ geht, und das Sonderteil hat keinen Typ", async ({
    page,
  }) => {
    await page.goto("#/erfassen/sonderteil/katalog/GEAR%3A5010325");
    await field(page, F.fields.number.specialPart).fill("5010326");
    expect(await style(field(page, F.fields.number.specialPart), "background-color")).not.toBe(
      MINT,
    );
    await expect(page.getByText(C.bricklinkTypeHint(S.bricklinkTypes.GEAR))).toHaveCount(0);
    await page.getByRole("button", { name: F.save }).click();
    await expect(heading(page)).toHaveText(CARD);
    await expect(row(page, D.origin.number)).toHaveText("5010326");
    await expect(
      page.locator(".rows__row").filter({ hasText: D.origin.bricklinkType }),
    ).toHaveCount(0);
  });

  test("Eine Nummer, die BrickLink nicht kennt, führt zum Hinweis mit dem Weg „Von Hand anlegen“", async ({
    page,
  }) => {
    await page.goto("#/erfassen/sonderteil/katalog/GEAR%3A99999");
    await expect(page.getByRole("alert")).toContainText(C.failed.notFound);
    await expectNoAccessibilityViolations(page);
    await page.getByRole("link", { name: C.failed.manual }).click();
    await expect(heading(page)).toHaveText(F.titleNew.specialPart);
  });

  test("Die Wunschliste bietet keine Sonderteile an: die Suche für einen Wunsch hat nur Figuren und Sets", async ({
    page,
  }) => {
    await page.goto("#/erfassen/suche/figur/wunsch");
    await expect(page.getByRole("button", { name: S.kinds.specialPart })).toHaveCount(0);
    await expect(page.getByRole("button", { name: S.kinds.legoSet })).toBeVisible();
    // An address of a special part wish does not exist: the showcase opens.
    await page.goto("#/erfassen/suche/sonderteil/wunsch");
    await expect(searchField(page)).toHaveCount(0);
  });
});

test.describe("Preisabruf für Sonderteile (S12)", () => {
  /** The demo collection plus the card from the catalog with a price point of last week. */
  const withCard = () => ({
    ...DEMO_COLLECTION,
    specialParts: [
      ...DEMO_COLLECTION.specialParts,
      aSpecialPart({
        id: "part-card",
        name: CARD,
        kind: "gwp",
        number: "5010325",
        bricklinkType: "GEAR",
        year: 2026,
        condition: "new",
      }),
      // Without a type: keeps its own value, is not asked for.
      aSpecialPart({
        id: "part-own",
        name: "Eigene Karte",
        number: "5010325",
        manualValue: { cents: 700, enteredOn: "2026-10-01" },
      }),
    ],
    prices: [
      ...DEMO_COLLECTION.prices,
      aPrice("GEAR:5010325", "2026-10-26", { new: 1500, used: 900 }, "specialPart"),
    ],
  });

  test("„Jetzt aktualisieren“ fragt auch das Sonderteil mit BrickLink-Typ ab; die Wert-Karte zeigt den neuen Stand, das Sonderteil ohne Typ bleibt beim eigenen Wert", async ({
    page,
  }) => {
    await signInDirectly(page, undefined, withCard());
    await page.goto("#/vitrine/sonderteil/part-card");
    const card = page.locator(".value-card");
    await expect(card).toContainText("15,00 €");
    await expect(card).toContainText(D.value.market("neu"));
    await expectNoAccessibilityViolations(page);

    await page.goto("#/einstellungen");
    await page.getByRole("button", { name: P.update }).click();
    await expect(page.getByRole("status").filter({ hasText: P.finished })).toBeVisible();

    await page.goto("#/vitrine/sonderteil/part-card");
    // The fake run adds 2 % to the last price: 15,00 € → 15,30 €.
    await expect(card).toContainText("15,30 €");
    await expect(card).toContainText(D.value.market("neu"));

    await page.goto("#/vitrine/sonderteil/part-own");
    await expect(page.locator(".value-card")).toContainText("7,00 €");
    await expect(page.locator(".value-card")).not.toContainText(D.value.market("neu"));
  });
});
