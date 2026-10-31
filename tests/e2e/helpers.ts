import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";

/** Phone size of the click dummy (Redmi-like) and a usual PC window. */
export const PHONE = { width: 390, height: 844 } as const;
export const PC = { width: 1280, height: 800 } as const;

/** Colours of tokens.css as the browser reports them. */
export const COLOURS = {
  nav: "rgb(17, 17, 17)",
  white: "rgb(255, 255, 255)",
  pop: "rgb(245, 154, 214)",
} as const;

/** The page as it is right now has no WCAG 2.2 A/AA violations (light scheme, no animations). */
export async function expectNoAccessibilityViolations(page: Page): Promise<void> {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

/** The visible main navigation (phone bar or PC sidebar; the other one is not displayed). */
export function mainNavigation(page: Page): Locator {
  return page.getByRole("navigation", { name: "Hauptnavigation" });
}

export function heading(page: Page): Locator {
  return page.getByRole("heading", { level: 1 });
}

/** One computed style property of an element. */
export function style(locator: Locator, property: string): Promise<string> {
  return locator.evaluate(
    (element, name) => getComputedStyle(element).getPropertyValue(name),
    property,
  );
}
