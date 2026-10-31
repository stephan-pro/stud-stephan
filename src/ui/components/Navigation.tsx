import { PHONE_NAVIGATION, type Route, routeHash, routeLabel, SIDEBAR_NAVIGATION } from "../route";
import { TEXTS } from "../texts";
import { Icon, type IconName } from "./Icon";

/** Symbol of each page in the navigation (same names as the routes). */
const ICONS: Readonly<Record<Route, IconName>> = {
  showcase: "showcase",
  dioramas: "dioramas",
  capture: "plus",
  wishlist: "wishlist",
  dashboard: "dashboard",
  settings: "settings",
};

interface NavigationProps {
  readonly current: Route;
}

/**
 * Phone: floating black pill at the bottom. The current page is a white pill with symbol and name,
 * the others show only their symbol (named by `aria-label`); the plus for capturing in `--pop`.
 */
export function PhoneNavigation({ current }: NavigationProps) {
  return (
    <nav class="tabbar" aria-label={TEXTS.mainNavigation}>
      {PHONE_NAVIGATION.map((route) => {
        const active = route === current;
        const ariaCurrent = active ? "page" : undefined;
        if (route === "capture") {
          return (
            <a
              key={route}
              class="tabbar__plus pressable"
              href={routeHash(route)}
              aria-label={routeLabel(route)}
              aria-current={ariaCurrent}
            >
              <Icon name="plus" size={24} strokeWidth={2.6} />
            </a>
          );
        }
        return active ? (
          <a
            key={route}
            class="tabbar__item tabbar__item--active pressable"
            href={routeHash(route)}
            aria-current="page"
          >
            <Icon name={ICONS[route]} size={20} />
            {routeLabel(route)}
          </a>
        ) : (
          <a
            key={route}
            class="tabbar__item pressable"
            href={routeHash(route)}
            aria-label={routeLabel(route)}
          >
            <Icon name={ICONS[route]} />
          </a>
        );
      })}
    </nav>
  );
}

/** PC: black sidebar on the left with the same entries, all with their names. */
export function Sidebar({ current }: NavigationProps) {
  const item = (route: Route, extraClass = "") => (
    <a
      key={route}
      class={`sidebar__item pressable${route === current ? " sidebar__item--active" : ""}${extraClass}`}
      href={routeHash(route)}
      aria-current={route === current ? "page" : undefined}
    >
      <Icon name={ICONS[route]} size={20} />
      {routeLabel(route)}
    </a>
  );
  return (
    <nav class="sidebar" aria-label={TEXTS.mainNavigation}>
      <div class="sidebar__brand">
        <span class="sidebar__avatar" aria-hidden="true">
          {TEXTS.avatarInitial}
        </span>
        <span class="sidebar__name">{TEXTS.appName}</span>
      </div>
      <a
        class="sidebar__capture pressable"
        href={routeHash("capture")}
        aria-current={current === "capture" ? "page" : undefined}
      >
        <Icon name="plus" size={20} strokeWidth={2.6} />
        {routeLabel("capture")}
      </a>
      {SIDEBAR_NAVIGATION.map((route) => item(route))}
      {item("settings", " sidebar__item--bottom")}
    </nav>
  );
}
