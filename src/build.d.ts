// Constants `vite.config.ts` writes into the build (`define`).

/** Which server the app uses (`src/backend/mode.ts`). */
declare const __BACKEND__: "supabase" | "fake" | "demo";

/** Address of the fake server of the end-to-end tests (build mode `e2e`). */
declare const __FAKE_SERVER__: string;
