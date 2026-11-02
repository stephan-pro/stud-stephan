import { describe, expect, it } from "vitest";
import designMd from "../../docs/design/DESIGN.md?raw";
import tokensCss from "./tokens.css?raw";

// DESIGN.md is the source of the tokens; tokens.css must carry its values exactly. Every pair of
// colours the app shows is checked for contrast: text 4.5:1, borders, symbols and focus rings 3:1
// (WCAG 1.4.3, 1.4.11).

type Rgb = readonly [number, number, number];

/** `--name: value` of tokens.css. */
const TOKENS: Readonly<Record<string, string>> = Object.fromEntries(
  [...tokensCss.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [
    name as string,
    (value as string).trim().toLowerCase(),
  ]),
);

/** Rows of the colour table in DESIGN.md: | `--token` | value | use |. */
const DESIGN_COLOURS = [...designMd.matchAll(/^\|\s*`(--[\w-]+)`\s*\|\s*([^|]+?)\s*\|/gm)].map(
  ([, name, value]) => [name as string, (value as string).toLowerCase().replace(/\s+/g, "")],
);

function colour(token: string): Rgb {
  const value = TOKENS[token];
  expect(value, `Token ${token} fehlt`).toMatch(/^#[0-9a-f]{6}$/);
  const channel = (offset: number) =>
    Number.parseInt((value as string).slice(offset, offset + 2), 16);
  return [channel(1), channel(3), channel(5)];
}

function linear(value: number): number {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

const TINTS = ["--tint-blue", "--tint-pink", "--tint-mint", "--tint-sand", "--tint-lilac"];

/** Foreground, background: text the app shows (DESIGN.md: text on colour is always `--ink`). */
const TEXT_PAIRS: readonly (readonly [string, string])[] = [
  ...["--bg", "--surface", "--accent", "--pop", ...TINTS].map((bg) => ["--ink", bg] as const),
  ["--ink-muted", "--surface"],
  ["--ink-muted", "--bg"],
  ["--positive", "--surface"],
  ["--danger", "--surface"],
  ["--on-ink", "--ink"],
  // Navigation: names on the bar, the current page in its white pill.
  ["--on-nav", "--nav"],
  ["--nav", "--on-nav"],
];

/** Foreground, background: borders, symbols and focus rings. */
const NON_TEXT_PAIRS: readonly (readonly [string, string])[] = [
  ["--ink", "--bg"],
  ["--ink", "--surface"],
  ["--focus", "--bg"],
  ["--focus", "--surface"],
  ["--focus-on-nav", "--nav"],
  // Plus button and avatar on the bar, the plus on its button, the current page's pill.
  ["--pop", "--nav"],
  ["--nav", "--pop"],
  ["--on-nav", "--nav"],
  // Sign-in page (P4b): the card's border and the focus ring on yellow, a refused field's border.
  ["--ink", "--accent"],
  ["--focus", "--accent"],
  ["--danger", "--surface"],
];

describe("P1 Design-Tokens aus DESIGN.md", () => {
  it("P1 Die Farbtabelle von DESIGN.md wurde gelesen", () => {
    expect(DESIGN_COLOURS.length).toBeGreaterThanOrEqual(15);
  });

  it.each(DESIGN_COLOURS)("P1 Token %s hat den Wert %s aus DESIGN.md", (name, value) => {
    expect(TOKENS[name]?.replace(/\s+/g, "")).toBe(value);
  });

  it.each([
    ["--radius-card", "22px"],
    ["--radius-sheet", "28px"],
    ["--radius-input", "14px"],
    ["--radius-pill", "999px"],
    ["--radius-sidebar", "28px"],
    ["--border", "2px"],
    ["--page-gutter", "18px"],
    ["--touch", "44px"],
    ["--icon-button", "50px"],
    ["--button-height", "52px"],
    ["--nav-inset", "16px"],
    ["--nav-height", "68px"],
    ["--nav-clearance", "110px"],
    ["--sidebar-width", "240px"],
    ["--stud", "8px"],
    ["--ratio-tile", "4 / 3"],
    ["--ratio-diorama", "16 / 9"],
  ])("P1 Form-Token %s ist %s wie in DESIGN.md", (name, value) => {
    expect(TOKENS[name]).toBe(value);
  });

  it("P1 Schriften Rubik und Mali", () => {
    expect(TOKENS["--font-body"]).toContain("rubik");
    expect(TOKENS["--font-hand"]).toContain("mali");
  });
});

describe("P1 Kontraste jedes verwendeten Farbpaars", () => {
  it.each(TEXT_PAIRS)("P1 Text %s auf %s erreicht mindestens 4,5:1", (foreground, background) => {
    expect(contrast(colour(foreground), colour(background))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NON_TEXT_PAIRS)(
    "P1 Rahmen oder Symbol %s auf %s erreicht mindestens 3:1",
    (foreground, background) => {
      expect(contrast(colour(foreground), colour(background))).toBeGreaterThanOrEqual(3);
    },
  );

  it("P1 Der Kontrastrechner stimmt (Schwarz auf Weiß 21:1)", () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrast([255, 255, 255], [255, 255, 255])).toBe(1);
  });
});
