// Rubik and Mali from the app's own files (no request to Google Fonts, DESIGN.md section 3).
import "@fontsource-variable/rubik/wght.css";
import "@fontsource/mali/700.css";
import "./ui/tokens.css";
import "./ui/app.css";
import { render } from "preact";
import type { Auth } from "./auth/auth";
import { FakeHttpAuth } from "./auth/fakeHttpAuth";
import { SupabaseAuth } from "./auth/supabaseAuth";
import { createSupabaseClient } from "./auth/supabaseClient";
import { App } from "./ui/App";

/** The sign-in of the server this build runs on (`src/backend/mode.ts`); none in the demo. */
function createAuth(): Auth | null {
  if (__BACKEND__ === "demo") return null;
  if (__BACKEND__ === "fake") {
    return new FakeHttpAuth({ baseUrl: __FAKE_SERVER__, store: localStorage });
  }
  // `vite.config.ts` stops the build if one of the two values is missing.
  const client = createSupabaseClient({
    url: import.meta.env.VITE_SUPABASE_URL,
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    store: localStorage,
  });
  return new SupabaseAuth({ client, store: localStorage });
}

const root = document.getElementById("app");
if (!root) {
  throw new Error("Element #app fehlt in index.html");
}
render(<App auth={createAuth()} />, root);
