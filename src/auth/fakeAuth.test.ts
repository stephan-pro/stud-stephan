import { describe, expect, it } from "vitest";
import { AuthError, codeDigits, emailAddress, isAuthFailure } from "./auth";
import { FakeAuth } from "./fakeAuth";

// The rules both services share are in the contract (`auth.contract.ts`, run in
// `fakeHttpAuth.test.ts`); here only what is the fake's own and the small helpers of `auth.ts`.

describe("Anmeldedienst des Fake-Servers", () => {
  it("Dieselbe Adresse hat immer dieselbe Benutzerkennung; der Standardcode hat sechs Ziffern", () => {
    let now = 0;
    const ids = ["user-1", "user-2"];
    const auth = new FakeAuth({ now: () => now, newUserId: () => ids.shift() ?? "?" });
    auth.addUser("a@b.de");
    auth.addUser("c@d.de");

    const signIn = (email: string) => {
      auth.requestCode(email);
      const code = auth.lastCode(email) ?? "";
      expect(code).toMatch(/^\d{6}$/);
      return auth.verifyCode(email, code).session.userId;
    };
    const first = signIn("a@b.de");
    now += 60_000;
    const second = signIn("A@B.de");

    expect([first, second, signIn("c@d.de"), auth.addUser("A@b.de")]).toEqual([
      "user-1",
      "user-1",
      "user-2",
      "user-1",
    ]);
    expect(auth.signInDirectly("c@d.de").session.userId).toBe("user-2");
  });

  it("P4b Eine unbekannte Adresse bekommt keine Mail und kein Konto, aber dieselben Regeln", () => {
    const auth = new FakeAuth({ now: () => 0 });

    auth.requestCode("fremd@b.de");

    expect([auth.mailCount("fremd@b.de"), auth.lastCode("fremd@b.de")]).toEqual([0, undefined]);
    expect(() => auth.requestCode("fremd@b.de")).toThrow(AuthError);
    expect(() => auth.verifyCode("fremd@b.de", "000000")).toThrow("wrongCode");
  });

  it("Ein Geheimnis gilt bis zum Abmelden; „überall abmelden“ beendet alle Sitzungen der Adresse", () => {
    const auth = new FakeAuth();
    const phone = auth.signInDirectly("a@b.de").token;
    const laptop = auth.signInDirectly("a@b.de").token;
    const other = auth.signInDirectly("c@d.de").token;

    auth.signOut(phone);
    auth.signOut(undefined);
    expect(auth.sessionFor(phone)).toBeUndefined();
    expect(auth.sessionFor(laptop)?.email).toBe("a@b.de");

    auth.signOutEverywhere("A@b.de");
    expect(auth.sessionFor(laptop)).toBeUndefined();
    expect(auth.sessionFor(other)?.email).toBe("c@d.de");
    expect(auth.sessionFor(undefined)).toBeUndefined();
  });

  it("Adresse und Code werden vor dem Senden bereinigt", () => {
    expect(emailAddress("  Stephan@Beispiel.DE ")).toBe("stephan@beispiel.de");
    expect(() => emailAddress("stephan@beispiel")).toThrow(AuthError);
    expect(codeDigits(" 123 456 ")).toBe("123456");
    expect([isAuthFailure("wrongCode"), isAuthFailure("notAllowed"), isAuthFailure(1)]).toEqual([
      true,
      false,
      false,
    ]);
  });
});
