import { useEffect, useRef, useState } from "preact/hooks";
import { ComingSoon } from "./components/ComingSoon";
import { PhoneNavigation, Sidebar } from "./components/Navigation";
import { PageHeader } from "./components/PageHeader";
import { documentTitle, parseRoute, type Route, routeHash } from "./route";
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

/** The shell: navigation (sidebar on the PC, bottom bar on the phone) and the current page. */
export function App() {
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
      return;
    }
    scrollTo(0, 0);
    focusHeading();
  }, [route]);

  return (
    <div class="shell">
      {/* A button, not a link to "#inhalt": the address belongs to the router. */}
      <button type="button" class="skip-link" onClick={focusHeading}>
        {TEXTS.skipLink}
      </button>
      <Sidebar current={route} />
      <main class={`page page--${route}`}>
        <PageHeader route={route} />
        <ComingSoon route={route} />
      </main>
      {route !== "settings" && <PhoneNavigation current={route} />}
    </div>
  );
}
