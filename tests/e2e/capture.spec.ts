import { expect, type Page, test } from "@playwright/test";
import { DEMO_COLLECTION } from "../../src/demo/collection";
import { formatMoney } from "../../src/domain/money";
import { TEXTS } from "../../src/ui/texts";
import {
  expectNoAccessibilityViolations,
  FAKE_SERVER,
  heading,
  PC,
  PHONE,
  signInDirectly,
} from "./helpers";

// P6: capturing by hand (S7, S8, S8a), editing, another copy, deleting with "Rückgängig", and the
// photos of a form, against the fake server. Texts come from `TEXTS`, so a rewording changes the
// test with the page.

const T = TEXTS.form;
const SIZES = [
  ["Handy", PHONE],
  ["PC", PC],
] as const;

const save = (page: Page) => page.getByRole("button", { name: T.save });
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });

/** A photo-like picture made in the page, as the bytes of a file of the given type. */
async function makePhoto(
  page: Page,
  width: number,
  height: number,
  type: "image/jpeg" | "image/png" = "image/jpeg",
): Promise<Buffer> {
  const base64 = await page.evaluate(
    async ([w, h, mime]) => {
      const canvas = document.createElement("canvas");
      canvas.width = w as number;
      canvas.height = h as number;
      const context = canvas.getContext("2d") as CanvasRenderingContext2D;
      const sky = context.createLinearGradient(0, 0, w as number, h as number);
      sky.addColorStop(0, "#4477aa");
      sky.addColorStop(1, "#ddaa66");
      context.fillStyle = sky;
      context.fillRect(0, 0, w as number, h as number);
      let seed = 4242;
      const random = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };
      for (let index = 0; index < 3000; index++) {
        context.fillStyle = `hsla(${random() * 360}, 60%, ${30 + random() * 40}%, 0.5)`;
        context.beginPath();
        context.arc(
          random() * (w as number),
          random() * (h as number),
          5 + random() * 50,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((made) => resolve(made as Blob), mime as string, 0.92),
      );
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let text = "";
      for (const byte of bytes) text += String.fromCharCode(byte);
      return btoa(text);
    },
    [width, height, type] as const,
  );
  return Buffer.from(base64, "base64");
}

/** The JPEG with an EXIF "Orientation" entry, as a phone writes it (6 = turned 90° to the right). */
function withOrientation(jpeg: Buffer, orientation: number): Buffer {
  const exif = Buffer.from([
    0xff,
    0xe1,
    0x00,
    0x22,
    0x45,
    0x78,
    0x69,
    0x66,
    0x00,
    0x00,
    0x4d,
    0x4d,
    0x00,
    0x2a,
    0x00,
    0x00,
    0x00,
    0x08,
    0x00,
    0x01,
    0x01,
    0x12,
    0x00,
    0x03,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    orientation,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
  ]);
  return Buffer.concat([jpeg.subarray(0, 2), exif, jpeg.subarray(2)]);
}

/** Natural size of the first picture matching the selector once it has loaded. */
async function imageSize(page: Page, selector: string): Promise<{ width: number; height: number }> {
  const image = page.locator(selector).first();
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBeGreaterThan(0);
  return image.evaluate((element: HTMLImageElement) => ({
    width: element.naturalWidth,
    height: element.naturalHeight,
  }));
}

/** Size in bytes of the file an image shows. */
function imageBytes(page: Page, selector: string): Promise<number> {
  return page
    .locator(selector)
    .first()
    .evaluate(async (element: HTMLImageElement) => (await (await fetch(element.src)).blob()).size);
}

