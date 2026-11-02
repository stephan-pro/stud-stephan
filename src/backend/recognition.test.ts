import { describe, expect, it } from "vitest";
import { DEMO_RECOGNITION, DEMO_SUGGESTIONS } from "../demo/recognition";
import { FakeRecognizer } from "./fakeRecognizer";
import { type Suggestion, SupabaseRecognizer } from "./recognition";

// The real function is tested in `supabase/functions/_shared/`; here how the app calls it and
// reads its answers, and the example recognition of the demo.

interface Call {
  name: string;
  body: unknown;
  headers: unknown;
}

function recognizerWith(
  answer: { data: unknown; error: unknown },
  calls: Call[] = [],
): SupabaseRecognizer {
  return new SupabaseRecognizer({
    functions: {
      invoke: async (name: string, options: { body: unknown; headers: unknown }) => {
        calls.push({ name, body: options.body, headers: options.headers });
        return answer;
      },
    },
  } as never);
}

const PHOTO = new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" });
const HUGO: Suggestion = { number: "coltlbm28", name: "Hugo Strange, Series 1", score: 0.78 };

describe("P8 F1 Die Erkennung der App ruft die Funktion recognize", () => {
  it("P8 F1 Das Foto geht als Körper mit seinem Bildtyp, die Vorschläge kommen zurück", async () => {
    const calls: Call[] = [];
    const recognizer = recognizerWith({ data: { suggestions: [HUGO] }, error: null }, calls);
    expect(await recognizer.recognize(PHOTO, "minifig")).toEqual([HUGO]);
    expect(calls).toEqual([
      {
        name: "recognize",
        body: PHOTO,
        headers: { "Content-Type": "image/webp", "x-recognize-kind": "minifig" },
      },
    ]);
  });

  it("F1 Die Art des Fotos (Figur, Set, Sonderteil) geht im Kopf x-recognize-kind mit", async () => {
    const calls: Call[] = [];
    const recognizer = recognizerWith({ data: { suggestions: [] }, error: null }, calls);
    await recognizer.recognize(PHOTO, "legoSet");
    await recognizer.recognize(PHOTO, "specialPart");
    expect(
      calls.map((call) => (call.headers as Record<string, string>)["x-recognize-kind"]),
    ).toEqual(["legoSet", "specialPart"]);
  });

  it("P8 F1 Keine Vorschläge sind eine leere Liste", async () => {
    const recognizer = recognizerWith({ data: { suggestions: [] }, error: null });
    expect(await recognizer.recognize(PHOTO, "minifig")).toEqual([]);
  });

  it("P8 F1 Die Antwort der Funktion mit einem Grund wird zum Grund des Fehlers", async () => {
    for (const failure of ["limit_reached", "unavailable", "not_signed_in", "bad_request"]) {
      const recognizer = recognizerWith({
        data: null,
        error: { context: Response.json({ failure }, { status: 500 }) },
      });
      await expect(recognizer.recognize(PHOTO, "minifig")).rejects.toMatchObject({ failure });
    }
  });

  it("P8 F1 Ein Netzfehler ist 'offline', eine unlesbare Antwort 'nicht verfügbar'", async () => {
    const offline = recognizerWith({ data: null, error: new TypeError("Failed to fetch") });
    await expect(offline.recognize(PHOTO, "minifig")).rejects.toMatchObject({ failure: "offline" });
    for (const data of [null, {}, { suggestions: "x" }]) {
      await expect(
        recognizerWith({ data, error: null }).recognize(PHOTO, "minifig"),
      ).rejects.toMatchObject({
        failure: "unavailable",
      });
    }
  });
});

describe("P8 Die Beispiel-Erkennung für Demo und E2E-Tests", () => {
  it("liefert die drei Vorschläge des Klick-Dummys, den besten zuerst", async () => {
    const fake = new FakeRecognizer(DEMO_SUGGESTIONS);
    const found = await fake.recognize(PHOTO, "minifig");
    expect(found.map((suggestion) => suggestion.number)).toEqual(["sw0194", "sw0631", "sw0634"]);
    expect(found.map((suggestion) => suggestion.score)).toEqual([0.92, 0.61, 0.44]);
    expect(fake.calls).toEqual(["image/webp 3"]);
    // A plain list is the answer for figures only.
    expect(await fake.recognize(PHOTO, "legoSet")).toEqual([]);
  });

  it("F1 antwortet je Art: Sets, Sonderteile, und eine Big Fig, wenn der Dienst nur das Teil kennt", async () => {
    let mode: "bigFig" | undefined;
    const fake = new FakeRecognizer(DEMO_RECOGNITION, () => mode);
    expect((await fake.recognize(PHOTO, "legoSet")).map((entry) => entry.number)).toEqual([
      "75005-1",
      "75372-1",
    ]);
    expect((await fake.recognize(PHOTO, "specialPart"))[0]).toMatchObject({ ref: "GEAR:5010325" });
    expect((await fake.recognize(PHOTO, "minifig")).map((entry) => entry.number)).toEqual([
      "sw0194",
      "sw0631",
      "sw0634",
    ]);
    mode = "bigFig";
    expect(await fake.recognize(PHOTO, "minifig")).toEqual([
      expect.objectContaining({ ref: "PART:11323pb01c01", bricklinkType: "PART" }),
    ]);
    expect((await fake.recognize(PHOTO, "legoSet"))[0]?.number).toBe("75005-1");
    expect(fake.kinds).toEqual(["legoSet", "specialPart", "minifig", "minifig", "legoSet"]);
  });

  it("kann nur einen Vorschlag liefern (wie Brickognize in P2), keinen, oder scheitern", async () => {
    let mode: "one" | "none" | "offline" | "unavailable" | "limit_reached" | undefined = "one";
    const fake = new FakeRecognizer(DEMO_SUGGESTIONS, () => mode);
    expect(await fake.recognize(PHOTO, "minifig")).toHaveLength(1);
    mode = "none";
    expect(await fake.recognize(PHOTO, "minifig")).toEqual([]);
    for (const failing of ["offline", "unavailable", "limit_reached"] as const) {
      mode = failing;
      await expect(fake.recognize(PHOTO, "minifig")).rejects.toMatchObject({ failure: failing });
    }
    mode = undefined;
    fake.online = false;
    await expect(fake.recognize(PHOTO, "minifig")).rejects.toMatchObject({ failure: "offline" });
  });
});
