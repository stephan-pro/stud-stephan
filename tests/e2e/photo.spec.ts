import { expect, test } from "@playwright/test";
import { build } from "vite";

// P4c: the canvas part of making photos small runs in a real browser only. The module is bundled
// here and put into the page; a 12-megapixel photo (4000 × 3000) must end up ≤ 400 KB.

let bundle = "";

test.beforeAll(async () => {
  const output = await build({
    configFile: false,
    logLevel: "silent",
    build: {
      write: false,
      lib: { entry: "src/files/browserPhoto.ts", name: "Photo", formats: ["iife"] },
    },
  });
  // `write: false` answers the finished bundle (never a watcher).
  const finished = (Array.isArray(output) ? output : [output]) as {
    output: { code?: string }[];
  }[];
  bundle = finished.flatMap((part) => part.output.map((chunk) => chunk.code ?? "")).join("\n");
});

interface Result {
  originalBytes: number;
  bytes: number;
  contentType: string;
  width: number;
  height: number;
  decoded: { width: number; height: number };
}

/** Makes a photo-like picture of the given size (shapes and some texture), resizes it. */
async function resizeFake(
  page: import("@playwright/test").Page,
  width: number,
  height: number,
): Promise<Result> {
  await page.goto("./");
  await page.addScriptTag({ content: bundle });
  return page.evaluate(
    async ([w, h]) => {
      const canvas = document.createElement("canvas");
      canvas.width = w as number;
      canvas.height = h as number;
      const context = canvas.getContext("2d") as CanvasRenderingContext2D;
      const sky = context.createLinearGradient(0, 0, w as number, h as number);
      sky.addColorStop(0, "#4477aa");
      sky.addColorStop(1, "#ddaa66");
      context.fillStyle = sky;
      context.fillRect(0, 0, w as number, h as number);
      let seed = 12345;
      const random = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };
      for (let index = 0; index < 4000; index++) {
        context.fillStyle = `hsla(${random() * 360}, 60%, ${30 + random() * 40}%, 0.5)`;
        context.beginPath();
        context.arc(
          random() * (w as number),
          random() * (h as number),
          5 + random() * 60,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
      const original = await new Promise<Blob>((resolve) =>
        canvas.toBlob((blob) => resolve(blob as Blob), "image/jpeg", 0.92),
      );
      const resized = await (
        window as unknown as {
          Photo: { resizePhoto(file: Blob): Promise<Record<string, unknown>> };
        }
      ).Photo.resizePhoto(original);
      const bytes = resized.bytes as Uint8Array;
      const decoded = await createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>]));
      return {
        originalBytes: original.size,
        bytes: bytes.length,
        contentType: resized.contentType as string,
        width: resized.width as number,
        height: resized.height as number,
        decoded: { width: decoded.width, height: decoded.height },
      };
    },
    [width, height],
  );
}

test("P4c Ein 12-Megapixel-Foto (Querformat) wird höchstens 400 KB groß, 1.600 px, WebP", async ({
  page,
}) => {
  const result = await resizeFake(page, 4000, 3000);

  expect(result.originalBytes).toBeGreaterThan(600 * 1024);
  expect(result.bytes).toBeLessThanOrEqual(400 * 1024);
  expect(result.contentType).toBe("image/webp");
  expect([result.width, result.height]).toEqual([1600, 1200]);
  expect(result.decoded).toEqual({ width: 1600, height: 1200 });
});

test("P4c Ein Hochformat-Foto bleibt hochkant und wird an der Höhe begrenzt", async ({ page }) => {
  const result = await resizeFake(page, 3000, 4000);

  expect(result.bytes).toBeLessThanOrEqual(400 * 1024);
  expect([result.width, result.height]).toEqual([1200, 1600]);
});
