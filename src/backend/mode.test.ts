import { describe, expect, it } from "vitest";
import { backendMode, checkSupabaseSettings } from "./mode";

describe("Server je Build-Modus", () => {
  it("P4b Online-Version und Entwicklung mit Supabase, E2E mit dem Fake-Server, Demo ohne Anmeldung", () => {
    expect(["production", "development", "e2e", "demo"].map(backendMode)).toEqual([
      "supabase",
      "supabase",
      "fake",
      "demo",
    ]);
  });

  it("P4b Ohne Adresse oder öffentlichen Schlüssel bricht der Build ab; ein geheimer Schlüssel nie in die App", () => {
    const url = "https://ohuqwiypmoqyuxsgouxw.supabase.co";

    expect(() => checkSupabaseSettings(url, "sb_publishable_abc")).not.toThrow();
    expect(() => checkSupabaseSettings(undefined, "sb_publishable_abc")).toThrow(/URL/);
    expect(() => checkSupabaseSettings("http://x.supabase.co", "sb_publishable_abc")).toThrow(
      /URL/,
    );
    expect(() => checkSupabaseSettings(url, " ")).toThrow(/fehlt/);
    expect(() => checkSupabaseSettings(url, undefined)).toThrow(/fehlt/);
    expect(() => checkSupabaseSettings(url, "sb_secret_abc")).toThrow(/nie der Secret Key/);
  });
});
