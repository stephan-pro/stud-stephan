import { expect, test } from "@playwright/test";
import { COLOURS, heading, mainNavigation, PC, PHONE, signInDirectly, style } from "./helpers";

// Signed in from the start (P4b; the sign-in page: `signIn.spec.ts`).
test.beforeEach(async ({ page }) => {
  await signInDirectly(page);
});

// P1 "Nav matches the dummy": black pill, current entry white with its name, plus button `--pop`
// (Main.dc.html); on the PC the sidebar of PC-Vitrine.dc.html.

const ENTRIES = [
  { name: "Vitrine", heading: "Hey Stephan" },
  { name: "Dioramen", heading: "Dioramen" },
  { name: "Erfassen", heading: "Erfassen" },
  { name: "Wunschliste", heading: "Wunschliste" },
  { name: "Dashboard", heading: "Dashboard" },
] as const;

test.describe("Handy", () => {
  test.use({ viewport: PHONE });

  test("P1 Handy: schwarze Pille unten, aktiver Eintrag weiß mit Text, Plus-Knopf in --pop", async ({
    page,
  }) => {
    await page.goto("#/vitrine");
    const nav = mainNavigation(page);
    await expect(nav).toBeVisible();
    await expect(page.locator(".sidebar")).toBeHidden();

    expect(await style(nav, "background-color")).toBe(COLOURS.nav);
    expect(await style(nav, "position")).toBe("fixed");
    const box = await nav.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height).toBe(68);
      expect(Number.parseFloat(await style(nav, "border-top-left-radius"))).toBeGreaterThanOrEqual(
        box.height / 2,
      );
      expect(box.x).toBe(16);
      expect(Math.round(box.y + box.height)).toBe(PHONE.height - 16);
    }

    const current = nav.getByRole("link", { name: "Vitrine" });
    await expect(current).toHaveAttribute("aria-current", "page");
    await expect(current).toHaveText("Vitrine");
    expect(await style(current, "background-color")).toBe(COLOURS.white);
    expect(await style(current, "color")).toBe(COLOURS.nav);

    for (const name of ["Dioramen", "Wunschliste", "Dashboard"]) {
      const link = nav.getByRole("link", { name });
      await expect(link).toBeVisible();
      await expect(link).toHaveText("");
      await expect(link).not.toHaveAttribute("aria-current");
    }

    const plus = nav.getByRole("link", { name: "Erfassen" });
    expect(await style(plus, "background-color")).toBe(COLOURS.pop);
    const plusBox = await plus.boundingBox();
    expect(plusBox?.width).toBe(50);
    expect(plusBox?.height).toBe(50);
  });

  test("P1 Handy: jeder Eintrag öffnet seine Seite und wird zur weißen Pille", async ({ page }) => {
    await page.goto("#/vitrine");
    const nav = mainNavigation(page);
    for (const entry of [...ENTRIES].reverse()) {
      await nav.getByRole("link", { name: entry.name }).click();
      await expect(heading(page)).toHaveText(entry.heading);
      await expect(nav.getByRole("link", { name: entry.name })).toHaveAttribute(
        "aria-current",
        "page",
      );
      if (entry.name !== "Erfassen") {
        await expect(nav.getByRole("link", { name: entry.name })).toHaveText(entry.name);
      } else {
        // Capturing opens a sheet that blocks the page; Escape closes it.
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape");
      }
    }
  });

  test("P1 Handy: Der Avatar „S“ öffnet die Einstellungen, „Zurück“ führt zur Vitrine", async ({
    page,
  }) => {
    await page.goto("#/vitrine");
    const avatar = page.getByRole("link", { name: "Einstellungen" });
    await expect(avatar).toHaveText("S");
    expect(await style(avatar, "background-color")).toBe(COLOURS.pop);
    await avatar.click();
    await expect(heading(page)).toHaveText("Einstellungen");
    await expect(mainNavigation(page)).toHaveCount(0);
    await page.getByRole("link", { name: "Zurück" }).click();
    await expect(heading(page)).toHaveText("Hey Stephan");
  });

  test("P1 Handy: Die Leiste verdeckt keinen Inhalt", async ({ page }) => {
    await page.goto("#/wunschliste");
    const padding = Number.parseFloat(await style(page.locator("main"), "padding-bottom"));
    expect(padding).toBeGreaterThanOrEqual(110);
  });
});

test.describe("PC", () => {
  test.use({ viewport: PC });

  test("P1 PC: schwarze Seitenleiste links mit allen Einträgen als Text, Erfassen als --pop-Knopf", async ({
    page,
  }) => {
    await page.goto("#/vitrine");
    const nav = mainNavigation(page);
    await expect(nav).toBeVisible();
    await expect(page.locator(".tabbar")).toBeHidden();
    expect(await style(nav, "background-color")).toBe(COLOURS.nav);
    expect(await style(nav, "border-top-left-radius")).toBe("28px");
    const box = await nav.boundingBox();
    expect(box?.x).toBe(16);
    expect(box?.width).toBe(240);

    await expect(nav.getByText("Stud Stephan")).toBeVisible();
    for (const name of [
      "Erfassen",
      "Vitrine",
      "Dioramen",
      "Wunschliste",
      "Dashboard",
      "Einstellungen",
    ]) {
      await expect(nav.getByRole("link", { name })).toHaveText(name);
    }
    const current = nav.getByRole("link", { name: "Vitrine" });
    await expect(current).toHaveAttribute("aria-current", "page");
    expect(await style(current, "background-color")).toBe(COLOURS.white);
    expect(await style(nav.getByRole("link", { name: "Erfassen" }), "background-color")).toBe(
      COLOURS.pop,
    );
    // Content sits right of the sidebar.
    const main = await page.locator("main").boundingBox();
    expect(main?.x).toBeGreaterThan(256);
  });

  test("P1 PC: jeder Eintrag der Seitenleiste öffnet seine Seite", async ({ page }) => {
    await page.goto("#/vitrine");
    const nav = mainNavigation(page);
    for (const entry of [...ENTRIES, { name: "Einstellungen", heading: "Einstellungen" }]) {
      await nav.getByRole("link", { name: entry.name }).click();
      await expect(heading(page)).toHaveText(entry.heading);
      await expect(nav.getByRole("link", { name: entry.name })).toHaveAttribute(
        "aria-current",
        "page",
      );
      // Capturing opens a sheet that blocks the page; Escape closes it.
      if (entry.name === "Erfassen") {
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape");
      }
    }
  });
});
