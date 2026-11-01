import { useState } from "preact/hooks";
import type { FormType } from "../../domain/forms";
import { formHash, photoHash, searchHash } from "../route";
import { TEXTS } from "../texts";
import { Icon, type IconName } from "./Icon";
import { Sheet } from "./Sheet";

const T = TEXTS.capture;

type What = keyof typeof T.what;

/** What can be captured, with its symbol and tint (as in Erfassen.dc.html). */
const WHAT: readonly { readonly value: What; readonly icon: IconName }[] = [
  { value: "minifig", icon: "figure" },
  { value: "legoSet", icon: "box" },
  { value: "specialPart", icon: "coin" },
  { value: "diorama", icon: "dioramas" },
  { value: "wish", icon: "wishlist" },
];

/** What a form exists for (the diorama comes with P10, the wish with P12). */
function formType(what: What): FormType | undefined {
  return what === "minifig" || what === "legoSet" || what === "specialPart" ? what : undefined;
}

const WAYS: readonly {
  readonly value: keyof typeof T.ways;
  readonly icon: IconName;
  readonly tint: string;
}[] = [
  { value: "photo", icon: "camera", tint: "blue" },
  { value: "search", icon: "number", tint: "accent" },
  { value: "link", icon: "link", tint: "mint" },
  { value: "manual", icon: "edit", tint: "lilac" },
];

/** Where a way leads for the kind of thing, or nothing while it does not work yet. */
function wayHref(way: keyof typeof T.ways, type: FormType | undefined): string | undefined {
  if (type === undefined) return undefined;
  if (way === "manual") return formHash({ type, mode: "new" });
  if (way === "search" && type !== "specialPart") return searchHash(type);
  // Brickognize recognizes figures only.
  if (way === "photo" && type === "minifig") return photoHash();
  return undefined;
}

/**
 * S7: first what is captured, then how. "Manuell" (P6), "Nummer oder Suche" (P7, figures and sets)
 * and "Foto" (P8, figures) work; the link comes with P9 and says so instead of leading nowhere.
 */
export function CaptureSheet({ onClose }: { readonly onClose: () => void }) {
  const [what, setWhat] = useState<What>("minifig");
  const type = formType(what);
  return (
    <Sheet id="capture" title={T.title} closeLabel={T.close} onClose={onClose}>
      <fieldset class="choice">
        <legend class="visually-hidden">{T.title}</legend>
        <div class="what-grid">
          {WHAT.map((entry) => (
            <button
              key={entry.value}
              type="button"
              class="what pressable"
              aria-pressed={what === entry.value}
              disabled={formType(entry.value) === undefined}
              onClick={() => setWhat(entry.value)}
            >
              <Icon name={entry.icon} size={24} />
              {T.what[entry.value]}
            </button>
          ))}
        </div>
        <p class="card__text">{T.later}</p>
      </fieldset>
      <h3 class="card__title card__title--small">{T.how}</h3>
      <ul class="ways">
        {WAYS.map((way) => {
          const text = T.ways[way.value];
          const href = wayHref(way.value, type);
          const hint = href
            ? text.text
            : way.value === "search" && type
              ? T.noCatalogForParts
              : way.value === "photo" && type
                ? T.onlyFigures
                : T.soon;
          const body = (
            <>
              <span class={`way__icon way__icon--${way.tint}`}>
                <Icon name={way.icon} />
              </span>
              <span class="way__text">
                <span class="way__title">{text.title}</span>
                <span class="way__hint">{hint}</span>
              </span>
              <Icon name="next" size={20} />
            </>
          );
          return (
            <li key={way.value}>
              {href ? (
                <a class="way pressable" href={href}>
                  {body}
                </a>
              ) : (
                <button type="button" class="way" disabled>
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
