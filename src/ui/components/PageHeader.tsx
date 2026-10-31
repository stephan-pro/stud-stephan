import { type Route, routeHash, routeLabel } from "../route";
import { TEXTS } from "../texts";
import { Icon } from "./Icon";

interface PageHeaderProps {
  readonly route: Route;
}

/** The four studs above "Hey Stephan" (DESIGN.md section 5: only there and on the sign-in page). */
function Studs() {
  return (
    <div class="studs" aria-hidden="true">
      <span class="stud" />
      <span class="stud" />
      <span class="stud" />
      <span class="stud" />
    </div>
  );
}

/**
 * The top of a page with its one `h1` (tabindex -1: the app moves the focus there after a page
 * change). The showcase greets instead of naming the page; on the phone its avatar "S" opens the
 * settings. The settings have a back button on the phone, where the bottom bar is hidden.
 */
export function PageHeader({ route }: PageHeaderProps) {
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
