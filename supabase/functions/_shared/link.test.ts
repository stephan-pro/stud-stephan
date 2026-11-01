// P9 (F3): the function `link-preview` — what a pasted address gives, and the protection that
// belongs to a function which fetches addresses of other people (decision in docs/UMSETZUNG.md,
// section 7). The Merlins Steine page is the stored sample next to this file.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fakeFetch, ok, type Route } from "./catalog.fixtures.ts";
import { linkHandlerDeps } from "./environment.ts";
import { handleLinkPreview } from "./handler.ts";
import type { Fetch } from "./json.ts";
import { catalogLink, fetchLinkImage, previewLink } from "./linkService.ts";
import { LinkError } from "./linkTypes.ts";
import { extractPreview } from "./pageParser.ts";
import {
  checkAddress,
  fetchImage,
  fetchPage,
  isPrivateAddress,
  PAGE_LIMITS,
  type PageDeps,
} from "./safeFetch.ts";

const ENV: Record<string, string> = { SUPABASE_URL: "https://projekt.supabase.co" };
const AUTH: Route = ["/auth/v1/user", ok({ id: "u" })];
const SAMPLE = readFileSync(new URL("./samples/merlinssteine-set.html", import.meta.url), "utf8");

const PUBLIC = async () => ["93.184.216.34"];

interface Sent {
  url: string;
  headers: Record<string, string>;
  init: RequestInit | undefined;
}

/** A fake internet for pages: answers by address, remembers what was sent. */
function pages(answers: Record<string, () => Response>, sent: Sent[] = []): Fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    sent.push({ url, headers: { ...(init?.headers as Record<string, string>) }, init });
    const answer = answers[url];
    return answer ? answer() : new Response("nicht da", { status: 404 });
  }) as Fetch;
}

const html =
  (body: string, headers: Record<string, string> = {}) =>
  () =>
    new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8", ...headers } });

const redirect =
  (to: string, status = 302) =>
  () =>
    new Response(null, { status, headers: { Location: to } });

function deps(answers: Record<string, () => Response>, extra: Partial<PageDeps> = {}): PageDeps {
  return { fetch: pages(answers), resolve: PUBLIC, ...extra };
}

async function failure(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof LinkError) return error.failure;
    throw error;
  }
  return "no failure";
}

describe("Adresse prüfen: nur öffentliche Webseiten", () => {
  it("F3 nimmt https und http auf den Standard-Ports an", () => {
    expect(checkAddress("https://www.merlinssteine.de/sets/bluebrixx-110374/").hostname).toBe(
      "www.merlinssteine.de",
    );
    expect(checkAddress("http://shop.example.com/x").protocol).toBe("http:");
    expect(checkAddress("https://shop.example.com:443/x").port).toBe("");
    expect(checkAddress("http://shop.example.com:80/x").port).toBe("");
    expect(checkAddress("https://shop.example.com:80/x").port).toBe("80");
  });

  it.each([
    ["ftp://shop.example.com/x", "anderes Protokoll"],
    ["file:///etc/passwd", "Datei"],
    ["javascript:alert(1)", "Skript"],
    ["data:text/html,<b>x</b>", "Daten"],
    ["https://shop.example.com:8443/x", "anderer Port"],
    ["http://shop.example.com:8080/x", "anderer Port"],
    ["https://user:pass@shop.example.com/x", "Anmeldung in der Adresse"],
    ["https://127.0.0.1/x", "IPv4"],
    ["http://10.0.0.5/x", "IPv4 privat"],
    ["http://169.254.169.254/latest/meta-data/", "Metadaten-Adresse"],
    ["http://2130706433/", "IPv4 als Zahl"],
    ["http://0x7f.0.0.1/", "IPv4 hexadezimal"],
    ["http://017700000001/", "IPv4 oktal"],
    ["http://127.1/", "IPv4 verkürzt"],
    ["http://[::1]/", "IPv6"],
    ["http://[::ffff:127.0.0.1]/", "IPv6 mit IPv4"],
    ["https://93.184.216.34/x", "öffentliche IP ist trotzdem keine erlaubte"],
    ["http://localhost/x", "localhost"],
    ["http://localhost:80/x", "localhost mit Port"],
    ["http://app.localhost/x", "Unterdomäne von localhost"],
    ["http://LOCALHOST./x", "localhost mit Punkt"],
    ["http://drucker/x", "ein Name ohne Punkt"],
    ["http://nas.local/x", "mDNS"],
    ["http://db.internal/x", "interner Name"],
    ["http://router.lan/x", "lan"],
    ["http://fritz.box.home.arpa/x", "home.arpa"],
    ["http://example.123/x", "Endung nur aus Ziffern"],
    ["", "leer"],
    ["kein link", "kein Link"],
  ])("F3 lehnt ab: %s (%s)", (address) => {
    expect(() => checkAddress(address)).toThrow(LinkError);
    try {
      checkAddress(address);
    } catch (error) {
      expect((error as LinkError).failure).toBe("blocked");
    }
  });

  it("F3 lehnt eine zu lange Adresse ab", () => {
    expect(() => checkAddress(`https://shop.example.com/${"a".repeat(2000)}`)).toThrow(LinkError);
  });
});

