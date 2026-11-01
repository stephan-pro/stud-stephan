import { describe, expect, it } from "vitest";
import tokensCss from "../ui/tokens.css?raw";

// P15: installable on Android. The manifest and the icons come from public/ (`npm run icons`
// renders the PNGs from the SVG sources in src/icons/); this test reads them as they ship.

const PUBLIC = import.meta.glob<string>(["/public/manifest.webmanifest", "/index.html"], {
  query: "?raw",
  import: "default",
  eager: true,
});
const ICON_SOURCES = import.meta.glob<string>("/src/icons/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});
const PNGS = import.meta.glob<string>(["/public/icons/*.png", "/public/favicon.ico"], {
  query: "?url",
  import: "default",
  eager: true,
});

interface Manifest {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: { src: string; sizes: string; type: string; purpose: string }[];
}

const manifest = JSON.parse(PUBLIC["/public/manifest.webmanifest"] ?? "{}") as Manifest;

function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i").exec(tokensCss);
  if (!match?.[1]) throw new Error(`Token --${name} fehlt`);
  return match[1].toLowerCase();
}

/** Width and height from the header of a PNG file. */
async function pngSize(file: string): Promise<[number, number]> {
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile(`.${file}`);
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

describe("P15 Installierbar auf Android", () => {
  it('P15 Das Manifest heißt "Stud Stephan" und öffnet die App eigenständig', () => {
    expect(manifest.name).toBe("Stud Stephan");
    expect(manifest.short_name).toBe("Stud Stephan");
    expect(manifest.display).toBe("standalone");
    expect(manifest.scope).toBe("./");
    expect(manifest.start_url).toBe("./#/vitrine");
  });

  it("P15 Theme- und Hintergrundfarbe kommen aus den Tokens (--bg), wie im index.html", () => {
    expect(manifest.theme_color).toBe(token("bg"));
    expect(manifest.background_color).toBe(token("bg"));
    expect(PUBLIC["/index.html"]).toContain(`<meta name="theme-color" content="${token("bg")}"`);
  });

  it("P15 Icons in 192 und 512 px, je normal und maskable, liegen in der richtigen Größe vor", async () => {
    const wanted = [
      ["icons/icon-192.png", "192x192", "any"],
      ["icons/icon-512.png", "512x512", "any"],
      ["icons/icon-maskable-192.png", "192x192", "maskable"],
      ["icons/icon-maskable-512.png", "512x512", "maskable"],
    ];
    expect(manifest.icons.map((icon) => [icon.src, icon.sizes, icon.purpose])).toEqual(wanted);
    for (const [src, sizes] of wanted) {
      const size = Number(sizes?.split("x")[0]);
      expect(await pngSize(`/public/${src}`), src).toEqual([size, size]);
    }
  });

  it("P15 Apple-Touch-Icon (180 px) und Favicon sind da und im index.html genannt", async () => {
    expect(await pngSize("/public/icons/apple-touch-icon.png")).toEqual([180, 180]);
    expect(Object.keys(PNGS)).toContain("/public/favicon.ico");
    const html = PUBLIC["/index.html"] ?? "";
    for (const link of [
      'rel="manifest" href="/manifest.webmanifest"',
      'rel="icon" href="/favicon.ico"',
      'rel="icon" href="/favicon.svg"',
      'rel="apple-touch-icon" href="/icons/apple-touch-icon.png"',
    ]) {
      expect(html).toContain(link);
    }
  });

  it("P15 Die Icon-Quellen nutzen nur die Farben der Tokens (--accent, --ink) und Weiß", () => {
    const allowed = new Set([token("accent"), token("ink"), "#ffffff"]);
    expect(Object.keys(ICON_SOURCES).sort()).toEqual([
      "/src/icons/icon-maskable.svg",
      "/src/icons/icon-small.svg",
      "/src/icons/icon.svg",
    ]);
    for (const [file, svg] of Object.entries(ICON_SOURCES)) {
      const colours = new Set((svg.match(/#[0-9a-f]{6}\b/gi) ?? []).map((c) => c.toLowerCase()));
      expect(
        [...colours].filter((colour) => !allowed.has(colour)),
        file,
      ).toEqual([]);
      // No trademark lettering, no embedded pictures: the motif is drawn with shapes only.
      expect(svg, file).not.toMatch(/<text|<image|lego/i);
    }
  });
});
