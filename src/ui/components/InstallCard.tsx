import { useEffect, useState } from "preact/hooks";
import { install, installState, onInstallChange } from "../../pwa/install";
import { TEXTS } from "../texts";

const T = TEXTS.install;

/**
 * S12: install hint (P15). Where the browser offers it (Chrome on Android and the PC) a button opens
 * the browser's own question; otherwise the card says where the menu has it, or that the app is
 * installed already.
 */
export function InstallCard() {
  const [state, setState] = useState(installState);
  useEffect(() => onInstallChange(() => setState(installState())), []);
  return (
    <section class="card" aria-labelledby="install-title">
      <h2 class="card__title" id="install-title">
        {T.title}
      </h2>
      <p class="card__text">
        {state === "installed" ? T.installed : state === "offered" ? T.offered : T.manual}
      </p>
      {state === "offered" && (
        <button
          type="button"
          class="button button--primary pressable"
          onClick={() => void install()}
        >
          {T.button}
        </button>
      )}
    </section>
  );
}