describe("IP-Adressen: privat und intern erkennen", () => {
  it.each([
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.0.0.1",
    "192.168.1.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:10.0.0.1",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "fe80::1%eth0",
    "ff02::1",
    "2001:db8::1",
    "64:ff9b::7f00:1",
    "2002:7f00:1::1",
    "unsinn",
    "1.2.3",
    "999.1.1.1",
  ])("%s ist nicht öffentlich", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each([
    "93.184.216.34",
    "8.8.8.8",
    "172.15.0.1",
    "172.32.0.1",
    "100.63.0.1",
    "198.20.0.1",
    "2606:2800:220:1:248:1893:25c8:1946",
    "2a00:1450:4001:81b::200e",
    "::ffff:8.8.8.8",
  ])("%s ist öffentlich", (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });
});

describe("Seite abrufen: Weiterleitungen, Namen, Grenzen", () => {
  const PAGE = "https://shop.example.com/burg";

  it("F3 liest eine HTML-Seite", async () => {
    const page = await fetchPage(deps({ [PAGE]: html("<title>Burg</title>") }), new URL(PAGE));
    expect(page.html).toBe("<title>Burg</title>");
    expect(page.url.href).toBe(PAGE);
  });

  it("folgt bis zu 3 Weiterleitungen und liefert die Adresse am Ende", async () => {
    const answers = {
      "https://a.example.com/": redirect("https://b.example.com/"),
      "https://b.example.com/": redirect("/c"),
      "https://b.example.com/c": redirect("https://d.example.com/ziel"),
      "https://d.example.com/ziel": html("<title>Ziel</title>"),
    };
    const page = await fetchPage(deps(answers), new URL("https://a.example.com/"));
    expect(page.url.href).toBe("https://d.example.com/ziel");
  });

  it("bricht bei der 4. Weiterleitung ab", async () => {
    const answers = {
      "https://a.example.com/": redirect("https://b.example.com/"),
      "https://b.example.com/": redirect("https://c.example.com/"),
      "https://c.example.com/": redirect("https://d.example.com/"),
      "https://d.example.com/": redirect("https://e.example.com/"),
      "https://e.example.com/": html("zu spät"),
    };
    expect(await failure(fetchPage(deps(answers), new URL("https://a.example.com/")))).toBe(
      "unreachable",
    );
  });

  it.each([
    ["https://127.0.0.1/geheim", "IP-Adresse"],
    ["http://localhost/admin", "localhost"],
    ["http://169.254.169.254/latest/meta-data/", "Metadaten"],
    ["http://intranet.corp/x", "interner Name"],
    ["https://shop.example.com:8443/x", "anderer Port"],
    ["ftp://shop.example.com/x", "anderes Protokoll"],
    ["file:///etc/passwd", "Datei"],
  ])("prüft auch das Ziel einer Weiterleitung: %s (%s) wird nie abgerufen", async (target) => {
    const sent: Sent[] = [];
    const send = pages({ [PAGE]: redirect(target), [target]: html("geheim") }, sent);
    expect(await failure(fetchPage({ fetch: send, resolve: PUBLIC }, new URL(PAGE)))).toBe(
      "blocked",
    );
    expect(sent.map((call) => call.url)).toEqual([PAGE]);
  });

  it("lehnt einen Namen ab, der in ein privates Netz führt (auch nach einer Weiterleitung)", async () => {
    const resolve = async (host: string) =>
      host === "intern.example.org" ? ["10.0.0.7"] : ["93.184.216.34"];
    const sent: Sent[] = [];
    const send = pages(
      { [PAGE]: redirect("https://intern.example.org/"), "https://intern.example.org/": html("x") },
      sent,
    );
    expect(await failure(fetchPage({ fetch: send, resolve }, new URL(PAGE)))).toBe("blocked");
    expect(sent.map((call) => call.url)).toEqual([PAGE]);
    // Direkt eingegeben genauso: es wird gar nicht erst gefragt.
    const direct: Sent[] = [];
    const none = await failure(
      fetchPage({ fetch: pages({}, direct), resolve }, new URL("https://intern.example.org/")),
    );
    expect(none).toBe("blocked");
    expect(direct).toEqual([]);
  });

  it("ein Name mit einer privaten und einer öffentlichen Antwort wird abgelehnt", async () => {
    const resolve = async () => ["93.184.216.34", "192.168.0.10"];
    expect(
      await failure(fetchPage({ fetch: pages({ [PAGE]: html("x") }), resolve }, new URL(PAGE))),
    ).toBe("blocked");
    const v6 = async () => ["93.184.216.34", "fd00::1"];
    expect(
      await failure(fetchPage({ fetch: pages({ [PAGE]: html("x") }), resolve: v6 }, new URL(PAGE))),
    ).toBe("blocked");
  });

  it("ein Name ohne Antwort oder mit Fehler der Abfrage ist nicht erreichbar", async () => {
    const none = async () => [];
    const broken = async () => {
      throw new Error("kein DNS");
    };
    for (const resolve of [none, broken]) {
      expect(
        await failure(fetchPage({ fetch: pages({ [PAGE]: html("x") }), resolve }, new URL(PAGE))),
      ).toBe("unreachable");
    }
  });

  it("gibt keine eigenen Header oder Cookies weiter: nur feste Kopfzeilen, ohne Anmeldedaten", async () => {
    const sent: Sent[] = [];
    await fetchPage(
      { fetch: pages({ [PAGE]: html("<title>x</title>") }, sent), resolve: PUBLIC },
      new URL(PAGE),
    );
    const call = sent[0] as Sent;
    expect(Object.keys(call.headers).sort()).toEqual(["Accept", "Accept-Language", "User-Agent"]);
    expect(call.init?.credentials).toBe("omit");
    expect(call.init?.redirect).toBe("manual");
    expect(call.init?.method).toBe("GET");
    expect(call.init?.body).toBeUndefined();
  });

  it("bricht nach der Zeitgrenze ab (hier 30 ms)", async () => {
    const slow = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () =>
          reject(new DOMException("abort", "TimeoutError")),
        );
      })) as unknown as Fetch;
    const started = Date.now();
    expect(
      await failure(
        fetchPage({ fetch: slow, resolve: PUBLIC, limits: { timeoutMs: 30 } }, new URL(PAGE)),
      ),
    ).toBe("unreachable");
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("die Zeitgrenze gilt auch für das Lesen des Inhalts, nicht nur für den Anfang", async () => {
    const stalled = (async (_url: string, init: RequestInit) => {
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("<title>an"));
          init.signal?.addEventListener("abort", () =>
            controller.error(new DOMException("abort", "TimeoutError")),
          );
        },
      });
      return new Response(body, { headers: { "Content-Type": "text/html" } });
    }) as unknown as Fetch;
    expect(
      await failure(
        fetchPage({ fetch: stalled, resolve: PUBLIC, limits: { timeoutMs: 30 } }, new URL(PAGE)),
      ),
    ).toBe("unreachable");
  });

  it("bricht ab, sobald 2 MB überschritten sind – auch ohne Längenangabe", async () => {
    const chunk = new Uint8Array(500_000).fill(97);
    let delivered = 0;
    const endless = (async () => {
      const body = new ReadableStream({
        pull(controller) {
          delivered += chunk.length;
          controller.enqueue(chunk);
        },
      });
      return new Response(body, { headers: { "Content-Type": "text/html" } });
    }) as unknown as Fetch;
    expect(await failure(fetchPage({ fetch: endless, resolve: PUBLIC }, new URL(PAGE)))).toBe(
      "unreachable",
    );
    // Es wurde nicht weitergelesen, bis nichts mehr kam.
    expect(delivered).toBeLessThanOrEqual(3_000_000);
  });

  it("lehnt eine angekündigte Größe über 2 MB sofort ab; genau 2 MB gehen durch", async () => {
    const big = html("x", { "Content-Length": "2000001" });
    expect(await failure(fetchPage(deps({ [PAGE]: big }), new URL(PAGE)))).toBe("unreachable");
    const exact = "a".repeat(2_000_000);
    expect((await fetchPage(deps({ [PAGE]: html(exact) }), new URL(PAGE))).html).toHaveLength(
      2_000_000,
    );
    expect(await failure(fetchPage(deps({ [PAGE]: html(`${exact}a`) }), new URL(PAGE)))).toBe(
      "unreachable",
    );
  });

  it.each([
    ["application/json", '{"a":1}'],
    ["application/pdf", "%PDF"],
    ["image/png", "PNG"],
    ["text/plain", "<title>x</title>"],
    ["application/xhtml+xml", "<title>x</title>"],
    ["", "<title>x</title>"],
  ])("wertet nur text/html aus: %s wird abgelehnt", async (type, body) => {
    const answer = () => new Response(body, { headers: type ? { "Content-Type": type } : {} });
    expect(await failure(fetchPage(deps({ [PAGE]: answer }), new URL(PAGE)))).toBe("unreachable");
  });

  it("Fehlerantworten und Verbindungsfehler sind 'nicht erreichbar'", async () => {
    const gone = () =>
      new Response("weg", { status: 404, headers: { "Content-Type": "text/html" } });
    expect(await failure(fetchPage(deps({ [PAGE]: gone }), new URL(PAGE)))).toBe("unreachable");
    const refused = (async () => {
      throw new TypeError("connection refused");
    }) as unknown as Fetch;
    expect(await failure(fetchPage({ fetch: refused, resolve: PUBLIC }, new URL(PAGE)))).toBe(
      "unreachable",
    );
    const noTarget = () => new Response(null, { status: 302 });
    expect(await failure(fetchPage(deps({ [PAGE]: noTarget }), new URL(PAGE)))).toBe("unreachable");
  });

  it("liest die Zeichen nach der Angabe der Seite (ISO-8859-1) und fällt sonst auf UTF-8 zurück", async () => {
    const latin = () =>
      new Response(new Uint8Array([0x3c, 0x62, 0x3e, 0xfc, 0x3c, 0x2f, 0x62, 0x3e]), {
        headers: { "Content-Type": "text/html; charset=ISO-8859-1" },
      });
    expect((await fetchPage(deps({ [PAGE]: latin }), new URL(PAGE))).html).toBe("<b>ü</b>");
    const unknown = html("<b>ü</b>", { "Content-Type": "text/html; charset=erfunden" });
    expect((await fetchPage(deps({ [PAGE]: unknown }), new URL(PAGE))).html).toBe("<b>ü</b>");
  });
});

