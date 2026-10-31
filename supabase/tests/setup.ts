// Building blocks of the database tests (`npm run check:db`): clients for the local instance and a
// fresh signed-in person for every test, so tests do not depend on each other.

import { spawnSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function setting(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`${name} fehlt: die Datenbank-Tests laufen über \`npm run check:db\`.`);
  }
  return value;
}

/** The local instance's API and its public key (the app's `VITE_SUPABASE_*` there). */
export const url = setting("SUPABASE_URL");
export const anonKey = setting("SUPABASE_ANON_KEY");
const serviceKey = setting("SUPABASE_SERVICE_ROLE_KEY");

const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/** Without sign-in, like anybody on the internet with the public key. */
export function anonymous(): SupabaseClient {
  return createClient(url, anonKey, noSession);
}

/** With the service role (only here, never in the app): makes the accounts of the tests. */
const admin = createClient(url, serviceKey, noSession);

export interface Person {
  readonly id: string;
  readonly client: SupabaseClient;
}

/** A new person, signed in with a password (sign-in by code comes with P4b). */
export async function signedIn(): Promise<Person> {
  const email = `test-${crypto.randomUUID()}@example.com`;
  const password = crypto.randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const client = createClient(url, anonKey, noSession);
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error) throw session.error;
  return { id: created.data.user.id, client };
}

// SQL as the owner of the database, as the operator works in the dashboard: `psql` in the container
// of the local instance. Only for reading the catalog.

const DB_CONTAINER = process.env.SUPABASE_DB_CONTAINER || "supabase_db_stud-stephan";

/** Runs SQL and returns the rows it printed, one line per row, columns separated by "|". */
export function sql(statement: string): string[] {
  const database = new URL(setting("SUPABASE_DB_URL"));
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-e",
      `PGPASSWORD=${decodeURIComponent(database.password)}`,
      DB_CONTAINER,
      "psql",
      "-h",
      "127.0.0.1",
      "-U",
      decodeURIComponent(database.username),
      "-d",
      database.pathname.slice(1),
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
      "-A",
      "-t",
      "-c",
      statement,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(`SQL fehlgeschlagen: ${result.stderr}`);
  return result.stdout.split("\n").filter((line) => line !== "");
}
