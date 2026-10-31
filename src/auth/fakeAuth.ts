// The sign-in service of the fake server (`src/backend/fakeServer.ts`), in memory, with the rules of
// the real one as far as the app sees them: a code of six digits, valid for ten minutes, usable
// once; a new code only after a minute, and it makes the old one invalid. An address without an
// account gets no mail, but is answered exactly like one with an account (no new accounts, P4b).
// One rule the real service has per network address instead (a limit on tries) is a limit per code
// here: after five wrong tries the code is used up. For tests; `lastCode` stands in for the mail.
// The app's side is `FakeHttpAuth` (`fakeHttpAuth.ts`).

import {
  AuthError,
  CODE_MINUTES,
  codeDigits,
  emailAddress,
  RESEND_SECONDS,
  type Session,
} from "./auth";

const MAX_WRONG_TRIES = 5;

interface PendingCode {
  /** `undefined` for an address without an account: no code was sent, none is right. */
  readonly code: string | undefined;
  readonly expiresAt: number;
  wrongTries: number;
}

export interface FakeAuthOptions {
  /** Milliseconds since 1970; default `Date.now`. */
  readonly now?: () => number;
  /** A code of six digits; default random. */
  readonly newCode?: () => string;
  /** The user id of a new account; default `crypto.randomUUID`. */
  readonly newUserId?: () => string;
}

/** What a successful sign-in hands to the device: the session and the secret that proves it. */
export interface SignedIn {
  readonly token: string;
  readonly session: Session;
}

export class FakeAuth {
  private readonly codes = new Map<string, PendingCode>();
  private readonly sentAt = new Map<string, number>();
  private readonly mails = new Map<string, number>();
  private readonly users = new Map<string, string>();
  private readonly sessions = new Map<string, Session>();
  private readonly now: () => number;
  private readonly newCode: () => string;
  private readonly newUserId: () => string;

  constructor(options: FakeAuthOptions = {}) {
    this.now = options.now ?? Date.now;
    this.newCode =
      options.newCode ?? (() => String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0"));
    this.newUserId = options.newUserId ?? (() => crypto.randomUUID());
  }

  /** The code the last mail to this address carried (the test's way to "read the mail"). */
  lastCode(email: string): string | undefined {
    return this.codes.get(email.trim().toLowerCase())?.code;
  }

  /** How many mails with a code went to the address. */
  mailCount(email: string): number {
    return this.mails.get(email.trim().toLowerCase()) ?? 0;
  }

  /**
   * An account made by hand (as "Add user" in the dashboard); answers its user id. Nothing changes
   * if it exists.
   */
  addUser(email: string): string {
    const address = emailAddress(email);
    const known = this.users.get(address);
    if (known !== undefined) return known;
    const userId = this.newUserId();
    this.users.set(address, userId);
    return userId;
  }

  requestCode(email: string): void {
    const address = emailAddress(email);
    const last = this.sentAt.get(address);
    if (last !== undefined && this.now() - last < RESEND_SECONDS * 1000) {
      throw new AuthError("tooManyTries");
    }
    this.sentAt.set(address, this.now());
    const known = this.users.has(address);
    if (known) this.mails.set(address, this.mailCount(address) + 1);
    this.codes.set(address, {
      code: known ? this.newCode() : undefined,
      expiresAt: this.now() + CODE_MINUTES * 60_000,
      wrongTries: 0,
    });
  }

  verifyCode(email: string, code: string): SignedIn {
    const address = emailAddress(email);
    const pending = this.codes.get(address);
    if (pending === undefined || pending.expiresAt <= this.now()) {
      this.codes.delete(address);
      throw new AuthError("expiredCode");
    }
    if (pending.wrongTries >= MAX_WRONG_TRIES) {
      this.codes.delete(address);
      throw new AuthError("tooManyTries");
    }
    const userId = this.users.get(address);
    if (pending.code === undefined || pending.code !== codeDigits(code) || userId === undefined) {
      pending.wrongTries++;
      throw new AuthError("wrongCode");
    }
    this.codes.delete(address); // a code works once
    return this.signIn(address, userId);
  }

  /** A session for an account without a code (the tests' shortcut past the sign-in page). */
  signInDirectly(email: string): SignedIn {
    const address = emailAddress(email);
    return this.signIn(address, this.addUser(address));
  }

  /** The session a secret belongs to; `undefined` when it is unknown or ended. */
  sessionFor(token: string | undefined): Session | undefined {
    return token === undefined ? undefined : this.sessions.get(token);
  }

  /** Ends one session (signing out on one device). */
  signOut(token: string | undefined): void {
    if (token !== undefined) this.sessions.delete(token);
  }

  /** Ends every session of the address, as the real service does when it refuses them for good. */
  signOutEverywhere(email: string): void {
    const address = email.trim().toLowerCase();
    for (const [token, session] of this.sessions) {
      if (session.email === address) this.sessions.delete(token);
    }
  }

  private signIn(address: string, userId: string): SignedIn {
    const signedIn = { token: crypto.randomUUID(), session: { userId, email: address } };
    this.sessions.set(signedIn.token, signedIn.session);
    return signedIn;
  }
}
