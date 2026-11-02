import { expect, type Page, test } from "@playwright/test";
import { DEMO_COLLECTION } from "../../src/demo/collection";
import { formatDate } from "../../src/domain/dates";
import { TEXTS } from "../../src/ui/texts";
import { expectNoAccessibilityViolations, PC, PHONE, signInDirectly } from "./helpers";

// P11: the card "Preisabruf" in the settings (S12) with "Jetzt aktualisieren". The fake build runs
// the price run over the collection on the fake server (`src/backend/fakePriceRun.ts`): the latest
// known price + 2 % with today's date; the real run is tested in `supabase/functions/_shared/`.

const T = TEXTS.priceRun;
const CONTROL_KEY = "stud-stephan-fake:price-run-control";

/** Today in the browser, "YYYY-MM-DD" (the fake's run day). */
async function today(page: Page): Promise<string> {
  return page.evaluate(() => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  });
}

function row(page: Page, label: string) {
  return page.locator(".price-run .rows__row").filter({ hasText: label }).locator("dd");
}

for (const [size, viewport] of [
  ["Handy", PHONE],
  ["PC", PC],
] as const) {
  test(`P11 ${size}: Die Einstellungen zeigen den Preisabruf ohne axe-Verstöße`, async ({
    page,
  }) => {
    await signInDirectly(page);
    await page.setViewportSize(viewport);
    await page.goto("#/einstellungen");

    await expect(page.getByRole("heading", { level: 2, name: T.title })).toBeVisible();
    await expect(row(page, T.lastRun)).toHaveText(T.never);
    await expect(row(page, T.nextRun)).toHaveText(/^\d{2}\.\d{2}\.\d{4}, 0[34]:00$/);
    await expect(page.getByRole("button", { name: T.update })).toBeEnabled();
    await expectNoAccessibilityViolations(page);
  });
}

test("P11 F10 'Jetzt aktualisieren' schreibt neue Preisstände; S12 und die Wert-Karte zeigen sie", async ({
  page,
}) => {
  await signInDirectly(page, undefined, DEMO_COLLECTION);
  await page.goto("#/einstellungen");
  await expect(row(page, T.lastRun)).toHaveText(T.never);

  await page.getByRole("button", { name: T.update }).click();
  await expect(page.getByRole("status").filter({ hasText: T.finished })).toBeVisible();
  await expect(row(page, T.lastRun)).toHaveText(/^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2} · von Hand$/);
  await expect(row(page, T.result)).toHaveText(/^\d+ aktualisiert, 0 fehlgeschlagen/);
  await expectNoAccessibilityViolations(page);

  // The state stays after a reload (the real one reads it from the database).
  await page.reload();
  await expect(row(page, T.result)).toHaveText(/^\d+ aktualisiert, 0 fehlgeschlagen/);

  // Captain Rex, used: 38,50 € of the last price point, now 2 % more with today's date.
  const day = formatDate(await today(page));
  await page.goto("#/vitrine/figur/minifig-rex");
  const card = page.locator(".value-card");
  await expect(card).toContainText("39,27 €");
  await expect(card).toContainText(TEXTS.detail.value.asOfMarket(day));
});

test("P11 Ohne Verbindung sagt die Karte es; beim Tageslimit wartet der Lauf auf morgen", async ({
  page,
}) => {
  await signInDirectly(page, undefined, DEMO_COLLECTION);
  await page.goto("#/einstellungen");
  await expect(row(page, T.lastRun)).toHaveText(T.never);
  await page.evaluate((key) => localStorage.setItem(key, "offline"), CONTROL_KEY);
  await page.getByRole("button", { name: T.update }).click();
  await expect(page.getByRole("alert")).toHaveText(T.failures.offline);
  await expect(page.getByRole("button", { name: T.update })).toBeEnabled();
  await expectNoAccessibilityViolations(page);

  await page.evaluate((key) => localStorage.setItem(key, "limit_reached"), CONTROL_KEY);
  await page.getByRole("button", { name: T.update }).click();
  await expect(row(page, T.result)).toContainText("Das Tageslimit von BrickLink ist erreicht");
  await expect(page.getByRole("alert")).toHaveCount(0);

  // The next day it goes on and finishes.
  await page.evaluate((key) => localStorage.removeItem(key), CONTROL_KEY);
  await page.getByRole("button", { name: T.update }).click();
  await expect(row(page, T.result)).toHaveText(/^\d+ aktualisiert, 0 fehlgeschlagen/);
});

for (const [size, viewport] of [
  ["Handy", PHONE],
  ["PC", PC],
] as const) {
  test(`P11 ${size}: „Fehlgeschlagen“ nennt je Nummer den Grund von BrickLink, wo es einen gibt, ohne axe-Verstöße`, async ({
    page,
  }) => {
    await signInDirectly(page);
    await page.setViewportSize(viewport);
    // A finished run with two failed items, one with a reason and one from before they were kept.
    const run = {
      status: {
        trigger: "manual",
        day: "2026-11-07",
        startedAt: "2026-11-07T10:00:00Z",
        finishedAt: "2026-11-07T10:01:00Z",
        total: 5,
        updated: 3,
        empty: 0,
        failed: 2,
        open: 0,
        skipped: 0,
        failedNumbers: ["11323pb01c01", "sw9998"],
        failedReasons: { "11323pb01c01": "BrickLink: nicht gefunden (RESOURCE_NOT_FOUND)" },
      },
      queue: [],
    };
    await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
      "stud-stephan-fake:price-run",
      JSON.stringify(run),
    ] as const);
    await page.goto("#/einstellungen");
    // The row "Fehlgeschlagen" itself, not "Ergebnis: … 2 fehlgeschlagen".
    const failedRow = page
      .locator(".price-run .rows__row")
      .filter({ has: page.locator("dt", { hasText: new RegExp(`^${T.failedNumbers}$`) }) })
      .locator("dd");
    await expect(failedRow).toHaveText(
      "11323pb01c01 – BrickLink: nicht gefunden (RESOURCE_NOT_FOUND); sw9998",
    );
    await expectNoAccessibilityViolations(page);
  });
}

test("P11 Kann der Stand nicht gelesen werden, sagt die Karte es und versucht es auf Wunsch neu", async ({
  page,
}) => {
  await signInDirectly(page);
  await page.addInitScript((key) => localStorage.setItem(key, "offline"), CONTROL_KEY);
  await page.goto("#/einstellungen");
  await expect(page.getByRole("alert")).toHaveText(T.failedToLoad);
  await expectNoAccessibilityViolations(page);
  await page.evaluate((key) => localStorage.removeItem(key), CONTROL_KEY);
  await page.getByRole("button", { name: T.retry }).first().click();
  await expect(row(page, T.lastRun)).toHaveText(T.never);
});
