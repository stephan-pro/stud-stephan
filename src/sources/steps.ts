// The four checks of `npm run try:sources`. Each one catches its own errors, so one failing
// service never hides the results of the others.

import { type PriceOutcome, priceGuide } from "./bricklink.ts";
import { BRICKOGNIZE_URL, recognize } from "./brickognize.ts";
import { type Fetch, formatCents } from "./json.ts";
import { extractSetPage } from "./merlin.ts";
import type { OAuthCredentials } from "./oauth.ts";
import { createClient, lookupSet, searchMinifigs } from "./rebrickable.ts";
import { corsProbe, type StepResult } from "./report.ts";

const ORIGIN = "https://stephan-pro.github.io";
export const SAMPLE_MINIFIG = "sw0194";
export const SAMPLE_SET = "75372-1";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "unbekannter Fehler";
}

export async function checkRebrickable(
  fetchFn: Fetch,
  key: string | undefined,
  sleep?: (ms: number) => Promise<void>,
): Promise<StepResult> {
  const service = "Rebrickable (Katalog)";
  if (!key) {
    return { service, status: "skipped", lines: ["REBRICKABLE_API_KEY fehlt in .env.local"] };
  }
  const lines: string[] = [];
  let problems = 0;
  const client = createClient(fetchFn, key, sleep);
  try {
    const search = await searchMinifigs(client, SAMPLE_MINIFIG);
    lines.push(`Figurensuche „${SAMPLE_MINIFIG}“: ${search.total} Treffer`);
    for (const fig of search.results.slice(0, 3)) {
      const ids = fig.externalIds
        ? Object.entries(fig.externalIds)
            .map(([system, values]) => `${system}: ${values.join(", ")}`)
            .join("; ")
        : "keine fremden Nummern";
      lines.push(`  ${fig.figNum} · ${fig.name} · ${fig.numParts ?? "?"} Teile · ${ids}`);
    }
    if (search.total === 0) {
      lines.push(
        "BrickLink-Nummern sind bei Rebrickable nicht direkt suchbar (siehe unten Zuordnung)",
      );
    }
  } catch (error) {
    problems++;
    lines.push(`Figurensuche fehlgeschlagen: ${message(error)}`);
  }
  try {
    const set = await lookupSet(client, SAMPLE_SET);
    lines.push(
      `Set ${set.setNum}: ${set.name} · ${set.year ?? "?"} · ${set.numParts ?? "?"} Teile · Bild ${set.imageUrl ? "ja" : "nein"}`,
    );
    lines.push(`Figuren im Set: ${set.minifigs.length}`);
    let withBrickLink = 0;
    for (const fig of set.minifigs) {
      const bricklink = fig.info?.externalIds?.BrickLink?.join(", ");
      if (bricklink) withBrickLink++;
      lines.push(
        `  ${fig.quantity}× ${fig.figNum} · ${fig.name} · BrickLink: ${bricklink ?? "keine Nummer"}`,
      );
    }
    lines.push(
      withBrickLink > 0
        ? "Zuordnung Rebrickable → BrickLink-Nummer: vorhanden (externe Nummern im Feld external_ids)"
        : "Zuordnung Rebrickable → BrickLink-Nummer: NICHT geliefert",
    );
  } catch (error) {
    problems++;
    lines.push(`Set-Abfrage fehlgeschlagen: ${message(error)}`);
  }
  lines.push(
    await corsProbe(fetchFn, `https://rebrickable.com/api/v3/lego/sets/${SAMPLE_SET}/`, ORIGIN),
  );
  return { service, status: problems === 0 ? "ok" : problems === 2 ? "error" : "partial", lines };
}

export async function checkBrickognize(
  fetchFn: Fetch,
  photo: { bytes: Uint8Array<ArrayBuffer>; fileName: string } | undefined,
): Promise<StepResult> {
  const service = "Brickognize (Fotoerkennung)";
  if (!photo) {
    return {
      service,
      status: "skipped",
      lines: ["kein Foto gefunden: bitte scripts/samples/minifig.jpg anlegen"],
    };
  }
  const lines: string[] = [];
  try {
    const top = await recognize(fetchFn, photo.bytes, photo.fileName);
    lines.push(`Foto ${photo.fileName} (${Math.round(photo.bytes.length / 1024)} KB)`);
    if (top.length === 0) lines.push("keine Vorschläge zurückgegeben");
    for (const [index, entry] of top.entries()) {
      lines.push(
        `${index + 1}. ${entry.id} · ${entry.name} · ${Math.round(entry.score * 100)} % · Bild ${entry.imageUrl ? "ja" : "nein"} · Seiten: ${entry.sites.join(", ") || "-"}`,
      );
    }
    lines.push(await corsProbe(fetchFn, BRICKOGNIZE_URL, ORIGIN, "content-type"));
    return { service, status: top.length > 0 ? "ok" : "partial", lines };
  } catch (error) {
    lines.push(`fehlgeschlagen: ${message(error)}`);
    return { service, status: "error", lines };
  }
}

