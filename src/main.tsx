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
import { type Catalog, SupabaseCatalog } from "./backend/catalog";
import { FakeCatalog } from "./backend/fakeCatalog";
import { createFakeHttpRemote } from "./backend/fakeHttpRemote";
import { FakeRemote } from "./backend/fakeRemote";
import { FakeStore } from "./backend/fakeStore";
import type { Remote } from "./backend/remote";
import { SupabaseRemote } from "./backend/supabaseRemote";
import { DEMO_CATALOG } from "./demo/catalog";
import { DEMO_COLLECTION } from "./demo/collection";
import { App } from "./ui/App";

/** Lets an end-to-end test make the example catalog fail: `localStorage["stud-stephan-fake:catalog-failure"]`. */
function fakeCatalogFailure(): "offline" | "unavailable" | "limit_reached" | undefined {
  try {
    const value = localStorage.getItem("stud-stephan-fake:catalog-failure");
    return value === "offline" || value === "unavailable" || value === "limit_reached"
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

/** Sign-in and data of the server this build runs on (`src/backend/mode.ts`); none in the demo. */
function createBackend(): { auth: Auth; remote: Remote; catalog: Catalog } | null {
  if (__BACKEND__ === "demo") return null;
  if (__BACKEND__ === "fake") {
    return {
      auth: new FakeHttpAuth({ baseUrl: __FAKE_SERVER__, store: localStorage }),
      remote: createFakeHttpRemote({
        baseUrl: __FAKE_SERVER__,
        token: () => fakeAuthToken(localStorage) ?? "",
      }),
      // The catalog functions are not part of the fake server: a few example entries in memory.
      catalog: new FakeCatalog(DEMO_CATALOG, fakeCatalogFailure),
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
    catalog: new SupabaseCatalog(client),
  };
}

const root = document.getElementById("app");
if (!root) {
  throw new Error("Element #app fehlt in index.html");
}
/** The demo has no server: what is entered lives in memory until the page is closed. */
function createDemoRemote(): Remote {
  const store = new FakeStore();
  return new FakeRemote(store, store.createUser());
}

const backend = createBackend();
render(
  <App
    auth={backend?.auth ?? null}
    remote={backend?.remote ?? (__BACKEND__ === "demo" ? createDemoRemote() : undefined)}
    catalog={
      backend?.catalog ?? (__BACKEND__ === "demo" ? new FakeCatalog(DEMO_CATALOG) : undefined)
    }
    demo={__BACKEND__ === "demo" ? DEMO_COLLECTION : undefined}
  />,
  root,
);
