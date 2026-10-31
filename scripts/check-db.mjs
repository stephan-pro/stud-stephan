// `npm run check:db`: tables, rules, functions and storage against a local Supabase instance in
// Docker. Runs in CI (job `db` of the workflow `check`); without Docker it says so and stops.
//
// 1. start the local instance (`supabase start`; it applies the migrations to a fresh database),
// 2. outside CI apply them again from scratch (`supabase db reset`),
// 3. run the tests in `supabase/tests/` (security, contract with the fakes) with its addresses.
import { spawnSync } from "node:child_process";

const isCi = Boolean(process.env.CI);

function step(title, command, options = {}) {
  console.log(`\n▶ ${title}`);
  const result = spawnSync(command, { shell: true, stdio: "inherit", ...options });
  if (result.status !== 0) {
    console.error(`\n❌ check:db: ${title} ist fehlgeschlagen.`);
    process.exit(1);
  }
}

const docker = spawnSync("docker info", { shell: true, stdio: "ignore" });
if (docker.status !== 0) {
  console.error(
    [
      "❌ check:db braucht Docker (lokale Supabase-Instanz), und Docker läuft hier nicht.",
      "   check:db läuft nur in CI, im Job „db“ des Workflows „check“ auf GitHub.",
      "   Ergebnis ansehen: gh run list --workflow check  (oder github.com → Actions).",
    ].join("\n"),
  );
  process.exit(1);
}

step("Lokale Supabase-Instanz starten", "npx supabase start");
if (!isCi) {
  step("Migrationen frisch einspielen", "npx supabase db reset");
}

const status = spawnSync("npx supabase status -o env", { shell: true, encoding: "utf8" });
if (status.status !== 0) {
  console.error(`❌ check:db: Adressen der lokalen Instanz nicht lesbar.\n${status.stderr}`);
  process.exit(1);
}
const values = Object.fromEntries(
  status.stdout
    .split("\n")
    .map((line) => /^([A-Z_]+)="?(.*?)"?\s*$/.exec(line.trim()))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);
for (const name of ["API_URL", "ANON_KEY", "SERVICE_ROLE_KEY", "DB_URL"]) {
  if (!values[name]) {
    console.error(`❌ check:db: ${name} fehlt in \`supabase status\`.`);
    process.exit(1);
  }
}

step("Datenbank-Tests (Vitest)", "npx vitest run --config vitest.db.config.ts", {
  env: {
    ...process.env,
    SUPABASE_URL: values.API_URL,
    SUPABASE_ANON_KEY: values.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY,
    SUPABASE_DB_URL: values.DB_URL,
  },
});
console.log("\n✅ check:db bestanden");
