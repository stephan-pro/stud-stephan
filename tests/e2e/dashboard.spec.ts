import { expect, type Page, test } from "@playwright/test";
import { DEMO_COLLECTION, DEMO_TODAY } from "../../src/demo/collection";
import { latestPriceDate, mostValuable, themeShares } from "../../src/domain/dashboard";
import { formatDate } from "../../src/domain/dates";
import { aCollection, aMinifig, aPrice } from "../../src/domain/fixtures";
import { formatMoney, formatMoneyWhole, formatPercentChange } from "../../src/domain/money";
import { figuresNotOnDisplay } from "../../src/domain/placement";
import { totals } from "../../src/domain/totals";
import { VALUE_PERIODS, valueTrend, weeklyChange } from "../../src/domain/valueHistory";
import { describeChart } from "../../src/ui/chartText";
import { TEXTS } from "../../src/ui/texts";
import { expectNoAccessibilityViolations, heading, PC, PHONE, signInDirectly } from "./helpers";

// P13 / F12: the dashboard (S11): the value with its history from the price runs, the sums, the
// counts, the share per sub theme, the most valuable objects, the figures without a diorama, and
// the "+x % Woche" of the collection card. Texts come from `TEXTS`; the numbers are computed from
// the example collection with the same domain functions the page uses (unit tests: `src/domain`).

const T = TEXTS.dashboard;
const SIZES = [
  ["Handy", PHONE],
  ["PC", PC],
] as const;

/** The day the example collection was made for; the page reads "today" from the clock. */
async function fixToday(page: Page, day = DEMO_TODAY): Promise<void> {
  await page.clock.setFixedTime(new Date(`${day}T12:00:00`));
}

const chart = (page: Page) => page.getByRole("img", { name: /^Gesamtwert vom / });
const periodButton = (page: Page, period: (typeof VALUE_PERIODS)[number]) =>
  page.getByRole("button", { name: T.periods[period], exact: true });

for (const [size, viewport] of SIZES) {
  test.describe(size, () => {
    test.use({ viewport });

    test(`F12 ${size}: Das Dashboard zeigt Gesamtwert, Kacheln, Anzahl, Themen, Bestenliste und Fußzeile und hat keine axe-Verstöße`, async ({
      page,
    }) => {
      await fixToday(page);
      await signInDirectly(page, undefined, DEMO_COLLECTION);
      await page.goto("#/dashboard");
      const sums = totals(DEMO_COLLECTION);

      await expect(heading(page)).toHaveText("Dashboard");
      await expect(heading(page)).toHaveCount(1);
      await expect(page).toHaveTitle("Dashboard – Stud Stephan");
      const valueCard = page.getByRole("region", { name: T.value });
      await expect(valueCard).toContainText(formatMoneyWhole(sums.value));
      for (const [label, value] of [
        [T.tiles.purchase, formatMoneyWhole(sums.purchase)],
        [T.tiles.mods, formatMoneyWhole(sums.modSpend)],
        [T.tiles.withoutValue, String(sums.withoutValue)],
      ] as const) {
        await expect(page.locator(".stat", { hasText: label })).toContainText(value);
      }
      const kinds = page.getByRole("region", { name: T.kinds.title });
      await expect(kinds).toContainText(T.kinds.figures(sums.counts.minifigs));
      await expect(kinds).toContainText(T.kinds.sets(sums.counts.sets));
      await expect(kinds).toContainText(T.kinds.dioramas(sums.counts.dioramas));
      await expect(kinds).toContainText(T.kinds.specialParts(sums.counts.specialParts));
      await expect(page.locator(".share")).toHaveCount(themeShares(DEMO_COLLECTION).length);
      await expect(page.locator(".top-row")).toHaveCount(mostValuable(DEMO_COLLECTION).length);
      const priced = latestPriceDate(DEMO_COLLECTION, DEMO_TODAY);
      expect(priced).toBeDefined();
      await expect(page.getByText(T.footer(formatDate(priced ?? "")))).toBeVisible();
      await expectNoAccessibilityViolations(page);
    });
  });
}

test("F12 Die Beschreibung des Diagramms entspricht den Daten, für jeden Zeitraum", async ({
  page,
}) => {
  await fixToday(page);
  await signInDirectly(page, undefined, DEMO_COLLECTION);
  await page.goto("#/dashboard");

  for (const period of VALUE_PERIODS) {
    await periodButton(page, period).click();
    await expect(periodButton(page, period)).toHaveAttribute("aria-pressed", "true");
    const points = valueTrend(DEMO_COLLECTION, period, DEMO_TODAY).points;
    expect(points.length).toBeGreaterThanOrEqual(2);
    await expect(chart(page)).toHaveAttribute("aria-label", describeChart(points));
  }
  // The line has one point per price run, nothing in between.
  const drawn = await chart(page).locator("polyline").getAttribute("points");
  expect(drawn?.trim().split(" ")).toHaveLength(
    valueTrend(DEMO_COLLECTION, "all", DEMO_TODAY).points.length,
  );
});

