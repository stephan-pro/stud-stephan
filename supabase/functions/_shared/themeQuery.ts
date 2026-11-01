// What a person types into the theme search (S10), understood the same way by the function and by
// the example catalog of the demo: words of a theme name (English, a few German ones), a set number
// ("75372", "75372-1") or a BrickLink minifig number ("sw0194"). Pure; no Deno, no DOM.

/** Lower case without accents and punctuation. */
export function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * German words people type that the English theme names do not have. Every word of the answer has
 * to be in the theme name; no word at all means the word only fills the sentence ("Krieg der
 * Sterne" is "star wars").
 */
const ALIASES: Readonly<Record<string, readonly string[]>> = {
  sammelserie: ["collectible"],
  sammelserien: ["collectible"],
  sammelfiguren: ["collectible"],
  sammelminifiguren: ["collectible"],
  klonkrieg: ["clone", "wars"],
  klonkriege: ["clone", "wars"],
  klonkrieger: ["clone"],
  krieg: [],
  sterne: ["star", "wars"],
  herr: ["lord"],
  ringe: ["rings"],
  superhelden: ["super", "heroes"],
  spiderman: ["spider", "man"],
  mandalorianer: ["mandalorian"],
  burg: ["castle"],
  burgen: ["castle"],
  piraten: ["pirates"],
  weltraum: ["space"],
  stadt: ["city"],
  eisenbahn: ["trains"],
  freunde: ["friends"],
  technik: ["technic"],
  polizei: ["police"],
  architektur: ["architecture"],
  dinosaurier: ["dinosaur"],
  weihnachten: ["christmas"],
  ostern: ["easter"],
};

/** Words that only join others in German. */
const FILLER = new Set(["der", "die", "das", "den", "dem", "und", "von", "mit", "aus"]);

/** The words every theme name has to contain for this text (aliases resolved). */
export function searchWords(text: string): string[] {
  return plain(text)
    .split(" ")
    .filter((word) => word !== "" && !FILLER.has(word))
    .flatMap((word) => ALIASES[word] ?? [word]);
}

export type QueryKind =
  | { readonly kind: "words" }
  | { readonly kind: "set"; readonly number: string }
  | { readonly kind: "figure"; readonly number: string };

const SET_NUMBER = /^[a-z0-9]{1,8}-\d{1,3}$/;
const PLAIN_SET_NUMBER = /^\d{3,7}$/;
const FIGURE_NUMBER = /^[a-z]{2,6}\d{1,5}[a-z]?$/;

/**
 * Words, a set number ("75372" is "75372-1") or a minifig number of BrickLink. A number with a
 * hyphen is a set (Rebrickable and BrickLink write sets so); letters followed by digits without
 * one is a minifig.
 */
export function classifyQuery(text: string): QueryKind {
  const query = text.trim().toLowerCase();
  if (PLAIN_SET_NUMBER.test(query)) return { kind: "set", number: `${query}-1` };
  if (SET_NUMBER.test(query) && /\d/.test(query.split("-")[0] ?? "")) {
    return { kind: "set", number: query };
  }
  if (FIGURE_NUMBER.test(query)) return { kind: "figure", number: query };
  return { kind: "words" };
}
