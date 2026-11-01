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
import { FakeLinkPreviewer, type LinkControl } from "./backend/fakeLinkPreviewer";
import { FakePriceRunner, type PriceRunControl } from "./backend/fakePriceRun";
import { FakeRecognizer, type RecognitionControl } from "./backend/fakeRecognizer";
import { FakeRemote } from "./backend/fakeRemote";
import { FakeSeriesBuilder, type SeriesControl } from "./backend/fakeSeriesBuilder";
import { FakeStore } from "./backend/fakeStore";
import { type LinkPreviewer, SupabaseLinkPreviewer } from "./backend/linkPreview";
import { type PriceRunner, SupabasePriceRunner } from "./backend/priceRun";
import { type Recognizer, SupabaseRecognizer } from "./backend/recognition";
import type { Remote } from "./backend/remote";
import { type SeriesBuilder, SupabaseSeriesBuilder } from "./backend/seriesBuilder";
import { SupabaseRemote } from "./backend/supabaseRemote";
import { DEMO_CATALOG } from "./demo/catalog";
import { DEMO_COLLECTION } from "./demo/collection";
import { DEMO_LINK_PAGES } from "./demo/links";
import { DEMO_SUGGESTIONS } from "./demo/recognition";
import { DEMO_SERIES_CATALOG } from "./demo/series";
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

/** Lets an end-to-end test steer the example recognition: `localStorage["stud-stephan-fake:recognition"]`. */
function fakeRecognition(): RecognitionControl {
  try {
    const value = localStorage.getItem("stud-stephan-fake:recognition");
    return value === "offline" ||
      value === "unavailable" ||
      value === "limit_reached" ||
      value === "none" ||
      value === "one"
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

/** Lets an end-to-end test steer the example link reading: `localStorage["stud-stephan-fake:link"]`. */
function fakeLink(): LinkControl {
  try {
    const value = localStorage.getItem("stud-stephan-fake:link");
    return value === "offline" ||
      value === "unavailable" ||
      value === "unreachable" ||
      value === "imageUnreachable"
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

/** Lets an end-to-end test steer the example price run: `localStorage["stud-stephan-fake:price-run-control"]`. */
function fakePriceRunControl(): PriceRunControl {
  try {
    const value = localStorage.getItem("stud-stephan-fake:price-run-control");
    return value === "offline" || value === "unavailable" || value === "limit_reached"
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

/** Lets an end-to-end test steer the example series: `localStorage["stud-stephan-fake:series-control"]`. */
function fakeSeriesControl(): SeriesControl {
  try {
    const value = localStorage.getItem("stud-stephan-fake:series-control");
    return value === "offline" || value === "unavailable" || value === "limit_reached"
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

/** Sign-in and data of the server this build runs on (`src/backend/mode.ts`); none in the demo. */
function createBackend(): {
  auth: Auth;
  remote: Remote;
  catalog: Catalog;
  recognizer: Recognizer;
  previewer: LinkPreviewer;
  priceRunner: PriceRunner;
  seriesBuilder: SeriesBuilder;
} | null {
  if (__BACKEND__ === "demo") return null;
  if (__BACKEND__ === "fake") {
    const remote = createFakeHttpRemote({
      baseUrl: __FAKE_SERVER__,
      token: () => fakeAuthToken(localStorage) ?? "",
    });
    return {
      auth: new FakeHttpAuth({ baseUrl: __FAKE_SERVER__, store: localStorage }),
      remote,
      // The catalog functions are not part of the fake server: a few example entries in memory.
      catalog: new FakeCatalog(DEMO_CATALOG, fakeCatalogFailure),
      recognizer: new FakeRecognizer(DEMO_SUGGESTIONS, fakeRecognition),
      previewer: new FakeLinkPreviewer(DEMO_LINK_PAGES, fakeLink),
      // The price run writes its price points through the fake server like the real one.
      priceRunner: new FakePriceRunner(remote, {
        control: fakePriceRunControl,
        storage: localStorage,
      }),
      seriesBuilder: new FakeSeriesBuilder(DEMO_SERIES_CATALOG, {
        control: fakeSeriesControl,
        storage: localStorage,
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
    catalog: new SupabaseCatalog(client),
    recognizer: new SupabaseRecognizer(client),
    previewer: new SupabaseLinkPreviewer(client),
    priceRunner: new SupabasePriceRunner(client),
    seriesBuilder: new SupabaseSeriesBuilder(client),
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
    recognizer={
      backend?.recognizer ??
      (__BACKEND__ === "demo" ? new FakeRecognizer(DEMO_SUGGESTIONS, fakeRecognition) : undefined)
    }
    previewer={
      backend?.previewer ??
      (__BACKEND__ === "demo" ? new FakeLinkPreviewer(DEMO_LINK_PAGES, fakeLink) : undefined)
    }
    priceRunner={backend?.priceRunner}
    seriesBuilder={
      backend?.seriesBuilder ??
      (__BACKEND__ === "demo" ? new FakeSeriesBuilder(DEMO_SERIES_CATALOG) : undefined)
    }
    demo={__BACKEND__ === "demo" ? DEMO_COLLECTION : undefined}
  />,
  root,
);
