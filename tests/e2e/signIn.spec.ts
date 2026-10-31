import { expect, type Page, test } from "@playwright/test";
import { TEXTS } from "../../src/ui/texts";
import {
  expectNoAccessibilityViolations,
  FAKE_SERVER,
  heading,
  newAddress,
  PC,
  PHONE,
  signInDirectly,
} from "./helpers";

// P4b: sign-in by code against the fake server (S0, settings S12). The rules of the service itself
// (ten minutes, once, a minute between codes, no new accounts) are in the contract tests
// (`src/auth/auth.contract.ts`), which also run against a real local Supabase in CI.

const T = TEXTS.signIn;

const emailField = (page: Page) => page.getByLabel(T.emailLabel);
const codeField = (page: Page) => page.getByLabel(T.codeLabel);

/** An account made by hand, as Stephan's in the dashboard ("Add user"); not signed in. */
async function addUser(page: Page): Promise<string> {
  const email = newAddress();
  const response = await page.request.post(`${FAKE_SERVER}/test/user`, { data: { email } });
  expect(response.ok()).toBe(true);
  return email;
}

/** The code the fake server "mailed" to the address; `undefined` if no mail went out. */
async function mailedCode(page: Page, email: string): Promise<string | undefined> {
  const response = await page.request.get(`${FAKE_SERVER}/test/code`, { params: { email } });
  return response.ok() ? ((await response.json()) as { code: string }).code : undefined;
}

async function requestCode(page: Page, email: string) {
  await emailField(page).fill(email);
  await page.getByRole("button", { name: T.sendCode }).click();
  await expect(page.getByRole("heading", { level: 2, name: T.codeTitle })).toBeVisible();
}

async function enterCode(page: Page, code: string) {
  await codeField(page).fill(code);
  await page.getByRole("button", { name: T.verify, exact: true }).click();
}

async function expectFieldError(page: Page, field: ReturnType<Page["getByLabel"]>, text: string) {
  await expect(page.getByRole("alert")).toHaveText(text);
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveAccessibleDescription(text);
  await expect(field).toBeFocused();
}

/** Signs in on the page with a code from the "mail". */
async function signIn(page: Page, email: string) {
  await requestCode(page, email);
  await enterCode(page, (await mailedCode(page, email)) ?? "");
  await expect(heading(page)).toHaveText(TEXTS.greeting);
}

