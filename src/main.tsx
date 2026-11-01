// Rubik and Mali from the app's own files (no request to Google Fonts, DESIGN.md section 3).
import "@fontsource-variable/rubik/wght.css";
import "@fontsource/mali/700.css";
import "./ui/tokens.css";
import "./ui/app.css";
import { render } from "preact";
import type { Auth } from "./auth/auth";
import { FakeHttpAuth, fakeAuthToken } from "./auth/fakeHttpAuth";
import { SupabaseAuth } from "./auth/supabaseAuth";
import { createSupabaseClient } from "./auth/supabaseClient";
import { createFakeHttpRemote } from "./backend/fakeHttpRemote";
import type { Remote } from "./backend/remote";
import { SupabaseRemote } from "./backend/supabaseRemote";
import { DEMO_COLLECTION } from "./demo/collection";
import { App } from "./ui/App";

/** Sign-in and data of the server this build runs on (`src/backend/mode.ts`); none in the demo. */
function createBackend(): { auth: Auth; remote: Remote } | null {
  if (__BACKEND__ === "demo") return null;
  if (__BACKEND__ === "fake") {
    return {
      auth: new FakeHttpAuth({ baseUrl: __FAKE_SERVER__, store: localStorage }),
      remote: createFakeHttpRemote({
        baseUrl: __FAKE_SERVER__,
        token: () => fakeAuthToken(localStorage) ?? "",
      }),
    };
  }
  // `vite.config.ts` stops the build if one of the two values is missing.
  const client = createSupabaseClient({
    url: import.meta.env.VITE_SUPABASE_URL,
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    store: localStorage,
  });
  return {
    auth: new SupabaseAuth({ client, store: localStorage }),
    remote: new SupabaseRemote(client),
  };
}

const root = document.getElementById("app");
if (!root) {
  throw new Error("Element #app fehlt in index.html");
}
const backend = createBackend();
render(
  <App
    auth={backend?.auth ?? null}
    remote={backend?.remote}
    demo={__BACKEND__ === "demo" ? DEMO_COLLECTION : undefined}
  />,
  root,
);
