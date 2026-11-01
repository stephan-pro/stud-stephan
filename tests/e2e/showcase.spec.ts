import { expect, type Page, test } from "@playwright/test";
import { FAKE_AUTH_KEY } from "../../src/auth/fakeHttpAuth";
import { DEMO_COLLECTION } from "../../src/demo/collection";
import { formatMoney, formatMoneyWhole } from "../../src/domain/money";
import {
  entryItems,
  NO_FILTER,
  type ShowcaseFilter,
  type ShowcaseSort,
  showcase,
} from "../../src/domain/showcase";
import { totals } from "../../src/domain/totals";
import type { Minifig } from "../../src/domain/types";
import { valueOfItem } from "../../src/domain/value";
import { TEXTS } from "../../src/ui/texts";
import {
  expectNoAccessibilityViolations,
  FAKE_SERVER,
  heading,
  PC,
  PHONE,
  signInDirectly,
} from "./helpers";

// P5: the showcase (S1, S1a) and the detail pages (S2, S3, S4) against the fake server, with the
// example collection of the click dummy (`src/demo/`) as content. Expectations come from the
// domain functions, so the numbers on the screen are checked against the rules, not against a copy.

const DEMO = DEMO_COLLECTION;
const T = TEXTS.showcase;

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Beispieldaten: Eintrag fehlt");
  return value;
}
const figure = (id: string): Minifig => must(DEMO.minifigs.find((minifig) => minifig.id === id));
const rex = figure("minifig-rex");
const shownValue = (item: Parameters<typeof valueOfItem>[0]) =>
  formatMoney(valueOfItem(item, DEMO.prices).cents);

/** Names of the tiles the domain says the showcase shows. */
function expectedNames(filter: Partial<ShowcaseFilter>, sort: ShowcaseSort = "recent"): string[] {
  return showcase(DEMO, { ...NO_FILTER, ...filter }, sort).map(
    (entry) => entryItems(entry)[0]?.name ?? "",
  );
}

const tiles = (page: Page) => page.locator(".grid .tile");
const tileNames = (page: Page) => page.locator(".grid .tile__name").allTextContents();

const SIZES = [
  ["Handy", PHONE],
  ["PC", PC],
] as const;

