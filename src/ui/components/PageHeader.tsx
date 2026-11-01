import { type Route, routeHash, routeLabel } from "../route";
import { TEXTS } from "../texts";
import { Icon } from "./Icon";
import { Studs } from "./Studs";

/**
 * Search of a list page (showcase, dioramas): a button on the phone opens the field, the PC has the
 * field open all the time.
 */
export interface HeaderSearch {
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly query: string;
  readonly onQuery: (query: string) => void;
}

interface PageHeaderProps {
  readonly route: Route;
  readonly search?: HeaderSearch | undefined;
}

/** The texts and the field id of each page's search. */
const SEARCH_TEXTS: Partial<
  Record<Route, { readonly id: string; readonly label: string; readonly placeholder: string }>
> = {
  showcase: {
    id: "showcase-search",
    label: TEXTS.showcase.searchLabel,
    placeholder: TEXTS.showcase.searchPlaceholder,
  },
  dioramas: {
    id: "dioramas-search",
    label: TEXTS.dioramas.searchLabel,
    placeholder: TEXTS.dioramas.searchPlaceholder,
  },
};

function Search({ route, search }: { readonly route: Route; readonly search: HeaderSearch }) {
  const texts = SEARCH_TEXTS[route];
  if (!texts) return null;
  return (
    <>
      <button
        type="button"
        class="icon-button search-toggle pressable"
        aria-label={search.open ? TEXTS.showcase.searchClose : TEXTS.showcase.searchOpen}
        aria-expanded={search.open}
        onClick={search.onToggle}
      >
        <Icon name={search.open ? "close" : "search"} />
      </button>
      <div class="search" data-open={search.open}>
        <label class="visually-hidden" for={texts.id}>
          {texts.label}
        </label>
        <input
          id={texts.id}
          class="search__input"
          type="search"
          placeholder={texts.placeholder}
          value={search.query}
          onInput={(event) => search.onQuery(event.currentTarget.value)}
        />
        <span class="search__icon" aria-hidden="true">
          <Icon name="search" size={20} />
        </span>
      </div>
    </>
  );
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
        {search && <Search route={route} search={search} />}
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
      {search && <Search route={route} search={search} />}
    </header>
  );
}
