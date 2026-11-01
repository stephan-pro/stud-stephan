import { readFile, writeFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { FAKE_AUTH_KEY } from "../../src/auth/fakeHttpAuth";
import { imageBytes } from "../../src/backup/backup.fixtures";
import { readBackup } from "../../src/backup/readBackup";
import { bytesSource, readZipDirectory, readZipEntry } from "../../src/backup/zip";
import { DEMO_COLLECTION } from "../../src/demo/collection";
import { aMinifig } from "../../src/domain/fixtures";
import { SCHEMA_VERSION } from "../../src/domain/types";
import { TEXTS } from "../../src/ui/texts";
import { expectNoAccessibilityViolations, FAKE_SERVER, PC, PHONE, signInDirectly } from "./helpers";

// P14: the cards "Datensicherung" and "Datenquellen" in the settings (S12, F15): export of
// everything (data, photos, Studio files) as one ZIP, import with a question and a safety copy
// first, the reminder after 30 days, the state of the data sources. The fake build runs it all
// against the fake server; the replacing logic itself (also the failures) is covered by the unit
// tests in `src/backup/`.

const B = TEXTS.backup;
const STAMP_KEY = "stud-stephan:last-backup";
const SOURCES_KEY = "stud-stephan-fake:sources";

/** The secret of the signed-in tab, to talk to the fake server like the app does. */
async function headers(page: Page): Promise<{ Authorization: string }> {
  const stored = await page.evaluate((key) => localStorage.getItem(key), FAKE_AUTH_KEY);
  return { Authorization: `Bearer ${(JSON.parse(stored ?? "{}") as { token: string }).token}` };
}

/** A figure with a photo on the server (for the files part of the backup). */
async function addFigureWithPhoto(page: Page, id: string, seed: number): Promise<void> {
  const auth = await headers(page);
  const put = await page.request.put(`${FAKE_SERVER}/files/photos/${id}/1.webp`, {
    headers: { ...auth, "Content-Type": "image/webp" },
    data: Buffer.from(imageBytes(seed)),
  });
  const { path } = (await put.json()) as { path: string };
  const save = await page.request.post(
    `${FAKE_SERVER}/objects/minifig?schemaVersion=${SCHEMA_VERSION}`,
    {
      headers: { ...auth, "Content-Type": "application/json" },
      // Its own number, so that it is a tile of its own and not a copy of Captain Rex (×3).
      data: aMinifig({ id, name: `Foto-Figur ${id}`, bricklinkId: id, photos: [path] }),
    },
  );
  expect(save.ok()).toBe(true);
}

/** Starts the export and answers the downloaded file's bytes. */
async function exportFile(page: Page, path: string): Promise<Uint8Array> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: B.export, exact: true }).click(),
  ]);
  await download.saveAs(path);
  return new Uint8Array(await readFile(path));
}

for (const [size, viewport] of [
  ["Handy", PHONE],
  ["PC", PC],
] as const) {
  test(`P14 ${size}: Die Einstellungen zeigen Datenquellen und Datensicherung ohne axe-Verstöße`, async ({
    page,
  }) => {
    await signInDirectly(page, undefined, DEMO_COLLECTION);
    await page.setViewportSize(viewport);
    await page.goto("#/einstellungen");

    await expect(page.getByRole("heading", { level: 2, name: B.title })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: TEXTS.sources.title })).toBeVisible();
    await expect(page.getByText(TEXTS.sources.lines.bricklink.ok)).toBeVisible();
    await expect(page.getByRole("button", { name: B.export, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: B.import, exact: true })).toBeVisible();
    await expect(page.getByText(TEXTS.version("0.1"))).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });
}

test("P14 F15 Die Karte nennt die ungefähre Größe der Datei, bevor man exportiert", async ({
  page,
}) => {
  await signInDirectly(page, undefined, DEMO_COLLECTION);
  await page.goto("#/einstellungen");
  await expect(page.getByText(/^Die Datei wird etwa .* groß\.$/)).toBeVisible();
});

test("P14 S12 Datenquellen: Name, Zustand und Hinweis; ohne Schlüssel „nicht verbunden“, nie ein Schlüssel", async ({
  page,
}) => {
  await signInDirectly(page);
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key as string, value as string),
    [SOURCES_KEY, JSON.stringify({ bricklink: "missingKeys", merlin: "unreachable" })],
  );
  await page.goto("#/einstellungen");

  const card = page.getByRole("region", { name: TEXTS.sources.title });
  await expect(card.getByText(TEXTS.sources.lines.rebrickable.ok)).toBeVisible();
  await expect(card.getByText(TEXTS.sources.lines.bricklink.missingKeys)).toBeVisible();
  await expect(card.getByText(TEXTS.sources.chips.missingKeys)).toBeVisible();
  await expect(card.getByText(TEXTS.sources.lines.brickognize.ok)).toBeVisible();
  await expect(card.getByText(TEXTS.sources.lines.merlin.unreachable)).toBeVisible();
  await expect(card.locator(".sources__dot--problem")).toHaveCount(2);
  await expect(card.locator(".sources__dot--ok")).toHaveCount(2);
  await expectNoAccessibilityViolations(page);
});

