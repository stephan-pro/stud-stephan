import { expect, test } from "@playwright/test";
import { FAKE_AUTH_KEY } from "../../src/auth/fakeHttpAuth";
import { TEXTS } from "../../src/ui/texts";
import { expectNoAccessibilityViolations, FAKE_SERVER, PC, PHONE, signInDirectly } from "./helpers";

// P4c: the storage card in the settings (S12) shows what photos and Studio files take of 1 GB,
// and files go up, come back byte-identical and go away again (F8) against the fake server.

test.beforeEach(async ({ page }) => {
  await signInDirectly(page);
});

for (const [size, viewport] of [
  ["Handy", PHONE],
  ["PC", PC],
] as const) {
  test(`P4c ${size}: Die Einstellungen zeigen die Belegung ohne axe-Verstöße`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("#/einstellungen");

    await expect(page.getByRole("heading", { level: 2, name: TEXTS.storage.title })).toBeVisible();
    await expect(page.getByText("0 B von 1 GB belegt")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: TEXTS.storage.meter })).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });
}

/** What the signed-in tab talks to the fake server with. */
async function secret(page: import("@playwright/test").Page): Promise<string> {
  const stored = await page.evaluate((key) => localStorage.getItem(key), FAKE_AUTH_KEY);
  return (JSON.parse(stored ?? "{}") as { token: string }).token;
}

test("P4c Hochladen, Herunterladen (byte-gleich) und Löschen ändern die Anzeige der Belegung", async ({
  page,
}) => {
  await page.goto("#/einstellungen");
  await expect(page.getByText("0 B von 1 GB belegt")).toBeVisible();
  const headers = { Authorization: `Bearer ${await secret(page)}` };
  const studio = Uint8Array.from({ length: 2500 }, (_, index) => (index * 7) % 256);

  const photo = await page.request.put(`${FAKE_SERVER}/files/photos/rex/1.webp`, {
    headers: { ...headers, "Content-Type": "image/webp" },
    data: Buffer.alloc(1500, 9),
  });
  const file = await page.request.put(`${FAKE_SERVER}/files/studio-files/umbara/s-1.io`, {
    headers: { ...headers, "Content-Type": "application/octet-stream" },
    data: Buffer.from(studio),
  });
  const photoPath = ((await photo.json()) as { path: string }).path;
  const studioPath = ((await file.json()) as { path: string }).path;

  await page.reload();
  await expect(page.getByText("4 KB von 1 GB belegt")).toBeVisible();

  const downloaded = await page.request.get(`${FAKE_SERVER}/files/studio-files/${studioPath}`, {
    headers,
  });
  expect(new Uint8Array(await downloaded.body())).toEqual(studio);

  await page.request.delete(`${FAKE_SERVER}/files/photos/${photoPath}`, { headers });
  await page.reload();
  await expect(page.getByText("2,5 KB von 1 GB belegt")).toBeVisible();
});

test("P4c Kann die Belegung nicht gelesen werden, sagt die Seite es und versucht es auf Wunsch neu", async ({
  page,
}) => {
  await page.route("**/usage", (route) => route.abort());
  await page.goto("#/einstellungen");

  await expect(page.getByRole("alert")).toHaveText(TEXTS.storage.failed);
  await expectNoAccessibilityViolations(page);

  await page.unroute("**/usage");
  await page.getByRole("button", { name: TEXTS.storage.retry }).click();
  await expect(page.getByText("0 B von 1 GB belegt")).toBeVisible();
});