test.describe("mit Beispielsammlung", () => {
  test.beforeEach(async ({ page }) => {
    await signInDirectly(page, undefined, DEMO);
  });

  for (const [size, viewport] of SIZES) {
    test(`P5 ${size}: Die Vitrine zeigt Sammlungskarte und alle Kacheln ohne axe-Verstöße`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/vitrine");

      await expect(heading(page)).toHaveText("Hey Stephan");
      await expect(page).toHaveTitle("Vitrine – Stud Stephan");
      const { value, counts } = totals(DEMO);
      const card = page.getByRole("region", { name: TEXTS.appName });
      await expect(card).toContainText(formatMoneyWhole(value));
      await expect(card).toContainText(T.card.figures(counts.minifigs));
      await expect(card).toContainText(T.card.sets(counts.sets));
      await expect(card).toContainText(T.card.dioramas(counts.dioramas));
      expect(await tileNames(page)).toEqual(expectedNames({}));
      await expectNoAccessibilityViolations(page);
    });
  }

  test("P5 Nacharbeit: Kacheln mit Leerzeichen im Namen haben eine gültige Muster-Kennung und bleiben hell", async ({
    page,
  }) => {
    await page.goto("#/vitrine");
    const tile = page.locator(".tile", { hasText: "Commander Appo" });
    await expect(tile).toBeVisible();
    const fill = await tile.locator(".scribbles rect").first().getAttribute("fill");
    const id = /^url\(#([A-Za-z0-9_-]+)\)$/.exec(fill ?? "")?.[1];
    expect(id).toBeDefined();
    await expect(tile.locator(`pattern[id="${id}"]`)).toHaveCount(1);
    // Every pattern on the page has a unique id, so no tile paints with another one's pattern.
    const ids = await page.locator("pattern").evaluateAll((all) => all.map((node) => node.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("P5 Nacharbeit: PC-Layout der Vitrine wie im Dummy", async ({ page }) => {
    await page.setViewportSize(PC);
    await page.goto("#/vitrine");
    const box = async (locator: ReturnType<Page["locator"]>) => {
      const rect = await locator.boundingBox();
      if (!rect) throw new Error("Element nicht sichtbar");
      return rect;
    };
    const greeting = await box(heading(page));
    const search = await box(page.getByRole("searchbox", { name: T.searchLabel }));
    expect(
      Math.abs(search.y + search.height / 2 - (greeting.y + greeting.height / 2)),
    ).toBeLessThan(40);
    expect(search.x).toBeGreaterThan(greeting.x + greeting.width);

    const card = page.getByRole("region", { name: TEXTS.appName });
    const amount = await box(card.locator(".collection-card__amount"));
    const pills = await box(card.locator(".pills"));
    expect(pills.x).toBeGreaterThan(amount.x + amount.width);
    expect(Math.abs(pills.y + pills.height - (amount.y + amount.height))).toBeLessThan(30);

    const chips = await box(page.locator(".controls .chips"));
    const filter = await box(page.getByRole("button", { name: TEXTS.showcase.filterButton }));
    expect(Math.abs(chips.y + chips.height / 2 - (filter.y + filter.height / 2))).toBeLessThan(20);
    expect(filter.x).toBeGreaterThan(chips.x + chips.width);

    // The sidebar reaches the bottom of the window, also after scrolling (by script: mobile WebKit
    // has no mouse wheel).
    await page.evaluate(() => scrollBy(0, 600));
    const sidebar = await box(page.locator(".sidebar"));
    expect(Math.round(sidebar.y + sidebar.height)).toBeGreaterThanOrEqual(PC.height - 16);
  });

  test("P5 F11 Handy zwei Spalten, PC fünf bis sechs", async ({ page }) => {
    const columns = () =>
      page
        .locator(".grid")
        .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length);
    await page.setViewportSize(PHONE);
    await page.goto("#/vitrine");
    await expect(tiles(page).first()).toBeVisible();
    expect(await columns()).toBe(2);
    await page.setViewportSize(PC);
    expect(await columns()).toBeGreaterThanOrEqual(5);
    expect(await columns()).toBeLessThanOrEqual(6);
  });

  test("P5 F5 Marker ×3, Mod, Kein Diorama und Set auf den Kacheln, Wert und Platzhalter ohne Foto", async ({
    page,
  }) => {
    await page.goto("#/vitrine");
    const tile = (name: string) => page.locator(".tile", { hasText: name });

    await expect(tile("Clone Trooper Phase II")).toContainText("×3");
    await expect(tile("Captain Rex")).toContainText(T.tile.modified);
    await expect(tile("Captain Rex")).not.toContainText("×");
    await expect(tile("ARC Trooper Fives")).toContainText(T.tile.withoutDiorama);
    await expect(tile("Clone Trooper & Battle Droid")).toContainText(T.tile.set);
    await expect(tile("Sammelmünze")).toContainText(TEXTS.specialPartKinds.gwp.chip);
    await expect(tile("Captain Rex")).toContainText("sw0194 · Star Wars");
    await expect(tile("Captain Rex")).toContainText(shownValue(rex));
    await expect(tile("Burgwache")).toContainText("Bluebrixx · Ritter");
    // No own photo and no catalog image yet: the placeholder with its picture symbol.
    await expect(tile("Captain Rex").locator("img")).toHaveCount(0);
    await expect(tile("Captain Rex").locator(".cover__symbol")).toBeVisible();
  });

  test("P5 F11 Die Chips Alle · Figuren · Sets · Sonderteile wählen die Objektart", async ({
    page,
  }) => {
    await page.goto("#/vitrine");
    const chip = (name: string) => page.getByRole("button", { name, exact: true });
    await expect(chip("Alle")).toHaveAttribute("aria-pressed", "true");

    await chip("Sets").click();
    await expect(chip("Sets")).toHaveAttribute("aria-pressed", "true");
    await expect(chip("Alle")).toHaveAttribute("aria-pressed", "false");
    expect(await tileNames(page)).toEqual(expectedNames({ type: "legoSet" }));

    await chip("Sonderteile").click();
    expect(await tileNames(page)).toEqual(["Sammelmünze"]);
    await chip("Figuren").click();
    expect(await tileNames(page)).toEqual(expectedNames({ type: "minifig" }));
  });

  test("P5 F11 Sortierung nach Name, Wert und zuletzt hinzugefügt", async ({ page }) => {
    await page.goto("#/vitrine");
    const sort = page.getByRole("combobox", { name: T.sortLabel });
    await expect(sort).toHaveValue("recent");
    for (const [label, key] of [
      [T.sorts.name, "name"],
      [T.sorts.value, "value"],
      [T.sorts.recent, "recent"],
    ] as const) {
      await sort.selectOption({ label });
      expect(await tileNames(page)).toEqual(expectedNames({}, key));
    }
  });

  test("P5 F11 Die Suche findet nach Name und Nummer, ohne Treffer hilft „zurücksetzen“", async ({
    page,
  }) => {
    await page.setViewportSize(PC);
    await page.goto("#/vitrine");
    const search = page.getByRole("searchbox", { name: T.searchLabel });

    await search.fill("sw0194");
    expect(await tileNames(page)).toEqual(expectedNames({ query: "sw0194" }));
    await search.fill("ritter");
    expect(await tileNames(page)).toEqual(expectedNames({ query: "ritter" }));

    await search.fill("gibt es nicht");
    await expect(page.getByRole("heading", { name: T.noResults.title })).toBeVisible();
    await expectNoAccessibilityViolations(page);
    await page.getByRole("button", { name: T.noResults.reset }).click();
    await expect(search).toHaveValue("");
    expect(await tileNames(page)).toEqual(expectedNames({}));
  });

  test("P5 F11 Handy: Die Lupe öffnet das Suchfeld und setzt den Fokus hinein", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await page.goto("#/vitrine");
    const search = page.getByRole("searchbox", { name: T.searchLabel });
    await expect(search).toBeHidden();

    await page.getByRole("button", { name: T.searchOpen }).click();
    await expect(search).toBeFocused();
    await expectNoAccessibilityViolations(page);
    await search.fill("rex");
    expect(await tileNames(page)).toEqual(["Captain Rex"]);
    await page.getByRole("button", { name: T.searchClose }).click();
    await expect(search).toBeHidden();
  });

  for (const [size, viewport] of SIZES) {
    test(`P5 ${size}: Der Filter zeigt Themen in zwei Stufen, zählt live und hat keine axe-Verstöße`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/vitrine");
      await page.getByRole("button", { name: TEXTS.filter.title, exact: true }).click();

      const sheet = page.getByRole("dialog", { name: TEXTS.filter.title });
      await expect(sheet).toBeVisible();
      // Sub themes appear only once their main theme is chosen.
      for (const chip of ["Star Wars", "Ritter", "Ninjago"]) {
        await expect(sheet.getByRole("button", { name: chip, exact: true })).toBeVisible();
      }
      for (const chip of ["The Clone Wars", "Staffel 1"]) {
        await expect(sheet.getByRole("button", { name: chip, exact: true })).toHaveCount(0);
      }
      await sheet.getByRole("button", { name: "Star Wars", exact: true }).click();
      await sheet.getByRole("button", { name: "Ninjago", exact: true }).click();
      for (const chip of ["The Clone Wars", "Staffel 1"]) {
        await expect(sheet.getByRole("button", { name: chip, exact: true })).toBeVisible();
      }
      await sheet.getByRole("button", { name: "Ninjago", exact: true }).click();
      for (const group of [
        TEXTS.filter.theme,
        TEXTS.filter.manufacturer,
        TEXTS.filter.condition,
        TEXTS.filter.modified,
      ]) {
        await expect(sheet.getByRole("group", { name: group })).toBeVisible();
      }
      await expectNoAccessibilityViolations(page);

      // The sub theme takes only its own objects, the count on the button follows at once.
      await sheet.getByRole("button", { name: "The Clone Wars", exact: true }).click();
      await sheet.getByRole("button", { name: "Star Wars", exact: true }).click();
      const clone = { themes: ["Star Wars – The Clone Wars"] };
      const count = expectedNames(clone).length;
      await sheet.getByRole("button", { name: TEXTS.filter.show(count) }).click();
      await expect(sheet).toBeHidden();
      expect(await tileNames(page)).toEqual(expectedNames(clone));
      await expect(page.getByRole("button", { name: T.filterButtonActive(1) })).toBeFocused();
    });
  }

  test("P5 F11 Hauptthema nimmt Unterthemen mit, Hersteller, Zustand, modifiziert und ohne Diorama", async ({
    page,
  }) => {
    await page.goto("#/vitrine");
    await page.getByRole("button", { name: TEXTS.filter.title, exact: true }).click();
    const sheet = page.getByRole("dialog", { name: TEXTS.filter.title });
    const choose = (name: string) => sheet.getByRole("button", { name, exact: true }).click();
    const closeWith = async (filter: Partial<ShowcaseFilter>) => {
      await sheet
        .getByRole("button", { name: TEXTS.filter.show(expectedNames(filter).length) })
        .click();
      expect(await tileNames(page)).toEqual(expectedNames(filter));
    };

    await choose("Star Wars");
    await choose(TEXTS.filter.manufacturers.lego);
    await choose(TEXTS.conditions.used);
    await choose(TEXTS.filter.modifiedOptions.yes);
    await closeWith({
      themes: ["Star Wars"],
      manufacturers: ["lego"],
      conditions: ["used"],
      modified: "yes",
    });
    expect(await tileNames(page)).toEqual(["Captain Rex"]);

    await page.getByRole("button", { name: T.filterButtonActive(4) }).click();
    await choose(TEXTS.filter.reset);
    await choose(TEXTS.filter.withoutDiorama);
    await closeWith({ withoutDiorama: true });
    await expect(page.getByRole("button", { name: T.filterButtonActive(1) })).toBeVisible();

    await page.getByRole("button", { name: T.filterButtonActive(1) }).click();
    await choose(TEXTS.filter.reset);
    await closeWith({});
    await expect(page.getByRole("button", { name: TEXTS.filter.title, exact: true })).toBeVisible();
  });

  test("P5 F5 Eine Kachel ×3 öffnet die Auswahl der Exemplare, dann die Detailseite", async ({
    page,
  }) => {
    await page.goto("#/vitrine");
    await page.locator(".tile", { hasText: "Clone Trooper Phase II" }).click();

    const sheet = page.getByRole("dialog", { name: /Clone Trooper Phase II/ });
    await expect(sheet).toContainText("Du hast diese Figur 3-mal.");
    await expect(sheet.getByRole("link")).toHaveCount(3);
    await expectNoAccessibilityViolations(page);

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(page.locator(".tile", { hasText: "Clone Trooper Phase II" })).toBeFocused();

    await page.locator(".tile", { hasText: "Clone Trooper Phase II" }).click();
    await sheet.getByRole("link").first().click();
    await expect(page).toHaveURL(/#\/vitrine\/figur\/minifig-trooper-\d$/);
    await expect(heading(page)).toHaveText("Clone Trooper Phase II");
  });

  for (const [size, viewport] of SIZES) {
    test(`P5 ${size}: Die Detailseite einer Figur zeigt Wert, Herkunft, Diorama und Mods ohne axe-Verstöße`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/vitrine");
      await page.locator(".tile", { hasText: "Captain Rex" }).click();

      await expect(page).toHaveURL(/#\/vitrine\/figur\/minifig-rex$/);
      await expect(heading(page)).toHaveText("Captain Rex");
      await expect(heading(page)).toBeFocused();
      await expect(page).toHaveTitle("Captain Rex – Stud Stephan");
      await expect(page.getByText("sw0194 · LEGO · Star Wars – The Clone Wars")).toBeVisible();
      await expect(page.getByText(TEXTS.conditions.used, { exact: true })).toBeVisible();
      await expect(page.getByText(TEXTS.detail.modified, { exact: true })).toBeVisible();

      const valuation = valueOfItem(rex, DEMO.prices);
      const card = page.getByRole("region", { name: TEXTS.detail.value.market("gebraucht") });
      await expect(card).toContainText(formatMoney(valuation.cents));
      // The lines of the value card as in Figur.dc.html.
      await expect(card).toContainText(`Kaufpreis ${formatMoney(2500)} · +13,50`);
      await expect(card).toContainText(
        `Neu wäre sie ${formatMoney(valuation.otherCondition?.cents ?? 0)} wert`,
      );
      await expect(card).toContainText("Stand vom 27.10.2026 · BrickLink");
      await expect(card.getByRole("img", { name: /Verlauf des Marktwerts/ })).toBeVisible();

      const origin = page.getByRole("region", { name: TEXTS.detail.origin.title });
      await expect(origin).toContainText("BrickLink-Händler");
      await expect(origin).toContainText("März 2025");
      await expect(origin).toContainText("einzeln gekauft");
      await expect(page.getByRole("region", { name: TEXTS.detail.diorama.title })).toContainText(
        "Umbara-Gefecht",
      );

      // F6: the mods are listed and add up, and the value above stays the market value.
      const mods = page.getByRole("region", { name: TEXTS.detail.mods.title });
      await expect(mods).toContainText(TEXTS.modPositions.arms);
      await expect(mods).toContainText(TEXTS.modPositions.headgear);
      await expect(mods).toContainText("Original in der Teilekiste");
      await expect(mods).toContainText(TEXTS.detail.mods.notInValue);
      await expect(mods).toContainText(`${TEXTS.detail.mods.spend}`);
      await expect(mods).toContainText(formatMoney(1450));
      await expect(page.getByRole("region", { name: TEXTS.detail.copies.title })).toContainText(
        TEXTS.detail.copies.once,
      );
      await expect(page.getByText("Helm sitzt etwas locker.")).toBeVisible();
      await expectNoAccessibilityViolations(page);
    });
  }

  test("P5 F5 Weitere Exemplare stehen auf der Detailseite und führen zum Exemplar und zum Set", async ({
    page,
  }) => {
    await page.goto("#/vitrine/figur/minifig-trooper-1");
    const copies = page.getByRole("region", { name: TEXTS.detail.copies.title });
    await expect(copies).toContainText("Du hast diese Figur 3-mal.");
    await expect(copies.getByRole("link")).toHaveCount(2);

    await copies.getByRole("link").first().click();
    await expect(page).toHaveURL(/#\/vitrine\/figur\/minifig-trooper-\d$/);
    await expect(page).not.toHaveURL(/trooper-1$/);

    // "Stammt aus Set" leads to the own set (S3) when the figure is linked to it.
    await page.goto("#/vitrine/figur/minifig-trooper-1");
    await page
      .getByRole("region", { name: TEXTS.detail.origin.title })
      .getByRole("link", { name: /75372-1/ })
      .click();
    await expect(page).toHaveURL(/#\/vitrine\/set\/set-75372$/);
    await expect(heading(page)).toHaveText("Clone Trooper & Battle Droid Battle Pack");
  });

  for (const [size, viewport] of SIZES) {
    test(`P5 ${size}: Die Detailseite eines Sets zeigt Status, Wert und enthaltene Figuren (vorhanden und fehlend) ohne axe-Verstöße`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/vitrine/set/set-75372");

      await expect(heading(page)).toHaveText("Clone Trooper & Battle Droid Battle Pack");
      await expect(page.getByText("75372 · LEGO · Star Wars · 2024")).toBeVisible();
      await expect(page.getByText(TEXTS.setStatus.figuresRemoved, { exact: true })).toBeVisible();
      await expect(page.getByText(TEXTS.conditions.used, { exact: true })).toBeVisible();
      const set = must(DEMO.sets[0]);
      const value = page.getByRole("region", { name: TEXTS.detail.value.market("gebraucht") });
      await expect(value).toContainText(shownValue(set));
      await expect(value).toContainText(/Neu wäre es \d+,\d{2}\s€ wert/);

      // Two of the four figures are at hand: both Clone Troopers, not the Battle Droids.
      const figures = page.getByRole("region", { name: TEXTS.detail.set.figuresTitle });
      await expect(figures.getByRole("img", { name: "2 von 4 Figuren vorhanden" })).toHaveText(
        "2 / 4",
      );
      await expect(figures.getByRole("link", { name: /Clone Trooper/ })).toBeVisible();
      await expect(figures.getByText("Battle Droid")).toBeVisible();
      await expect(figures.getByRole("link", { name: /Battle Droid/ })).toHaveCount(0);
      await expect(figures.locator(".figure-tile--missing")).toContainText(
        TEXTS.detail.set.missing,
      );
      await expect(page.getByRole("region", { name: TEXTS.detail.set.title })).toContainText("215");
      await expect(page.getByRole("region", { name: TEXTS.detail.origin.title })).toContainText(
        "LEGO Store Köln",
      );
      await expectNoAccessibilityViolations(page);

      await figures.getByRole("link", { name: /Clone Trooper/ }).click();
      await expect(page).toHaveURL(/#\/vitrine\/figur\/minifig-trooper-\d$/);
    });
  }

  for (const [size, viewport] of SIZES) {
    test(`P5 ${size}: Die Detailseite eines Sonderteils zeigt Art und selbst geschätzten Wert ohne axe-Verstöße`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/vitrine/sonderteil/part-coin");

      await expect(heading(page)).toHaveText("Sammelmünze");
      await expect(page.getByText("LEGO · Star Wars", { exact: true })).toBeVisible();
      await expect(page.getByText(TEXTS.specialPartKinds.gwp.chip, { exact: true })).toBeVisible();
      const card = page.getByRole("region", { name: TEXTS.detail.value.manual });
      await expect(card).toContainText(formatMoney(990));
      await expect(card).toContainText(TEXTS.detail.value.noMarket);
      await expect(card).toContainText("Eingetragen am 12.05.2025");
      const origin = page.getByRole("region", { name: TEXTS.detail.origin.title });
      await expect(origin).toContainText(TEXTS.specialPartKinds.gwp.long);
      await expect(origin).toContainText("Beigabe zu einer Bestellung");
      await expect(origin).toContainText("Mai 2025");
      await expect(page.getByRole("region", { name: TEXTS.detail.mods.title })).toHaveCount(0);
      await expect(page.getByRole("region", { name: TEXTS.detail.diorama.title })).toHaveCount(0);
      await expect(page.getByRole("region", { name: TEXTS.detail.copies.title })).toHaveCount(0);
      await expectNoAccessibilityViolations(page);
    });
  }

  test("P5 Ein Objekt, das es nicht gibt, sagt es und führt zurück zur Vitrine", async ({
    page,
  }) => {
    await page.goto("#/vitrine/figur/gibt-es-nicht");
    await expect(heading(page)).toHaveText(TEXTS.detail.notFound.title);
    await expect(heading(page)).toHaveCount(1);
    await expectNoAccessibilityViolations(page);
    await page.getByRole("link", { name: TEXTS.detail.back }).last().click();
    await expect(heading(page)).toHaveText("Hey Stephan");
  });

  test("P5 Suche, Filter und Sortierung bleiben beim Zurückkehren von einer Detailseite", async ({
    page,
  }) => {
    await page.goto("#/vitrine");
    await page.getByRole("button", { name: "Sets", exact: true }).click();
    await page.locator(".tile", { hasText: "Battle Pack" }).click();
    await expect(heading(page)).toHaveText("Clone Trooper & Battle Droid Battle Pack");

    await page.getByRole("link", { name: TEXTS.detail.back }).first().click();
    await expect(page.getByRole("button", { name: "Sets", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await tileNames(page)).toEqual(expectedNames({ type: "legoSet" }));
  });

  test("P5 Offline zeigt die Hinweisleiste und lässt die geladene Sammlung stehen", async ({
    page,
    context,
  }) => {
    await page.goto("#/vitrine");
    await expect(tiles(page).first()).toBeVisible();
    await expect(page.getByText(TEXTS.offline)).toBeHidden();

    await context.setOffline(true);
    await expect(page.getByText(TEXTS.offline)).toBeVisible();
    expect(await tileNames(page)).toEqual(expectedNames({}));
    await expectNoAccessibilityViolations(page);

    await context.setOffline(false);
    await expect(page.getByText(TEXTS.offline)).toBeHidden();
  });

  test("P5 Eigene Fotos erscheinen auf Kachel und Detailseite über die signierte Adresse", async ({
    page,
  }) => {
    await page.goto("#/einstellungen");
    const stored = await page.evaluate((key) => localStorage.getItem(key), FAKE_AUTH_KEY);
    const headers = {
      Authorization: `Bearer ${(JSON.parse(stored ?? "{}") as { token: string }).token}`,
    };
    // A real 1 × 1 pixel WebP picture, so the browser can decode what comes back.
    const picture = Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64");
    const photos: string[] = [];
    for (const name of ["rex/foto-1.webp", "rex/foto-2.webp"]) {
      const response = await page.request.put(`${FAKE_SERVER}/files/photos/${name}`, {
        headers: { ...headers, "Content-Type": "image/webp" },
        data: picture,
      });
      photos.push(((await response.json()) as { path: string }).path);
    }
    const saved = await page.request.post(`${FAKE_SERVER}/objects/minifig?schemaVersion=1`, {
      headers,
      data: { ...rex, photos },
    });
    expect(saved.ok()).toBe(true);

    // The app reads the collection once when it starts: a new start shows the photos.
    await page.goto("#/vitrine");
    await page.reload();
    const photo = page.locator(".tile", { hasText: "Captain Rex" }).locator("img");
    await expect(photo).toHaveCount(1);
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);
    await expect(page.locator(".tile", { hasText: "ARC Trooper" }).locator("img")).toHaveCount(0);

    await page.locator(".tile", { hasText: "Captain Rex" }).click();
    const gallery = page.getByRole("region", { name: /Fotos: Captain Rex/ });
    await expect(gallery.locator("img")).toHaveCount(2);
    await expect(gallery.getByRole("img", { name: "Captain Rex, Foto 1 von 2" })).toBeAttached();
    await expect(page.getByText("1 / 2", { exact: true })).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });
});

test.describe("ohne Sammlung", () => {
  test.beforeEach(async ({ page }) => {
    await signInDirectly(page);
  });

  for (const [size, viewport] of SIZES) {
    test(`P5 ${size}: Die leere Vitrine begrüßt und führt zum Erfassen ohne axe-Verstöße`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("#/vitrine");

      await expect(page.getByRole("heading", { name: T.empty.title })).toBeVisible();
      await expect(page.getByText(T.empty.text)).toBeVisible();
      await expectNoAccessibilityViolations(page);
      await page.getByRole("link", { name: T.empty.action }).click();
      await expect(page).toHaveURL(/#\/erfassen$/);
    });
  }

  test("P5 Während die Sammlung lädt, stehen Platzhalter statt eines Drehrads", async ({
    page,
  }) => {
    await page.route("**/collection", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.continue();
    });
    await page.goto("#/vitrine");

    const loading = page.getByRole("status", { name: T.loading });
    await expect(loading).toBeVisible();
    await expectNoAccessibilityViolations(page);
    await expect(loading).toBeHidden();
    await expect(page.getByRole("heading", { name: T.empty.title })).toBeVisible();
  });

  test("P5 Kann die Sammlung nicht geladen werden, sagt die Seite es und versucht es auf Wunsch neu", async ({
    page,
  }) => {
    await page.route("**/collection", (route) => route.abort());
    await page.goto("#/vitrine");

    await expect(page.getByRole("alert")).toContainText(T.loadFailed.title);
    await expectNoAccessibilityViolations(page);

    await page.unroute("**/collection");
    await page.getByRole("button", { name: T.loadFailed.retry }).click();
    await expect(page.getByRole("heading", { name: T.empty.title })).toBeVisible();
  });
});
