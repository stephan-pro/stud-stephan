// Signing in (P4b): one e-mail address, a six-digit code sent to it, a session per device. No
// password, no link. The app only talks to this interface; the implementations are `SupabaseAuth`
// (the real service through supabase-js) and `FakeHttpAuth` (against the fake server of the
// end-to-end tests). Both pass the same series of tests (`auth.contract.ts`). Pattern from Krümel,
// without invites: only Stephan's account exists, made once by hand.

/** How long a code is valid (the same in the real project, `supabase/config.toml` and the fake). */
export const CODE_MINUTES = 10;

/** How many digits the code in the mail has. */
export const CODE_DIGITS = 6;

/** How long after a code a new one may be asked for (Supabase: one mail per address a minute). */
export const RESEND_SECONDS = 60;

/** The part of the browser's `localStorage` the sign-in uses (a stand-in in unit tests). */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface Session {
  readonly userId: string;
  readonly email: string;
}

/**
 * Why a sign-in step failed; `TEXTS.signIn.failures` says it to the person.
 * - `invalidEmail`: the address does not look like an e-mail address.
 * - `wrongCode`: the code is wrong.
 * - `expiredCode`: the code was valid once but its time ran out, or it was used up.
 * - `tooManyTries`: too many tries, or a new code asked for too soon.
 * - `offline`: no connection to the sign-in service (no network, or it does not answer).
 * - `unknown`: anything else the service refused.
 *
 * There is no failure for an address without an account: asking a code for it looks exactly like
 * asking for Stephan's (no mail goes out), so the page does not tell who has an account.
 */
export const AUTH_FAILURES = [
  "invalidEmail",
  "wrongCode",
  "expiredCode",
  "tooManyTries",
  "offline",
  "unknown",
] as const;

export type AuthFailure = (typeof AUTH_FAILURES)[number];

export class AuthError extends Error {
  constructor(
    readonly failure: AuthFailure,
    message: string = failure,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export function isAuthFailure(value: unknown): value is AuthFailure {
  return typeof value === "string" && (AUTH_FAILURES as readonly string[]).includes(value);
}

/** The address as it is sent (trimmed, lower case); throws `invalidEmail` if it is none. */
export function emailAddress(email: string): string {
  const address = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    throw new AuthError("invalidEmail");
  }
  return address;
}

/** The code as typed, without spaces (a mail app may copy "123 456"). */
export function codeDigits(code: string): string {
  return code.replace(/\s/g, "");
}

export interface Auth {
  /**
   * The session remembered on this device, or `null` when signed out. Read from the device's
   * storage, so it works without network; renewing it runs quietly in the background, and only a
   * final refusal by the server ends it (then `onChange` reports `null`).
   */
  session(): Promise<Session | null>;
  /**
   * Sends a code to the address if it has an account. For any other address nothing is sent and
   * nothing is said (no new accounts, P4b). Throws `AuthError`.
   */
  requestCode(email: string): Promise<void>;
  /** Checks the code and signs in. Throws `AuthError`. */
  verifyCode(email: string, code: string): Promise<Session>;
  /** Ends the session on this device, also without network. */
  signOut(): Promise<void>;
  /** Calls `listener` whenever the session changes (signed in or out); returns the way to stop. */
  onChange(listener: (session: Session | null) => void): () => void;
}
