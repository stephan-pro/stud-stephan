// `npm run try:themes` – prüft die Themensuche der Reihen (S10) gegen das echte Rebrickable: wie
// viele Themen die Liste hat, ob „Star Wars“ und „The Clone Wars“ mit parent_id darin vorkommen und
// was die Suche der Funktion (`searchThemes`, derselbe Code) für einige Eingaben liefert. Der
// Schlüssel kommt aus .env.local und wird nie ausgegeben; die Ausgabe wird davon bereinigt.
// Läuft mit `node --experimental-transform-types` (die Funktionen nutzen TypeScript-Syntax, die
// Node sonst nicht liest).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createBricklink } from "../supabase/functions/_shared/bricklinkClient.ts";
import { createRebrickable } from "../supabase/functions/_shared/rebrickableClient.ts";
import { searchThemes } from "../supabase/functions/_shared/seriesService.ts";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const env = (name) => process.env[name]?.trim() || undefined;
const secrets = Object.entries(process.env)
  .filter(
    ([name, value]) =>
      /(KEY|SECRET|TOKEN)/.test(name) && /^(REBRICKABLE|BRICKLINK)_/.test(name) && value,
  )
  .map(([, value]) => value.trim());

function say(text = "") {
  let clean = text;
  for (const secret of secrets) clean = clean.split(secret).join("***");
  console.log(clean);
}

const key = env("REBRICKABLE_API_KEY");
if (!key) {
  say("REBRICKABLE_API_KEY fehlt in .env.local – ohne ihn kann nichts geprüft werden.");
  process.exit(1);
}

const message = (error) =>
  error instanceof Error ? `${error.name}: ${error.message}` : "unbekannter Fehler";

// 1. Die rohe erste Seite: wie viele Themen meldet Rebrickable, und kommen sie auf einer Seite?
say("1. Rohe Antwort von https://rebrickable.com/api/v3/lego/themes/?page_size=1000&page=1");
try {
  const response = await fetch(
    "https://rebrickable.com/api/v3/lego/themes/?page_size=1000&page=1",
    {
      headers: { Authorization: `key ${key}`, Accept: "application/json" },
    },
  );
  say(`   HTTP ${response.status}`);
  const body = await response.json();
  say(`   count (Themen insgesamt): ${body.count}`);
  say(`   results (auf dieser Seite): ${body.results?.length}`);
  say(`   next (weitere Seite): ${body.next ?? "keine"}`);
} catch (error) {
  say(`   FEHLER: ${message(error)}`);
}

// 2. Die Liste, wie die Funktion sie liest.
say("\n2. Themenliste, wie die Funktion sie liest (createRebrickable.themes)");
const rebrickable = createRebrickable({ fetch, key });
let themes = [];
try {
  themes = await rebrickable.themes();
} catch (error) {
  say(`   FEHLER: ${message(error)}`);
}
const byId = new Map(themes.map((theme) => [theme.id, theme]));
const pathOf = (theme) => {
  const names = [theme.name];
  for (let parent = byId.get(theme.parentId); parent; parent = byId.get(parent.parentId)) {
    names.unshift(parent.name);
  }
  return names.join(" – ");
};
const roots = themes.filter((theme) => theme.parentId === undefined);
say(
  `   Themen: ${themes.length} (Hauptthemen: ${roots.length}, Unterthemen: ${themes.length - roots.length})`,
);
for (const name of ["Star Wars", "Clone Wars"]) {
  const found = themes.filter((theme) => theme.name.toLowerCase().includes(name.toLowerCase()));
  say(`   Namen mit „${name}“: ${found.length}`);
  for (const theme of found.slice(0, 12)) {
    say(`     id ${theme.id} · parent_id ${theme.parentId ?? "-"} · ${pathOf(theme)}`);
  }
}
// Wie groß sind Star Wars und seine Unterthemen? (eine kleine Abfrage je Thema, nur die Anzahl)
const starWars = themes.find((theme) => theme.name === "Star Wars" && theme.parentId === undefined);
if (starWars) {
  say(`   Unterthemen von „Star Wars“ (id ${starWars.id}):`);
  for (const sub of themes.filter((theme) => theme.parentId === starWars.id)) {
    say(`     id ${sub.id} · ${sub.name}`);
  }
  for (const theme of [starWars, ...themes.filter((entry) => entry.parentId === starWars.id)]) {
    try {
      const response = await fetch(
        `https://rebrickable.com/api/v3/lego/sets/?theme_id=${theme.id}&page_size=1`,
        { headers: { Authorization: `key ${key}`, Accept: "application/json" } },
      );
      const body = await response.json();
      say(`   Sets direkt in „${theme.name}“: ${body.count ?? `HTTP ${response.status}`}`);
    } catch (error) {
      say(`   Sets in „${theme.name}“: FEHLER ${message(error)}`);
    }
    await new Promise((done) => setTimeout(done, 1100));
  }
}
mkdirSync("test-results/sources", { recursive: true });
writeFileSync("test-results/sources/themes.json", JSON.stringify(themes, null, 1));
say("   Die ganze Liste liegt in test-results/sources/themes.json.");

// 3. Die Suche der Funktion (derselbe Code, ein Zwischenspeicher im Speicher).
say("\n3. searchThemes (Code der Funktion)");
const memory = new Map();
const cache = {
  read: async (name) => memory.get(name),
  write: async (name, value) => void memory.set(name, value),
  countCall: async () => true,
};
const bricklinkKeys = {
  consumerKey: env("BRICKLINK_CONSUMER_KEY"),
  consumerSecret: env("BRICKLINK_CONSUMER_SECRET"),
  tokenValue: env("BRICKLINK_TOKEN_VALUE"),
  tokenSecret: env("BRICKLINK_TOKEN_SECRET"),
};
const hasBricklink = Object.values(bricklinkKeys).every(Boolean);
const deps = {
  cache,
  rebrickable,
  bricklink: hasBricklink ? createBricklink({ fetch, credentials: bricklinkKeys }) : undefined,
  now: () => new Date(),
};
const queries = ["Clone Wars", "Star Wars", "Batman", "Klonkriege", "75372", "75372-1"];
if (hasBricklink) queries.push("sw0194");
else say("   (sw0194 übersprungen: BRICKLINK_… fehlt in .env.local)");
for (const query of queries) {
  try {
    const { themes: hits, more } = await searchThemes(deps, query);
    say(`   „${query}“: ${hits.length} Treffer${more ? " (und mehr)" : ""}`);
    for (const hit of hits.slice(0, 8)) {
      const via = hit.via ? ` · über ${hit.via.kind} ${hit.via.number}` : "";
      say(
        `     ${hit.selectable ? "wählbar     " : "NICHT wählbar"} · id ${hit.id} · ${hit.name}${via}`,
      );
    }
  } catch (error) {
    say(`   „${query}“: FEHLER ${message(error)}`);
  }
}
say("\nFertig. Bitte alles ab „1. Rohe Antwort“ in den Chat kopieren (enthält keine Schlüssel).");
