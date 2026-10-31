import { useEffect, useRef, useState } from "preact/hooks";
import type { Auth, Session } from "../auth/auth";
import { AccountCard } from "./components/AccountCard";
import { ComingSoon } from "./components/ComingSoon";
import { PhoneNavigation, Sidebar } from "./components/Navigation";
import { PageHeader } from "./components/PageHeader";
import { SignInPage } from "./pages/SignInPage";
import { DEFAULT_ROUTE, documentTitle, parseRoute, type Route, routeHash } from "./route";
import { TEXTS } from "./texts";

/** The page of the current address; an empty or unknown address is rewritten to the start page. */
function currentRoute(): Route {
  const route = parseRoute(location.hash);
  if (location.hash !== routeHash(route)) {
    // No new history entry: "Zurück" in the browser must not land on the unknown address again.
    history.replaceState(null, "", routeHash(route));
  }
  return route;
}

function focusHeading(): void {
  document.querySelector<HTMLElement>("main h1")?.focus();
}

interface ShellProps {
  readonly session: Session;
  /** Missing in the demo (no sign-in). */
  readonly onSignOut?: (() => void) | undefined;
  /** Move the focus to the heading at once (right after signing in; not on a fresh load). */
  readonly focusOnMount: boolean;
}

/** The shell: navigation (sidebar on the PC, bottom bar on the phone) and the current page. */
function Shell({ session, onSignOut, focusOnMount }: ShellProps) {
  const [route, setRoute] = useState(currentRoute);
  const firstPage = useRef(true);

  useEffect(() => {
    const onHashChange = () => setRoute(currentRoute());
    addEventListener("hashchange", onHashChange);
    return () => removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    document.title = documentTitle(route);
    // A freshly loaded page starts at the top without moving the focus (the skip link comes
    // first). After a page change keyboard and screen reader users start at the new heading.
    if (firstPage.current) {
      firstPage.current = false;
      if (focusOnMount) focusHeading();
      return;
    }
    scrollTo(0, 0);
    focusHeading();
  }, [route, focusOnMount]);

  return (
    <div class="shell">
      {/* A button, not a link to "#inhalt": the address belongs to the router. */}
      <button type="button" class="skip-link" onClick={focusHeading}>
        {TEXTS.skipLink}
      </button>
      <Sidebar current={route} />
      <main class={`page page--${route}`}>
        <PageHeader route={route} />
        {route === "settings" && <AccountCard email={session.email} onSignOut={onSignOut} />}
        <ComingSoon route={route} />
      </main>
      {route !== "settings" && <PhoneNavigation current={route} />}
    </div>
  );
}

/** Stands in for a session in the demo, which has no sign-in. */
const DEMO_SESSION: Session = { userId: "demo", email: "" };

/**
 * Sign-in first (P4b), then the shell. `auth` is `null` in the demo: no sign-in. The session is
 * read from the device, so a reload stays signed in; when it ends (signed out here, or refused by
 * the server) the sign-in page comes back.
 */
export function App({ auth }: { readonly auth: Auth | null }) {
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

  if (auth === null) return <Shell session={DEMO_SESSION} focusOnMount={false} />;
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
    <Shell session={session} onSignOut={() => void signOut()} focusOnMount={changed.current} />
  );
}
