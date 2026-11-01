import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";
import { FAKE_AUTH_KEY } from "../../src/auth/fakeHttpAuth";
import type { ObjectKind } from "../../src/backend/rules";
import { type Collection, SCHEMA_VERSION } from "../../src/domain/types";

/** Phone size of the click dummy (Redmi-like) and a usual PC window. */
export const PHONE = { width: 390, height: 844 } as const;
export const PC = { width: 1280, height: 800 } as const;

/** The fake server of the backend (started by Playwright, see playwright.config.ts). */
export const FAKE_SERVER = "http://localhost:4180";

/**
 * An address no other test uses. The fake server runs once for all tests and allows one code a
 * minute per address, so every test signs in with an address of its own.
 */
export function newAddress(): string {
  return `stephan-${Date.now()}-${Math.floor(Math.random() * 1e6)}@beispiel.de`;
}

/** Puts the objects and prices of a collection onto the fake server, for the account of `token`. */
async function seedCollection(page: Page, token: string, collection: Collection): Promise<void> {
  const send = async (path: string, data: unknown) => {
    const response = await page.request.post(`${FAKE_SERVER}${path}`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      data,
    });
    expect(response.ok(), `${path}: ${response.status()}`).toBe(true);
  };
  const save = (kind: ObjectKind, objects: readonly object[]) =>
    Promise.all(
      objects.map((object) => send(`/objects/${kind}?schemaVersion=${SCHEMA_VERSION}`, object)),
    );
  // The example Studio files do not exist on the fake server; the showcase does not need them.
  await save(
    "diorama",
    collection.dioramas.map((diorama) => ({ ...diorama, studioFiles: [] })),
  );
  await save("minifig", collection.minifigs);
  await save("legoSet", collection.sets);
  await save("specialPart", collection.specialParts);
  await save("wishItem", collection.wishlist);
  await Promise.all(collection.prices.map((point) => send("/prices", point)));
}

/**
 * Makes an account by hand (as "Add user" in the dashboard) and puts its session into the browser
 * before the app starts, so a test of the shell starts signed in without the sign-in page (that
 * page has its own tests in `signIn.spec.ts`). Only for the first load of the tab: after signing
 * out, a reload stays signed out. Answers the address. With `collection` the account starts with
 * those objects, otherwise it is empty.
 */
export async function signInDirectly(
  page: Page,
  email = newAddress(),
  collection?: Collection,
): Promise<string> {
  const response = await page.request.post(`${FAKE_SERVER}/test/user`, { data: { email } });
  expect(response.ok()).toBe(true);
  const account = (await response.json()) as { token: string; owner: string; email: string };
  if (collection) await seedCollection(page, account.token, collection);
  const stored = JSON.stringify({
    token: account.token,
    session: { userId: account.owner, email: account.email },
  });
  await page.addInitScript(
    ([key, value]) => {
      if (sessionStorage.getItem("e2e:angemeldet") === null) {
        sessionStorage.setItem("e2e:angemeldet", "ja");
        localStorage.setItem(key, value);
      }
    },
    [FAKE_AUTH_KEY, stored] as const,
  );
  return account.email;
}

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

/**
 * The entry of a wish in the wishlist that opens its sheet (row or "Zielpreis erreicht" card), by its
 * exact name; not the bin beside it.
 */
export function wishEntry(page: Page, name: string): Locator {
  const exact = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
  return page
    .locator(".wish-row, .wish-reached")
    .filter({ has: page.locator(".wish-row__name").getByText(exact) });
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
