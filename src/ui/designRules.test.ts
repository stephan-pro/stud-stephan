import { describe, expect, it } from "vitest";

// CLAUDE.md: colours, radii and spacing only via the tokens of tokens.css, never as fixed values in
// components or their styles.

const SOURCES = import.meta.glob<string>(
  ["/src/**/*.tsx", "/src/**/*.css", "!/src/ui/tokens.css"],
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
);

const COLOUR_LITERAL = /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|hwb|oklch|lab|lch)\(/i;

/** `property: value` declarations of a style sheet. */
function declarations(css: string): [string, string][] {
  return [...css.matchAll(/([\w-]+)\s*:\s*([^;{}]+);/g)].map(([, property, value]) => [
    property as string,
    (value as string).trim(),
  ]);
}

const styleSheets = Object.entries(SOURCES).filter(([file]) => file.endsWith(".css"));

describe("P1 Nur Tokens in Komponenten", () => {
  it("P1 Es gibt Quelltexte zu prüfen", () => {
    expect(Object.keys(SOURCES)).toContain("/src/ui/app.css");
    expect(Object.keys(SOURCES)).toContain("/src/ui/App.tsx");
    // Vitest leaves CSS empty unless vite.config.ts lets it through.
    expect(SOURCES["/src/ui/app.css"]).toContain("var(--radius-pill)");
  });

  it.each(Object.entries(SOURCES))("P1 %s enthält keine festen Farbwerte", (_file, source) => {
    expect(source).not.toMatch(COLOUR_LITERAL);
  });

  it.each(styleSheets)("P1 %s nutzt für Radien nur Tokens", (_file, css) => {
    for (const [property, value] of declarations(css)) {
      if (property.endsWith("radius")) {
        expect(value, property).toMatch(/^var\(--radius-[\w-]+\)$/);
      }
    }
  });

  it.each(styleSheets)("P1 %s nutzt für Abstände nur Tokens", (_file, css) => {
    for (const [property, value] of declarations(css)) {
      if (/^(gap|row-gap|column-gap|padding|margin)(-|$)/.test(property)) {
        expect(value.replace(/var\([^)]*\)/g, ""), `${property}: ${value}`).not.toMatch(
          /\d+(\.\d+)?(px|rem|em)/,
        );
      }
    }
  });
});
