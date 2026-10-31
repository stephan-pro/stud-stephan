import { describe, expect, it } from "vitest";
import { isTemporary, storageError, storageReason } from "./supabaseRemote";

// The calls themselves run against the real database in `npm run check:db`
// (`supabase/tests/contract.test.ts`); here only how answers are read.

describe("SupabaseRemote", () => {
  it("Eine fehlende Datenbankfunktion (App neuer als Server) ist vorübergehend", () => {
    expect(isTemporary(404, "PGRST202")).toBe(true);
    expect(isTemporary(400, "22023")).toBe(false);
    expect(isTemporary(0, undefined)).toBe(true);
  });

  it("Meldungen des Dateispeichers werden zu Gründen", () => {
    expect(storageReason("The object exceeded the maximum allowed size")).toBe("file_too_large");
    expect(storageReason("mime type image/gif is not supported")).toBe("file_type");
    expect(storageReason("Object not found")).toBe("not_found");
    expect(storageReason("new row violates row-level security policy")).toBe("invalid_path");
    expect(storageReason("Internal Server Error")).toBeUndefined();
  });

  it("Ein Serverfehler des Dateispeichers ist vorübergehend, eine Ablehnung nicht", () => {
    expect(storageError("laden", { message: "Internal Server Error", status: 500 })).toMatchObject({
      permanent: false,
    });
    expect(storageError("laden", { message: "Object not found", statusCode: "404" })).toMatchObject(
      { permanent: true, reason: "not_found" },
    );
  });
});
