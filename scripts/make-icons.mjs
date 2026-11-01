// `npm run icons`: renders the app icons from the SVG sources in src/icons/ into public/ (P15).
// Uses the Chromium of Playwright, which the project has anyway: no image library needed.
// Run again after changing an SVG and commit the result; `npm run check` only checks the files.
//
//   icons/icon-192.png, icons/icon-512.png       manifest, purpose "any"     (icon.svg)
//   icons/icon-maskable-192.png, …-512.png       manifest, purpose "maskable" (icon-maskable.svg)
//   icons/apple-touch-icon.png (180)             iPhone/iPad home screen      (icon-maskable.svg)
//   favicon.svg, favicon.ico (16, 32, 48)        browser tab                  (icon-small.svg)
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const SOURCE = "src/icons";
const TARGET = "public";

/** [source, size, target file] */
const PNGS = [
  ["icon.svg", 192, "icons/icon-192.png"],
  ["icon.svg", 512, "icons/icon-512.png"],
  ["icon-maskable.svg", 192, "icons/icon-maskable-192.png"],
  ["icon-maskable.svg", 512, "icons/icon-maskable-512.png"],
  ["icon-maskable.svg", 180, "icons/apple-touch-icon.png"],
];
const FAVICON_SIZES = [16, 32, 48];

/** One PNG of the SVG `file` at `size` × `size` pixels, transparent where the SVG draws nothing. */
async function render(page, file, size) {
  const svg = readFileSync(`${SOURCE}/${file}`, "utf8");
  const source = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent"><img src="${source}" width="${size}" height="${size}" style="display:block"></body></html>`,
  );
  await page.locator("img").evaluate((image) => image.decode());
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

/** An .ico file holding PNG images (allowed since Windows Vista, read by every browser). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  mkdirSync(`${TARGET}/icons`, { recursive: true });
  for (const [file, size, target] of PNGS) {
    writeFileSync(`${TARGET}/${target}`, await render(page, file, size));
  }
  const favicons = [];
  for (const size of FAVICON_SIZES) {
    favicons.push({ size, png: await render(page, "icon-small.svg", size) });
  }
  writeFileSync(`${TARGET}/favicon.ico`, ico(favicons));
  copyFileSync(`${SOURCE}/icon-small.svg`, `${TARGET}/favicon.svg`);
  console.log(`Icons geschrieben: ${PNGS.length} PNG, favicon.ico, favicon.svg`);
} finally {
  await browser.close();
}
