// `npm run deploy:functions` – sets the secrets of the catalog functions in the Supabase project and
// deploys the functions (P7). Only for the PO, in his own terminal after `npx supabase login`.
// The keys are read from .env.local and handed to the Supabase CLI through a temporary file that is
// deleted afterwards; they are never printed. No database password and no Docker are needed.
// `npm run deploy:functions -- --project-ref=<Kennung>` for another project.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The project of docs/SUPABASE.md. */
const DEFAULT_PROJECT = "ohuqwiypmoqyuxsgouxw";
/** Only these go to the server; the public `VITE_` values and everything else stay here. */
const SECRET_NAMES = [
  "REBRICKABLE_API_KEY",
  "BRICKLINK_CONSUMER_KEY",
  "BRICKLINK_CONSUMER_SECRET",
  "BRICKLINK_TOKEN_VALUE",
  "BRICKLINK_TOKEN_SECRET",
];

if (!existsSync(".env.local")) {
  console.error(
    "❌ Die Datei .env.local fehlt (Schlüssel aus Paket P2). Siehe docs/EINRICHTUNG.md.",
  );
  process.exit(1);
}
process.loadEnvFile(".env.local");

const missing = SECRET_NAMES.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(`❌ In .env.local fehlt ein Wert für: ${missing.join(", ")}`);
  process.exit(1);
}

const given = process.argv.find((arg) => arg.startsWith("--project-ref="));
const project = given ? given.slice("--project-ref=".length).trim() : DEFAULT_PROJECT;
if (!/^[a-z0-9]{10,40}$/.test(project)) {
  console.error("❌ Die Projektkennung sieht nicht richtig aus.");
  process.exit(1);
}

function supabase(args) {
  const result = spawnSync("npx", ["supabase", ...args], { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    console.error(
      `\n❌ Der Schritt „supabase ${args.slice(0, 2).join(" ")}“ ist fehlgeschlagen (Code ${result.status}).` +
        "\n   Falls es um eine fehlende Anmeldung geht: erst `npx supabase login` ausführen.",
    );
    process.exit(1);
  }
}

const folder = mkdtempSync(join(tmpdir(), "stud-stephan-"));
const file = join(folder, "secrets.env");
try {
  writeFileSync(
    file,
    `${SECRET_NAMES.map((name) => `${name}=${process.env[name].trim()}`).join("\n")}\n`,
    { mode: 0o600 },
  );
  console.log("1/2 Schlüssel als Supabase-Secrets setzen …");
  supabase(["secrets", "set", "--env-file", `"${file}"`, "--project-ref", project]);
} finally {
  rmSync(folder, { recursive: true, force: true });
}

console.log("\n2/2 Funktionen catalog und bricklink bereitstellen …");
supabase(["functions", "deploy", "--project-ref", project, "--use-api", "--no-verify-jwt"]);

console.log(
  "\n✅ Fertig. Prüfung in der App: Erfassen → Figur → Nummer oder Suche → sw0194 eintippen.",
);
