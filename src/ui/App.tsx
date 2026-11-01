import { useEffect, useRef, useState } from "preact/hooks";
import type { Auth, Session } from "../auth/auth";
import type { Remote } from "../backend/remote";
import type { Collection } from "../domain/types";
import { AccountCard } from "./components/AccountCard";
import { ComingSoon } from "./components/ComingSoon";
import { PhoneNavigation, Sidebar } from "./components/Navigation";
import { PageHeader } from "./components/PageHeader";
import { StorageCard } from "./components/StorageCard";
import { DetailPage, detailName } from "./pages/DetailPage";
import { INITIAL_VIEW, ShowcasePage, type ShowcaseView } from "./pages/ShowcasePage";
import { SignInPage } from "./pages/SignInPage";
import { PhotoSourceContext } from "./photos";
import {
  DEFAULT_ROUTE,
  documentTitle,
  locationHash,
  type PageLocation,
  parseLocation,
  routeHash,
} from "./route";
import { TEXTS } from "./texts";
import { useCollection, useOnline } from "./useCollection";

/** The page of the current address; an empty or unknown address is rewritten to the start page. */
function currentLocation(): PageLocation {
  const page = parseLocation(location.hash);
  if (location.hash !== locationHash(page)) {
    // No new history entry: "Zurück" in the browser must not land on the unknown address again.
    history.replaceState(null, "", locationHash(page));
  }
  return page;
}

function focusHeading(): void {
  document.querySelector<HTMLElement>("main h1")?.focus();
}

interface ShellProps {
  readonly session: Session;
  /** The server's files and data; missing in the demo (no server). */
  readonly remote?: Remote | undefined;
  /** The example collection of the demo (no server). */
  readonly demo?: Collection | undefined;
  /** Missing in the demo (no sign-in). */
  readonly onSignOut?: (() => void) | undefined;
  /** Move the focus to the heading at once (right after signing in; not on a fresh load). */
  readonly focusOnMount: boolean;
}

/** The shell: navigation (sidebar on the PC, bottom bar on the phone) and the current page. */
function Shell({ session, remote, demo, onSignOut, focusOnMount }: ShellProps) {
  const [page, setPage] = useState(currentLocation);
  const [view, setView] = useState<ShowcaseView>(INITIAL_VIEW);
  const data = useCollection(remote, demo);
  const online = useOnline();
  const firstPage = useRef(true);
  const { route, detail } = page;
  const address = locationHash(page);
  const name = detail ? detailName(data, detail) : undefined;

  useEffect(() => {
    const onHashChange = () => setPage(currentLocation());
    addEventListener("hashchange", onHashChange);
    return () => removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    document.title = documentTitle(route, name);
  }, [route, name]);

  useEffect(() => {
    // A freshly loaded page starts at the top without moving the focus (the skip link comes
    // first). After a page change keyboard and screen reader users start at the new heading.
    if (firstPage.current) {
      firstPage.current = false;
      if (focusOnMount) focusHeading();
      return;
    }
    scrollTo(0, 0);
    focusHeading();
  }, [address, focusOnMount]);

  const hasItems =
    data.state.status === "ready" &&
    data.state.collection.minifigs.length +
      data.state.collection.sets.length +
      data.state.collection.specialParts.length >
      0;
  const search =
    route === "showcase" && !detail && hasItems
      ? {
          open: view.searchOpen,
          query: view.filter.query,
          onQuery: (query: string) => setView({ ...view, filter: { ...view.filter, query } }),
          onToggle: () => {
            setView({ ...view, searchOpen: !view.searchOpen });
            if (!view.searchOpen) {
              requestAnimationFrame(() => document.getElementById("showcase-search")?.focus());
            }
          },
        }
      : undefined;

  return (
    <PhotoSourceContext.Provider value={remote}>
      <div class="shell">
        {/* A button, not a link to "#inhalt": the address belongs to the router. */}
        <button type="button" class="skip-link" onClick={focusHeading}>
          {TEXTS.skipLink}
        </button>
        <Sidebar current={route} />
        <main class={`page page--${route}`}>
          {!online && (
            <p class="banner" role="status">
              {TEXTS.offline}
            </p>
          )}
          {detail ? (
            <div class="detail">
              <DetailPage data={data} detail={detail} />
            </div>
          ) : (
            <>
              <PageHeader route={route} search={search} />
              {route === "showcase" && <ShowcasePage data={data} view={view} onView={setView} />}
              {route === "settings" && <AccountCard email={session.email} onSignOut={onSignOut} />}
              {route === "settings" && remote !== undefined && <StorageCard remote={remote} />}
              {route !== "showcase" && <ComingSoon route={route} />}
            </>
          )}
        </main>
        {route !== "settings" && <PhoneNavigation current={route} />}
      </div>
    </PhotoSourceContext.Provider>
  );
}

/** Stands in for a session in the demo, which has no sign-in. */
const DEMO_SESSION: Session = { userId: "demo", email: "" };

/**
 * Sign-in first (P4b), then the shell. `auth` is `null` in the demo: no sign-in. The session is
 * read from the device, so a reload stays signed in; when it ends (signed out here, or refused by
 * the server) the sign-in page comes back.
 */
export function App({
  auth,
  remote,
  demo,
}: {
  readonly auth: Auth | null;
  readonly remote?: Remote | undefined;
  /** The example collection; only the demo has one. */
  readonly demo?: Collection | undefined;
}) {
  /** `undefined` while it is read from the device, `null` when signed out. */
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  /** Whether the session changed while the app ran (then the new page takes the focus). */
  const changed = useRef(false);

  useEffect(() => {
    if (auth === null) return;
    let active = true;
    void auth.session().then((remembered) => {
      if (active) setSession((current) => (current === undefined ? remembered : current));
    });
    const stop = auth.onChange((next) => {
      changed.current = true;
      setSession(next);
    });
    return () => {
      active = false;
      stop();
    };
  }, [auth]);

  if (auth === null) return <Shell session={DEMO_SESSION} demo={demo} focusOnMount={false} />;
  if (session === undefined) return null;
  if (session === null) {
    return (
      <SignInPage
        auth={auth}
        focusOnMount={changed.current}
        onSignedIn={(signedIn) => {
          changed.current = true;
          setSession(signedIn);
        }}
      />
    );
  }

  const signOut = async () => {
    // After signing in again the app starts at the showcase, not at the settings.
    history.replaceState(null, "", routeHash(DEFAULT_ROUTE));
    changed.current = true;
    await auth.signOut();
    setSession(null);
  };

  return (
    <Shell
      session={session}
      remote={remote}
      onSignOut={() => void signOut()}
      focusOnMount={changed.current}
    />
  );
}
