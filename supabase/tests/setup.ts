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
export const admin = createClient(url, serviceKey, noSession);

/** An account made by hand, as the PO made Stephan's in the dashboard ("Add user"), not signed in. */
export async function addUser(email: string): Promise<void> {
  const { error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// The mails of the local instance land in its mail catcher (Mailpit), never in a real mailbox.

const MAIL_URL = process.env.SUPABASE_MAIL_URL || "http://127.0.0.1:54324";

interface MailSummary {
  readonly ID: string;
  readonly To: readonly { readonly Address: string }[];
}

/** The mails sent to the address so far, newest first. */
export async function mailTo(email: string): Promise<MailSummary[]> {
  const response = await fetch(`${MAIL_URL}/api/v1/messages?limit=500`);
  const { messages } = (await response.json()) as { messages: MailSummary[] };
  return messages.filter((mail) => mail.To.some((to) => to.Address.toLowerCase() === email));
}

/** The code in the newest mail to the address, once more mails arrived than `seen` counts. */
export async function codeFromMail(email: string, seen: Map<string, number>): Promise<string> {
  const known = seen.get(email) ?? 0;
  for (let attempt = 0; attempt < 50; attempt++) {
    const mails = await mailTo(email);
    const newest = mails[0];
    if (mails.length > known && newest !== undefined) {
      seen.set(email, mails.length);
      const message = (await (await fetch(`${MAIL_URL}/api/v1/message/${newest.ID}`)).json()) as {
        Text?: string;
        HTML?: string;
      };
      const text = `${message.Text ?? ""} ${(message.HTML ?? "").replace(/<[^>]*>/g, " ")}`;
      const code = /\b\d{6}\b/.exec(text)?.[0];
      if (code === undefined) throw new Error(`Kein sechsstelliger Code in der Mail an ${email}`);
      return code;
    }
    await sleep(200);
  }
  throw new Error(`Keine neue Mail an ${email} in Mailpit (${MAIL_URL}).`);
}

export interface Person {
  readonly id: string;
  readonly client: SupabaseClient;
}

/** A new person, signed in with a password (quicker; sign-in by code is tested in `auth.test.ts`). */
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
