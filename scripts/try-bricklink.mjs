// `npm run try:bricklink` – prüft gegen das echte BrickLink, was für Big Figs (der Rancor aus 75005,
// Teil 11323pb01c01) gilt: der Katalogeintrag, der Preisguide ohne und mit color_id, die Farben, die
// BrickLink für das Teil kennt, und die Subsets von 75005-1 (wie ein Set seine Teile und Figuren
// auflistet, mit Kategorie und Farbe). Die Schlüssel kommen aus .env.local und werden nie
// ausgegeben; die Ausgabe wird davon bereinigt. Die rohen Antworten stehen (ohne Schlüssel) in
// test-results/sources/bricklink-rancor.json. Es sind etwa 15 Abfragen, ein winziger Teil des
// Tageslimits von 5.000.
// Läuft mit `node --experimental-transform-types` (die Funktion nutzt TypeScript-Syntax).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { oauthHeader } from "../supabase/functions/_shared/oauth.ts";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const env = (name) => process.env[name]?.trim() || undefined;
const credentials = {
  consumerKey: env("BRICKLINK_CONSUMER_KEY"),
  consumerSecret: env("BRICKLINK_CONSUMER_SECRET"),
  tokenValue: env("BRICKLINK_TOKEN_VALUE"),
  tokenSecret: env("BRICKLINK_TOKEN_SECRET"),
};
const secrets = Object.values(credentials).filter(Boolean);

function clean(text) {
  let result = String(text);
  for (const secret of secrets) result = result.split(secret).join("***");
  return result;
}

function say(text = "") {
  console.log(clean(text));
}

if (!Object.values(credentials).every(Boolean)) {
  say(
    "BRICKLINK_CONSUMER_KEY, …_CONSUMER_SECRET, …_TOKEN_VALUE oder …_TOKEN_SECRET fehlt in .env.local.",
  );
  process.exit(1);
}

const BASE = "https://api.bricklink.com/api/store/v1";
const NUMBER = "11323pb01c01";
const SET = "75005-1";

/** Alles, was die Datei bekommt: Aufruf → Antwort. */
const recorded = [];
let calls = 0;

/** Eine Abfrage wie die Funktion sie schickt; liefert Status und den ganzen Körper. */
async function get(path, params = {}) {
  calls += 1;
  const url = `${BASE}${path}`;
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const timestamp = String(Math.floor(Date.now() / 1000));
  const header = await oauthHeader("GET", url, params, credentials, nonce, timestamp);
  const query = Object.keys(params).length > 0 ? `?${new URLSearchParams(params)}` : "";
  const shown = `${path}${query}`;
  let status;
  let body;
  try {
    const response = await fetch(`${url}${query}`, {
      headers: { Authorization: header, Accept: "application/json" },
    });
    status = response.status;
    const text = await response.text();
    try {
      body = JSON.parse(text);
    } catch {
      body = { nichtLesbar: text.slice(0, 300) };
    }
  } catch (error) {
    status = 0;
    body = { fehler: error instanceof Error ? error.message : "unbekannt" };
  }
  recorded.push({ aufruf: shown, http: status, antwort: body });
  const meta = body?.meta ?? {};
  say(`   GET ${shown}`);
  say(
    `     → HTTP ${status} · meta.code ${meta.code ?? "-"} · ${meta.message ?? "-"} · ${meta.description ?? "-"}`,
  );
  return { status, body, data: body?.data, meta };
}

function save() {
  mkdirSync("test-results/sources", { recursive: true });
  writeFileSync(
    "test-results/sources/bricklink-rancor.json",
    clean(JSON.stringify(recorded, null, 1)),
  );
}

const price = (data) =>
  data
    ? `Ø ${data.avg_price} ${data.currency_code}, ${data.total_quantity} verkauft (min ${data.min_price}, max ${data.max_price})`
    : "keine Daten";

// 1. Der Katalogeintrag des Teils.
say(`1. Katalogeintrag: Teil ${NUMBER}`);
const item = await get(`/items/PART/${NUMBER}`);
say(
  `   no ${item.data?.no} · name ${item.data?.name} · category_id ${item.data?.category_id} · year ${item.data?.year_released}`,
);
say(
  `   alternate_no ${item.data?.alternate_no ?? "-"} · is_obsolete ${item.data?.is_obsolete ?? "-"}`,
);
if (item.data?.category_id !== undefined) {
  const category = await get(`/categories/${item.data.category_id}`);
  say(`   Kategorie: ${category.data?.category_name} (parent_id ${category.data?.parent_id})`);
}

