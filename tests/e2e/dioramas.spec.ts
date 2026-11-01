import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { DEMO_COLLECTION } from "../../src/demo/collection";
import { figuresInDiorama, figuresWithoutDiorama } from "../../src/domain/dioramas";
import { TEXTS } from "../../src/ui/texts";
import {
  expectNoAccessibilityViolations,
  heading,
  mainNavigation,
  PC,
  PHONE,
  signInDirectly,
} from "./helpers";

// P10 / F8: the dioramas (S5 list, S6 detail, S6a assign, the form), Studio files that go up and come
// back byte-identical, figures in at most one diorama, deleting with "Rückgängig". Texts come from
// `TEXTS`, so a rewording changes the test with the page.

const D = TEXTS.dioramas;
const T = TEXTS.form;
const SIZES = [
  ["Handy", PHONE],
  ["PC", PC],
] as const;

const without = figuresWithoutDiorama(DEMO_COLLECTION);
const umbara = DEMO_COLLECTION.dioramas.find((diorama) => diorama.id === "diorama-umbara");
const kamino = DEMO_COLLECTION.dioramas.find((diorama) => diorama.id === "diorama-kamino");
if (!umbara || !kamino || without.length < 2) throw new Error("Beispielsammlung passt nicht");
const inUmbara = figuresInDiorama(DEMO_COLLECTION, umbara.id);
const inKamino = figuresInDiorama(DEMO_COLLECTION, kamino.id);
const free = without[0];
const movable = inKamino[0];
if (!free || !movable) throw new Error("Beispielsammlung passt nicht");

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });
const save = (page: Page) => page.getByRole("button", { name: T.save });
const studioInput = (page: Page) => page.locator('input[accept=".io"]');

/** Some bytes that are not text, like the inside of a zipped Studio file. */
function studioBytes(length: number, seed = 7): Buffer {
  return Buffer.from(Uint8Array.from({ length }, (_, index) => (index * 31 + seed) % 256));
}

/** The storage line of the settings, read after the server was asked again. */
async function usedStorage(page: Page): Promise<string> {
  await page.goto("#/einstellungen");
  await page.reload();
  const line = page.getByText(/ von 1 GB belegt/);
  await expect(line).toBeVisible();
  return (await line.textContent()) ?? "";
}

/** A small picture made in the page, as the bytes of a PNG. */
async function makePicture(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext("2d") as CanvasRenderingContext2D;
    context.fillStyle = "#4477aa";
    context.fillRect(0, 0, 640, 480);
    context.fillStyle = "#ddaa66";
    context.fillRect(100, 100, 300, 200);
    return canvas.toDataURL("image/png").split(",")[1] ?? "";
  });
  return Buffer.from(base64, "base64");
}

