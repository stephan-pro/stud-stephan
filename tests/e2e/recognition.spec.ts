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
      await expect(page.getByText(R.empty.minifig)).toBeVisible();
      await expect(page.getByRole("button", { name: R.pick })).toBeVisible();
      await expect(fileInput(page)).toHaveAttribute("accept", "image/*");
      await expectNoAccessibilityViolations(page);

      await choosePhoto(page);
      await expect(page.getByRole("heading", { name: R.suggestions(3) })).toBeVisible();
      await expect(page.getByAltText(R.photoAlt.minifig)).toBeVisible();
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
    await expect(page.getByText(R.none.minifig.title)).toBeVisible();
    await expect(page.getByText(R.none.minifig.text)).toBeVisible();
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

  test("F1 Das Erfassen-Blatt sagt je Art, was das Foto erkennt; für ein Diorama gibt es keins", async ({
    page,
  }) => {
    await page.goto("#/erfassen");
    const sheet = page.getByRole("dialog", { name: TEXTS.capture.title });
    const photo = (role: "link" | "button") =>
      sheet.getByRole(role, { name: new RegExp(TEXTS.capture.ways.photo.title) });
    await expect(photo("link")).toContainText(TEXTS.capture.ways.photo.text);
    await expect(photo("link")).toHaveAttribute("href", "#/erfassen/foto");
    await sheet.getByRole("button", { name: TEXTS.capture.what.legoSet }).click();
    await expect(photo("link")).toContainText(TEXTS.capture.photoSet);
    await expect(photo("link")).toHaveAttribute("href", "#/erfassen/foto/set");
    await sheet.getByRole("button", { name: TEXTS.capture.what.specialPart }).click();
    await expect(photo("link")).toContainText(TEXTS.capture.photoSpecialPart);
    await expect(photo("link")).toHaveAttribute("href", "#/erfassen/foto/sonderteil");
    await sheet.getByRole("button", { name: TEXTS.capture.what.diorama }).click();
    await expect(photo("button")).toBeDisabled();
    await expect(photo("button")).toContainText(TEXTS.capture.onlyManual);
  });
});