describe("Was eine Adresse ergibt", () => {
  it("F3 Merlins Steine: die Beispielseite ergibt Name, Hersteller, Setnummer, Teilezahl und Bild", async () => {
    const address = "https://www.merlinssteine.de/sets/bluebrixx-110374/";
    const answer = await previewLink(deps({ [address]: html(SAMPLE) }), address);
    expect(answer).toEqual({
      kind: "page",
      source: "merlin",
      fields: {
        name: "BlueBrixx - Burgtor mit Zugbrücke",
        manufacturer: "BlueBrixx",
        setNumber: "110374",
        pieceCount: 929,
        imageUrl: "https://www.merlinssteine.de/media/sets/bluebrixx-110374.jpg?v=2",
      },
    });
  });

  it("F3 Merlins Steine: die Seite vom 01.11.2026 (ohne Produktdaten) ergibt alle fünf Felder", async () => {
    const address = "https://www.merlinssteine.de/sets/bb-109580/";
    const page = readFileSync(
      new URL("./samples/merlinssteine-set-2026-11.html", import.meta.url),
      "utf8",
    );
    expect(await previewLink(deps({ [address]: html(page) }), address)).toEqual({
      kind: "page",
      source: "merlin",
      fields: {
        name: "BlueBrixx The Grinch Max",
        manufacturer: "BlueBrixx",
        setNumber: "109580",
        pieceCount: 195,
        imageUrl: "https://cdn.merlinssteine.de/images/BB-109580/main/BB-109580.jpeg?v=1",
      },
    });
  });

  it("F3 Merlins Steine: ohne die Produktdaten geben Titel, Texte und Meta-Angaben, was sie hergeben", async () => {
    const address = "https://www.merlinssteine.de/sets/x-1/";
    const thin = `<title>Burg &bull; Set 1</title><meta property="og:image" content="/b.jpg">
      <ul><li>Von: <a>Cobi</a></li></ul>`;
    const answer = await previewLink(deps({ [address]: html(thin) }), address);
    expect(answer).toEqual({
      kind: "page",
      source: "merlin",
      fields: {
        name: "Burg",
        manufacturer: "Cobi",
        setNumber: "1",
        imageUrl: "https://www.merlinssteine.de/b.jpg",
      },
    });
  });

  it("F3 eine geänderte Seite ohne erkennbare Angaben ergibt leere Felder, keinen Fehler", async () => {
    const address = "https://www.merlinssteine.de/sets/x-1/";
    const answer = await previewLink(deps({ [address]: html("<div>ganz anders</div>") }), address);
    expect(answer).toEqual({ kind: "page", source: "merlin", fields: {} });
  });

  it("F3 jede andere Seite: Titel und Vorschaubild (Open Graph), sonst der Seitentitel", async () => {
    const address = "https://shop.example.com/burg";
    const page = `<title>Seitentitel</title><meta property="og:title" content="Burg &amp; Turm">
      <meta property="og:image" content="https://cdn.example.com/b.jpg">`;
    expect(await previewLink(deps({ [address]: html(page) }), address)).toEqual({
      kind: "page",
      source: "page",
      fields: { name: "Burg & Turm", imageUrl: "https://cdn.example.com/b.jpg" },
    });
    const plain = await previewLink(deps({ [address]: html("<title>Nur Titel</title>") }), address);
    expect(plain).toEqual({ kind: "page", source: "page", fields: { name: "Nur Titel" } });
    expect(extractPreview("<p>nichts</p>", address)).toEqual({});
  });

  it("Bild-Adressen kommen nur als https-Link mit, werden nie abgerufen", async () => {
    const address = "https://shop.example.com/burg";
    const log: Sent[] = [];
    const withImage = (image: string) =>
      `<title>Burg</title><meta property="og:image" content="${image}">`;
    const read = async (image: string) =>
      (
        (await previewLink(
          { fetch: pages({ [address]: html(withImage(image)) }, log), resolve: PUBLIC },
          address,
        )) as { fields: { imageUrl?: string } }
      ).fields.imageUrl;
    expect(await read("http://cdn.example.com/b.jpg")).toBeUndefined();
    expect(await read("javascript:alert(1)")).toBeUndefined();
    expect(await read("data:image/png;base64,AAAA")).toBeUndefined();
    expect(await read("https://user:pw@cdn.example.com/b.jpg")).toBeUndefined();
    expect(await read(`https://cdn.example.com/${"a".repeat(600)}.jpg`)).toBeUndefined();
    expect(await read("//cdn.example.com/b.jpg")).toBe("https://cdn.example.com/b.jpg");
    expect(await read("/media/b.jpg")).toBe("https://shop.example.com/media/b.jpg");
    // Nur die Seite wurde geholt, nie ein Bild.
    expect(new Set(log.map((call) => call.url))).toEqual(new Set([address]));
  });

  it("eine http-Seite gibt ihr Bild nicht weiter, auch wenn es relativ angegeben ist", async () => {
    const address = "http://shop.example.com/burg";
    const page = `<title>Burg</title><meta property="og:image" content="/b.jpg">`;
    expect(await previewLink(deps({ [address]: html(page) }), address)).toEqual({
      kind: "page",
      source: "page",
      fields: { name: "Burg" },
    });
  });

  it("zu lange Texte werden auf die Grenzen des Formulars gekürzt", async () => {
    const address = "https://shop.example.com/burg";
    const answer = await previewLink(
      deps({ [address]: html(`<title>${"N".repeat(500)}</title>`) }),
      address,
    );
    expect((answer as { fields: { name: string } }).fields.name).toHaveLength(200);
  });

  it("die Seite selbst wird nie weitergegeben, nur die Felder", async () => {
    const address = "https://shop.example.com/burg";
    const secret = "<title>Burg</title><!-- geheimer Kommentar --><script>var key='abc'</script>";
    const text = JSON.stringify(await previewLink(deps({ [address]: html(secret) }), address));
    expect(text).not.toContain("geheimer");
    expect(text).not.toContain("abc");
  });
});