test.describe("Liste der Dioramen (S5)", () => {
  test.beforeEach(async ({ page }) => {
    await signInDirectly(page, undefined, DEMO_COLLECTION);
  });

  for (const [size, viewport] of SIZES) {
    test(`P10 ${size}: Die Liste zeigt jedes Diorama mit Figuren und Teilen, das Banner zählt die Figuren ohne Diorama, axe ist ruhig`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/dioramen");
      await expect(heading(page)).toHaveText("Dioramen");
      await expect(
        page.getByRole("button", { name: /haben noch kein Diorama|hat noch kein/ }),
      ).toContainText(D.withoutBanner.count(without.length));
      const card = page.getByRole("link", { name: /Umbara-Gefecht/ });
      await expect(card).toContainText(`${D.figures(inUmbara.length)} · 1.240 Teile`);
      await expect(page.getByRole("link", { name: /Kamino-Hangar/ })).toBeVisible();
      await expect(page.getByRole("link", { name: /Burgtor/ })).toBeVisible();
      await expectNoAccessibilityViolations(page);
    });
  }

  test("P10 Das Banner öffnet die Vitrine mit dem Filter „ohne Diorama“", async ({ page }) => {
    await page.goto("#/dioramen");
    await page.getByRole("button", { name: /haben noch kein Diorama|hat noch kein/ }).click();
    await expect(page).toHaveURL(/#\/vitrine$/);
    await expect(
      page.getByRole("button", { name: TEXTS.showcase.filterButtonActive(1) }),
    ).toBeVisible();
    await expect(page.locator(".grid .tile__name", { hasText: free.name }).first()).toBeVisible();
    // Figures that stand in a diorama are not shown.
    await expect(page.locator(".grid .tile__name", { hasText: movable.name })).toHaveCount(0);
  });

  test("P10 Ein Diorama öffnet seine Seite, die Navigation bleibt bei „Dioramen“", async ({
    page,
  }) => {
    await page.goto("#/dioramen");
    await page.getByRole("link", { name: /Umbara-Gefecht/ }).click();
    await expect(page).toHaveURL(/#\/dioramen\/diorama-umbara$/);
    await expect(heading(page)).toHaveText("Umbara-Gefecht");
    await expect(page).toHaveTitle("Umbara-Gefecht – Stud Stephan");
    await expect(mainNavigation(page).locator('[aria-current="page"]').first()).toContainText(
      "Dioramen",
    );
  });
});

test.describe("Detail eines Dioramas (S6) und Figuren zuordnen (S6a)", () => {
  test.beforeEach(async ({ page }) => {
    await signInDirectly(page, undefined, DEMO_COLLECTION);
  });

  for (const [size, viewport] of SIZES) {
    test(`P10 ${size}: Die Detailseite zeigt die Figuren, Studio-Dateien, Notiz und Links, axe ist ruhig`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/dioramen/diorama-umbara");
      await expect(heading(page)).toHaveText("Umbara-Gefecht");
      await expect(page.getByText("1.240 Teile")).toBeVisible();
      const figures = page.getByRole("region", { name: D.detail.figuresTitle });
      await expect(figures.locator(".figure-tile")).toHaveCount(inUmbara.length);
      await expect(page.getByRole("region", { name: D.studio.title })).toBeVisible();
      await expect(page.getByText(umbara.note ?? "")).toBeVisible();
      await expect(page.getByRole("link", { name: "rebrickable.com" })).toBeVisible();
      await expectNoAccessibilityViolations(page);
    });
  }

  test("F8 Die Figur zeigt ihr Diorama und das Diorama die Figur, beide verlinkt", async ({
    page,
  }) => {
    const [first] = inUmbara;
    if (!first) throw new Error("keine Figur");
    await page.goto(`#/vitrine/figur/${first.id}`);
    const section = page.getByRole("region", { name: TEXTS.detail.diorama.title });
    await expect(section).toContainText("Umbara-Gefecht");
    await section.getByRole("link", { name: /Umbara-Gefecht/ }).click();
    await expect(page).toHaveURL(/#\/dioramen\/diorama-umbara$/);
    await page
      .getByRole("region", { name: D.detail.figuresTitle })
      .getByRole("link", { name: first.name })
      .first()
      .click();
    await expect(heading(page)).toHaveText(first.name);
  });

  for (const [size, viewport] of SIZES) {
    test(`P10 ${size}: Figur einem Diorama zuordnen → sie erscheint im Diorama und verschwindet aus „ohne Diorama“`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/dioramen/diorama-burgtor");
      await page.getByRole("link", { name: D.detail.assign }).click();
      await expect(page).toHaveURL(/#\/dioramen\/diorama-burgtor\/zuordnen$/);
      await expect(heading(page)).toHaveText(D.assign.title);
      // Only figures without a diorama are offered at first, none of them says "steht in".
      await expect(page.locator(".pick")).toHaveCount(without.length);
      await expect(page.getByText(/^steht in:/)).toHaveCount(0);
      const submit = page.getByRole("button", { name: D.assign.submitNone });
      await expect(submit).toBeDisabled();

      await field(page, D.assign.searchLabel).fill(free.name);
      await page.locator(".pick", { hasText: free.name }).first().click();
      await expect(page.locator(".pick[aria-pressed='true']")).toHaveCount(1);
      await expectNoAccessibilityViolations(page);
      await page.getByRole("button", { name: D.assign.submit(1) }).click();

      await expect(page).toHaveURL(/#\/dioramen\/diorama-burgtor$/);
      await expect(
        page
          .getByRole("region", { name: D.detail.figuresTitle })
          .locator(".figure-tile", { hasText: free.name }),
      ).toBeVisible();
      // The banner counts one figure less, and the server has it, too.
      await page.goto("#/dioramen");
      await expect(page.getByRole("button", { name: /noch kein Diorama/ })).toContainText(
        D.withoutBanner.count(without.length - 1),
      );
      await page.reload();
      await expect(page.getByRole("button", { name: /noch kein Diorama/ })).toContainText(
        D.withoutBanner.count(without.length - 1),
      );
    });
  }

  test("F8 Eine Figur aus einem anderen Diorama wird erst nach Rückfrage verschoben („steht in: …“)", async ({
    page,
  }) => {
    await page.goto("#/dioramen/diorama-burgtor/zuordnen");
    await page.getByRole("button", { name: D.assign.all }).click();
    const pick = page.locator(".pick", { hasText: movable.name }).first();
    await expect(pick).toContainText(D.assign.standsIn("Kamino-Hangar"));
    await pick.click();
    await page.getByRole("button", { name: D.assign.submit(1) }).click();

    const sheet = page.getByRole("dialog", { name: D.assign.move.title(1) });
    await expect(sheet).toContainText(movable.name);
    await expect(sheet).toContainText("Kamino-Hangar");
    await expectNoAccessibilityViolations(page);
    await sheet.getByRole("button", { name: D.assign.move.cancel }).click();
    await expect(page).toHaveURL(/zuordnen$/);

    await page.getByRole("button", { name: D.assign.submit(1) }).click();
    await page.getByRole("dialog").getByRole("button", { name: D.assign.move.confirm }).click();
    await expect(page).toHaveURL(/#\/dioramen\/diorama-burgtor$/);
    await expect(page.locator(".figure-tile", { hasText: movable.name }).first()).toBeVisible();
    // It stands in the new diorama only.
    await page.goto("#/dioramen/diorama-kamino");
    await expect(
      page.getByRole("region", { name: D.detail.figuresTitle }).locator(".figure-tile"),
    ).toHaveCount(inKamino.length - 1);
  });

  test("P10 Findet die Suche nichts, sagt die Seite es", async ({ page }) => {
    await page.goto("#/dioramen/diorama-burgtor/zuordnen");
    await field(page, D.assign.searchLabel).fill("gibt-es-nicht-xyz");
    await expect(page.getByText(D.assign.none)).toBeVisible();
  });

  test("F8 Auf der Seite einer Figur ohne Diorama: zuordnen, dann wieder herausnehmen", async ({
    page,
  }) => {
    await page.goto(`#/vitrine/figur/${free.id}`);
    const section = page.getByRole("region", { name: TEXTS.detail.diorama.title });
    await expect(section).toContainText(TEXTS.detail.diorama.none);
    await section.getByRole("button", { name: D.figureSection.assign }).click();
    const sheet = page.getByRole("dialog", { name: D.figureSection.chooseTitle });
    await expectNoAccessibilityViolations(page);
    await sheet.getByRole("button", { name: /Kamino-Hangar/ }).click();
    await expect(section.getByRole("link", { name: /Kamino-Hangar/ })).toBeVisible();

    await page.reload();
    await expect(
      page
        .getByRole("region", { name: TEXTS.detail.diorama.title })
        .getByRole("link", { name: /Kamino-Hangar/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: D.figureSection.take }).click();
    await expect(page.getByRole("region", { name: TEXTS.detail.diorama.title })).toContainText(
      TEXTS.detail.diorama.none,
    );
  });
});

test.describe("Diorama löschen", () => {
  test.beforeEach(async ({ page }) => {
    await signInDirectly(page, undefined, DEMO_COLLECTION);
  });

  for (const [size, viewport] of SIZES) {
    test(`P10 ${size}: Diorama löschen → die Figuren bleiben und gelten wieder als „ohne Diorama“; „Rückgängig“ holt alles zurück`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/dioramen/diorama-umbara");
      await page.getByRole("button", { name: TEXTS.actions.remove }).click();
      const sheet = page.getByRole("dialog", { name: TEXTS.remove.title("Umbara-Gefecht") });
      await expect(sheet).toContainText(TEXTS.remove.text.diorama);
      await expectNoAccessibilityViolations(page);
      await sheet.getByRole("button", { name: TEXTS.remove.confirm }).click();

      await expect(page).toHaveURL(/#\/dioramen$/);
      const toast = page.locator(".toast", { hasText: TEXTS.remove.done("Umbara-Gefecht") });
      await expect(toast).toBeVisible();
      await expect(page.getByRole("link", { name: /Umbara-Gefecht/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /noch kein Diorama/ })).toContainText(
        D.withoutBanner.count(without.length + inUmbara.length),
      );
      await expectNoAccessibilityViolations(page);

      await toast.getByRole("button", { name: TEXTS.remove.undo }).click();
      await expect(page.getByRole("link", { name: /Umbara-Gefecht/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /noch kein Diorama/ })).toContainText(
        D.withoutBanner.count(without.length),
      );
      // The server never heard of it.
      await page.reload();
      await expect(page.getByRole("link", { name: /Umbara-Gefecht/ })).toBeVisible();
    });
  }

  test("F8 Nach der Frist ist das Diorama auf dem Server weg, die Figuren sind noch da", async ({
    page,
  }) => {
    const [first] = inUmbara;
    if (!first) throw new Error("keine Figur");
    await page.goto("#/dioramen/diorama-umbara");
    await page.getByRole("button", { name: TEXTS.actions.remove }).click();
    await page.getByRole("dialog").getByRole("button", { name: TEXTS.remove.confirm }).click();
    const toast = page.locator(".toast", { hasText: TEXTS.remove.done("Umbara-Gefecht") });
    await expect(toast).toBeHidden({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByRole("link", { name: /Umbara-Gefecht/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Kamino-Hangar/ })).toBeVisible();
    await page.goto(`#/vitrine/figur/${first.id}`);
    await expect(heading(page)).toHaveText(first.name);
    await expect(page.getByRole("region", { name: TEXTS.detail.diorama.title })).toContainText(
      TEXTS.detail.diorama.none,
    );
  });
});

test.describe("Erfassen, Bearbeiten und Studio-Dateien", () => {
  test.beforeEach(async ({ page }) => {
    await signInDirectly(page);
  });

  test("P10 Ohne Diorama sagt die Liste es und führt zum Erfassen", async ({ page }) => {
    await page.goto("#/dioramen");
    await expect(page.getByRole("heading", { level: 2, name: D.empty.title })).toBeVisible();
    await expectNoAccessibilityViolations(page);
    await page.getByRole("link", { name: D.empty.action }).click();
    await expect(page).toHaveURL(/#\/erfassen\/diorama$/);
    await expect(heading(page)).toHaveText(D.form.titleNew);
  });

  test("P10 Das Erfassen-Blatt kennt das Diorama: nur der Weg „Manuell“ führt weiter", async ({
    page,
  }) => {
    await page.goto("#/erfassen");
    await page.getByRole("button", { name: TEXTS.capture.what.diorama }).click();
    const sheet = page.getByRole("dialog", { name: TEXTS.capture.title });
    await expect(sheet.getByRole("link")).toHaveCount(1);
    await expect(sheet.getByText(TEXTS.capture.onlyManual).first()).toBeVisible();
    await expectNoAccessibilityViolations(page);
    await sheet.getByRole("link", { name: TEXTS.capture.ways.manual.title }).click();
    await expect(page).toHaveURL(/#\/erfassen\/diorama$/);
    await expect(heading(page)).toHaveText(D.form.titleNew);
  });

  for (const [size, viewport] of SIZES) {
    test(`P10 ${size}: Ein leeres Formular verlangt einen Namen, axe ist ruhig`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/erfassen/diorama");
      await expectNoAccessibilityViolations(page);
      await save(page).click();
      await expect(page.getByRole("alert").first()).toHaveText(T.summary(1));
      await expect(field(page, D.form.fields.name)).toBeFocused();
      await expect(page.getByText(T.errors.required)).toBeVisible();
      await expectNoAccessibilityViolations(page);
    });
  }

  test("F8 Studio-Datei hochladen, speichern, herunterladen → die Datei ist byte-gleich mit dem Original", async ({
    page,
  }) => {
    const bytes = studioBytes(5000);
    await page.goto("#/erfassen/diorama");
    await field(page, D.form.fields.name).fill("Mein MOC");
    await field(page, D.form.fields.pieceCount).fill("1500");
    await field(page, T.fields.links).fill("https://rebrickable.com/mocs/MOC-4711/");
    await expect(studioInput(page)).toHaveAttribute("accept", ".io");
    await studioInput(page).setInputFiles({
      name: "mein-moc.io",
      mimeType: "application/octet-stream",
      buffer: bytes,
    });
    const list = page.getByRole("list").filter({ has: page.locator(".studio-row") });
    await expect(list.getByText("mein-moc.io")).toBeVisible();
    await expect(list).toContainText("5 KB");
    await expectNoAccessibilityViolations(page);
    await save(page).click();

    await expect(page).toHaveURL(/#\/dioramen\/diorama-/);
    await expect(heading(page)).toHaveText("Mein MOC");
    const studio = page.getByRole("region", { name: D.studio.title });
    await expect(studio).toContainText("mein-moc.io");
    await expect(page.getByRole("link", { name: "rebrickable.com" })).toBeVisible();
    await expectNoAccessibilityViolations(page);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      studio.getByRole("button", { name: D.studio.download("mein-moc.io") }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("mein-moc.io");
    const saved = await readFile((await download.path()) ?? "");
    expect(new Uint8Array(saved)).toEqual(new Uint8Array(bytes));

    // The server has it: after a reload the file is listed and downloads the same bytes.
    await page.reload();
    const [again] = await Promise.all([
      page.waitForEvent("download"),
      page
        .getByRole("region", { name: D.studio.title })
        .getByRole("button", { name: D.studio.download("mein-moc.io") })
        .click(),
    ]);
    expect(new Uint8Array(await readFile((await again.path()) ?? ""))).toEqual(
      new Uint8Array(bytes),
    );
  });

  test("F8 Auf der Detailseite lassen sich weitere Studio-Dateien hochladen; sie bleiben nach dem Neuladen", async ({
    page,
  }) => {
    await page.goto("#/erfassen/diorama");
    await field(page, D.form.fields.name).fill("Zwei Versionen");
    await save(page).click();
    await expect(heading(page)).toHaveText("Zwei Versionen");
    await expect(page.getByText(D.studio.none)).toBeVisible();

    const second = studioBytes(2000, 3);
    await studioInput(page).setInputFiles([
      { name: "v1.io", mimeType: "application/octet-stream", buffer: studioBytes(1500, 1) },
      { name: "v2.io", mimeType: "application/octet-stream", buffer: second },
    ]);
    const studio = page.getByRole("region", { name: D.studio.title });
    await expect(studio.locator(".studio-row")).toHaveCount(2);
    await page.reload();
    await expect(studio.locator(".studio-row")).toHaveCount(2);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      studio.getByRole("button", { name: D.studio.download("v2.io") }).click(),
    ]);
    expect(new Uint8Array(await readFile((await download.path()) ?? ""))).toEqual(
      new Uint8Array(second),
    );
  });

  test("P10 Eine Datei ohne .io und eine leere werden gemeldet und lassen sich verwerfen", async ({
    page,
  }) => {
    await page.goto("#/erfassen/diorama");
    await studioInput(page).setInputFiles([
      { name: "foto.jpg", mimeType: "image/jpeg", buffer: studioBytes(100) },
      { name: "leer.io", mimeType: "application/octet-stream", buffer: Buffer.alloc(0) },
    ]);
    await expect(page.getByText(`foto.jpg: ${D.studio.problems.not_io}`)).toBeVisible();
    await expect(page.getByText(`leer.io: ${D.studio.problems.empty}`)).toBeVisible();
    await expectNoAccessibilityViolations(page);
    await page.getByRole("button", { name: D.studio.discard }).first().click();
    await page.getByRole("button", { name: D.studio.discard }).first().click();
    await expect(page.locator(".studio-job")).toHaveCount(0);
    await expect(page.locator(".studio-row")).toHaveCount(0);
  });

  test("P10 Eine Studio-Datei, die nie gespeichert wurde, liegt nach „Abbrechen“ nicht auf dem Server", async ({
    page,
  }) => {
    await page.goto("#/erfassen/diorama");
    await studioInput(page).setInputFiles({
      name: "weg.io",
      mimeType: "application/octet-stream",
      buffer: studioBytes(4000),
    });
    await expect(page.locator(".studio-row")).toHaveCount(1);
    // Leaving the form takes the file out again; wait for that before asking the server.
    const removed = page.waitForResponse(
      (response) =>
        response.request().method() === "DELETE" && response.url().includes("/files/studio-files/"),
    );
    await page.goto("#/einstellungen");
    await removed;
    await expect.poll(() => usedStorage(page)).toBe("0 B von 1 GB belegt");
  });

  test("P10 Bearbeiten: Name ändern und eine Studio-Datei entfernen; beim Speichern verschwindet sie vom Server", async ({
    page,
  }) => {
    await page.goto("#/erfassen/diorama");
    await field(page, D.form.fields.name).fill("Altes MOC");
    await studioInput(page).setInputFiles({
      name: "alt.io",
      mimeType: "application/octet-stream",
      buffer: studioBytes(3000),
    });
    await expect(page.locator(".studio-row")).toHaveCount(1);
    await save(page).click();
    await expect(heading(page)).toHaveText("Altes MOC");

    await page.getByRole("link", { name: TEXTS.actions.edit }).click();
    await expect(page).toHaveURL(/\/bearbeiten$/);
    await expect(heading(page)).toHaveText(D.form.titleEdit("Altes MOC"));
    await expect(field(page, D.form.fields.name)).toHaveValue("Altes MOC");
    await expectNoAccessibilityViolations(page);
    await field(page, D.form.fields.name).fill("Neues MOC");
    await page.getByRole("button", { name: D.studio.remove("alt.io") }).click();
    await expect(page.locator(".studio-row")).toHaveCount(0);
    await save(page).click();

    await expect(heading(page)).toHaveText("Neues MOC");
    await expect(page.getByText(D.studio.none)).toBeVisible();
    await page.goto("#/einstellungen");
    await expect(page.getByText("0 B von 1 GB belegt")).toBeVisible();
  });

  test("F8 Fotos eines Dioramas: hochladen, speichern, Liste und Detailseite zeigen sie; Löschen räumt auf", async ({
    page,
  }) => {
    await page.goto("#/erfassen/diorama");
    await field(page, D.form.fields.name).fill("Foto-Diorama");
    await page.locator('input[accept="image/*"]').setInputFiles({
      name: "bild.png",
      mimeType: "image/png",
      buffer: await makePicture(page),
    });
    await expect(page.locator(".photo-slot img")).toHaveCount(1);
    await save(page).click();
    await expect(heading(page)).toHaveText("Foto-Diorama");
    await expect(page.locator(".gallery__track img")).toHaveCount(1);

    await page.goto("#/dioramen");
    await expect(page.locator(".diorama-card img")).toHaveCount(1);

    await page.getByRole("link", { name: /Foto-Diorama/ }).click();
    await page.getByRole("button", { name: TEXTS.actions.remove }).click();
    await page.getByRole("dialog").getByRole("button", { name: TEXTS.remove.confirm }).click();
    await expect(page.locator(".toast")).toBeHidden({ timeout: 15_000 });
    await expect.poll(() => usedStorage(page)).toBe("0 B von 1 GB belegt");
  });

  test("P10 Ein unbekanntes Diorama sagt „Nicht gefunden“", async ({ page }) => {
    await page.goto("#/dioramen/gibt-es-nicht");
    await expect(page.getByRole("heading", { name: D.notFound.title })).toBeVisible();
    await page.goto("#/dioramen/gibt-es-nicht/bearbeiten");
    await expect(page.getByRole("heading", { name: D.form.notFound.title })).toBeVisible();
    await page.goto("#/dioramen/gibt-es-nicht/zuordnen");
    await expect(page.getByRole("heading", { name: D.notFound.title })).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });
});
