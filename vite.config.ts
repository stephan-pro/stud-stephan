import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import { backendMode, checkSupabaseSettings } from "./src/backend/mode";

/** Where the app finds the fake server in the build mode `e2e` (`scripts/fake-server.ts`). */
const FAKE_SERVER = "http://localhost:4180";

export default defineConfig(({ mode, isPreview, isSsrBuild }) => {
  const backend = backendMode(mode);
  // The app for the real project must not be built without its address and public key. Not
  // checked for the unit tests, `vite preview` (serves a finished build) and the fake server's own
  // build (`--ssr`).
  if (backend === "supabase" && mode !== "test" && !isPreview && !isSsrBuild) {
    const env = loadEnv(mode, ".", "VITE_");
    checkSupabaseSettings(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
  }
  return {
    // GitHub Pages serves the app under /<repo-name>/.
    base: "/stud-stephan/",
    define: {
      // Which server the app uses (`src/backend/mode.ts`), fixed at build time.
      __BACKEND__: JSON.stringify(backend),
      __FAKE_SERVER__: JSON.stringify(FAKE_SERVER),
    },
    test: {
      include: ["src/**/*.test.ts", "supabase/functions/**/*.test.ts"],
      // The tests of the design read tokens.css and app.css; other CSS stays empty in unit tests.
      css: { include: [/tokens\.css/, /app\.css/] },
      // No `passWithNoTests`: `npm run check` must fail if no unit tests are found.
      coverage: {
        provider: "v8",
        // Business logic (from P3), the sign-in (P4b) and the pure helpers of the page.
        include: [
          "src/domain/**/*.ts",
          "src/demo/**/*.ts",
          "src/auth/**/*.ts",
          "src/backend/mode.ts",
          "supabase/functions/_shared/**/*.ts",
          "src/files/**/*.ts",
          "src/backup/**/*.ts",
          "src/ui/route.ts",
          "src/ui/labels.ts",
        ],
        // `browserPhoto.ts` needs a real browser (end-to-end test `tests/e2e/photo.spec.ts`).
        exclude: [
          "src/files/browserPhoto.ts",
          "src/**/*.test.ts",
          "src/**/*.fixtures.ts",
          "src/**/*.contract.ts",
          "supabase/**/*.test.ts",
          "supabase/**/*.fixtures.ts",
        ],
        thresholds: {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
      },
    },
  };
});