test("P14 S12 Datenquellen: Ist der Dienst nicht erreichbar, sagt die Karte es und versucht es auf Wunsch neu", async ({
  page,
}) => {
  await signInDirectly(page);
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key as string, value as string),
    ["stud-stephan-fake:catalog-failure", "offline"],
  );
  await page.goto("#/einstellungen");

  const card = page.getByRole("region", { name: TEXTS.sources.title });
  await expect(card.getByRole("alert")).toHaveText(TEXTS.sources.failed);
  await expectNoAccessibilityViolations(page);

  await page.evaluate(() => localStorage.removeItem("stud-stephan-fake:catalog-failure"));
  await card.getByRole("button", { name: TEXTS.sources.retry }).click();
  await expect(card.getByText(TEXTS.sources.lines.rebrickable.ok)).toBeVisible();
});

test("P14 F15 Export am PC: eine Datei mit Datenstand, Exportdatum, allen Daten und allen Dateien, geprüft", async ({
  page,
}, testInfo) => {
  await signInDirectly(page, undefined, DEMO_COLLECTION);
  await page.setViewportSize(PC);
  await page.goto("#/einstellungen");
  await addFigureWithPhoto(page, "foto-1", 1);
  await addFigureWithPhoto(page, "foto-2", 2);
  await page.reload();

  const bytes = await exportFile(page, testInfo.outputPath("sicherung.zip"));

  const backup = await readBackup(bytesSource(bytes));
  expect(backup.manifest.schemaVersion).toBe(SCHEMA_VERSION);
  expect(Date.now() - Date.parse(backup.manifest.exportedAt)).toBeLessThan(60_000);
  expect(backup.summary).toMatchObject({
    minifigs: DEMO_COLLECTION.minifigs.length + 2,
    sets: DEMO_COLLECTION.sets.length,
    specialParts: DEMO_COLLECTION.specialParts.length,
    dioramas: DEMO_COLLECTION.dioramas.length,
    wishlist: DEMO_COLLECTION.wishlist.length,
    prices: DEMO_COLLECTION.prices.length,
    photos: 2,
  });
  const fileName = /stud-stephan-sicherung-\d{4}-\d{2}-\d{2}\.zip/;
  await expect(page.getByRole("status").filter({ hasText: fileName })).toContainText(
    `${DEMO_COLLECTION.minifigs.length + 2} Figuren`,
  );
  await expect(page.getByRole("status").filter({ hasText: fileName })).toContainText("2 Fotos");
});

test("P14 F15 Die ZIP-Datei ist unverändert lesbar (Fotos byte-gleich in der Datei)", async ({
  page,
}, testInfo) => {
  await signInDirectly(page);
  await page.goto("#/einstellungen");
  await addFigureWithPhoto(page, "foto-1", 5);
  await page.reload();

  const bytes = await exportFile(page, testInfo.outputPath("sicherung.zip"));
  const source = bytesSource(bytes);
  const entries = await readZipDirectory(source);
  const photo = entries.find((entry) => entry.name.startsWith("fotos/"));

  expect(entries.map((entry) => entry.name)).toContain("daten.json");
  expect(await readZipEntry(source, photo as never)).toEqual(imageBytes(5));
});

test("P14 F15 Letzte Sicherung: erst „noch keine“, nach dem Export das heutige Datum, nach 30 Tagen eine sanfte Erinnerung", async ({
  page,
}, testInfo) => {
  await signInDirectly(page);
  await page.goto("#/einstellungen");
  const notice = page.locator(".backup__notice");
  await expect(notice).toHaveText(B.last.never);
  await expect(notice).toHaveAttribute("data-notice", "never");

  await exportFile(page, testInfo.outputPath("sicherung.zip"));
  await expect(notice).toHaveAttribute("data-notice", "recent");
  await expect(notice).toContainText("Letzte Sicherung auf diesem Gerät: ");

  await page.evaluate((key) => localStorage.setItem(key, "2020-01-01"), STAMP_KEY);
  await page.reload();
  await expect(notice).toHaveAttribute("data-notice", "due");
  await expect(notice).toContainText("Zeit für eine neue?");
  await expectNoAccessibilityViolations(page);
});

