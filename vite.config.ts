import { defineConfig } from "vitest/config";

export default defineConfig({
  // GitHub Pages serves the app under /<repo-name>/.
  base: "/stud-stephan/",
  test: {
    include: ["src/**/*.test.ts"],
    // The tests of the design read tokens.css and app.css; other CSS stays empty in unit tests.
    css: { include: [/tokens\.css/, /app\.css/] },
    // No `passWithNoTests`: `npm run check` must fail if no unit tests are found.
    coverage: {
      provider: "v8",
      // Business logic (from P3) and the pure helpers of the page.
      include: ["src/domain/**/*.ts", "src/demo/**/*.ts", "src/ui/route.ts"],
      exclude: ["src/**/*.test.ts"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