function describePrice(outcome: PriceOutcome): string {
  const label = (c: string) => (c === "new" ? "neu" : "gebraucht");
  switch (outcome.kind) {
    case "ok": {
      const avg = outcome.averageCents;
      const range =
        outcome.minCents !== undefined && outcome.maxCents !== undefined
          ? ` (${formatCents(outcome.minCents)} bis ${formatCents(outcome.maxCents)})`
          : "";
      return `${label(outcome.condition)}: ${avg !== undefined ? formatCents(avg) : "kein Durchschnitt"}${range}, ${outcome.totalQuantity} Stück verkauft, Währung ${outcome.currency}`;
    }
    case "refused":
      return `ABGELEHNT (HTTP ${outcome.httpStatus}, Code ${outcome.code ?? "?"}): ${outcome.message}`;
    case "error":
      return `Fehler: ${outcome.message}`;
  }
}

export async function checkBrickLink(
  fetchFn: Fetch,
  credentials: OAuthCredentials | undefined,
  clock: () => { nonce: string; timestamp: string },
): Promise<StepResult> {
  const service = "BrickLink (Marktwerte)";
  if (!credentials) {
    return {
      service,
      status: "skipped",
      lines: ["mindestens ein BRICKLINK_…-Wert fehlt in .env.local"],
    };
  }
  const lines = [`Preisguide „verkauft, letzte 6 Monate“ für Figur ${SAMPLE_MINIFIG}, in EUR`];
  const outcomes: PriceOutcome[] = [];
  for (const condition of ["new", "used"] as const) {
    try {
      const outcome = await priceGuide(
        fetchFn,
        credentials,
        { type: "MINIFIG", no: SAMPLE_MINIFIG },
        condition,
        clock(),
      );
      outcomes.push(outcome);
      lines.push(describePrice(outcome));
    } catch (error) {
      outcomes.push({ kind: "error", message: message(error) });
      lines.push(`${condition === "new" ? "neu" : "gebraucht"}: Fehler: ${message(error)}`);
    }
  }
  lines.push(
    await corsProbe(
      fetchFn,
      "https://api.bricklink.com/api/store/v1/items/MINIFIG/sw0194/price",
      ORIGIN,
    ),
  );
  const oks = outcomes.filter((o) => o.kind === "ok").length;
  const status =
    oks === 2
      ? "ok"
      : oks === 1
        ? "partial"
        : outcomes.some((o) => o.kind === "refused")
          ? "refused"
          : "error";
  return { service, status, lines };
}

export async function checkMerlin(
  fetchFn: Fetch,
  pageUrl: string | undefined,
): Promise<{
  result: StepResult;
  html?: string;
}> {
  const service = "Merlins Steine SetDB";
  if (!pageUrl) {
    return { result: { service, status: "skipped", lines: ["keine Adresse angegeben"] } };
  }
  try {
    const response = await fetchFn(pageUrl, {
      headers: { "User-Agent": "stud-stephan/0.1 (privates Projekt, einzelne Seite)" },
    });
    if (!response.ok) {
      return {
        result: {
          service,
          status: "error",
          lines: [`Seite antwortet mit HTTP ${response.status}`],
        },
      };
    }
    const html = await response.text();
    const { fields, labels } = extractSetPage(html, pageUrl);
    const rows: [string, string | undefined][] = [
      ["Name", fields.name],
      ["Hersteller", fields.manufacturer],
      ["Setnummer", fields.setNumber],
      ["Teilezahl", fields.pieceCount?.toString()],
      ["Bild", fields.imageUrl],
    ];
    const lines = rows.map(([label, value]) => `${label}: ${value ?? "NICHT gefunden"}`);
    lines.push(`Seitengröße: ${Math.round(html.length / 1024)} KB`);
    lines.push(`Beschriftungen auf der Seite: ${labels.join(" | ") || "keine"}`);
    lines.push(await corsProbe(fetchFn, pageUrl, ORIGIN, "content-type"));
    const found = rows.filter(([, value]) => value !== undefined).length;
    return {
      result: {
        service,
        status: found === rows.length ? "ok" : found > 0 ? "partial" : "error",
        lines,
      },
      html,
    };
  } catch (error) {
    return { result: { service, status: "error", lines: [`fehlgeschlagen: ${message(error)}`] } };
  }
}