// 2. Welche Farben kennt BrickLink für das Teil?
say(`\n2. Bekannte Farben von ${NUMBER}`);
const known = await get(`/items/PART/${NUMBER}/colors`);
const colors = Array.isArray(known.data) ? known.data : [];
say(
  `   ${colors.length} Farben: ${colors.map((c) => `${c.color_id} (${c.quantity} Stück)`).join(", ") || "keine"}`,
);

// 3. Die Subsets von 75005-1: wo steht der Rancor und was sagen Kategorie und Farbe?
say(`\n3. Subsets von ${SET} (Inhalt des Sets)`);
const subsets = await get(`/items/SET/${SET}/subsets`, {
  break_minifigs: "false",
  break_build: "false",
});
const entries = (Array.isArray(subsets.data) ? subsets.data : []).flatMap((group) =>
  (group.entries ?? []).map((entry) => ({
    ...entry,
    match_no: group.match_no,
    group_color: group.color_id,
  })),
);
const kinds = new Map();
for (const entry of entries) kinds.set(entry.item?.type, (kinds.get(entry.item?.type) ?? 0) + 1);
say(
  `   ${entries.length} Einträge: ${[...kinds].map(([type, count]) => `${type} ${count}`).join(", ")}`,
);
const rancor = entries.filter((entry) => entry.item?.no === NUMBER);
say(`   Der Rancor in den Subsets: ${rancor.length} Eintrag(e)`);
for (const entry of rancor) say(`     ${JSON.stringify(entry)}`);
for (const entry of entries.filter((e) => e.item?.type === "MINIFIG")) {
  say(
    `   Minifigur: ${entry.item.no} · ${entry.item.name} · category_id ${entry.item.category_id} · Anzahl ${entry.quantity}`,
  );
}

// Teile, die wie zusammengesetzte Figuren aussehen: Nummer mit „pb“/„c01“ oder Name mit Figur/Large.
const figureLike = entries.filter(
  (entry) =>
    entry.item?.type === "PART" &&
    (/pb\d|c\d\d$/i.test(entry.item.no ?? "") ||
      /figure|large|rancor/i.test(entry.item.name ?? "")),
);
say(
  `   Teile, die wie Figuren aussehen (Nummer mit pb/c01 oder Name mit figure/large): ${figureLike.length}`,
);
for (const entry of figureLike) {
  say(
    `     ${entry.item.no} · ${entry.item.name} · category_id ${entry.item.category_id} · color_id ${entry.color_id} · Anzahl ${entry.quantity}`,
  );
}

// Die Kategorien aller Teile des Sets mit Namen (je Kategorie ein Aufruf, höchstens 40).
const categoryIds = [
  ...new Set(entries.filter((e) => e.item?.type === "PART").map((e) => e.item.category_id)),
].filter((id) => id !== undefined);
say(`   Kategorien der Teile im Set: ${categoryIds.length}`);
const names = new Map();
for (const id of categoryIds.slice(0, 40)) {
  const category = await get(`/categories/${id}`);
  names.set(id, category.data?.category_name ?? "?");
}
for (const [id, name] of names) {
  const parts = entries.filter((e) => e.item?.type === "PART" && e.item.category_id === id);
  say(
    `     category_id ${id} · ${name} · ${parts.length} Teile${parts.some((p) => p.item.no === NUMBER) ? "  ← enthält den Rancor" : ""}`,
  );
}

// 4. Der Preisguide ohne und mit color_id.
say(`\n4. Preisguide für Teil ${NUMBER} (verkauft, letzte 6 Monate, EUR)`);
const base = { guide_type: "sold", currency_code: "EUR" };
for (const [label, extra] of [["ohne color_id", {}]]) {
  for (const condition of ["N", "U"]) {
    const result = await get(`/items/PART/${NUMBER}/price`, {
      ...base,
      new_or_used: condition,
      ...extra,
    });
    say(`   ${label}, ${condition === "N" ? "neu" : "gebraucht"}: ${price(result.data)}`);
  }
}
const tryColors = [
  ...new Set([
    ...rancor.map((entry) => entry.color_id).filter((id) => id !== undefined),
    ...colors.slice(0, 3).map((c) => c.color_id),
    0,
  ]),
];
for (const colorId of tryColors) {
  for (const condition of ["N", "U"]) {
    const result = await get(`/items/PART/${NUMBER}/price`, {
      ...base,
      new_or_used: condition,
      color_id: String(colorId),
    });
    say(
      `   color_id ${colorId}, ${condition === "N" ? "neu" : "gebraucht"}: ${price(result.data)}`,
    );
  }
}

save();
say(
  `\n${calls} Abfragen. Die rohen Antworten liegen in test-results/sources/bricklink-rancor.json.`,
);
say("Fertig. Bitte alles ab „1. Katalogeintrag“ in den Chat kopieren (enthält keine Schlüssel).");