describe("Rebrickable und BrickLink: nur die Nummer aus der Adresse, kein Abruf", () => {
  it.each([
    [
      "https://rebrickable.com/sets/75372-1/clone-trooper-battle-droid-battle-pack/",
      "rebrickable",
      "legoSet",
      "75372-1",
    ],
    ["https://rebrickable.com/sets/75372-1", "rebrickable", "legoSet", "75372-1"],
    [
      "https://www.rebrickable.com/sets/10305-1/lion-knights-castle/#parts",
      "rebrickable",
      "legoSet",
      "10305-1",
    ],
    [
      "https://rebrickable.com/minifigs/fig-014663/captain-rex/",
      "rebrickable",
      "minifig",
      "fig-014663",
    ],
    [
      "https://www.bricklink.com/v2/catalog/catalogitem.page?S=75372-1#T=C",
      "bricklink",
      "legoSet",
      "75372-1",
    ],
    [
      "https://www.bricklink.com/v2/catalog/catalogitem.page?S=75372",
      "bricklink",
      "legoSet",
      "75372-1",
    ],
    [
      "https://www.bricklink.com/v2/catalog/catalogitem.page?M=sw0194",
      "bricklink",
      "minifig",
      "sw0194",
    ],
    ["https://www.bricklink.com/catalogitem.asp?M=sw0194&v=1", "bricklink", "minifig", "sw0194"],
    [
      "https://bricklink.com/v2/catalog/catalogitem.page?S=75372-1",
      "bricklink",
      "legoSet",
      "75372-1",
    ],
  ])("F3 %s", async (address, source, catalogKind, ref) => {
    const sent: Sent[] = [];
    const answer = await previewLink({ fetch: pages({}, sent), resolve: PUBLIC }, address);
    expect(answer).toEqual({ kind: "catalog", source, catalogKind, ref });
    expect(sent).toEqual([]);
  });

  it("andere Seiten dieser Anbieter (MOC, Teile, Nutzer) werden als normale Seite gelesen", async () => {
    expect(
      catalogLink(new URL("https://rebrickable.com/mocs/MOC-12345/autor/burg/")),
    ).toBeUndefined();
    expect(catalogLink(new URL("https://rebrickable.com/sets/"))).toBeUndefined();
    expect(catalogLink(new URL("https://rebrickable.com/sets/..%2f..%2fadmin/"))).toBeUndefined();
    expect(
      catalogLink(new URL("https://www.bricklink.com/v2/catalog/catalogitem.page?P=3001")),
    ).toBeUndefined();
    expect(
      catalogLink(new URL("https://www.bricklink.com/v2/catalog/catalogitem.page?S=a%20b")),
    ).toBeUndefined();
    expect(
      catalogLink(new URL("https://rebrickable.com.evil.example/sets/75372-1/")),
    ).toBeUndefined();
    expect(catalogLink(new URL("https://evilrebrickable.com/sets/75372-1/"))).toBeUndefined();
    const address = "https://rebrickable.com/mocs/MOC-12345/autor/burg/";
    const moc = `<meta property="og:title" content="Burg (MOC)">`;
    expect(await previewLink(deps({ [address]: html(moc) }), address)).toEqual({
      kind: "page",
      source: "page",
      fields: { name: "Burg (MOC)" },
    });
  });
});

