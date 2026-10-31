// Which server the app runs on, chosen at build time by the build mode (`vite.config.ts` turns it
// into the constant `__BACKEND__`, so the code of the other modes is left out of the build):
//
// - `supabase`: the real project, with sign-in (`npm run build` for GitHub Pages, `npm run dev`).
//   Needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (repository variables in the
//   workflow `pages`, `.env.local` on the PC).
// - `fake`: the fake server of the end-to-end tests, with sign-in by code (build mode `e2e`,
//   `npm run check`).
// - `demo`: no server and no sign-in (`npm run demo`; the example data of `src/demo/` from P5).

export type BackendMode = "supabase" | "fake" | "demo";

export function backendMode(buildMode: string): BackendMode {
  if (buildMode === "e2e") return "fake";
  if (buildMode === "demo") return "demo";
  return "supabase";
}

/**
 * Stops a build for the real project without its address or public key (the app could not sign
 * in), or with another kind of key: only the publishable key may go into the app, never the secret
 * one.
 */
export function checkSupabaseSettings(url: string | undefined, key: string | undefined): void {
  if (!/^https:\/\/[\w.-]+$/.test(url?.trim() ?? "")) {
    throw new Error(
      "VITE_SUPABASE_URL fehlt oder ist keine https-Adresse (Projekt-URL, siehe .env.example).",
    );
  }
  const value = key?.trim() ?? "";
  if (value === "") {
    throw new Error(
      "VITE_SUPABASE_PUBLISHABLE_KEY fehlt (öffentlicher Schlüssel des Supabase-Projekts, siehe .env.example).",
    );
  }
  if (!value.startsWith("sb_publishable_")) {
    throw new Error(
      "VITE_SUPABASE_PUBLISHABLE_KEY muss der Publishable Key sein (sb_publishable_…), nie der Secret Key.",
    );
  }
}
