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

describe("P10 F3 Das Bild einer Seite über die Funktion", () => {
  const PICTURE = "https://www.merlinssteine.de/media/sets/bluebrixx-110374.jpg";
  const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 250, 251, 252, 253]);
  const base64 = btoa(String.fromCharCode(...bytes));

  it("F3 Die Bild-Adresse geht als {image} an die Funktion, das Bild kommt byte-gleich als Datei zurück", async () => {
    const calls: Call[] = [];
    const previewer = previewerWith(
      { data: { kind: "image", contentType: "image/jpeg", data: base64 }, error: null },
      calls,
    );
    const file = await previewer.image(PICTURE);
    expect(calls).toEqual([{ name: "link-preview", body: { image: PICTURE } }]);
    expect(file.type).toBe("image/jpeg");
    expect(file.name).toBe("bild.jpg");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);
  });

  it("F3 PNG und WebP bekommen ihre Endung", async () => {
    for (const [contentType, name] of [
      ["image/png", "bild.png"],
      ["image/webp", "bild.webp"],
    ] as const) {
      const previewer = previewerWith({
        data: { kind: "image", contentType, data: base64 },
        error: null,
      });
      expect((await previewer.image(PICTURE)).name).toBe(name);
    }
  });

  it("F3 Der Grund einer abgelehnten Antwort wird zum Grund des Fehlers", async () => {
    for (const failure of ["blocked", "unreachable", "not_signed_in", "unavailable"]) {
      const previewer = previewerWith({
        data: null,
        error: { context: Response.json({ failure }, { status: 502 }) },
      });
      expect(await reasonOf(previewer.image(PICTURE))).toBe(failure);
    }
    const offline = previewerWith({ data: null, error: new TypeError("Failed to fetch") });
    expect(await reasonOf(offline.image(PICTURE))).toBe("offline");
  });

  it("F3 Eine unlesbare Antwort ist 'unavailable'", async () => {
    for (const data of [
      null,
      {},
      { kind: "page" },
      { kind: "image", contentType: "image/gif", data: base64 },
      { kind: "image", contentType: "image/png" },
      { kind: "image", contentType: "image/png", data: "%%% kein base64 %%%" },
    ]) {
      const previewer = previewerWith({ data, error: null });
      expect(await reasonOf(previewer.image(PICTURE))).toBe("unavailable");
    }
  });

  it("F3 Die Beispiel-Vorschau holt die Bilder ihrer Beispielseiten, andere nicht", async () => {
    const previewer = new FakeLinkPreviewer(DEMO_LINK_PAGES);
    const file = await previewer.image(PICTURE);
    expect(file.type).toBe("image/png");
    expect(file.size).toBeGreaterThan(0);
    expect(await reasonOf(previewer.image("https://unbekannt.example.com/bild.jpg"))).toBe(
      "unreachable",
    );
    expect(await reasonOf(previewer.image("http://127.0.0.1/bild.jpg"))).toBe("blocked");
    expect(previewer.imageCalls).toEqual([
      PICTURE,
      "https://unbekannt.example.com/bild.jpg",
      "http://127.0.0.1/bild.jpg",
    ]);
  });

  it("F3 Die Beispiel-Vorschau lässt Bilder gezielt scheitern, ohne die Seiten zu stören", async () => {
    const fake = (control: "offline" | "unavailable" | "unreachable" | "imageUnreachable") =>
      new FakeLinkPreviewer(DEMO_LINK_PAGES, () => control);
    expect(await reasonOf(fake("imageUnreachable").image(PICTURE))).toBe("unreachable");
    expect(await fake("imageUnreachable").preview(MERLIN_LINK)).toMatchObject({ source: "merlin" });
    expect(await reasonOf(fake("offline").image(PICTURE))).toBe("offline");
    expect(await reasonOf(fake("unavailable").image(PICTURE))).toBe("unavailable");
    expect(await reasonOf(fake("unreachable").image(PICTURE))).toBe("unreachable");
    const offline = new FakeLinkPreviewer(DEMO_LINK_PAGES);
    offline.online = false;
    expect(await reasonOf(offline.image(PICTURE))).toBe("offline");
  });
});