describe("Die Funktion: Anmeldung, Anfrage, Antworten", () => {
  const ADDRESS = "https://shop.example.com/burg";

  function request(body: unknown, signedIn = true, method = "POST"): Request {
    return new Request("https://projekt.supabase.co/functions/v1/link-preview", {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(signedIn ? { Authorization: "Bearer jwt", apikey: "pk" } : {}),
      },
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
    });
  }

  /** The handler as deployed: the sign-in check and the page fetch go through one fake internet. */
  function handlerDeps(pageAnswers: Record<string, () => Response>, log: string[] = []) {
    const pageFetch = pages(pageAnswers);
    const send = fakeFetch([AUTH], log);
    return linkHandlerDeps(
      (name) => ENV[name],
      (async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes("/auth/v1/user")) return send(input, init);
        log.push(String(input));
        return pageFetch(input, init);
      }) as Fetch,
      PUBLIC,
    );
  }

  it("F3 gibt zu einer Adresse die Felder zurück", async () => {
    const response = await handleLinkPreview(
      request({ url: ADDRESS }),
      handlerDeps({ [ADDRESS]: html('<meta property="og:title" content="Burg">') }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      kind: "page",
      source: "page",
      fields: { name: "Burg" },
    });
  });

  it("ohne Anmeldung: 401, und es wird nichts abgerufen (dieselbe Prüfung wie die anderen Funktionen)", async () => {
    const log: string[] = [];
    const response = await handleLinkPreview(
      request({ url: ADDRESS }, false),
      handlerDeps({ [ADDRESS]: html("x") }, log),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ failure: "not_signed_in" });
    expect(log).toEqual([]);
  });

  it("ein vom Projekt abgelehntes Token gibt 401, ohne Abruf", async () => {
    const log: string[] = [];
    const refusing = linkHandlerDeps(
      (name) => ENV[name],
      (async (input: RequestInfo | URL) => {
        log.push(String(input));
        return new Response("", { status: 401 });
      }) as Fetch,
      PUBLIC,
    );
    expect((await handleLinkPreview(request({ url: ADDRESS }), refusing)).status).toBe(401);
    expect(log.every((line) => line.includes("/auth/v1/user"))).toBe(true);
  });

  it("eine nicht erlaubte Adresse gibt 422 'blocked', eine nicht lesbare Seite 502 'unreachable'", async () => {
    const blocked = await handleLinkPreview(
      request({ url: "http://127.0.0.1/admin" }),
      handlerDeps({}),
    );
    expect(blocked.status).toBe(422);
    expect(await blocked.json()).toEqual({ failure: "blocked" });
    const gone = await handleLinkPreview(request({ url: ADDRESS }), handlerDeps({}));
    expect(gone.status).toBe(502);
    expect(await gone.json()).toEqual({ failure: "unreachable" });
  });

  it("ein unerwarteter Fehler ist 'unavailable' ohne Einzelheiten", async () => {
    const broken = {
      signedIn: async () => true,
      preview: async () => Promise.reject(new Error("geheim: Stapelspur")),
      image: async () => Promise.reject(new Error("geheim")),
    };
    const response = await handleLinkPreview(request({ url: ADDRESS }), broken);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ failure: "unavailable" });
  });

  it("schlechte Anfragen: kein JSON, keine Adresse, falscher Typ, zu lang", async () => {
    for (const body of [
      {},
      { url: 5 },
      { url: "" },
      { url: `https://a.example.com/${"a".repeat(2001)}` },
      "text",
      null,
    ]) {
      const response = await handleLinkPreview(request(body), handlerDeps({}));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ failure: "bad_request" });
    }
    const notJson = new Request("https://x.test/", {
      method: "POST",
      headers: { Authorization: "Bearer jwt", apikey: "pk" },
      body: "kein json",
    });
    expect((await handleLinkPreview(notJson, handlerDeps({}))).status).toBe(400);
  });

  it("OPTIONS beantwortet die Vorabfrage, andere Methoden werden abgelehnt", async () => {
    const options = await handleLinkPreview(request(undefined, true, "OPTIONS"), handlerDeps({}));
    expect(options.status).toBe(204);
    expect(options.headers.get("Access-Control-Allow-Headers")).toContain("authorization");
    expect((await handleLinkPreview(request(undefined, true, "GET"), handlerDeps({}))).status).toBe(
      400,
    );
  });

  it("die Header der Anfrage der App (Token, Cookie) gehen nicht an die Seite", async () => {
    const sent: Sent[] = [];
    const pageFetch = pages({ [ADDRESS]: html("<title>x</title>") }, sent);
    const authFetch = fakeFetch([AUTH]);
    const deps = linkHandlerDeps(
      (name) => ENV[name],
      (async (input: RequestInfo | URL, init?: RequestInit) =>
        String(input).includes("/auth/v1/user")
          ? authFetch(input, init)
          : pageFetch(input, init)) as Fetch,
      PUBLIC,
    );
    const withSecrets = new Request("https://projekt.supabase.co/functions/v1/link-preview", {
      method: "POST",
      headers: {
        Authorization: "Bearer geheim",
        apikey: "pk",
        Cookie: "sitzung=geheim",
        "X-Test": "1",
      },
      body: JSON.stringify({ url: ADDRESS }),
    });
    expect((await handleLinkPreview(withSecrets, deps)).status).toBe(200);
    expect(Object.keys((sent[0] as Sent).headers).sort()).toEqual([
      "Accept",
      "Accept-Language",
      "User-Agent",
    ]);
  });
});

