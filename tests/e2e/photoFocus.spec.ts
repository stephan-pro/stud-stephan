import { expect, type Page, test } from "@playwright/test";
import { TEXTS } from "../../src/ui/texts";
import { expectNoAccessibilityViolations, PC, PHONE, signInDirectly, style } from "./helpers";

// Bildausschnitt: tap a photo in the form, set the point (the figure), and every box that fills its
// area shows the photo around it. A portrait phone photo: wall above, the figure in the middle.

const T = TEXTS.form;
const F = T.photos.focus;

/** A portrait photo like a phone takes: grey wall and table, a red figure in the middle. */
async function portraitPhoto(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 1600;
    const context = canvas.getContext("2d") as CanvasRenderingContext2D;
    context.fillStyle = "#9aa0a6";
    context.fillRect(0, 0, 900, 1600);
    context.fillStyle = "#6b5b45";
    context.fillRect(0, 1250, 900, 350);
    context.fillStyle = "#d62828";
    context.fillRect(380, 600, 140, 500);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((result) => resolve(result as Blob), "image/jpeg", 0.9),
    );
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let text = "";
    for (const byte of bytes) text += String.fromCharCode(byte);
    return btoa(text);
  });
  return Buffer.from(base64, "base64");
}

for (const [size, viewport] of [
  ["Handy", PHONE],
  ["PC", PC],
] as const) {
  test(`${size}: Bildausschnitt setzen, speichern und in Kachel und Thumbnail wiederfinden`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await signInDirectly(page);
    await page.goto("#/erfassen/figur");
    await page.getByLabel(T.fields.name, { exact: true }).fill("Figur mit Ausschnitt");
    await page.locator('input[type="file"]').setInputFiles({
      name: "hoch.jpg",
      mimeType: "image/jpeg",
      buffer: await portraitPhoto(page),
    });
    const thumb = page.locator(".photo-slot .cover__image");
    await expect(thumb).toHaveCount(1);
    expect(await style(thumb, "object-position")).toBe("50% 50%");

    await page.getByRole("button", { name: T.photos.setFocus(1) }).click();
    const dialog = page.getByRole("dialog");
    const area = dialog.getByRole("slider", { name: F.areaLabel("Figur mit Ausschnitt") });
    await expect(area).toBeVisible();
    await expect(dialog.locator(".focus-area__image")).toBeVisible();
    await expect(dialog.locator(".focus-area__image")).toHaveJSProperty("complete", true);
    await expectNoAccessibilityViolations(page);

    // A tap in the upper left quarter of the photo puts the point there.
    const box = await area.boundingBox();
    if (!box) throw new Error("Bildfläche fehlt");
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.25);
    await expect(dialog.getByText(F.valueText(25, 25), { exact: true }).first()).toBeVisible();
    const marker = dialog.getByTestId("focus-marker");
    expect(await style(marker, "left")).not.toBe("auto");

    // The keyboard moves it: 5 percent per arrow key, home goes back to the middle.
    await area.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    await expect(dialog.getByText(F.valueText(30, 30), { exact: true }).first()).toBeVisible();
    await page.keyboard.press("Shift+ArrowLeft");
    await expect(dialog.getByText(F.valueText(29, 30), { exact: true }).first()).toBeVisible();
    await page.keyboard.press("Home");
    await expect(dialog.getByText(F.valueText(50, 50), { exact: true }).first()).toBeVisible();

    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.6);
    await expect(dialog.getByText(F.valueText(50, 60), { exact: true }).first()).toBeVisible();
    await dialog.getByRole("button", { name: F.done }).click();
    await expect(dialog).toBeHidden();
    expect(await style(thumb, "object-position")).toBe("50% 60%");

    // Cancelling the sheet changes nothing.
    await page.getByRole("button", { name: T.photos.setFocus(1) }).click();
    await page.mouse.click(box.x + 5, box.y + 5);
    await page.getByRole("dialog").getByRole("button", { name: F.close }).click();
    expect(await style(thumb, "object-position")).toBe("50% 60%");

    await page.getByRole("button", { name: T.save }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Figur mit Ausschnitt");

    // The showcase tile fills its box around the saved point, also after a reload.
    await page.goto("#/vitrine");
    const tile = page.locator(".cover--tile.cover--photo .cover__image").first();
    await expect(tile).toBeVisible();
    expect(await style(tile, "object-position")).toBe("50% 60%");
    await page.reload();
    expect(
      await style(
        page.locator(".cover--tile.cover--photo .cover__image").first(),
        "object-position",
      ),
    ).toBe("50% 60%");
  });
}
