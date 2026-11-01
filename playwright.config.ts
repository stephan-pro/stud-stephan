import { defineConfig, devices } from "@playwright/test";

// Minimal Node typing instead of @types/node (one dependency less for one line).
declare const process: { env: Record<string, string | undefined> };

const port = 4173;
// The fake server of the backend (`src/backend/fakeServer.ts`); the tests know it from helpers.ts.
const fakeServerPort = 4180;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Short console output (see scripts/short-reporter.mjs); the HTML report only goes to disk.
  reporter: process.env.CI
    ? [["./scripts/short-reporter.mjs"], ["html", { open: "never" }]]
    : [["./scripts/short-reporter.mjs"]],
  use: {
    baseURL: `http://localhost:${port}/stud-stephan/`,
    locale: "de-DE",
    trace: "on-first-retry",
    // The service worker (P15) keeps the app's files; `pwa.spec.ts` switches it on for itself. The
    // other tests run without it, so routes and offline steps act on the network as before.
    serviceWorkers: "block",
  },
  // Runs against the production build and the fake server; `npm run check` builds both before
  // this step (the fake server into dist-fake, `npm run build:fake`).
  webServer: [
    {
      command: `npx vite preview --port ${port} --strictPort`,
      url: `http://localhost:${port}/stud-stephan/`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "node dist-fake/fake-server.js",
      url: `http://localhost:${fakeServerPort}/health`,
      env: { FAKE_SERVER_PORT: String(fakeServerPort) },
      reuseExistingServer: !process.env.CI,
    },
  ],
  // `npm run check` (every push): Chromium on the desktop; the specs set phone and PC sizes
  // themselves where the layout matters. `npm run check:full` (E2E_FULL=1: nightly and before a
  // release) adds WebKit and real phone emulation.
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    ...(process.env.E2E_FULL
      ? [
          { name: "chromium-mobile", use: { ...devices["Pixel 7"] } },
          { name: "webkit-desktop", use: { ...devices["Desktop Safari"] } },
          { name: "webkit-mobile", use: { ...devices["iPhone 15"] } },
        ]
      : []),
  ],
});
