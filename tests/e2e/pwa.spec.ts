import { readFileSync, writeFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { DEMO_COLLECTION } from "../../src/demo/collection";
import { TEXTS } from "../../src/ui/texts";
import { APP_VERSION } from "../../src/version";
import { expectNoAccessibilityViolations, PC, PHONE, signInDirectly } from "./helpers";

// P15: installable app, offline reading of the collection, a new version only on "neu laden". The
// other specs block the service worker (playwright.config.ts); here it runs as on the phone.
test.use({ serviceWorkers: "allow" });

/** The built service worker that `vite preview` serves (playwright.config.ts). */
const SERVICE_WORKER = "dist/sw.js";

const SIZES = [
  ["Handy", PHONE],
  ["PC", PC],
] as const;

/** Waits until the service worker is installed and active (the app's files are kept then). */
async function serviceWorkerReady(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state))
    .toBe("activated");
}

/** Whether the copy of the collection is kept on the device (IndexedDB of `snapshotStore.ts`). */
function hasCopy(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const opening = indexedDB.open("stud-stephan-offline", 1);
        opening.onupgradeneeded = () => opening.result.createObjectStore("snapshot");
        opening.onerror = () => resolve(false);
        opening.onsuccess = () => {
          const database = opening.result;
          const get = database.transaction("snapshot").objectStore("snapshot").get("collection");
          get.onsuccess = () => {
            database.close();
            resolve(get.result !== undefined);
          };
          get.onerror = () => {
            database.close();
            resolve(false);
          };
        };
      }),
  );
}

/** Signed in with the example collection, loaded once online, then the device goes offline. */
async function openOffline(page: Page, context: import("@playwright/test").BrowserContext) {
  await signInDirectly(page, undefined, DEMO_COLLECTION);
  await page.goto("#/vitrine");
  await expect(page.getByText("Captain Rex").first()).toBeVisible();
  await serviceWorkerReady(page);
  await expect.poll(() => hasCopy(page)).toBe(true);
  await context.setOffline(true);
  await page.reload();
}

test("P15 Installierbar: Manifest, Icons und Service Worker sind da", async ({ page }) => {
  await page.goto("");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe("/stud-stephan/manifest.webmanifest");
  const manifest = await (await page.request.get(href ?? "")).json();
  expect(manifest).toMatchObject({ name: "Stud Stephan", display: "standalone" });
  for (const icon of manifest.icons as { src: string }[]) {
    const response = await page.request.get(`/stud-stephan/${icon.src}`);
    expect(response.ok(), icon.src).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
  await serviceWorkerReady(page);
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toMatch(/\/stud-stephan\/$/);
});

for (const [size, viewport] of SIZES) {
  test(`P15 ${size}: Ohne Verbindung startet die App und zeigt die Vitrine mit dem letzten Stand`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize(viewport);
    await openOffline(page, context);
    await expect(page.getByText("Captain Rex").first()).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: /du siehst den Stand vom/ }),
    ).toBeVisible();
    // Photos with expired or unreachable addresses show the placeholder, never a broken picture.
    await expect
      .poll(() =>
        page
          .locator("img.cover__image")
          .evaluateAll((images) =>
            images.filter((image) => {
              const picture = image as HTMLImageElement;
              return picture.complete && picture.naturalWidth === 0;
            }),
          )
          .then((broken) => broken.length),
      )
      .toBe(0);
    await expectNoAccessibilityViolations(page);
  });
}

test("P15 Ohne Verbindung sind Erfassen und Ändern abgeschaltet, mit klarem Hinweis", async ({
  page,
  context,
}) => {
  await openOffline(page, context);
  await page.goto("#/erfassen");
  const capture = page.getByRole("dialog", { name: TEXTS.capture.title });
  await expect(capture.getByText(TEXTS.readOnly)).toBeVisible();
  for (const way of Object.values(TEXTS.capture.ways)) {
    await expect(capture.getByRole("button", { name: new RegExp(way.title) })).toBeDisabled();
  }
  await expectNoAccessibilityViolations(page);
  await capture.getByRole("button", { name: TEXTS.capture.close }).click();

  await page.getByText("Captain Rex").first().click();
  await expect(page).toHaveURL(/#\/vitrine\/figur\//);
  await expect(
    page.getByRole("button", { name: `${TEXTS.actions.edit} – ${TEXTS.readOnlyShort}` }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: `${TEXTS.actions.remove} – ${TEXTS.readOnlyShort}` }),
  ).toBeDisabled();
  await expectNoAccessibilityViolations(page);

  // Back online: the server's collection replaces the copy, changing works again.
  await context.setOffline(false);
  await expect(page.getByRole("link", { name: TEXTS.actions.edit })).toBeVisible();
  await expect(page.getByText(/du siehst den Stand vom/)).toBeHidden();
});

test("P15 Beim Abmelden verlässt die Kopie der Sammlung das Gerät", async ({ page }) => {
  await signInDirectly(page, undefined, DEMO_COLLECTION);
  await page.goto("#/vitrine");
  await expect.poll(() => hasCopy(page)).toBe(true);
  await page.goto("#/einstellungen");
  await page.getByRole("button", { name: TEXTS.account.signOut }).click();
  await expect(page.getByRole("button", { name: TEXTS.signIn.sendCode })).toBeVisible();
  expect(await hasCopy(page)).toBe(false);
});

test("P15 Neue Version: Hinweis „Neue Version verfügbar – Neu laden“ statt stillem Wechsel", async ({
  page,
}) => {
  await page.goto("");
  await serviceWorkerReady(page);
  // Controlled by the service worker from the second load on.
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
  await expect(page.getByText(TEXTS.update.message)).toBeHidden();

  // The server now has another sw.js, as after a deploy: the new version installs and waits.
  // (Playwright's routes do not see the browser fetching the service worker script, so the built
  // file itself is changed for this test and put back afterwards.)
  const original = readFileSync(SERVICE_WORKER, "utf8");
  writeFileSync(SERVICE_WORKER, `${original}\n// neue Version ${Date.now()}`);
  try {
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())?.update();
    });
    const notice = page.getByRole("status").filter({ hasText: TEXTS.update.message });
    await expect(notice).toBeVisible();
    // Nothing happens by itself: the page is still the same after a while.
    await page.waitForTimeout(500);
    await expect(notice).toBeVisible();
    await expectNoAccessibilityViolations(page);

    // "Neu laden" lets the new version take over and reloads.
    const reloaded = page.waitForEvent("load");
    await notice.getByRole("button", { name: TEXTS.update.action }).click();
    await reloaded;
    await expect(page.getByText(TEXTS.update.message)).toBeHidden();
  } finally {
    writeFileSync(SERVICE_WORKER, original);
  }
});

test("P15 Version 1.0 steht in den Einstellungen, dazu der Hinweis zum Installieren", async ({
  page,
}) => {
  await signInDirectly(page);
  await page.goto("#/einstellungen");
  expect(APP_VERSION).toBe("1.0");
  await expect(page.getByText(TEXTS.version("1.0"))).toBeVisible();
  await expect(page.getByRole("heading", { name: TEXTS.install.title })).toBeVisible();
  await expectNoAccessibilityViolations(page);
});
