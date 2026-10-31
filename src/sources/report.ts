// The summary the PO pastes into the chat. It must never contain a key: every secret is scrubbed.
import type { Fetch } from "./json.ts";

export type StepStatus = "ok" | "partial" | "refused" | "error" | "skipped";

export interface StepResult {
  service: string;
  status: StepStatus;
  lines: string[];
}

const ICONS: Record<StepStatus, string> = {
  ok: "✅",
  partial: "⚠️",
  refused: "⛔",
  error: "❌",
  skipped: "⏭️",
};

/** Replaces every secret value by `***` (also inside error messages of the network layer). */
export function redact(text: string, secrets: string[]): string {
  return secrets
    .filter((secret) => secret.length >= 4)
    .reduce((safe, secret) => safe.split(secret).join("***"), text);
}

export function formatSummary(results: StepResult[], secrets: string[], today: string): string {
  const body = results
    .map((result) =>
      [
        `## ${ICONS[result.status]} ${result.service}`,
        ...result.lines.map((line) => `- ${line}`),
      ].join("\n"),
    )
    .join("\n\n");
  return redact(`# Ergebnis von try:sources (${today})\n\n${body}\n`, secrets);
}

/** CORS check as a browser would do it: does the service allow requests from our page? */
export async function corsProbe(
  fetchFn: Fetch,
  url: string,
  origin: string,
  requestHeaders = "authorization",
): Promise<string> {
  try {
    const response = await fetchFn(url, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": requestHeaders,
      },
    });
    const allowed = response.headers.get("access-control-allow-origin");
    if (allowed === "*" || allowed === origin) return `CORS: erlaubt für ${origin} (${allowed})`;
    return `CORS: nicht erlaubt für ${origin} (HTTP ${response.status}) → nur über Edge Function`;
  } catch (error) {
    return `CORS: Prüfung fehlgeschlagen (${error instanceof Error ? error.message : "unbekannt"})`;
  }
}