test.describe("Erfassen-Blatt (S7)", () => {
  test.beforeEach(async ({ page }) => {
    await signInDirectly(page);
  });

  for (const [size, viewport] of SIZES) {
    test(`P6 ${size}: „Was erfassen?“ dann „Wie?“, Manuell und Suche führen weiter, keine axe-Verstöße`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/erfassen");
      const sheet = page.getByRole("dialog", { name: TEXTS.capture.title });
      await expect(sheet).toBeVisible();
      await expect(heading(page)).toHaveText("Erfassen");

      // Figure is chosen to begin with.
      const figure = sheet.getByRole("button", { name: TEXTS.capture.what.minifig });
      await expect(figure).toHaveAttribute("aria-pressed", "true");
      // The diorama works since P10 (`dioramas.spec.ts`), the wish since P15 (`wishCapture.spec.ts`).
      await expect(sheet.getByRole("button", { name: TEXTS.capture.what.diorama })).toBeEnabled();
      await expect(sheet.getByRole("button", { name: TEXTS.capture.what.wish })).toBeEnabled();
      // "Nummer oder Suche" works since P7 (figures and sets), "Foto" since P8 (figures), "Link
      // einfügen" since P9 (all kinds).
      await expect(
        sheet.getByRole("link", { name: new RegExp(TEXTS.capture.ways.link.title) }),
      ).toHaveAttribute("href", "#/erfassen/link/figur");
      await expect(
        sheet.getByRole("link", { name: new RegExp(TEXTS.capture.ways.search.title) }),
      ).toHaveAttribute("href", "#/erfassen/suche/figur");
      await expect(
        sheet.getByRole("link", { name: new RegExp(TEXTS.capture.ways.photo.title) }),
      ).toHaveAttribute("href", "#/erfassen/foto");
      await expectNoAccessibilityViolations(page);

      await sheet.getByRole("button", { name: TEXTS.capture.what.legoSet }).click();
      await expect(sheet.getByRole("button", { name: TEXTS.capture.what.legoSet })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      const manual = sheet.getByRole("link", { name: new RegExp(TEXTS.capture.ways.manual.title) });
      await expect(manual).toHaveAttribute("href", "#/erfassen/set");
      await manual.click();
      await expect(heading(page)).toHaveText(T.titleNew.legoSet);
    });
  }

  test("P6 Das Blatt lässt sich mit „Schließen“ und mit Escape schließen, danach steht die Vitrine da", async ({
    page,
  }) => {
    await page.goto("#/erfassen");
    await page.getByRole("button", { name: TEXTS.capture.close }).click();
    await expect(page).toHaveURL(/#\/vitrine$/);
    await expect(heading(page)).toHaveText("Hey Stephan");

    await page.goto("#/erfassen");
    await expect(page.getByRole("dialog", { name: TEXTS.capture.title })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/#\/vitrine$/);
  });

  test("P6 Aus der leeren Vitrine führt „Erste Figur erfassen“ ins Blatt", async ({ page }) => {
    await page.goto("#/vitrine");
    await page.getByRole("link", { name: TEXTS.showcase.empty.action }).click();
    await expect(page.getByRole("dialog", { name: TEXTS.capture.title })).toBeVisible();
  });
});

test.describe("Formular (S8): Prüfung und Speichern", () => {
  test.beforeEach(async ({ page }) => {
    await signInDirectly(page);
  });

  for (const [size, viewport] of SIZES) {
    test(`P6 ${size}: Ein leeres Formular zeigt den Fehler am Feld, der Fokus geht dorthin, axe ist ruhig`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/erfassen/figur");
      await expect(heading(page)).toHaveText(T.titleNew.minifig);
      await expectNoAccessibilityViolations(page);

      await save(page).click();
      await expect(page.getByRole("alert").first()).toHaveText(T.summary(1));
      const name = field(page, T.fields.name);
      await expect(name).toHaveAttribute("aria-invalid", "true");
      await expect(name).toBeFocused();
      await expect(page.getByText(T.errors.required)).toBeVisible();
      await expect(name).toHaveAccessibleDescription(T.errors.required);
      await expectNoAccessibilityViolations(page);

      // Typing a name and saving again is enough.
      await name.fill("Test-Figur");
      await save(page).click();
      await expect(heading(page)).toHaveText("Test-Figur");
    });
  }

  test("P6 Der Fokus geht auf das erste falsche Feld in der Reihenfolge der Seite", async ({
    page,
  }) => {
    await page.goto("#/erfassen/figur");
    await field(page, T.fields.name).fill("Test");
    await field(page, T.fields.purchasePrice).fill("viel");
    await field(page, T.fields.acquired).fill("13.2025");
    await field(page, T.fields.links).fill("kein Link");
    await save(page).click();

    await expect(page.getByRole("alert").first()).toHaveText(T.summary(3));
    // "Erworben am" stands above the price and the links.
    await expect(field(page, T.fields.acquired)).toBeFocused();
    await expect(page.getByText(T.errors.month)).toBeVisible();
    await expect(page.getByText(T.errors.money)).toBeVisible();
    await expect(page.getByText(T.errors.url)).toBeVisible();
    await expect(heading(page)).toHaveText(T.titleNew.minifig);
  });

  test("P6 Ein anderer Hersteller braucht einen Namen", async ({ page }) => {
    await page.goto("#/erfassen/figur");
    await field(page, T.fields.name).fill("Test");
    await page.getByRole("button", { name: T.manufacturers.custom }).click();
    await save(page).click();
    await expect(field(page, T.fields.manufacturerName)).toBeFocused();
    await expect(page.getByText(T.errors.required)).toBeVisible();
  });

  // A test of its own with a fresh start: right after only the address changed from one form to
  // another, WebKit under load sometimes drew the new form twice and lost what had been typed.
  test("P6 Ein falsches Jahr beim Set wird gemeldet", async ({ page }) => {
    await page.goto("#/erfassen/set");
    await field(page, T.fields.name).fill("Set");
    await field(page, T.fields.year).fill("1500");
    await save(page).click();
    await expect(field(page, T.fields.year)).toBeFocused();
    await expect(page.getByText(T.errors.year)).toBeVisible();
  });

  test("F4 Eine Figur mit allen Angaben: Detailseite zeigt sie, Mod-Preise zählen nicht zum Wert (F6)", async ({
    page,
  }) => {
    await page.goto("#/erfassen/figur");
    await field(page, T.fields.name).fill("Test-Figur");
    await field(page, T.fields.number.minifig).fill("sw9999");
    await page.getByRole("button", { name: T.manufacturers.custom }).click();
    await field(page, T.fields.manufacturerName).fill("Brick Arms");
    await field(page, T.fields.theme).fill("Star Wars – The Clone Wars");
    await page.getByRole("button", { name: TEXTS.conditions.used }).click();
    await field(page, T.fields.source).fill("Kleinanzeigen");
    await field(page, T.fields.acquired).fill("03.2025");
    await field(page, T.fields.purchasePrice).fill("25,00 €");
    await field(page, T.fields.note).fill("Steht vorne.");
    await field(page, T.fields.links).fill("https://shop.example/arme");

    // Two mod parts through the sheet (S8a); the first try is empty and says what is missing.
    await page.getByRole("button", { name: T.mods.add }).click();
    const sheet = page.getByRole("dialog", { name: TEXTS.mod.titleNew });
    await sheet.getByRole("button", { name: TEXTS.mod.add }).click();
    await expect(sheet.getByText(TEXTS.mod.positionRequired)).toBeVisible();
    await expect(sheet.getByText(T.errors.required)).toBeVisible();
    // The position is the first thing missing and takes the focus.
    await expect(
      sheet.getByRole("button", { name: TEXTS.modPositions.head, exact: true }),
    ).toBeFocused();
    await expectNoAccessibilityViolations(page);

    await sheet.getByRole("button", { name: TEXTS.modPositions.arms }).click();
    await field(page, TEXTS.mod.description).fill("Bedruckt");
    await field(page, TEXTS.mod.vendor).fill("Custom-Shop");
    await field(page, TEXTS.mod.price).fill("6,00");
    await field(page, TEXTS.mod.originalPart).fill("Teilekiste");
    await sheet.getByRole("button", { name: TEXTS.mod.add }).click();
    await expect(sheet).toBeHidden();

    await page.getByRole("button", { name: T.mods.add }).click();
    await page
      .getByRole("dialog", { name: TEXTS.mod.titleNew })
      .getByRole("button", { name: TEXTS.modPositions.headgear })
      .click();
    await field(page, TEXTS.mod.description).fill("Helm");
    await field(page, TEXTS.mod.price).fill("8,50");
    await page
      .getByRole("dialog", { name: TEXTS.mod.titleNew })
      .getByRole("button", { name: TEXTS.mod.add })
      .click();

    const form = page.getByRole("form");
    await expect(form.getByText(T.mods.count(2))).toBeVisible();
    await expect(form.getByText(formatMoney(1450))).toBeVisible();
    await expectNoAccessibilityViolations(page);

    await save(page).click();
    await expect(heading(page)).toHaveText("Test-Figur");
    await expect(page).toHaveURL(/#\/vitrine\/figur\/minifig-/);

    // F5/F6: the data is on the page, the mods add up, and the value is the purchase price.
    await expect(page.getByText("sw9999 · Brick Arms · Star Wars – The Clone Wars")).toBeVisible();
    await expect(page.locator(".detail-title .pills")).toContainText(TEXTS.conditions.used);
    await expect(page.locator(".detail-title .pills")).toContainText(TEXTS.detail.modified);
    const mods = page.getByRole("region", { name: TEXTS.detail.mods.title });
    await expect(mods).toContainText(formatMoney(1450));
    await expect(mods).toContainText("Original Teilekiste");
    await expect(
      page.getByRole("region", { name: "Wert" }).or(page.locator(".value-card")),
    ).toContainText(formatMoney(2500));
    await expect(page.locator(".value-card")).not.toContainText(formatMoney(3950));
    await expect(page.getByRole("region", { name: TEXTS.detail.origin.title })).toContainText(
      "Kleinanzeigen",
    );
    await expect(page.getByRole("region", { name: TEXTS.detail.origin.title })).toContainText(
      "März 2025",
    );
    await expect(page.getByText("Steht vorne.")).toBeVisible();
    await expect(page.getByRole("link", { name: "shop.example" })).toBeVisible();
    await expectNoAccessibilityViolations(page);

    // It is in the showcase, too, and still there after a reload (the server has it).
    await page.reload();
    await expect(heading(page)).toHaveText("Test-Figur");
    await page.goto("#/vitrine");
    await expect(page.locator(".grid .tile__name", { hasText: "Test-Figur" })).toBeVisible();
  });

  test("F6 Ein Mod-Teil lässt sich ändern und entfernen, die Summe folgt", async ({ page }) => {
    await page.goto("#/erfassen/figur");
    await field(page, T.fields.name).fill("Mod-Figur");
    for (const [position, price] of [
      [TEXTS.modPositions.arms, "6"],
      [TEXTS.modPositions.legs, "4"],
    ] as const) {
      await page.getByRole("button", { name: T.mods.add }).click();
      const sheet = page.getByRole("dialog", { name: TEXTS.mod.titleNew });
      await sheet.getByRole("button", { name: position }).click();
      await field(page, TEXTS.mod.description).fill(`Teil ${position}`);
      await field(page, TEXTS.mod.price).fill(price);
      await sheet.getByRole("button", { name: TEXTS.mod.add }).click();
    }
    const form = page.getByRole("form");
    const total = form.locator(".mod-total__amount");
    await expect(total).toHaveText(formatMoney(1000));

    await form.getByRole("button", { name: `Arme Teil Arme ${T.mods.edit}` }).click();
    const sheet = page.getByRole("dialog", { name: TEXTS.mod.titleEdit });
    await expect(field(page, TEXTS.mod.description)).toHaveValue("Teil Arme");
    await field(page, TEXTS.mod.price).fill("7,50");
    await sheet.getByRole("button", { name: TEXTS.mod.apply }).click();
    await expect(total).toHaveText(formatMoney(1150));
    await expect(form.getByText(T.mods.count(2))).toBeVisible();

    await form.getByRole("button", { name: T.mods.remove("Beine: Teil Beine") }).click();
    await expect(form.getByText(T.mods.count(1))).toBeVisible();
    await expect(total).toHaveText(formatMoney(750));
  });

  test("F7 Ein Set mit Nummer, Zahlen und Status", async ({ page }) => {
    await page.goto("#/erfassen/set");
    await expect(heading(page)).toHaveText(T.titleNew.legoSet);
    await field(page, T.fields.name).fill("Battle Pack");
    await field(page, T.fields.number.legoSet).fill("75372-1");
    await field(page, T.fields.theme).fill("Star Wars");
    await field(page, T.fields.year).fill("2024");
    await field(page, T.fields.pieceCount).fill("215");
    await field(page, T.fields.minifigCount).fill("4");
    await page.getByRole("button", { name: TEXTS.setStatus.figuresRemoved }).click();
    await page.getByRole("button", { name: TEXTS.conditions.used }).click();
    await field(page, T.fields.purchasePrice).fill("19,99");
    await expectNoAccessibilityViolations(page);
    await save(page).click();

    await expect(heading(page)).toHaveText("Battle Pack");
    await expect(page.getByText("75372 · LEGO · Star Wars · 2024")).toBeVisible();
    await expect(page.locator(".detail-title .pills")).toContainText(
      TEXTS.setStatus.figuresRemoved,
    );
    await expect(page.getByRole("region", { name: TEXTS.detail.set.title })).toContainText("215");
    await expect(page.getByRole("region", { name: TEXTS.detail.origin.title })).toContainText(
      formatMoney(1999),
    );
    await expectNoAccessibilityViolations(page);
  });

  test("F9 Ein Sonderteil mit Art, Nummer und geschätztem Wert", async ({ page }) => {
    await page.goto("#/erfassen/sonderteil");
    await expect(heading(page)).toHaveText(T.titleNew.specialPart);
    await field(page, T.fields.name).fill("Sammelmünze Jabba");
    await page.getByRole("button", { name: TEXTS.specialPartKinds.coin.long }).click();
    await field(page, T.fields.number.specialPart).fill("5008818");
    await field(page, T.fields.manualValue).fill("9,50");
    await expectNoAccessibilityViolations(page);
    await save(page).click();

    await expect(heading(page)).toHaveText("Sammelmünze Jabba");
    await expect(page.locator(".detail-title .pills")).toContainText(
      TEXTS.specialPartKinds.coin.chip,
    );
    await expect(page.getByRole("region", { name: TEXTS.detail.origin.title })).toContainText(
      "5008818",
    );
    await expect(page.locator(".value-card")).toContainText(formatMoney(950));
    await expect(page.locator(".value-card")).toContainText(TEXTS.detail.value.manual);
  });

  test("P6 Schlägt das Speichern fehl, bleiben die Eingaben und ein Hinweis erscheint", async ({
    page,
  }) => {
    await page.goto("#/erfassen/figur");
    await field(page, T.fields.name).fill("Wiederholer");
    await page.route(`${FAKE_SERVER}/objects/**`, (route) => route.abort());
    await save(page).click();
    await expect(page.getByRole("alert")).toContainText("Das Speichern hat nicht geklappt");
    await expect(field(page, T.fields.name)).toHaveValue("Wiederholer");
    await expect(save(page)).toBeEnabled();
    await expectNoAccessibilityViolations(page);

    await page.unroute(`${FAKE_SERVER}/objects/**`);
    await save(page).click();
    await expect(heading(page)).toHaveText("Wiederholer");
  });

  test("P6 „Abbrechen“ führt zurück und speichert nichts", async ({ page }) => {
    await page.goto("#/vitrine");
    await page.goto("#/erfassen/figur");
    await field(page, T.fields.name).fill("Nie gespeichert");
    await page.getByRole("link", { name: T.cancel }).click();
    await expect(page).toHaveURL(/#\/vitrine$/);
    await expect(page.getByText("Nie gespeichert")).toHaveCount(0);
  });

  test("P6 Ein unbekanntes Objekt zum Bearbeiten sagt „Nicht gefunden“", async ({ page }) => {
    await page.goto("#/vitrine/figur/gibt-es-nicht/bearbeiten");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(T.notFound.title);
    await page.goto("#/erfassen/figur/kopie/gibt-es-nicht");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(T.notFound.title);
    await expectNoAccessibilityViolations(page);
  });
});

test.describe("Bearbeiten, weiteres Exemplar, Löschen (mit Beispielsammlung)", () => {
  test.beforeEach(async ({ page }) => {
    await signInDirectly(page, undefined, DEMO_COLLECTION);
  });

  for (const [size, viewport] of SIZES) {
    test(`P6 ${size}: Bearbeiten zeigt die Angaben, ändert den Namen und lässt Mods, Diorama und Wert unberührt`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/vitrine/figur/minifig-rex");
      const valueBefore = await page.locator(".value-card").textContent();
      const modsBefore = await page
        .getByRole("region", { name: TEXTS.detail.mods.title })
        .textContent();

      await page.getByRole("link", { name: TEXTS.actions.edit }).click();
      await expect(page).toHaveURL(/#\/vitrine\/figur\/minifig-rex\/bearbeiten$/);
      await expect(heading(page)).toHaveText(T.titleEdit("Captain Rex"));
      await expect(field(page, T.fields.name)).toHaveValue("Captain Rex");
      await expect(field(page, T.fields.number.minifig)).toHaveValue("sw0194");
      await expect(field(page, T.fields.source)).toHaveValue("BrickLink-Händler");
      await expect(field(page, T.fields.acquired)).toHaveValue("14.03.2025");
      await expect(field(page, T.fields.purchasePrice)).toHaveValue("25,00");
      await expect(page.getByRole("form").getByText(T.mods.count(2))).toBeVisible();
      await expectNoAccessibilityViolations(page);

      await field(page, T.fields.name).fill("Captain Rex Phase II");
      await save(page).click();

      await expect(heading(page)).toHaveText("Captain Rex Phase II");
      await expect(page).toHaveURL(/#\/vitrine\/figur\/minifig-rex$/);
      expect(await page.locator(".value-card").textContent()).toBe(valueBefore);
      expect(await page.getByRole("region", { name: TEXTS.detail.mods.title }).textContent()).toBe(
        modsBefore,
      );
      // The diorama is not in the form and stays; the day of "Erworben" stays.
      await expect(page.getByRole("region", { name: TEXTS.detail.diorama.title })).toContainText(
        DEMO_COLLECTION.dioramas.find((diorama) => diorama.id === "diorama-umbara")?.name ?? "?",
      );
      await expect(page.getByRole("region", { name: TEXTS.detail.origin.title })).toContainText(
        "März 2025",
      );
      // "Zurück" does not return to the form.
      await page.goBack();
      await expect(page).not.toHaveURL(/bearbeiten/);
    });
  }

  test("F6 Beim Bearbeiten lässt sich ein Mod-Teil ändern: Ausgaben und Wert folgen richtig", async ({
    page,
  }) => {
    await page.goto("#/vitrine/figur/minifig-rex/bearbeiten");
    await page
      .getByRole("form")
      .getByRole("button", { name: `Arme Bedruckt mit Phase-II-Markierungen ${T.mods.edit}` })
      .click();
    await field(page, TEXTS.mod.price).fill("10");
    await page
      .getByRole("dialog", { name: TEXTS.mod.titleEdit })
      .getByRole("button", { name: TEXTS.mod.apply })
      .click();
    await save(page).click();

    const mods = page.getByRole("region", { name: TEXTS.detail.mods.title });
    await expect(mods).toContainText(formatMoney(1850));
  });

  test("F5 „Weiteres Exemplar anlegen“ übernimmt die Katalogdaten, nicht Quelle, Preis und Mods", async ({
    page,
  }) => {
    await page.goto("#/vitrine/figur/minifig-rex");
    await expect(page.getByRole("region", { name: TEXTS.detail.copies.title })).toContainText(
      TEXTS.detail.copies.once,
    );
    await page.getByRole("link", { name: TEXTS.actions.copy }).click();
    await expect(page).toHaveURL(/#\/erfassen\/figur\/kopie\/minifig-rex$/);
    await expect(heading(page)).toHaveText(T.titleCopy);
    await expect(field(page, T.fields.name)).toHaveValue("Captain Rex");
    await expect(field(page, T.fields.number.minifig)).toHaveValue("sw0194");
    await expect(field(page, T.fields.fromSet)).toHaveValue("einzeln gekauft");
    await expect(field(page, T.fields.source)).toHaveValue("");
    await expect(field(page, T.fields.purchasePrice)).toHaveValue("");
    await expect(page.getByRole("form").getByText(T.mods.none)).toBeVisible();
    await expectNoAccessibilityViolations(page);

    await page.getByRole("button", { name: TEXTS.conditions.used }).click();
    await save(page).click();
    await expect(heading(page)).toHaveText("Captain Rex");
    await expect(page).not.toHaveURL(/minifig-rex$/);
    await expect(page.getByRole("region", { name: TEXTS.detail.copies.title })).toContainText(
      TEXTS.detail.copies.several(2),
    );
    // The original still has one copy more, and its own data.
    await page.goto("#/vitrine/figur/minifig-rex");
    await expect(page.getByRole("region", { name: TEXTS.detail.copies.title })).toContainText(
      TEXTS.detail.copies.several(2),
    );
    await expect(page.getByRole("region", { name: TEXTS.detail.mods.title })).toBeVisible();
  });

  for (const [size, viewport] of SIZES) {
    test(`P6 ${size}: Löschen fragt nach, „Rückgängig“ holt die Figur zurück, ohne den Server zu fragen`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/vitrine/figur/minifig-rex");
      await page.getByRole("button", { name: TEXTS.actions.remove }).click();
      const sheet = page.getByRole("dialog", { name: TEXTS.remove.title("Captain Rex") });
      await expect(sheet).toContainText(TEXTS.remove.text.minifig);
      await expectNoAccessibilityViolations(page);

      // Cancelling deletes nothing.
      await sheet.getByRole("button", { name: TEXTS.remove.cancel }).click();
      await expect(heading(page)).toHaveText("Captain Rex");

      await page.getByRole("button", { name: TEXTS.actions.remove }).click();
      await page.getByRole("dialog").getByRole("button", { name: TEXTS.remove.confirm }).click();
      await expect(page).toHaveURL(/#\/vitrine$/);
      const toast = page.locator(".toast", { hasText: TEXTS.remove.done("Captain Rex") });
      await expect(toast).toBeVisible();
      await expect(page.locator(".grid .tile__name", { hasText: "Captain Rex" })).toHaveCount(0);
      await expectNoAccessibilityViolations(page);

      await toast.getByRole("button", { name: TEXTS.remove.undo }).click();
      await expect(toast).toBeHidden();
      await expect(page.locator(".grid .tile__name", { hasText: "Captain Rex" })).toBeVisible();
      // The server never heard of it: after a reload the figure is there with its mods.
      await page.reload();
      await page.goto("#/vitrine/figur/minifig-rex");
      await expect(page.getByRole("region", { name: TEXTS.detail.mods.title })).toBeVisible();
    });
  }

  test("P6 Nach der Frist ist die Figur auch auf dem Server gelöscht", async ({ page }) => {
    await page.goto("#/vitrine/figur/minifig-fives");
    await page.getByRole("button", { name: TEXTS.actions.remove }).click();
    await page.getByRole("dialog").getByRole("button", { name: TEXTS.remove.confirm }).click();
    const toast = page.locator(".toast", { hasText: TEXTS.remove.done("ARC Trooper Fives") });
    await expect(toast).toBeVisible();
    // The message goes away by itself after its time; then the server has been told.
    await expect(toast).toBeHidden({ timeout: 15_000 });
    // Asking the server again (reload) shows it is gone there, too.
    await expect
      .poll(async () => {
        await page.reload();
        await expect(page.locator(".grid .tile__name").first()).toBeVisible();
        return page.locator(".grid .tile__name", { hasText: "ARC Trooper Fives" }).count();
      })
      .toBe(0);
  });

  test("F7 Ein Set löschen lässt seine Figuren in der Sammlung", async ({ page }) => {
    await page.goto("#/vitrine/set/set-75372");
    const trooperTiles = page.locator(".grid .tile__name", { hasText: "Clone Trooper Phase II" });
    await page.getByRole("button", { name: TEXTS.actions.remove }).click();
    await expect(page.getByRole("dialog")).toContainText(TEXTS.remove.text.legoSet);
    await page.getByRole("dialog").getByRole("button", { name: TEXTS.remove.confirm }).click();
    await expect(page).toHaveURL(/#\/vitrine$/);
    await expect(trooperTiles.first()).toBeVisible();
    await page.getByRole("button", { name: TEXTS.remove.undo }).click();
    await page.goto("#/vitrine/set/set-75372");
    await expect(heading(page)).not.toHaveText(TEXTS.detail.notFound.title);
  });

  test("P6 Beim Löschen eines zweiten Objekts wird das erste endgültig, das zweite bleibt rückgängig zu machen", async ({
    page,
  }) => {
    await page.goto("#/vitrine/figur/minifig-fives");
    await page.getByRole("button", { name: TEXTS.actions.remove }).click();
    await page.getByRole("dialog").getByRole("button", { name: TEXTS.remove.confirm }).click();
    await page.goto("#/vitrine/figur/minifig-appo");
    await page.getByRole("button", { name: TEXTS.actions.remove }).click();
    await page.getByRole("dialog").getByRole("button", { name: TEXTS.remove.confirm }).click();
    await expect(
      page.locator(".toast", { hasText: TEXTS.remove.done("Commander Appo") }),
    ).toBeVisible();
    await page.getByRole("button", { name: TEXTS.remove.undo }).click();
    await expect(page.locator(".grid .tile__name", { hasText: "Commander Appo" })).toBeVisible();
    await expect(page.locator(".grid .tile__name", { hasText: "ARC Trooper Fives" })).toHaveCount(
      0,
    );
  });

  test("P6 Ein Löschen, das der Server ablehnt, bringt die Figur zurück und sagt es", async ({
    page,
  }) => {
    await page.goto("#/vitrine/figur/minifig-fives");
    await page.getByRole("button", { name: TEXTS.actions.remove }).click();
    await page.route(`${FAKE_SERVER}/objects/**`, (route) => route.abort());
    await page.getByRole("dialog").getByRole("button", { name: TEXTS.remove.confirm }).click();
    await expect(page.locator(".toast")).toContainText(TEXTS.remove.failed, { timeout: 15_000 });
    await expect(page.locator(".grid .tile__name", { hasText: "ARC Trooper Fives" })).toBeVisible();
  });
});

test.describe("Fotos im Formular", () => {
  test.beforeEach(async ({ page }) => {
    await signInDirectly(page);
  });

  test("P6 Fotos wählen: verkleinert und hochgeladen, Titelbild, entfernen, speichern, Detailseite zeigt sie", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await page.goto("#/erfassen/figur");
    await field(page, T.fields.name).fill("Foto-Figur");
    const input = page.locator('input[type="file"]');
    await expect(input).toHaveAttribute("accept", "image/*");

    const first = await makePhoto(page, 1200, 900);
    await input.setInputFiles({ name: "eins.jpg", mimeType: "image/jpeg", buffer: first });
    const thumbs = page.locator(".photo-slot img");
    await expect(thumbs).toHaveCount(1);
    await expect(page.getByText(T.photos.cover, { exact: true })).toBeVisible();

    const second = await makePhoto(page, 800, 800, "image/png");
    await input.setInputFiles({ name: "zwei.png", mimeType: "image/png", buffer: second });
    await expect(thumbs).toHaveCount(2);
    await expectNoAccessibilityViolations(page);

    // The second photo becomes the cover and moves to the front.
    const firstSrc = await thumbs.nth(0).getAttribute("alt");
    expect(firstSrc).toContain(T.photos.alt(1, 2));
    await page.getByRole("button", { name: T.photos.makeCover(2) }).click();
    await expect(page.locator(".photo-slot").first()).toContainText(T.photos.cover);

    // A third one is taken out again.
    const third = await makePhoto(page, 640, 480);
    await input.setInputFiles({ name: "drei.jpg", mimeType: "image/jpeg", buffer: third });
    await expect(thumbs).toHaveCount(3);
    await page.getByRole("button", { name: T.photos.remove(3) }).click();
    await expect(thumbs).toHaveCount(2);

    await save(page).click();
    await expect(heading(page)).toHaveText("Foto-Figur");
    const gallery = page.locator(".gallery__track img");
    await expect(gallery).toHaveCount(2);
    await imageSize(page, ".gallery__track img");
    await expect(page.locator(".gallery__counter")).toHaveText(TEXTS.detail.photoCounter(1, 2));

    // After a reload the photos are still there (they are on the server).
    await page.reload();
    await expect(page.locator(".gallery__track img")).toHaveCount(2);
  });

  test("P6 Ein Hochformat-Foto mit EXIF-Drehung bleibt hochkant, höchstens 1.600 px, höchstens 400 KB", async ({
    page,
  }) => {
    await page.goto("#/erfassen/figur");
    // Taken as 3000 × 2000 lying down, with the note "turn 90° right": it must be shown upright.
    const landscape = await makePhoto(page, 3000, 2000);
    const upright = withOrientation(landscape, 6);
    await page.locator('input[type="file"]').setInputFiles({
      name: "hochformat.jpg",
      mimeType: "image/jpeg",
      buffer: upright,
    });
    await expect(page.locator(".photo-slot img")).toHaveCount(1);
    const size = await imageSize(page, ".photo-slot img");
    expect(size.height).toBeGreaterThan(size.width);
    expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(1600);
    expect(size.height).toBe(1600);
    expect(Math.abs(size.width / size.height - 2 / 3)).toBeLessThan(0.01);
    expect(await imageBytes(page, ".photo-slot img")).toBeLessThanOrEqual(400 * 1024);
  });

  test("P6 Ein Foto ohne EXIF-Drehung bleibt im Querformat", async ({ page }) => {
    await page.goto("#/erfassen/figur");
    const landscape = await makePhoto(page, 3000, 2000);
    await page.locator('input[type="file"]').setInputFiles({
      name: "quer.jpg",
      mimeType: "image/jpeg",
      buffer: landscape,
    });
    const size = await imageSize(page, ".photo-slot img");
    expect([size.width, size.height]).toEqual([1600, 1067]);
  });

  test("P6 Eine Datei, die kein Bild ist, wird gemeldet und lässt sich verwerfen", async ({
    page,
  }) => {
    await page.goto("#/erfassen/figur");
    await page.locator('input[type="file"]').setInputFiles({
      name: "kaputt.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("das ist kein bild"),
    });
    const job = page.locator(".photo-job");
    await expect(job).toContainText(T.photos.unreadable);
    await expect(job.getByRole("button", { name: T.photos.retry })).toHaveCount(0);
    await expectNoAccessibilityViolations(page);
    await job.getByRole("button", { name: T.photos.discard }).click();
    await expect(job).toHaveCount(0);
  });

  test("P6 Hochladen mit Wiederholung: der erste Versuch scheitert, der zweite klappt", async ({
    page,
  }) => {
    await page.goto("#/erfassen/figur");
    let puts = 0;
    await page.route(`${FAKE_SERVER}/files/**`, (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      puts += 1;
      return puts === 1 ? route.fulfill({ status: 503, body: "" }) : route.continue();
    });
    const photo = await makePhoto(page, 800, 600);
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "wieder.jpg", mimeType: "image/jpeg", buffer: photo });
    await expect(page.locator(".photo-job")).toContainText(T.photos.waiting);
    await expect(page.locator(".photo-slot img")).toHaveCount(1, { timeout: 15_000 });
    expect(puts).toBe(2);
  });

  test("P6 Hochladen scheitert ganz: „Noch einmal versuchen“ klappt, sobald der Server wieder da ist", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto("#/erfassen/figur");
    await page.route(`${FAKE_SERVER}/files/**`, (route) =>
      route.request().method() === "PUT" ? route.abort() : route.continue(),
    );
    const photo = await makePhoto(page, 800, 600);
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "weg.jpg", mimeType: "image/jpeg", buffer: photo });
    const job = page.locator(".photo-job");
    await expect(job).toContainText(T.photos.failed, { timeout: 30_000 });
    await expectNoAccessibilityViolations(page);

    await page.unroute(`${FAKE_SERVER}/files/**`);
    await job.getByRole("button", { name: T.photos.retry }).click();
    await expect(page.locator(".photo-slot img")).toHaveCount(1, { timeout: 15_000 });
    await expect(job).toHaveCount(0);
  });

  test("P6 Fotos, die nie gespeichert wurden, liegen nach „Abbrechen“ nicht auf dem Server", async ({
    page,
  }) => {
    await page.goto("#/erfassen/figur");
    const uploads: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "PUT" && request.url().includes("/files/")) {
        uploads.push(request.url());
      }
    });
    const deletions: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "DELETE" && request.url().includes("/files/")) {
        deletions.push(request.url());
      }
    });
    const photo = await makePhoto(page, 600, 400);
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "x.jpg", mimeType: "image/jpeg", buffer: photo });
    await expect(page.locator(".photo-slot img")).toHaveCount(1);
    await page.getByRole("link", { name: T.cancel }).click();
    await expect.poll(() => deletions.length).toBe(1);
    // The same file that was sent (the server's path adds the owner's folder in front).
    const sent = uploads[0]?.split("/files/photos/")[1];
    expect(sent).toBeTruthy();
    expect(deletions[0]).toContain(sent);
  });
});
