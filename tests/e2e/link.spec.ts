import { expect, type Page, test } from "@playwright/test";
import { EMPTY_PAGE_LINK, MERLIN_LINK, SHOP_LINK } from "../../src/demo/links";
import { TEXTS } from "../../src/ui/texts";
import {
  expectNoAccessibilityViolations,
  heading,
  PC,
  PHONE,
  signInDirectly,
  style,
} from "./helpers";

// P9 (F3): capture by link — a pasted address in, as much as possible filled in, the rest left for
// the person; whatever cannot be read, the form still opens with the link saved. The pages are the
// example ones of `src/demo/links.ts`; the real function and its protection are tested in
// `supabase/functions/_shared/link.test.ts`.

const L = TEXTS.linkCapture;
const F = TEXTS.form;
const C = TEXTS.catalogForm;
const SIZES = [
  ["Handy", PHONE],
  ["PC", PC],
] as const;

const LINK_KEY = "stud-stephan-fake:link";
/** The mint tint of the filled fields (`--tint-mint`). */
const MINT = "rgb(181, 229, 204)";

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });
const addressField = (page: Page) => page.getByLabel(L.label, { exact: true });

async function paste(page: Page, address: string): Promise<void> {
  await addressField(page).fill(address);
}

test.beforeEach(async ({ page }) => {
  await signInDirectly(page);
});