test("F12 Mit nur einem Preisstand bleibt das Diagramm ehrlich: Hinweis „Verlauf“, keine Linie", async ({
  page,
}) => {
  await fixToday(page, "2026-11-01");
  const collection = aCollection({
    minifigs: [aMinifig({ acquiredOn: "2026-08-01" })],
    prices: [aPrice("sw0194", "2026-11-01", { used: 3850 })],
  });
  await signInDirectly(page, undefined, collection);
  await page.goto("#/dashboard");
  await expect(page.getByText(T.historyFirst(formatDate("2026-11-01")))).toBeVisible();
  await expect(chart(page)).toHaveCount(0);
  await expect(page.locator(".dashboard-value .badge")).toHaveCount(0);
  await expectNoAccessibilityViolations(page);
});

test("F12 Mit wenigen Preisständen steht „Verlauf ab …“ unter dem Diagramm", async ({ page }) => {
  await fixToday(page);
  await signInDirectly(page, undefined, DEMO_COLLECTION);
  await page.goto("#/dashboard");
  await periodButton(page, "year").click();
  const trend = valueTrend(DEMO_COLLECTION, "year", DEMO_TODAY);
  expect(trend.partial).toBe(true);
  await expect(page.getByText(T.historyFrom(formatDate(trend.since ?? "")))).toBeVisible();
  await expect(page.locator(".dashboard-value .badge")).toContainText(
    T.changeSince(formatDate(trend.points[0]?.date ?? "")),
  );
});

test("F12 Ohne Preisstände sagt das Dashboard, dass der Verlauf noch fehlt, und rechnet mit 0", async ({
  page,
}) => {
  await signInDirectly(page);
  await page.goto("#/dashboard");
  await expect(page.getByText(T.historyNone)).toBeVisible();
  await expect(chart(page)).toHaveCount(0);
  await expect(page.getByText(T.footerNone)).toBeVisible();
  await expect(page.getByText(T.top.empty)).toBeVisible();
  await expect(page.getByText(T.themes.empty)).toBeVisible();
  await expectNoAccessibilityViolations(page);
});

test("F12 Ein Eintrag der Bestenliste öffnet die Detailseite", async ({ page }) => {
  await fixToday(page);
  await signInDirectly(page, undefined, DEMO_COLLECTION);
  await page.goto("#/dashboard");
  const best = mostValuable(DEMO_COLLECTION)[0];
  if (!best) throw new Error("Beispielsammlung passt nicht");
  const row = page.locator(".top-row").first();
  await expect(row).toContainText(best.item.name);
  await expect(row).toContainText(formatMoney(best.cents));
  await row.click();
  await expect(page).toHaveURL(new RegExp(`#/vitrine/[a-zA-Z]+/${best.item.id}$`));
  await expect(heading(page)).toContainText(best.item.name);
});

test("F12 „Nicht ausgestellt“ öffnet die Vitrine, gefiltert auf diese Figuren", async ({
  page,
}) => {
  await fixToday(page);
  await signInDirectly(page, undefined, DEMO_COLLECTION);
  await page.goto("#/dashboard");
  const without = figuresNotOnDisplay(DEMO_COLLECTION).length;
  const banner = page.getByRole("button", { name: new RegExp(T.notOnDisplay) });
  await expect(banner).toContainText(TEXTS.dioramas.withoutBanner.count(without));
  await banner.click();
  await expect(page).toHaveURL(/#\/vitrine$/);
  await expect(
    page.getByRole("button", { name: TEXTS.showcase.filterButtonActive(1) }),
  ).toBeVisible();
});

test("F12 Die Sammlungskarte der Vitrine zeigt die Veränderung der Woche mit derselben Rechnung", async ({
  page,
}) => {
  await fixToday(page);
  await signInDirectly(page, undefined, DEMO_COLLECTION);
  await page.goto("#/vitrine");
  const week = weeklyChange(DEMO_COLLECTION, DEMO_TODAY);
  if (!week) throw new Error("Beispielsammlung passt nicht");
  await expect(page.locator(".collection-card .badge")).toHaveText(
    TEXTS.showcase.card.week(formatPercentChange(week.percent)),
  );
  await expectNoAccessibilityViolations(page);
});

test("F12 Ohne Vergleichswert zeigt die Sammlungskarte keine Veränderung", async ({ page }) => {
  await fixToday(page, "2026-11-01");
  const collection = aCollection({
    minifigs: [aMinifig({ acquiredOn: "2026-08-01" })],
    prices: [aPrice("sw0194", "2026-11-01", { used: 3850 })],
  });
  await signInDirectly(page, undefined, collection);
  await page.goto("#/vitrine");
  await expect(page.locator(".collection-card")).toBeVisible();
  await expect(page.locator(".collection-card .badge")).toHaveCount(0);
});
