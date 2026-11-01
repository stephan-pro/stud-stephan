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

// P8 (F1): photo recognition — a photo of a figure in, suggestions with BrickLink number and hit
// rate out, a pick opens the form filled from the catalog (green fields) with the own photo on
// it. The suggestions are the example ones of `src/demo/recognition.ts`; the real function is
// tested in `supabase/functions/_shared/recognize.test.ts`.

const R = TEXTS.recognition;
const F = TEXTS.form;
const C = TEXTS.catalogForm;
const SIZES = [
  ["Handy", PHONE],
  ["PC", PC],
] as const;

const RECOGNITION_KEY = "stud-stephan-fake:recognition";
/** The mint tint of the filled fields (`--tint-mint`). */
const MINT = "rgb(181, 229, 204)";

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });
const fileInput = (page: Page) => page.locator('input[type="file"]');
const suggestionLinks = (page: Page) => page.locator("a.suggestion");

/** A photo-like picture made in the page, as the bytes of a JPEG file. */
async function makePhoto(page: Page, width = 1200, height = 900): Promise<Buffer> {
  const base64 = await page.evaluate(
    async ([w, h]) => {
      const canvas = document.createElement("canvas");
      canvas.width = w as number;
      canvas.height = h as number;
      const context = canvas.getContext("2d") as CanvasRenderingContext2D;
      context.fillStyle = "#4477aa";
      context.fillRect(0, 0, w as number, h as number);
      for (let index = 0; index < 200; index++) {
        context.fillStyle = `hsla(${index * 7}, 60%, 50%, 0.5)`;
        context.beginPath();
        context.arc(
          ((index * 97) % (w as number)) | 0,
          ((index * 57) % (h as number)) | 0,
          40,
          0,
          7,
        );
        context.fill();
      }
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((made) => resolve(made as Blob), "image/jpeg", 0.9),
      );
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let text = "";
      for (const byte of bytes) text += String.fromCharCode(byte);
      return btoa(text);
    },
    [width, height],
  );
  return Buffer.from(base64, "base64");
}

async function choosePhoto(page: Page): Promise<void> {
  const photo = await makePhoto(page);
  await fileInput(page).setInputFiles({ name: "figur.jpg", mimeType: "image/jpeg", buffer: photo });
}

test.beforeEach(async ({ page }) => {
  await signInDirectly(page);
});

