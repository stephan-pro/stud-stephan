import { useState } from "preact/hooks";
import type { FormType } from "../../domain/forms";
import { dioramaHash, formHash, linkHash, photoHash, searchHash } from "../route";
import { TEXTS } from "../texts";
import { useWritable } from "../useCollection";
import { Icon, type IconName } from "./Icon";
import { Sheet } from "./Sheet";
import { ReadOnlyNote } from "./WriteLink";

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

/** What a form exists for; the diorama has a form of its own, the wish a sheet (S9a). */
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

/** Where a way leads for the kind of thing, or nothing where it does not work. */
function wayHref(way: keyof typeof T.ways, what: What): string | undefined {
  if (what === "diorama") return way === "manual" ? dioramaHash({ kind: "new" }) : undefined;
  // A wish (P15) is found in the catalog or by a link; the search and the link page say "Figur" or
  // "Set" themselves.
  if (what === "wish") {
    if (way === "search") return searchHash("minifig", true);
    if (way === "link") return linkHash("legoSet", true);
    return undefined;
  }
  const type = formType(what);
  if (type === undefined) return undefined;
  if (way === "manual") return formHash({ type, mode: "new" });
  if (way === "link") return linkHash(type);
  if (way === "search") return searchHash(type);
  // Brickognize recognizes figures only.
  if (way === "photo" && type === "minifig") return photoHash();
  return undefined;
}

/**
 * S7: first what is captured, then how. "Manuell" (P6), "Nummer oder Suche" (P7, figures and sets;
 * special parts by number), "Foto" (P8, figures) and "Link einfügen" (P9, all kinds) work; a wish by
 * number, search or link (P15). Without a connection every way is switched off with a hint (P15).
 */
export function CaptureSheet({ onClose }: { readonly onClose: () => void }) {
  const [what, setWhat] = useState<What>("minifig");
  const writable = useWritable();
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
              onClick={() => setWhat(entry.value)}
            >
              <Icon name={entry.icon} size={24} />
              {T.what[entry.value]}
            </button>
          ))}
        </div>
        {what === "wish" && <p class="card__text">{T.wishHint}</p>}
      </fieldset>
      <h3 class="card__title card__title--small">{T.how}</h3>
      <ReadOnlyNote />
      <ul class="ways">
        {WAYS.map((way) => {
          const text = T.ways[way.value];
          const href = writable ? wayHref(way.value, what) : undefined;
          const hint = !writable
            ? TEXTS.readOnlyShort
            : href
              ? way.value === "search" && what === "specialPart"
                ? T.partsSearch
                : text.text
              : what === "diorama"
                ? T.onlyManual
                : what === "wish"
                  ? T.wishWays
                  : T.onlyFigures;
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
