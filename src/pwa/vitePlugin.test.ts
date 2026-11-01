import { describe, expect, it } from "vitest";
import { importsOtherFiles, isKept, precacheList } from "./vitePlugin";

const FILES = [
  "index.html",
  "sw.js",
  "assets/index-abc.js",
  "assets/index-abc.js.map",
  "assets/rubik-latin-wght-normal-x.woff2",
  "assets/mali-latin-700-normal-y.woff",
  ".vite/manifest.json",
  "manifest.webmanifest",
  "icons/icon-192.png",
];

describe("P15 Dateiliste des Service Workers", () => {
  it("P15 Vorgehalten werden App-Dateien, nicht der Service Worker selbst, Karten oder alte Schriften", () => {
    expect(FILES.filter(isKept)).toEqual([
      "index.html",
      "assets/index-abc.js",
      "assets/rubik-latin-wght-normal-x.woff2",
      "manifest.webmanifest",
      "icons/icon-192.png",
    ]);
  });

  it("P15 index.html steht als Start der App in der Liste", () => {
    const { files } = precacheList(FILES, () => "x");
    expect(files[0]).toBe("./");
    expect(files).not.toContain("index.html");
    expect(files).toContain("assets/index-abc.js");
  });

  it("P15 Jede geänderte Datei ergibt eine neue Version, gleiche Dateien dieselbe", () => {
    const contents: Record<string, string> = { "index.html": "<html>1</html>" };
    const first = precacheList(FILES, (file) => contents[file] ?? "same").version;
    expect(precacheList([...FILES].reverse(), (file) => contents[file] ?? "same").version).toBe(
      first,
    );
    contents["index.html"] = "<html>2</html>";
    expect(precacheList(FILES, (file) => contents[file] ?? "same").version).not.toBe(first);
    expect(first).toMatch(/^[0-9a-f]{16}$/);
  });

  it("P15 Der Build erkennt einen Service Worker, der andere Dateien laden müsste", () => {
    expect(importsOtherFiles('import{a as e}from"./assets/swPolicy-x.js";var i=self')).toBe(true);
    expect(importsOtherFiles('var a=1;import("./chunk.js")')).toBe(true);
    expect(importsOtherFiles("var e=[`/auth/`];self.addEventListener(`fetch`,e=>{})")).toBe(false);
    expect(importsOtherFiles("const important = 1;")).toBe(false);
  });
});