test.describe("Foto-Erkennung (S7a)", () => {
  for (const [size, viewport] of SIZES) {
    test(`F1 ${size}: vom Erfassen-Blatt zur Foto-Erkennung, ein Foto liefert drei auswählbare Vorschläge mit Nummer und Trefferquote, keine axe-Verstöße`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/erfassen");
      await page
        .getByRole("dialog", { name: TEXTS.capture.title })
        .getByRole("link", { name: new RegExp(TEXTS.capture.ways.photo.title) })
        .click();
      await expect(page).toHaveURL(/#\/erfassen\/foto$/);
      await expect(heading(page)).toHaveText(R.title);
      await expect(page.getByText(R.empty)).toBeVisible();
      await expect(page.getByRole("button", { name: R.pick })).toBeVisible();
      await expect(fileInput(page)).toHaveAttribute("accept", "image/*");
      await expectNoAccessibilityViolations(page);

      await choosePhoto(page);
      await expect(page.getByRole("heading", { name: R.suggestions(3) })).toBeVisible();
      await expect(page.getByAltText(R.photoAlt)).toBeVisible();
      await expect(page.getByText(R.yourPhoto)).toBeVisible();
      await expect(page.getByText(R.scoreLabel)).toBeVisible();
      const links = suggestionLinks(page);
      await expect(links).toHaveCount(3);
      await expect(links.nth(0)).toContainText("Captain Rex");
      await expect(links.nth(0)).toContainText("sw0194");
      await expect(links.nth(0)).toContainText("92 %");
      await expect(links.nth(1)).toContainText("Clone Trooper Phase II");
      await expect(links.nth(1)).toContainText("61 %");
      await expect(links.nth(2)).toContainText("44 %");
      // The sure one is green, the others white; each opens the form of its number.
      expect(await style(links.nth(0), "background-color")).toBe(MINT);
      expect(await style(links.nth(1), "background-color")).not.toBe(MINT);
      await expect(links.nth(1)).toHaveAttribute("href", "#/erfassen/figur/katalog/sw0631");
      await expect(page.getByRole("button", { name: R.again })).toBeEnabled();
      await expectNoAccessibilityViolations(page);
    });
  }

  test("F1 Ein Tipp auf den Vorschlag öffnet das Formular aus dem Katalog mit grünen Feldern und dem eigenen Foto; gespeichert hat die Figur es", async ({
    page,
  }) => {
    await page.goto("#/erfassen/foto");
    await choosePhoto(page);
    await suggestionLinks(page).first().click();

    await expect(page).toHaveURL(/#\/erfassen\/figur\/katalog\/sw0194$/);
    await expect(heading(page)).toHaveText(F.titleCatalog.minifig);
    await expect(page.getByText(C.banner)).toBeVisible();
    await expect(field(page, F.fields.name)).toHaveValue("Captain Rex");
    await expect(field(page, F.fields.number.minifig)).toHaveValue("sw0194");
    expect(await style(field(page, F.fields.name), "background-color")).toBe(MINT);
    // The own photo is on the new figure, as the cover, made small and sent like any other.
    await expect(page.locator(".photo-slot img")).toHaveCount(1);
    await expect(page.getByText(F.photos.cover, { exact: true })).toBeVisible();
    await expectNoAccessibilityViolations(page);

    await page.getByRole("button", { name: F.save }).click();
    await expect(heading(page)).toHaveText("Captain Rex");
    // The own photo first, the catalog image behind it (F11).
    await expect(page.locator(".gallery__track img")).toHaveCount(2);
    await page.reload();
    await expect(page.locator(".gallery__track img")).toHaveCount(2);
    await expect(page.locator(".gallery__track img").first()).toHaveAttribute("alt", /Captain Rex/);
  });

  test("F1 Nur ein Vorschlag (so antwortete Brickognize in P2) geht auch", async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "one"), RECOGNITION_KEY);
    await page.goto("#/erfassen/foto");
    await choosePhoto(page);
    await expect(page.getByRole("heading", { name: R.suggestions(1) })).toBeVisible();
    await expect(suggestionLinks(page)).toHaveCount(1);
    await expectNoAccessibilityViolations(page);
  });

  test("F1 Kein Treffer: Hinweis, und „Keiner passt“ führt zur Suche; das Foto kommt trotzdem an die Figur", async ({
    page,
  }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "none"), RECOGNITION_KEY);
    await page.goto("#/erfassen/foto");
    await choosePhoto(page);
    await expect(page.getByText(R.none.title)).toBeVisible();
    await expect(page.getByText(R.none.text)).toBeVisible();
    await expectNoAccessibilityViolations(page);

    await page.getByRole("link", { name: R.notFitting }).click();
    await expect(page).toHaveURL(/#\/erfassen\/suche\/figur$/);
    // After a page change the app moves the focus to the heading a moment later; typing before
    // that would lose the text (WebKit, under load).
    await expect(heading(page)).toBeFocused();
    await page.getByRole("searchbox", { name: TEXTS.search.label }).fill("sw0194");
    await page.getByRole("link", { name: TEXTS.search.pick("Captain Rex") }).click();
    await expect(heading(page)).toHaveText(F.titleCatalog.minifig);
    await expect(page.locator(".photo-slot img")).toHaveCount(1);
  });

  test("F1 „Keiner passt“ nach Vorschlägen führt zur Suche nach Nummer", async ({ page }) => {
    await page.goto("#/erfassen/foto");
    await choosePhoto(page);
    await expect(suggestionLinks(page)).toHaveCount(3);
    await page.getByRole("link", { name: R.notFitting }).click();
    await expect(page).toHaveURL(/#\/erfassen\/suche\/figur$/);
  });

  test("F1 Dienst nicht erreichbar: verständlicher Hinweis und „Per Nummer weiter“; nach „Noch einmal erkennen“ klappt es", async ({
    page,
  }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "unavailable"), RECOGNITION_KEY);
    await page.goto("#/erfassen/foto");
    await choosePhoto(page);
    const alert = page.getByRole("alert");
    await expect(alert).toContainText(R.failed.title);
    await expect(alert).toContainText(R.failed.unavailable);
    await expectNoAccessibilityViolations(page);

    await page.evaluate((key) => localStorage.removeItem(key), RECOGNITION_KEY);
    await alert.getByRole("button", { name: R.retry }).click();
    await expect(suggestionLinks(page)).toHaveCount(3);

    // And the way by number from the error state.
    await page.evaluate((key) => localStorage.setItem(key, "offline"), RECOGNITION_KEY);
    await page.getByRole("button", { name: R.again }).click();
    await choosePhoto(page);
    await expect(page.getByRole("alert")).toContainText(R.failed.offline);
    await page.getByRole("link", { name: R.byNumber }).click();
    await expect(page).toHaveURL(/#\/erfassen\/suche\/figur$/);
  });

  test("F1 Bei zu vielen Anfragen sagt die Seite das, und ein kaputtes Foto wird nicht erkannt", async ({
    page,
  }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "limit_reached"), RECOGNITION_KEY);
    await page.goto("#/erfassen/foto");
    await choosePhoto(page);
    await expect(page.getByRole("alert")).toContainText(R.failed.limit_reached);

    await page.evaluate((key) => localStorage.removeItem(key), RECOGNITION_KEY);
    await fileInput(page).setInputFiles({
      name: "kaputt.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("das ist kein Bild"),
    });
    const alert = page.getByRole("alert");
    await expect(alert).toContainText(R.failed.unreadable);
    await expect(alert.getByRole("button", { name: R.retry })).toHaveCount(0);
  });

  test("F1 Das Foto bleibt nicht hängen: nach dem Verlassen des Weges hat eine andere Figur keins", async ({
    page,
  }) => {
    await page.goto("#/erfassen/foto");
    await choosePhoto(page);
    await expect(suggestionLinks(page)).toHaveCount(3);
    // Back to the capture sheet (leaves the way), then a figure by hand.
    await page.getByRole("link", { name: R.back }).click();
    await page
      .getByRole("dialog", { name: TEXTS.capture.title })
      .getByRole("link", { name: new RegExp(TEXTS.capture.ways.manual.title) })
      .click();
    await expect(heading(page)).toHaveText(F.titleNew.minifig);
    await expect(page.locator(".photo-slot img")).toHaveCount(0);
  });

  test("F1 „Abbrechen“ im Formular führt zurück zu den Vorschlägen des Fotos", async ({ page }) => {
    await page.goto("#/erfassen/foto");
    await choosePhoto(page);
    await suggestionLinks(page).first().click();
    await expect(heading(page)).toHaveText(F.titleCatalog.minifig);
    await page.getByRole("link", { name: F.cancel }).click();
    await expect(page).toHaveURL(/#\/erfassen\/foto$/);
    await expect(suggestionLinks(page)).toHaveCount(3);
  });

  test("F1 Für Sets und Sonderteile gibt es keine Foto-Erkennung, das Blatt sagt es", async ({
    page,
  }) => {
    await page.goto("#/erfassen");
    const sheet = page.getByRole("dialog", { name: TEXTS.capture.title });
    await sheet.getByRole("button", { name: TEXTS.capture.what.legoSet }).click();
    const photo = sheet.getByRole("button", { name: new RegExp(TEXTS.capture.ways.photo.title) });
    await expect(photo).toBeDisabled();
    await expect(photo).toContainText(TEXTS.capture.onlyFigures);
  });
});
