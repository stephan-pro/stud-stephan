import { describe, expect, it } from "vitest";
import { DEMO_LINK_PAGES, MERLIN_LINK } from "../demo/links";
import { FakeLinkPreviewer } from "./fakeLinkPreviewer";
import { type LinkAnswer, LinkCallError, SupabaseLinkPreviewer } from "./linkPreview";

// The real function is tested in `supabase/functions/_shared/link.test.ts`; here how the app calls
// it and reads its answers, and the example link reading of the demo.

interface Call {
  name: string;
  body: unknown;
}

function previewerWith(
  answer: { data: unknown; error: unknown },
  calls: Call[] = [],
): SupabaseLinkPreviewer {
  return new SupabaseLinkPreviewer({
    functions: {
      invoke: async (name: string, options: { body: unknown }) => {
        calls.push({ name, body: options.body });
        return answer;
      },
    },
  } as never);
}

const PAGE: LinkAnswer = { kind: "page", source: "page", fields: { name: "Burg" } };

async function reasonOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof LinkCallError) return error.failure;
    throw error;
  }
  return "no failure";
}

describe("P9 F3 Die App ruft die Funktion link-preview", () => {
  it("F3 Die Adresse geht als {url} an die Funktion, die Antwort kommt zurück", async () => {
    const calls: Call[] = [];
    const previewer = previewerWith({ data: PAGE, error: null }, calls);
    expect(await previewer.preview("https://shop.example.com/burg")).toEqual(PAGE);
    expect(calls).toEqual([
      { name: "link-preview", body: { url: "https://shop.example.com/burg" } },
    ]);
  });

  it("F3 Der Grund einer abgelehnten Antwort wird zum Grund des Fehlers", async () => {
    for (const failure of [
      "blocked",
      "unreachable",
      "not_signed_in",
      "bad_request",
      "unavailable",
    ]) {
      const previewer = previewerWith({
        data: null,
        error: { context: Response.json({ failure }, { status: 422 }) },
      });
      expect(await reasonOf(previewer.preview("https://a.example.com/"))).toBe(failure);
    }
  });

  it("F3 Eine Antwort ohne bekannten Grund ist 'unavailable', keine Antwort ist 'offline'", async () => {
    const odd = previewerWith({
      data: null,
      error: { context: new Response("oops", { status: 500 }) },
    });
    expect(await reasonOf(odd.preview("https://a.example.com/"))).toBe("unavailable");
    const offline = previewerWith({ data: null, error: new TypeError("Failed to fetch") });
    expect(await reasonOf(offline.preview("https://a.example.com/"))).toBe("offline");
  });

  it("F3 Eine unlesbare Antwort ist 'unavailable'", async () => {
    for (const data of [null, {}, { kind: "etwas" }, "text"]) {
      const previewer = previewerWith({ data, error: null });
      expect(await reasonOf(previewer.preview("https://a.example.com/"))).toBe("unavailable");
    }
  });
});

describe("P9 F3 Die Beispiel-Links der Vorschau", () => {
  const fake = (control?: () => "offline" | "unavailable" | "unreachable" | undefined) =>
    new FakeLinkPreviewer(DEMO_LINK_PAGES, control);

  it("F3 Rebrickable- und BrickLink-Adressen ergeben die Nummer für den Katalog, ohne Abruf", async () => {
    expect(await fake().preview("https://rebrickable.com/sets/75372-1/battle-pack/")).toEqual({
      kind: "catalog",
      source: "rebrickable",
      catalogKind: "legoSet",
      ref: "75372-1",
    });
    expect(
      await fake().preview("https://www.bricklink.com/v2/catalog/catalogitem.page?M=sw0194"),
    ).toMatchObject({ source: "bricklink", catalogKind: "minifig", ref: "sw0194" });
  });

  it("F3 Bekannte Seiten geben ihre Felder, unbekannte antworten nicht", async () => {
    expect(await fake().preview(MERLIN_LINK)).toMatchObject({ source: "merlin" });
    expect(await reasonOf(fake().preview("https://unbekannt.example.com/x"))).toBe("unreachable");
  });

  it("F3 Nicht erlaubte Adressen sind 'blocked', wie in der echten Funktion", async () => {
    for (const address of [
      "http://localhost/x",
      "http://192.168.1.1/",
      "ftp://a.example.com/",
      "x",
    ]) {
      expect(await reasonOf(fake().preview(address))).toBe("blocked");
    }
  });

  it("F3 Die Vorschau lässt sich offline schalten oder stören", async () => {
    const previewer = fake();
    previewer.online = false;
    expect(await reasonOf(previewer.preview(MERLIN_LINK))).toBe("offline");
    expect(await reasonOf(fake(() => "offline").preview(MERLIN_LINK))).toBe("offline");
    expect(await reasonOf(fake(() => "unavailable").preview(MERLIN_LINK))).toBe("unavailable");
    expect(await reasonOf(fake(() => "unreachable").preview(MERLIN_LINK))).toBe("unreachable");
    expect(previewer.calls).toEqual([MERLIN_LINK]);
  });
});