test.describe("Foto-Erkennung für Sets (S7a)", () => {
  for (const [size, viewport] of SIZES) {
    test(`F1 ${size}: Erfassen → Set → Foto zeigt Set-Vorschläge, ein Tipp öffnet das grüne Katalogformular mit dem eigenen Foto, keine axe-Verstöße`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/erfassen");
      const sheet = page.getByRole("dialog", { name: TEXTS.capture.title });
      await sheet.getByRole("button", { name: TEXTS.capture.what.legoSet }).click();
      await sheet.getByRole("link", { name: new RegExp(TEXTS.capture.ways.photo.title) }).click();
      await expect(page).toHaveURL(/#\/erfassen\/foto\/set$/);
      await expect(heading(page)).toHaveText(R.title);
      await expect(page.getByText(R.empty.legoSet)).toBeVisible();
      await expect(page.getByText(R.attempt)).toHaveCount(0);
      await expectNoAccessibilityViolations(page);

      await choosePhoto(page);
      await expect(page.getByRole("heading", { name: R.suggestions(2) })).toBeVisible();
      await expect(page.getByAltText(R.photoAlt.legoSet)).toBeVisible();
      const links = suggestionLinks(page);
      await expect(links).toHaveCount(2);
      await expect(links.nth(0)).toContainText("Rancor Pit");
      await expect(links.nth(0)).toContainText("75005-1");
      await expect(links.nth(0)).toContainText("88 %");
      await expect(links.nth(0)).toHaveAttribute("href", "#/erfassen/set/katalog/75005-1");
      expect(await style(links.nth(0), "background-color")).toBe(MINT);
      await expectNoAccessibilityViolations(page);

      await links.nth(0).click();
      await expect(page).toHaveURL(/#\/erfassen\/set\/katalog\/75005-1$/);
      await expect(heading(page)).toHaveText(F.titleCatalog.legoSet);
      await expect(page.getByText(C.banner)).toBeVisible();
      await expect(field(page, F.fields.name)).toHaveValue("Rancor Pit");
      expect(await style(field(page, F.fields.name), "background-color")).toBe(MINT);
      // The own photo is on the new set, made small and sent like any other.
      await expect(page.locator(".photo-slot img")).toHaveCount(1);
      await expectNoAccessibilityViolations(page);

      // "Abbrechen" leads back to the suggestions of the photo.
      await page.getByRole("link", { name: F.cancel }).click();
      await expect(page).toHaveURL(/#\/erfassen\/foto\/set$/);
      await expect(suggestionLinks(page)).toHaveCount(2);
    });
  }

  test("F1 Ein erkanntes Set wird gespeichert; ohne Treffer führt „Keiner passt“ zur Set-Suche", async ({
    page,
  }) => {
    await page.goto("#/erfassen/foto/set");
    await choosePhoto(page);
    await suggestionLinks(page).first().click();
    await page.getByRole("button", { name: F.save }).click();
    await expect(heading(page)).toHaveText("Rancor Pit");

    // The page stays loaded, so the example recognition is told at its storage directly.
    await page.evaluate((key) => localStorage.setItem(key, "none"), RECOGNITION_KEY);
    await page.goto("#/erfassen/foto/set");
    await choosePhoto(page);
    await expect(page.getByText(R.none.legoSet.title)).toBeVisible();
    await expect(page.getByText(R.none.legoSet.text)).toBeVisible();
    await expectNoAccessibilityViolations(page);
    await page.getByRole("link", { name: R.notFitting }).click();
    await expect(page).toHaveURL(/#\/erfassen\/suche\/set$/);
  });
});

test.describe("Foto-Erkennung für Big Figs (S7a)", () => {
  test("F1 Kennt der Dienst die Figur nur als Teil, wird die Big Fig als Figur vom Typ PART angeboten und öffnet das Katalogformular", async ({
    page,
  }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "bigFig"), RECOGNITION_KEY);
    await page.goto("#/erfassen/foto");
    await choosePhoto(page);
    const links = suggestionLinks(page);
    await expect(links).toHaveCount(1);
    await expect(links.first()).toContainText("Large Figure, Rancor");
    await expect(links.first()).toContainText("11323pb01c01");
    await expect(links.first()).toContainText(R.bigFig);
    await expect(links.first()).toHaveAttribute(
      "href",
      "#/erfassen/figur/katalog/PART%3A11323pb01c01",
    );
    await expectNoAccessibilityViolations(page);

    await links.first().click();
    await expect(heading(page)).toHaveText(F.titleCatalog.minifig);
    await expect(field(page, F.fields.name)).toHaveValue("Large Figure, Rancor");
    await expect(field(page, F.fields.number.minifig)).toHaveValue("11323pb01c01");
    await expect(page.locator(".photo-slot img")).toHaveCount(1);
    await page.getByRole("button", { name: F.save }).click();
    await expect(heading(page)).toHaveText("Large Figure, Rancor");
  });
});

test.describe("Foto-Erkennung für Sonderteile (S7a)", () => {
  for (const [size, viewport] of SIZES) {
    test(`F1 ${size}: Der Versuch für ein Sonderteil sagt, dass GWPs oft nicht erkannt werden, und löst Treffer über den Katalogweg der Sonderteile auf, keine axe-Verstöße`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/erfassen");
      const sheet = page.getByRole("dialog", { name: TEXTS.capture.title });
      await sheet.getByRole("button", { name: TEXTS.capture.what.specialPart }).click();
      await sheet.getByRole("link", { name: new RegExp(TEXTS.capture.ways.photo.title) }).click();
      await expect(page).toHaveURL(/#\/erfassen\/foto\/sonderteil$/);
      await expect(page.getByText(R.attempt)).toBeVisible();
      await expect(page.getByText(R.empty.specialPart)).toBeVisible();
      await expectNoAccessibilityViolations(page);

      await choosePhoto(page);
      const links = suggestionLinks(page);
      await expect(links).toHaveCount(1);
      await expect(links.first()).toContainText("The Mandalorian and Grogu Metal Card");
      await expect(links.first()).toHaveAttribute(
        "href",
        "#/erfassen/sonderteil/katalog/GEAR%3A5010325",
      );
      await expect(page.getByText(R.attempt)).toBeVisible();
      await expectNoAccessibilityViolations(page);

      await links.first().click();
      await expect(heading(page)).toHaveText(F.titleCatalog.specialPart);
      await expect(field(page, F.fields.name)).toHaveValue("The Mandalorian and Grogu Metal Card");
      await expect(page.locator(".photo-slot img")).toHaveCount(1);
    });
  }

  test("F1 Erkennt der Dienst das Sonderteil nicht, steht dort der Hinweis auf die Nummer, und „Keiner passt“ führt zur Suche", async ({
    page,
  }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "none"), RECOGNITION_KEY);
    await page.goto("#/erfassen/foto/sonderteil");
    await choosePhoto(page);
    await expect(page.getByText(R.none.specialPart.title)).toBeVisible();
    await expect(page.getByText(R.none.specialPart.text)).toBeVisible();
    await expectNoAccessibilityViolations(page);
    await page.getByRole("link", { name: R.notFitting }).click();
    await expect(page).toHaveURL(/#\/erfassen\/suche\/sonderteil$/);
  });
});