for (const [size, viewport] of [
  ["Handy", PHONE],
  ["PC", PC],
] as const) {
  test(`P14 F15 ${size}: Import fragt mit Zusammenfassung, sichert vorab und stellt den Stand der Sicherung her`, async ({
    page,
  }, testInfo) => {
    await signInDirectly(page, undefined, DEMO_COLLECTION);
    await page.setViewportSize(viewport);
    await page.goto("#/einstellungen");
    await addFigureWithPhoto(page, "foto-1", 1);
    await page.reload();
    const path = testInfo.outputPath("sicherung.zip");
    await exportFile(page, path);

    // After the backup the collection changes: the photo figure is deleted, a new one added.
    const auth = await headers(page);
    await page.request.delete(`${FAKE_SERVER}/objects/minifig/foto-1`, { headers: auth });
    await addFigureWithPhoto(page, "foto-neu", 9);
    await page.reload();

    await page.locator('input[type="file"]').setInputFiles(path);
    const sheet = page.getByRole("dialog", { name: B.sheet.title });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText(`${DEMO_COLLECTION.minifigs.length + 1} Figuren`);
    await expect(sheet.getByText(B.sheet.replaces)).toBeVisible();
    await expect(sheet.getByText(B.sheet.safety)).toBeVisible();
    await expectNoAccessibilityViolations(page);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      sheet.getByRole("button", { name: B.sheet.confirm }).click(),
    ]);
    // The safety copy is the state before: it holds the new photo figure, not the old one.
    await download.saveAs(testInfo.outputPath("vor-import.zip"));
    expect(download.suggestedFilename()).toMatch(/^stud-stephan-sicherung-.*-vor-import\.zip$/);
    const before = await readBackup(
      bytesSource(new Uint8Array(await readFile(testInfo.outputPath("vor-import.zip")))),
    );
    expect(before.manifest.collection.minifigs.map((m) => m.id)).toContain("foto-neu");
    expect(before.manifest.collection.minifigs.map((m) => m.id)).not.toContain("foto-1");

    await expect(page.getByRole("status").filter({ hasText: "Fertig." })).toBeVisible();
    await expect(sheet).toBeHidden();

    // The collection is the one of the backup again: the old figure is back, the new one gone.
    await page.goto("#/vitrine");
    await expect(page.getByRole("link", { name: /Foto-Figur foto-1/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Foto-Figur foto-neu/ })).toHaveCount(0);
    await expectNoAccessibilityViolations(page);
  });
}

test("P14 F15 „Abbrechen“ in der Frage lässt alles, wie es war", async ({ page }, testInfo) => {
  await signInDirectly(page, undefined, DEMO_COLLECTION);
  await page.goto("#/einstellungen");
  const path = testInfo.outputPath("sicherung.zip");
  await exportFile(page, path);
  const auth = await headers(page);
  await page.request.delete(`${FAKE_SERVER}/objects/minifig/${DEMO_COLLECTION.minifigs[0]?.id}`, {
    headers: auth,
  });
  let downloads = 0;
  page.on("download", () => downloads++);

  await page.locator('input[type="file"]').setInputFiles(path);
  const sheet = page.getByRole("dialog", { name: B.sheet.title });
  await sheet.getByRole("button", { name: B.sheet.cancel }).click();

  await expect(sheet).toBeHidden();
  expect(downloads).toBe(0);
  const collection = await page.request.get(`${FAKE_SERVER}/collection`, { headers: auth });
  const minifigs = ((await collection.json()) as { minifigs: unknown[] }).minifigs;
  expect(minifigs).toHaveLength(DEMO_COLLECTION.minifigs.length - 1);
});

test("P14 F15 Eine Datei, die keine Sicherung ist, wird geprüft und abgelehnt – nichts ändert sich", async ({
  page,
}, testInfo) => {
  await signInDirectly(page, undefined, DEMO_COLLECTION);
  await page.goto("#/einstellungen");
  const wrong = testInfo.outputPath("brief.zip");
  await writeFile(wrong, "Das ist ein Brief und keine Sicherung.");
  let downloads = 0;
  page.on("download", () => downloads++);

  await page.locator('input[type="file"]').setInputFiles(wrong);

  const alert = page.getByRole("alert").filter({ hasText: B.problems.notZip });
  await expect(alert).toContainText(B.problems.nothingChanged);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(downloads).toBe(0);
  await expectNoAccessibilityViolations(page);
});

test("P14 F15 Eine beschädigte Sicherung wird vor jeder Änderung abgelehnt", async ({
  page,
}, testInfo) => {
  await signInDirectly(page, undefined, DEMO_COLLECTION);
  await page.goto("#/einstellungen");
  await addFigureWithPhoto(page, "foto-1", 1);
  await page.reload();
  const path = testInfo.outputPath("sicherung.zip");
  const bytes = await exportFile(page, path);
  // One byte inside the first photo changes: the checksum does not fit any more.
  bytes[30 + 17 + 40] = (bytes[30 + 17 + 40] as number) ^ 0xff;
  await writeFile(path, bytes);

  await page.locator('input[type="file"]').setInputFiles(path);

  await expect(page.getByRole("alert")).toContainText(B.problems.damaged);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
