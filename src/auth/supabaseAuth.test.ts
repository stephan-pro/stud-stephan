import { describe, expect, it } from "vitest";
import { AuthError } from "./auth";
import { describeAuthContract } from "./auth.contract";
import {
  expireAccessToken,
  FAKE_SUPABASE_URL,
  fakeGoTrue,
  MemoryStore,
  offlineFetch,
  serviceError,
} from "./auth.fixtures";
import { CODE_REQUEST_KEY, SupabaseAuth } from "./supabaseAuth";
import { createSupabaseClient, SESSION_KEY } from "./supabaseClient";

function device(send: typeof fetch, store = new MemoryStore(), now?: () => number) {
  const client = createSupabaseClient({
    url: FAKE_SUPABASE_URL,
    publishableKey: "sb_publishable_test",
    store,
    fetch: send,
  });
  return new SupabaseAuth({ client, store, ...(now === undefined ? {} : { now }) });
}

describeAuthContract("SupabaseAuth (Nachbau des Anmeldedienstes)", async () => {
  let now = Date.now();
  const service = fakeGoTrue({ now: () => now });
  const store = new MemoryStore();
  const newEmail = () => `person-${crypto.randomUUID()}@example.com`;
  const email = newEmail();
  service.addUser(email);
  return {
    email,
    newEmail,
    mailCount: async (address) => service.mailCount(address),
    open: (options) => device(options?.offline ? offlineFetch : service.fetch, store, () => now),
    nextCode: async (address) => service.lastCode(address) ?? "",
    expireCodes: async () => {
      now += 11 * 60_000;
    },
    waitBeforeResend: async () => {
      now += 61_000;
    },
    refuseSessions: async (address) => {
      service.refuseSessions(address);
      expireAccessToken(store);
    },
  };
});

async function failureOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AuthError);
    return (error as AuthError).failure;
  }
  throw new Error("Sollte scheitern");
}

/** A service that answers every request with the given response. */
const answering = (response: () => Response) => (async () => response()) as unknown as typeof fetch;

describe("SupabaseAuth: Fehler des Dienstes werden zu AuthFailure", () => {
  it("P4b Zu viele Versuche, Dienst gestört und Unbekanntes haben eigene Meldungen", async () => {
    const cases: [Response, string, string][] = [
      [serviceError(429, "over_request_rate_limit"), "verify", "tooManyTries"],
      [serviceError(429, "irgendwas"), "request", "tooManyTries"],
      [serviceError(400, "email_address_invalid"), "request", "invalidEmail"],
      [serviceError(400, "validation_failed"), "verify", "wrongCode"],
      [serviceError(500, "unexpected_failure"), "request", "serviceFailed"],
      [serviceError(503, "unavailable"), "request", "serviceFailed"],
      [new Response("<html>Bad Gateway</html>", { status: 502 }), "verify", "serviceFailed"],
      [serviceError(400, "email_provider_disabled"), "request", "unknown"],
      [serviceError(400, "bad_json"), "verify", "unknown"],
      [new Response("kein JSON", { status: 400 }), "request", "unknown"],
    ];
    for (const [response, step, failure] of cases) {
      const auth = device(answering(() => response.clone()));
      const action =
        step === "request" ? auth.requestCode("a@b.de") : auth.verifyCode("a@b.de", "123456");

      expect([step, response.status, await failureOf(action)]).toEqual([
        step,
        response.status,
        failure,
      ]);
    }
  });

  it("P4b Neue Konten sind abgeschaltet: auch diese Antwort des Dienstes sieht aus wie ein verschickter Code", async () => {
    const auth = device(answering(() => serviceError(422, "signup_disabled")));

    await expect(auth.requestCode("fremd@example.com")).resolves.toBeUndefined();
  });

  it("Falsch oder abgelaufen entscheidet das Gerät nach dem Zeitpunkt seiner Anforderung, auch nach dem Neuladen", async () => {
    let now = 0;
    const service = fakeGoTrue({ now: () => now });
    const store = new MemoryStore();
    service.addUser("a@b.de");
    await device(service.fetch, store, () => now).requestCode("a@b.de");

    now += 9 * 60_000;
    expect(await failureOf(device(service.fetch, store, () => now).verifyCode("a@b.de", "1"))).toBe(
      "wrongCode",
    );
    expect(await failureOf(device(service.fetch, store, () => now).verifyCode("c@d.de", "1"))).toBe(
      "expiredCode",
    );
    store.items.set(CODE_REQUEST_KEY, "kaputt");
    expect(await failureOf(device(service.fetch, store, () => now).verifyCode("a@b.de", "1"))).toBe(
      "expiredCode",
    );
  });

  it("Ohne nutzbaren Gerätespeicher klappt die Anmeldung trotzdem; eine kaputte gemerkte Sitzung zählt als abgemeldet", async () => {
    const service = fakeGoTrue();
    const store = new MemoryStore();
    const auth = device(service.fetch, store);
    service.addUser("a@b.de");
    service.addUser("e@f.de");
    await auth.requestCode("a@b.de");
    const code = service.lastCode("a@b.de") ?? "";
    // supabase-js keeps its session in memory as well; only our own notes fail to be written.
    const original = store.setItem.bind(store);
    store.setItem = (key, value) => {
      if (key === CODE_REQUEST_KEY) throw new Error("voll");
      original(key, value);
    };
    store.removeItem = () => {
      throw new Error("gesperrt");
    };

    expect((await auth.verifyCode("a@b.de", code)).email).toBe("a@b.de");
    await expect(auth.requestCode("e@f.de")).resolves.toBeUndefined();

    for (const broken of ["kein JSON", "{}", JSON.stringify({ refresh_token: "r", user: {} })]) {
      store.items.set(SESSION_KEY, broken);
      expect(await auth.session()).toBeNull();
    }
    store.items.set(SESSION_KEY, JSON.stringify({ refresh_token: "r", user: { id: "u-1" } }));
    expect(await auth.session()).toEqual({ userId: "u-1", email: "" });
  });

  it("Antwortet der Dienst ohne Benutzer, ist das ein unbekannter Fehler", async () => {
    const auth = device(answering(() => new Response(JSON.stringify({}), { status: 200 })));

    expect(await failureOf(auth.verifyCode("a@b.de", "123456"))).toBe("unknown");
  });
});