test.describe("Foto-Erkennung für Wünsche (S7a)", () => {
  for (const [size, viewport] of SIZES) {
    test(`F1 ${size}: Wunsch → Foto erkennt ein Set, ein Tipp öffnet das Wunschblatt, der Wunsch landet auf der Liste, keine axe-Verstöße`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/erfassen");
      const sheet = page.getByRole("dialog", { name: TEXTS.capture.title });
      await sheet.getByRole("button", { name: TEXTS.capture.what.wish }).click();
      await sheet.getByRole("link", { name: new RegExp(TEXTS.capture.ways.photo.title) }).click();
      await expect(page).toHaveURL(/#\/erfassen\/foto\/set\/wunsch$/);
      await expect(heading(page)).toHaveText(R.titleWish);
      await expect(
        page.getByRole("button", { name: R.kinds.legoSet, exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await expectNoAccessibilityViolations(page);

      await choosePhoto(page);
      await expect(page.getByRole("heading", { name: R.suggestions(2) })).toBeVisible();
      await expectNoAccessibilityViolations(page);
      await page.getByRole("button", { name: TEXTS.wishCapture.pick("Rancor Pit") }).click();
      await page
        .getByRole("dialog", { name: TEXTS.wishCapture.setFigures.title })
        .getByRole("button", { name: TEXTS.wishCapture.setFigures.wholeSet })
        .click();
      const wish = page.getByRole("dialog", {
        name: new RegExp(`${TEXTS.wishSheet.titleNew}|${TEXTS.wishSheet.titleEdit}`),
      });
      await expect(wish.getByText("Rancor Pit")).toBeVisible();
      await expectNoAccessibilityViolations(page);
      await wish.getByRole("button", { name: TEXTS.wishSheet.add }).click();

      await expect(page).toHaveURL(/#\/wunschliste$/);
      await expect(page.locator(".wish-row__name", { hasText: "Rancor Pit" })).toBeVisible();
    });
  }

  test("F1 Im Wunsch lässt sich auf Figur umstellen: dasselbe Foto wird neu erkannt", async ({
    page,
  }) => {
    await page.goto("#/erfassen/foto/set/wunsch");
    await choosePhoto(page);
    await expect(suggestionLinks(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: R.suggestions(2) })).toBeVisible();

    await page.getByRole("button", { name: R.kinds.minifig, exact: true }).click();
    await expect(page).toHaveURL(/#\/erfassen\/foto\/figur\/wunsch$/);
    await expect(page.getByRole("heading", { name: R.suggestions(3) })).toBeVisible();
    await expect(page.getByAltText(R.photoAlt.minifig)).toBeVisible();
    await page.getByRole("link", { name: R.notFitting }).click();
    await expect(page).toHaveURL(/#\/erfassen\/suche\/figur\/wunsch$/);
  });
});
