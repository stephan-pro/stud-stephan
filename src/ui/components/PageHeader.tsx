import { type Route, routeHash, routeLabel } from "../route";
import { TEXTS } from "../texts";
import { Icon } from "./Icon";
import { Studs } from "./Studs";

interface PageHeaderProps {
  readonly route: Route;
  /** Search button of the showcase on the phone (the PC has the search field open all the time). */
  readonly search?: { readonly open: boolean; readonly onToggle: () => void } | undefined;
}

/**
 * The top of a page with its one `h1` (tabindex -1: the app moves the focus there after a page
 * change). The showcase greets instead of naming the page; on the phone its avatar "S" opens the
 * settings. The settings have a back button on the phone, where the bottom bar is hidden.
 */
export function PageHeader({ route, search }: PageHeaderProps) {
  if (route === "showcase") {
    return (
      <header class="page-header">
        <div class="greeting">
          <a
            class="avatar avatar--header pressable"
            href={routeHash("settings")}
            aria-label={routeLabel("settings")}
          >
            {TEXTS.avatarInitial}
          </a>
          <div class="greeting__text">
            <Studs />
            <h1 class="greeting__title" tabIndex={-1}>
              {TEXTS.greeting}
            </h1>
          </div>
        </div>
        {search && (
          <button
            type="button"
            class="icon-button search-toggle pressable"
            aria-label={search.open ? TEXTS.showcase.searchClose : TEXTS.showcase.searchOpen}
            aria-expanded={search.open}
            onClick={search.onToggle}
          >
            <Icon name={search.open ? "close" : "search"} />
          </button>
        )}
      </header>
    );
  }
  if (route === "settings") {
    return (
      <header class="page-header">
        <a
          class="icon-button back-button pressable"
          href={routeHash("showcase")}
          aria-label={TEXTS.back}
        >
          <Icon name="back" />
        </a>
        <h1 class="page-title page-title--small" tabIndex={-1}>
          {routeLabel(route)}
        </h1>
        <span class="header-spacer" />
      </header>
    );
  }
  return (
    <header class="page-header">
      <h1 class="page-title" tabIndex={-1}>
        {routeLabel(route)}
      </h1>
    </header>
  );
}
