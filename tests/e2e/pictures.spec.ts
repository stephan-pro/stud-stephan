import { expect, test } from "@playwright/test";
import { DEMO_COLLECTION } from "../../src/demo/collection";
import type { Collection } from "../../src/domain/types";
import { expectNoAccessibilityViolations, PC, PHONE, signInDirectly, style } from "./helpers";

// Pictures are shown whole (figures are portrait): catalog images on white with some padding, own
// photos on the detail page contained on the tint, own photos in small boxes cover from the top so
// the head stays in. Checked on a portrait and a landscape catalog image, phone and PC.

const svg = (width: number, height: number) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#888"/></svg>`,
  )}`;

const [rex] = DEMO_COLLECTION.minifigs;
if (!rex) throw new Error("Die Beispielsammlung hat keine Figur");

function collectionWith(image: string): Collection {
  return {
    ...DEMO_COLLECTION,
    minifigs: DEMO_COLLECTION.minifigs.map((figure) =>
      figure.id === rex?.id ? { ...figure, photos: [], catalogImageUrl: image } : figure,
    ),
  };
}

for (const [size, viewport] of [
  ["Handy", PHONE],
  ["PC", PC],
] as const) {
  for (const [shape, image] of [
    ["Hochformat", svg(120, 240)],
    ["Querformat", svg(240, 120)],
  ] as const) {
    test(`P12 ${size}: Ein Katalogbild im ${shape} wird ganz gezeigt, weiß hinterlegt, in Kachel und Detailseite`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await signInDirectly(page, undefined, collectionWith(image));
      await page.goto("#/vitrine");
      const tile = page.locator(".cover--catalog .cover__image").first();
      await expect(tile).toBeVisible();
      expect(await style(tile, "object-fit")).toBe("contain");
      expect(await style(tile.locator(".."), "background-color")).toBe("rgb(255, 255, 255)");
      expect(await style(tile, "padding-top")).not.toBe("0px");

      await page.goto(`#/vitrine/figur/${rex?.id}`);
      const hero = page.locator(".cover--hero.cover--catalog .cover__image").first();
      await expect(hero).toBeVisible();
      expect(await style(hero, "object-fit")).toBe("contain");
      await expectNoAccessibilityViolations(page);
    });
  }
}

test("P12 Eigene Fotos: auf der Detailseite ganz auf der Tönung, in Kacheln und kleinen Bildern von oben gefüllt", async ({
  page,
}) => {
  await signInDirectly(page);
  await page.goto("#/vitrine");
  const result = await page.evaluate(() => {
    const read = (classes: string) => {
      const box = document.createElement("div");
      box.className = `cover cover--tint-0 ${classes}`;
      const img = document.createElement("img");
      img.className = "cover__image";
      box.append(img);
      document.body.append(box);
      const css = getComputedStyle(img);
      const values = { fit: css.objectFit, position: css.objectPosition };
      box.remove();
      return values;
    };
    return {
      hero: read("cover--hero cover--photo"),
      tile: read("cover--tile cover--photo"),
      small: read("cover--small cover--photo"),
      thumb: read("cover--thumb cover--photo"),
    };
  });
  expect(result.hero.fit).toBe("contain");
  for (const key of ["tile", "small", "thumb"] as const) {
    expect(result[key].fit, key).toBe("cover");
    expect(result[key].position, key).toBe("50% 0%");
  }
});