// The second call of `link-preview` (optional part of P10): the one picture of a page, so a page
// that forbids embedding (Merlins Steine) can still give its picture. Same rules as for pages.
describe("Das eine Bild einer Seite", () => {
  const PICTURE = "https://cdn.example.com/bild";
  const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]);
  const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const WEBP = Uint8Array.from([
    0x52, 0x49, 0x46, 0x46, 9, 9, 9, 9, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50,
  ]);

  const picture =
    (bytes: Uint8Array, type: string, headers: Record<string, string> = {}) =>
    () =>
      new Response(bytes as BodyInit, { headers: { "Content-Type": type, ...headers } });

  const fetched = (answers: Record<string, () => Response>, extra: Partial<PageDeps> = {}) =>
    fetchLinkImage(deps(answers, extra), PICTURE);

  it("F3 liest ein JPEG, ein PNG und ein WebP und nennt den Typ, den die ersten Bytes belegen", async () => {
    for (const [bytes, type] of [
      [JPEG, "image/jpeg"],
      [PNG, "image/png"],
      [WEBP, "image/webp"],
    ] as const) {
      const image = await fetched({ [PICTURE]: picture(bytes, type) });
      expect(image.contentType).toBe(type);
      expect(image.bytes).toEqual(bytes);
    }
    // Charset or capital letters in the header do not matter.
    const loud = await fetched({ [PICTURE]: picture(JPEG, "Image/JPEG; charset=binary") });
    expect(loud.contentType).toBe("image/jpeg");
  });

  it.each([
    ["text/html", JPEG],
    ["image/svg+xml", new TextEncoder().encode("<svg onload='x()'/>")],
    ["image/gif", new TextEncoder().encode("GIF89a....")],
    ["application/octet-stream", JPEG],
    ["", JPEG],
  ])("F3 lehnt den Typ '%s' ab", async (type, bytes) => {
    expect(await failure(fetched({ [PICTURE]: picture(bytes, type) }))).toBe("unreachable");
  });

  it("F3 lehnt ein Bild ab, dessen Bytes nicht zum Typ passen (HTML als PNG, JPEG als PNG)", async () => {
    const lie = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    expect(await failure(fetched({ [PICTURE]: picture(lie, "image/png") }))).toBe("unreachable");
    expect(await failure(fetched({ [PICTURE]: picture(JPEG, "image/png") }))).toBe("unreachable");
    expect(await failure(fetched({ [PICTURE]: picture(new Uint8Array(), "image/png") }))).toBe(
      "unreachable",
    );
  });

  it("F3 bricht bei mehr als 3 MB ab, nach der Angabe der Größe und beim Lesen", async () => {
    expect(PAGE_LIMITS.imageBytes).toBe(3_000_000);
    const declared = picture(JPEG, "image/jpeg", { "Content-Length": "3000001" });
    expect(await failure(fetched({ [PICTURE]: declared }))).toBe("unreachable");
    // Without a size in the header the body is cut off at the limit.
    const big = new Uint8Array(3_000_001);
    big.set(JPEG);
    expect(await failure(fetched({ [PICTURE]: picture(big, "image/jpeg") }))).toBe("unreachable");
    const exact = new Uint8Array(3_000_000);
    exact.set(JPEG);
    expect((await fetched({ [PICTURE]: picture(exact, "image/jpeg") })).bytes.length).toBe(
      3_000_000,
    );
  });

  it("F3 die Grenze für Seiten (2 MB) bleibt für Seiten, die für Bilder (3 MB) gilt nur für Bilder", async () => {
    const small = { limits: { maxBytes: 5, imageBytes: 20 } };
    expect(
      await failure(
        fetchPage(deps({ [PICTURE]: html("<title>zu groß</title>") }, small), new URL(PICTURE)),
      ),
    ).toBe("unreachable");
    expect((await fetched({ [PICTURE]: picture(JPEG, "image/jpeg") }, small)).bytes.length).toBe(
      JPEG.length,
    );
    expect(
      await failure(
        fetched({ [PICTURE]: picture(JPEG, "image/jpeg") }, { limits: { imageBytes: 5 } }),
      ),
    ).toBe("unreachable");
  });

  it("F3 folgt höchstens 3 Weiterleitungen und prüft jedes Ziel: auch ein Bild darf nicht ins interne Netz führen", async () => {
    const ok = {
      "https://a.example.com/": redirect("https://b.example.com/"),
      "https://b.example.com/": redirect("/c"),
      "https://b.example.com/c": redirect("https://cdn.example.com/bild"),
      [PICTURE]: picture(JPEG, "image/jpeg"),
    };
    expect((await fetchImage(deps(ok), new URL("https://a.example.com/"))).url.href).toBe(PICTURE);
    const four = {
      "https://a.example.com/": redirect("https://b.example.com/"),
      "https://b.example.com/": redirect("https://c.example.com/"),
      "https://c.example.com/": redirect("https://d.example.com/"),
      "https://d.example.com/": redirect("https://e.example.com/"),
      "https://e.example.com/": picture(JPEG, "image/jpeg"),
    };
    expect(await failure(fetchImage(deps(four), new URL("https://a.example.com/")))).toBe(
      "unreachable",
    );
    for (const target of [
      "http://127.0.0.1/geheim.png",
      "http://169.254.169.254/latest/meta-data",
      "http://localhost/x.png",
      "https://intern.example.org/x.png",
    ]) {
      const sent: Sent[] = [];
      const toInternal = pages(
        { [PICTURE]: redirect(target), [target]: picture(PNG, "image/png") },
        sent,
      );
      const resolve = async (host: string) =>
        host === "intern.example.org" ? ["10.0.0.5"] : ["93.184.216.34"];
      expect(await failure(fetchImage({ fetch: toInternal, resolve }, new URL(PICTURE)))).toBe(
        "blocked",
      );
      expect(sent.map((call) => call.url)).toEqual([PICTURE]);
    }
  });

  it("F3 eine nicht erlaubte Adresse wird gar nicht erst abgerufen (keine IP, kein Port, keine Anmeldung, kein ftp)", async () => {
    for (const address of [
      "http://127.0.0.1/x.png",
      "http://10.0.0.1/x.png",
      "https://shop.example.com:8443/x.png",
      "https://nutzer:geheim@shop.example.com/x.png",
      "ftp://shop.example.com/x.png",
      "file:///etc/passwd",
      "data:image/png;base64,AAAA",
      "kein-link",
    ]) {
      const sent: Sent[] = [];
      const none = { fetch: pages({}, sent), resolve: PUBLIC };
      expect(await failure(fetchLinkImage(none, address))).toBe("blocked");
      expect(sent).toEqual([]);
    }
  });

  it("F3 ein Name, der auch auf eine private Adresse führt, wird abgelehnt", async () => {
    const resolve = async () => ["93.184.216.34", "192.168.0.10"];
    expect(
      await failure(
        fetchImage(
          { fetch: pages({ [PICTURE]: picture(JPEG, "image/jpeg") }), resolve },
          new URL(PICTURE),
        ),
      ),
    ).toBe("blocked");
  });

  it("F3 eine Seite, die nicht antwortet oder 404 gibt, ist nicht erreichbar", async () => {
    expect(await failure(fetched({}))).toBe("unreachable");
    const hang: Fetch = (async (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("abgebrochen")));
      })) as Fetch;
    expect(
      await failure(
        fetchImage({ fetch: hang, resolve: PUBLIC, limits: { timeoutMs: 30 } }, new URL(PICTURE)),
      ),
    ).toBe("unreachable");
  });

  it("F3 gibt nur feste Kopfzeilen weiter, ohne Anmeldedaten und mit Bild-Accept", async () => {
    const sent: Sent[] = [];
    await fetchImage(
      { fetch: pages({ [PICTURE]: picture(JPEG, "image/jpeg") }, sent), resolve: PUBLIC },
      new URL(PICTURE),
    );
    const call = sent[0] as Sent;
    expect(Object.keys(call.headers).sort()).toEqual(["Accept", "Accept-Language", "User-Agent"]);
    expect(call.headers.Accept).toBe("image/webp,image/jpeg,image/png");
    expect(call.init?.credentials).toBe("omit");
    expect(call.init?.redirect).toBe("manual");
    expect(call.init?.method).toBe("GET");
  });

  describe("die Funktion", () => {
    function request(body: unknown, signedIn = true): Request {
      return new Request("https://projekt.supabase.co/functions/v1/link-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(signedIn ? { Authorization: "Bearer jwt", apikey: "pk" } : {}),
        },
        body: JSON.stringify(body),
      });
    }

    function handlerDeps(answers: Record<string, () => Response>, log: string[] = []) {
      const pageFetch = pages(answers);
      const send = fakeFetch([AUTH], log);
      return linkHandlerDeps(
        (name) => ENV[name],
        (async (input: RequestInfo | URL, init?: RequestInit) => {
          if (String(input).includes("/auth/v1/user")) return send(input, init);
          log.push(String(input));
          return pageFetch(input, init);
        }) as Fetch,
        PUBLIC,
      );
    }

    it("F3 {image} gibt Typ und Bytes als base64 zurück", async () => {
      const response = await handleLinkPreview(
        request({ image: PICTURE }),
        handlerDeps({ [PICTURE]: picture(PNG, "image/png") }),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { kind: string; contentType: string; data: string };
      expect(body.kind).toBe("image");
      expect(body.contentType).toBe("image/png");
      expect(Uint8Array.from(atob(body.data), (char) => char.charCodeAt(0))).toEqual(PNG);
    });

    it("F3 ein großes Bild (fast 3 MB) wird ganz und unverändert zurückgegeben", async () => {
      const big = new Uint8Array(2_900_000).map((_, index) => (index * 7) % 256);
      big.set(JPEG);
      const response = await handleLinkPreview(
        request({ image: PICTURE }),
        handlerDeps({ [PICTURE]: picture(big, "image/jpeg") }),
      );
      const body = (await response.json()) as { data: string };
      // Compared as buffers: a deep comparison of millions of numbers is far too slow.
      const back = Buffer.from(body.data, "base64");
      expect(back.length).toBe(big.length);
      expect(back.equals(Buffer.from(big))).toBe(true);
    });

    it("ohne Anmeldung: 401, und es wird nichts abgerufen", async () => {
      const log: string[] = [];
      const response = await handleLinkPreview(
        request({ image: PICTURE }, false),
        handlerDeps({ [PICTURE]: picture(JPEG, "image/jpeg") }, log),
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ failure: "not_signed_in" });
      expect(log).toEqual([]);
    });

    it("eine nicht erlaubte Adresse gibt 422, ein unbrauchbares Bild 502", async () => {
      const blocked = await handleLinkPreview(
        request({ image: "http://127.0.0.1/x.png" }),
        handlerDeps({}),
      );
      expect(blocked.status).toBe(422);
      expect(await blocked.json()).toEqual({ failure: "blocked" });
      const html = await handleLinkPreview(
        request({ image: PICTURE }),
        handlerDeps({
          [PICTURE]: () => new Response("<html>", { headers: { "Content-Type": "text/html" } }),
        }),
      );
      expect(html.status).toBe(502);
      expect(await html.json()).toEqual({ failure: "unreachable" });
    });

    it("schlechte Anfragen: beides zugleich, kein Text, zu lang", async () => {
      for (const body of [
        { image: PICTURE, url: PICTURE },
        { image: 5 },
        { image: "" },
        { image: `https://a.example.com/${"a".repeat(2001)}` },
      ]) {
        const response = await handleLinkPreview(request(body), handlerDeps({}));
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ failure: "bad_request" });
      }
    });

    it("ein unerwarteter Fehler ist 'unavailable' ohne Einzelheiten", async () => {
      const broken = {
        signedIn: async () => true,
        preview: async () => Promise.reject(new Error("geheim")),
        image: async () => Promise.reject(new Error("geheim: Stapelspur")),
      };
      const response = await handleLinkPreview(request({ image: PICTURE }), broken);
      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({ failure: "unavailable" });
    });
  });
});