test.describe("Link einfügen (S7c)", () => {
  for (const [size, viewport] of SIZES) {
    test(`F3 ${size}: vom Erfassen-Blatt zum Link, eine Seite von Merlins Steine ergibt die Karte „Erkannt“ mit Hinweis „bitte ergänzen“, keine axe-Verstöße`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/erfassen");
      await page.getByRole("button", { name: TEXTS.capture.what.legoSet }).click();
      await page
        .getByRole("dialog", { name: TEXTS.capture.title })
        .getByRole("link", { name: new RegExp(TEXTS.capture.ways.link.title) })
        .click();
      await expect(page).toHaveURL(/#\/erfassen\/link\/set$/);
      await expect(heading(page)).toHaveText(L.title);
      await expect(page.getByText(L.idle)).toBeVisible();
      await expect(page.getByRole("button", { name: L.paste })).toBeVisible();
      await expectNoAccessibilityViolations(page);

      // The picture of the example page loads (a 1 × 1 pixel PNG stands in for it).
      await page.route("**/bluebrixx-110374.jpg", (route) =>
        route.fulfill({
          contentType: "image/png",
          body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
            "base64",
          ),
        }),
      );
      await paste(page, MERLIN_LINK);
      await expect(page.getByRole("heading", { name: L.recognized })).toBeVisible();
      await expect(page.getByText(L.sources.merlin, { exact: true })).toBeVisible();
      const rows = page.locator(".rows__row");
      await expect(rows).toHaveCount(5);
      await expect(rows.nth(0)).toContainText("Burgtor mit Zugbrücke");
      await expect(rows.nth(1)).toContainText("BlueBrixx");
      // The page gave no set number: it says so instead of staying silent.
      await expect(rows.nth(2)).toContainText(L.rows.number.legoSet);
      await expect(rows.nth(2)).toContainText(L.pleaseAdd);
      await expect(rows.nth(3)).toContainText("1.520");
      await expect(rows.nth(4)).toContainText(L.imageTaken);
      await expect(page.getByRole("link", { name: L.next })).toBeVisible();
      await expectNoAccessibilityViolations(page);
    });
  }

  test("F3 Merlins Steine: Weiter öffnet das Formular mit grünen Feldern und gespeichertem Link; speichern legt das Set an", async ({
    page,
  }) => {
    await page.goto("#/erfassen/link/set");
    await paste(page, MERLIN_LINK);
    await page.getByRole("link", { name: L.next }).click();

    await expect(page).toHaveURL(/#\/erfassen\/set\/link\/https%3A%2F%2Fwww\.merlinssteine\.de/);
    await expect(heading(page)).toHaveText(F.titleNew.legoSet);
    await expect(page.getByText(C.linkBanner)).toBeVisible();
    await expect(field(page, F.fields.name)).toHaveValue("Burgtor mit Zugbrücke");
    expect(await style(field(page, F.fields.name), "background-color")).toBe(MINT);
    await expect(field(page, F.fields.pieceCount)).toHaveValue("1520");
    await expect(page.getByRole("button", { name: F.manufacturers.bluebrixx })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Not given by the page: empty and not green.
    await expect(field(page, F.fields.number.legoSet)).toHaveValue("");
    expect(await style(field(page, F.fields.number.legoSet), "background-color")).not.toBe(MINT);
    await expect(field(page, F.fields.links)).toHaveValue(MERLIN_LINK);
    await expectNoAccessibilityViolations(page);

    await page.getByRole("button", { name: F.save }).click();
    await expect(heading(page)).toHaveText("Burgtor mit Zugbrücke");
    // The page's picture is kept as the catalog picture of the set.
    await expect(page.locator(".gallery__track img")).toHaveCount(1);
    await page.reload();
    await expect(heading(page)).toHaveText("Burgtor mit Zugbrücke");
    await expect(page.getByRole("link", { name: /merlinssteine\.de/ })).toBeVisible();
  });

  test("F3 Sperrt die andere Seite die Einbettung des Bildes (wie Merlins Steine), sagt die Karte es, statt „übernommen“ zu zeigen", async ({
    page,
  }) => {
    await page.route("**/bluebrixx-110374.jpg", (route) => route.abort());
    await page.goto("#/erfassen/link/set");
    await paste(page, MERLIN_LINK);
    await expect(page.locator(".rows__row").nth(4)).toContainText(L.imageBlocked);
    await expect(page.locator(".rows__row").nth(4)).not.toContainText(L.imageTaken);
    await expectNoAccessibilityViolations(page);
    // The form still opens and the person can add an own photo.
    await page.getByRole("link", { name: L.next }).click();
    await expect(field(page, F.fields.name)).toHaveValue("Burgtor mit Zugbrücke");
  });

  test("F3 Die Seite liest nur Titel und Bild (Shop oder MOC): der Rest bleibt zum Ergänzen", async ({
    page,
  }) => {
    await page.goto("#/erfassen/link/set");
    await paste(page, SHOP_LINK);
    await expect(page.getByText(L.sources.page, { exact: true })).toBeVisible();
    await expect(page.locator(".rows__row").first()).toContainText("Drachenburg MOC");
    await expect(page.getByText(L.pleaseAdd)).toHaveCount(3);
    await page.getByRole("link", { name: L.next }).click();
    await expect(field(page, F.fields.name)).toHaveValue("Drachenburg MOC");
    await expect(field(page, F.fields.links)).toHaveValue(SHOP_LINK);
    // No manufacturer was found: the choice stays where the person puts it.
    await page.getByRole("button", { name: F.manufacturers.custom }).click();
    await field(page, F.fields.manufacturerName).fill("Eigenbau");
    await page.getByRole("button", { name: F.save }).click();
    await expect(heading(page)).toHaveText("Drachenburg MOC");
  });

  test("F3 Ein Rebrickable-Link zu einem Set führt über den Katalog in das grüne Formular, der Link bleibt am Set", async ({
    page,
  }) => {
    const address = "https://rebrickable.com/sets/75372-1/clone-trooper-battle-droid-battle-pack/";
    await page.goto("#/erfassen/link/set");
    await paste(page, address);
    await expect(page.getByText(L.sources.rebrickable, { exact: true })).toBeVisible();
    await expect(page.getByText(L.kinds.legoSet, { exact: true })).toBeVisible();
    await expect(page.getByText("75372-1", { exact: true })).toBeVisible();
    await expect(page.getByText(L.catalogNote)).toBeVisible();
    await expectNoAccessibilityViolations(page);

    await page.getByRole("link", { name: L.next }).click();
    await expect(page).toHaveURL(/#\/erfassen\/set\/katalog\/75372-1\/link\//);
    await expect(heading(page)).toHaveText(F.titleCatalog.legoSet);
    await expect(page.getByText(C.banner)).toBeVisible();
    await expect(field(page, F.fields.name)).toHaveValue(
      "Clone Trooper & Battle Droid Battle Pack",
    );
    expect(await style(field(page, F.fields.name), "background-color")).toBe(MINT);
    await expect(field(page, F.fields.links)).toHaveValue(address);
    await page.getByRole("button", { name: F.save }).click();
    await expect(heading(page)).toHaveText("Clone Trooper & Battle Droid Battle Pack");
  });

  test("F3 Ein BrickLink-Link zu einer Figur öffnet das Figuren-Formular, auch wenn „Set“ gewählt war", async ({
    page,
  }) => {
    await page.goto("#/erfassen/link/set");
    await paste(page, "https://www.bricklink.com/v2/catalog/catalogitem.page?M=sw0194#T=C");
    await expect(page.getByText(L.sources.bricklink, { exact: true })).toBeVisible();
    await expect(page.getByText(L.kinds.minifig, { exact: true })).toBeVisible();
    await page.getByRole("link", { name: L.next }).click();
    await expect(heading(page)).toHaveText(F.titleCatalog.minifig);
    await expect(field(page, F.fields.name)).toHaveValue("Captain Rex");
    await expect(field(page, F.fields.number.minifig)).toHaveValue("sw0194");
  });

  test("F3 Eine Seite ohne erkennbare Angaben: Hinweis, das Formular öffnet sich trotzdem mit dem Link", async ({
    page,
  }) => {
    await page.goto("#/erfassen/link/set");
    await paste(page, EMPTY_PAGE_LINK);
    await expect(page.getByText(L.nothingFound.title)).toBeVisible();
    await expectNoAccessibilityViolations(page);
    await page.getByRole("link", { name: L.next }).click();
    await expect(field(page, F.fields.links)).toHaveValue(EMPTY_PAGE_LINK);
    await expect(field(page, F.fields.name)).toHaveValue("");
    await expect(page.getByText(C.linkUnreadable)).toBeVisible();
  });
});

test.describe("Link, der sich nicht lesen lässt (F3, Akzeptanzkriterium)", () => {
  for (const [size, viewport] of SIZES) {
    test(`F3 ${size}: Seite nicht lesbar → das Formular öffnet sich trotzdem, mit gespeichertem Link und leeren Feldern; speichern geht`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const address = "https://unbekannt.example.com/set-1";
      await page.goto("#/erfassen/link/set");
      await paste(page, address);
      await expect(page.getByRole("alert")).toContainText(L.failed.title);
      await expect(page.getByText(L.failed.unreachable)).toBeVisible();
      await expectNoAccessibilityViolations(page);

      await page.getByRole("link", { name: L.withoutPreview }).click();
      await expect(heading(page)).toHaveText(F.titleNew.legoSet);
      await expect(page.getByText(C.linkUnreadable)).toBeVisible();
      await expect(field(page, F.fields.links)).toHaveValue(address);
      await expect(field(page, F.fields.name)).toHaveValue("");
      await expectNoAccessibilityViolations(page);

      await field(page, F.fields.name).fill("Mein Set");
      await page.getByRole("button", { name: F.save }).click();
      await expect(heading(page)).toHaveText("Mein Set");
    });
  }

  test("F3 Ein Formular, das nur über die Adresse geöffnet wird (Neuladen), liest den Link noch einmal", async ({
    page,
  }) => {
    await page.goto("#/erfassen/link/set");
    await paste(page, MERLIN_LINK);
    await page.getByRole("link", { name: L.next }).click();
    await expect(field(page, F.fields.pieceCount)).toHaveValue("1520");
    await page.reload();
    await expect(field(page, F.fields.name)).toHaveValue("Burgtor mit Zugbrücke");
    await expect(field(page, F.fields.links)).toHaveValue(MERLIN_LINK);
  });

  test("F3 Gestörte Vorschau beim Öffnen des Formulars: es geht mit leeren Feldern und dem Link auf", async ({
    page,
  }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "unavailable"), LINK_KEY);
    await page.goto(
      `#/erfassen/set/link/${encodeURIComponent("https://www.merlinssteine.de/sets/x-1/")}`,
    );
    await expect(heading(page)).toHaveText(F.titleNew.legoSet);
    await expect(page.getByText(C.linkUnreadable)).toBeVisible();
    await expect(field(page, F.fields.links)).toHaveValue("https://www.merlinssteine.de/sets/x-1/");
  });

  test("F3 Eine Adresse, die die App nicht abrufen darf (localhost, IP, internes Netz), wird erklärt; der Link lässt sich trotzdem speichern", async ({
    page,
  }) => {
    await page.goto("#/erfassen/link/set");
    for (const address of [
      "http://localhost/admin",
      "http://192.168.0.1/",
      "https://127.0.0.1/x",
    ]) {
      await paste(page, address);
      await expect(page.getByText(L.failed.blocked)).toBeVisible();
      // Waiting does not help for a refused address: no "Noch einmal lesen".
      await expect(page.getByRole("button", { name: L.retry })).toHaveCount(0);
      await expect(page.getByRole("link", { name: L.withoutPreview })).toBeVisible();
    }
    await expectNoAccessibilityViolations(page);
  });

  test("F3 Text, der keine Web-Adresse ist: Hinweis am Feld, nichts wird gelesen", async ({
    page,
  }) => {
    await page.goto("#/erfassen/link/set");
    await paste(page, "burg kaufen");
    await expect(page.getByText(L.notAnAddress)).toBeVisible();
    await expect(addressField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("link", { name: L.next })).toHaveCount(0);
    await expectNoAccessibilityViolations(page);
    await paste(page, "");
    await expect(page.getByText(L.idle)).toBeVisible();
  });

  test("F3 Gestörter Dienst oder keine Verbindung: Hinweis, „Noch einmal lesen“ klappt, sobald es wieder geht", async ({
    page,
  }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "unavailable"), LINK_KEY);
    await page.goto("#/erfassen/link/set");
    await paste(page, MERLIN_LINK);
    await expect(page.getByText(L.failed.unavailable)).toBeVisible();
    await page.evaluate((key) => localStorage.setItem(key, "offline"), LINK_KEY);
    await page.getByRole("button", { name: L.retry }).click();
    await expect(page.getByText(L.failed.offline)).toBeVisible();
    await expectNoAccessibilityViolations(page);

    await page.evaluate((key) => localStorage.removeItem(key), LINK_KEY);
    await page.getByRole("button", { name: L.retry }).click();
    await expect(page.getByRole("heading", { name: L.recognized })).toBeVisible();
  });

  test("F3 Zurück vom Formular führt zum Einfügen des Links, „Zurück“ der Seite zum Erfassen", async ({
    page,
  }) => {
    await page.goto("#/erfassen/link/set");
    await paste(page, MERLIN_LINK);
    await page.getByRole("link", { name: L.next }).click();
    await page.getByRole("link", { name: F.cancel }).click();
    await expect(page).toHaveURL(/#\/erfassen\/link\/set$/);
    await page.getByRole("link", { name: L.back }).click();
    await expect(page).toHaveURL(/#\/erfassen$/);
  });
});
