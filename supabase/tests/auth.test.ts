import { expect, it } from "vitest";
import { describeAuthContract } from "../../src/auth/auth.contract";
import { expireAccessToken, MemoryStore, offlineFetch } from "../../src/auth/auth.fixtures";
import { SupabaseAuth } from "../../src/auth/supabaseAuth";
import { createSupabaseClient, SESSION_KEY } from "../../src/auth/supabaseClient";
import { addUser, admin, anonKey, anonymous, codeFromMail, mailTo, sleep, sql, url } from "./setup";

// Sign-in with a code (P4b) against the local instance: the same series of tests as for the fake
// server and the stand-in in `npm run check`. The code comes from the mail the instance sent,
// caught by its mail catcher (Mailpit). Settings as in the real project: six digits, ten minutes,
// no new accounts (`supabase/config.toml`); only "a new code after 1 s" instead of 60 s.

/** Moves the time the codes of the address were sent back by `minutes` (in the database). */
function backdateCodes(email: string, minutes: number): void {
  if (!/^[a-z0-9-]+@example\.com$/.test(email))
    throw new Error(`Unerwartete Testadresse: ${email}`);
  const shift = `interval '${minutes} minutes'`;
  const updated = sql(
    `update auth.users set confirmation_sent_at = confirmation_sent_at - ${shift}, recovery_sent_at = recovery_sent_at - ${shift} where email = '${email}' returning id`,
  );
  if (updated.length !== 1) throw new Error(`Codes nicht zurückdatiert: ${updated.length} Zeilen`);
}

const newEmail = () => `auth-${crypto.randomUUID()}@example.com`;

describeAuthContract("SupabaseAuth (lokale Supabase-Instanz, Code aus Mailpit)", async () => {
  const store = new MemoryStore();
  const seen = new Map<string, number>();
  let offset = 0;
  const email = newEmail();
  await addUser(email);
  return {
    email,
    newEmail,
    mailCount: async (address) => {
      // A request without account sends nothing; wait a moment so a mail that went out is there.
      await sleep(500);
      return (await mailTo(address)).length;
    },
    open: (options) =>
      new SupabaseAuth({
        client: createSupabaseClient({
          url,
          publishableKey: anonKey,
          store,
          ...(options?.offline ? { fetch: offlineFetch } : {}),
        }),
        store,
        now: () => Date.now() + offset,
      }),
    nextCode: (address) => codeFromMail(address, seen),
    expireCodes: async (address) => {
      backdateCodes(address, 11);
      offset += 11 * 60_000;
    },
    waitBeforeResend: () => sleep(1500),
    refuseSessions: async () => {
      const stored = JSON.parse(store.getItem(SESSION_KEY) ?? "{}") as { access_token?: string };
      const { error } = await admin.auth.admin.signOut(stored.access_token ?? "", "global");
      if (error) throw error;
      expireAccessToken(store);
    },
  };
});

it("P4b Neue Konten sind abgeschaltet: eine unbekannte Adresse bekommt weder Konto noch Mail, auch wenn sie eines verlangt", async () => {
  const stranger = newEmail();

  const { error } = await anonymous().auth.signInWithOtp({
    email: stranger,
    options: { shouldCreateUser: true },
  });

  expect(error?.status).toBe(422);
  await sleep(500);
  expect(await mailTo(stranger)).toEqual([]);
  expect(sql(`select count(*) from auth.users where email = '${stranger}'`)).toEqual(["0"]);
});