for (const [size, viewport] of [
  ["Handy", PHONE],
  ["PC", PC],
] as const) {
  test.describe(size, () => {
    test.use({ viewport });

    test(`P4b ${size}: Anmelden mit Code aus der Mail führt zur Vitrine; beide Schritte ohne axe-Verstöße`, async ({
      page,
    }) => {
      const email = await addUser(page);
      await page.goto("");

      await expect(heading(page)).toHaveText("Stud Stephan");
      await expect(page).toHaveTitle("Anmelden – Stud Stephan");
      await expect(page.getByRole("heading", { level: 2, name: T.title })).toBeVisible();
      await expect(page.getByText(T.intro)).toBeVisible();
      await expect(page.getByRole("navigation")).toHaveCount(0);
      await expectNoAccessibilityViolations(page);

      await requestCode(page, email);
      await expect(page.getByText(T.codeSent(email))).toBeVisible();
      await expect(codeField(page)).toBeFocused();
      await expectNoAccessibilityViolations(page);

      await enterCode(page, (await mailedCode(page, email)) ?? "");

      await expect(heading(page)).toHaveText(TEXTS.greeting);
      await expect(heading(page)).toBeFocused();
      await expect(page).toHaveURL(/#\/vitrine$/);
      await expect(page).toHaveTitle("Vitrine – Stud Stephan");
    });

    test(`P4b ${size}: Einstellungen zeigen das Konto mit Abmelden, ohne axe-Verstöße`, async ({
      page,
    }) => {
      const email = await signInDirectly(page);
      await page.goto("#/einstellungen");

      const account = page.getByRole("region", { name: TEXTS.account.label });
      await expect(account.getByText(TEXTS.account.name, { exact: true })).toBeVisible();
      await expect(account.getByText(email)).toBeVisible();
      await expect(account.getByRole("button", { name: TEXTS.account.signOut })).toBeVisible();
      await expectNoAccessibilityViolations(page);
    });
  });
}

test("P4b Neu laden: Man bleibt auf dem Gerät angemeldet", async ({ page }) => {
  const email = await addUser(page);
  await page.goto("");
  await signIn(page, email);

  await page.reload();

  await expect(heading(page)).toHaveText(TEXTS.greeting);
  await expect(page.getByRole("button", { name: T.sendCode })).toHaveCount(0);
});

test("P4b Ein Link auf eine Seite führt nach der Anmeldung genau dorthin", async ({ page }) => {
  const email = await addUser(page);
  await page.goto("#/dioramen");
  await requestCode(page, email);

  await enterCode(page, (await mailedCode(page, email)) ?? "");

  await expect(heading(page)).toHaveText("Dioramen");
  await expect(heading(page)).toBeFocused();
});

test("P4b Abmelden in den Einstellungen: Anmeldeseite, auch nach dem Neuladen; danach wieder anmelden", async ({
  page,
}) => {
  const email = await signInDirectly(page);
  await page.goto("#/einstellungen");

  await page.getByRole("button", { name: TEXTS.account.signOut }).click();

  await expect(heading(page)).toHaveText("Stud Stephan");
  await expect(heading(page)).toBeFocused();
  await page.reload();
  await expect(page.getByRole("heading", { level: 2, name: T.title })).toBeVisible();
  await signIn(page, email);
  await expect(page).toHaveURL(/#\/vitrine$/);
});

test("P4b Falscher Code: Meldung am Feld, Fokus im Feld; der richtige Code geht danach", async ({
  page,
}) => {
  const email = await addUser(page);
  await page.goto("");
  await requestCode(page, email);
  const code = (await mailedCode(page, email)) ?? "";

  await enterCode(page, code === "000000" ? "111111" : "000000");

  await expectFieldError(page, codeField(page), T.failures.wrongCode);
  await enterCode(page, code);
  await expect(heading(page)).toHaveText(TEXTS.greeting);
});

test("P4b Abgelaufener Code: eigene Meldung am Feld", async ({ page }) => {
  const email = await addUser(page);
  await page.goto("");
  await requestCode(page, email);
  // Zehn Minuten Warten spielt der Fake-Server nach (die Regel selbst prüft der Vertragstest).
  await page.route(`${FAKE_SERVER}/auth/verify`, (route) =>
    route.fulfill({ status: 400, json: { failure: "expiredCode" } }),
  );

  await enterCode(page, (await mailedCode(page, email)) ?? "");

  await expectFieldError(page, codeField(page), T.failures.expiredCode);
});

test("P4b Unbekannte Adresse: keine Mail, dieselbe neutrale Meldung wie für Stephans Adresse", async ({
  page,
}) => {
  const stranger = newAddress();
  await page.goto("");

  await requestCode(page, stranger);

  await expect(page.getByText(T.codeSent(stranger))).toBeVisible();
  expect(await mailedCode(page, stranger)).toBeUndefined();
  await enterCode(page, "123456");
  await expectFieldError(page, codeField(page), T.failures.wrongCode);
});

test("P4b Zu viele Versuche: zu früh einen neuen Code anfordern meldet es am Feld", async ({
  page,
}) => {
  const email = await addUser(page);
  await page.goto("");
  await requestCode(page, email);
  await expect(page.getByText(T.resendWait)).toBeVisible();
  await expect(page.getByRole("button", { name: T.resend })).toHaveCount(0);

  await page.getByRole("button", { name: T.otherEmail }).click();
  await expect(emailField(page)).toBeFocused();
  await expect(emailField(page)).toHaveValue(email);
  await page.getByRole("button", { name: T.sendCode }).click();

  await expectFieldError(page, emailField(page), T.failures.tooManyTries);
});

test("P4b Ohne Netz: eigene Meldung beim Anfordern und beim Prüfen", async ({ page, context }) => {
  const email = await addUser(page);
  await page.goto("");
  await requestCode(page, email);
  await context.setOffline(true);

  await enterCode(page, "123456");
  await expectFieldError(page, codeField(page), T.failures.offline);

  await page.getByRole("button", { name: T.otherEmail }).click();
  await page.getByRole("button", { name: T.sendCode }).click();
  await expectFieldError(page, emailField(page), T.failures.offline);
});

test("P4b Ungültige Adresse und Code mit falscher Länge: Meldung am Feld, ohne Anfrage", async ({
  page,
}) => {
  const email = await addUser(page);
  await page.goto("");

  await emailField(page).fill("stephan@beispiel");
  await page.getByRole("button", { name: T.sendCode }).click();
  await expectFieldError(page, emailField(page), T.failures.invalidEmail);

  await requestCode(page, email);
  await enterCode(page, "12 34");
  await expectFieldError(page, codeField(page), T.codeFormat);
});

test("P4b Nach dem Neuladen (Wechsel in die Mail-App) geht es mit der Code-Eingabe weiter", async ({
  page,
}) => {
  const email = await addUser(page);
  await page.goto("");
  await requestCode(page, email);

  await page.reload();

  await expect(page.getByText(T.codeSent(email))).toBeVisible();
  await enterCode(page, ` ${(await mailedCode(page, email)) ?? ""} `);
  await expect(heading(page)).toHaveText(TEXTS.greeting);
});

test("P4b Nach einer Minute lässt sich ein neuer Code anfordern", async ({ page }) => {
  await page.clock.install();
  const email = await addUser(page);
  await page.goto("");
  await requestCode(page, email);
  // Nur die Uhr der App läuft vor; den neuen Code beantwortet der Fake-Server hier nachgestellt.
  await page.route(`${FAKE_SERVER}/auth/code`, (route) => route.fulfill({ status: 200, json: {} }));

  await page.clock.fastForward(61_000);
  await page.getByRole("button", { name: T.resend }).click();

  await expect(page.getByRole("status")).toHaveText(T.resent);
  await expect(codeField(page)).toBeFocused();
});
