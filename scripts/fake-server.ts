// The fake server of the end-to-end tests (`src/backend/fakeServer.ts` lists its addresses).
// Playwright starts it (see `playwright.config.ts`). Built with `vite build --ssr` into dist-fake
// (`npm run check` does that) and run with Node, because the app's source files import each other
// without file endings.

import { startFakeHttpServer } from "../src/backend/fakeHttpServer";

const port = Number(process.env.FAKE_SERVER_PORT ?? 4180);

startFakeHttpServer(port).then(({ url }) => {
  console.log(`Fake-Server läuft auf ${url}`);
});
