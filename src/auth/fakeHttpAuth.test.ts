import { describe, expect, it } from "vitest";
import { FakeServer } from "../backend/fakeServer";
import { fetchFrom } from "../backend/fakeServer.fixtures";
import { AuthError } from "./auth";
import { describeAuthContract } from "./auth.contract";
import { MemoryStore, offlineFetch } from "./auth.fixtures";
import { FAKE_AUTH_KEY, FakeHttpAuth, fakeAuthToken } from "./fakeHttpAuth";

const BASE = "http://fake.test";

const newEmail = () => `person-${crypto.randomUUID()}@example.com`;

describeAuthContract("FakeHttpAuth (über den Fake-Server)", async () => {
  let now = 1_000_000;
  const server = new FakeServer({ auth: { now: () => now } });
  const store = new MemoryStore();
  const email = newEmail();
  server.auth.addUser(email);
  return {
    email,
    newEmail,
    mailCount: async (address) => server.auth.mailCount(address),
    open: (options) =>
      new FakeHttpAuth({
        baseUrl: BASE,
        store,
        fetch: options?.offline ? offlineFetch : fetchFrom(server),
      }),
    nextCode: async (address) => server.auth.lastCode(address) ?? "",
    expireCodes: async () => {
      now += 11 * 60_000;
    },
    waitBeforeResend: async () => {
      now += 61_000;
    },
    refuseSessions: async (address) => server.auth.signOutEverywhere(address),
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

describe("FakeHttpAuth und die Anmeldung am Fake-Server", () => {
  it("Der Test liest den Code über /test/code; das Geheimnis der Anmeldung öffnet die eigene Sammlung", async () => {
    const server = new FakeServer({ auth: { newCode: () => "424242" } });
    const send = fetchFrom(server);
    const store = new MemoryStore();
    const auth = new FakeHttpAuth({ baseUrl: BASE, store, fetch: send });
    server.auth.addUser("a@b.de");

    expect((await send(`${BASE}/test/code?email=a@b.de`)).status).toBe(404);
    await auth.requestCode("a@b.de");
    expect(await (await send(`${BASE}/test/code?email=a@b.de`)).json()).toEqual({ code: "424242" });
    await auth.verifyCode("a@b.de", "424242");

    const headers = { Authorization: `Bearer ${fakeAuthToken(store)}` };
    expect((await send(`${BASE}/collection`, { headers })).status).toBe(200);
    expect(await (await send(`${BASE}/auth/session`, { headers })).json()).toEqual({
      userId: expect.any(String),
      email: "a@b.de",
    });
    expect((await send(`${BASE}/auth/session`)).status).toBe(401);
    expect((await send(`${BASE}/auth/gibtsnicht`, { headers })).status).toBe(404);
  });

  it("/test/user legt ein Konto von Hand an und meldet es an, mit oder ohne Adresse", async () => {
    const server = new FakeServer();
    const send = fetchFrom(server);
    const made = async (body?: object) =>
      (await (
        await send(`${BASE}/test/user`, {
          method: "POST",
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        })
      ).json()) as { token: string; owner: string; email: string };

    const stephan = await made({ email: "Stephan@Beispiel.de" });
    const other = await made();

    expect(stephan.email).toBe("stephan@beispiel.de");
    expect(other.email).toMatch(/^test-.+@beispiel\.de$/);
    expect(server.auth.sessionFor(stephan.token)).toEqual({
      userId: stephan.owner,
      email: "stephan@beispiel.de",
    });
    const refused = await send(`${BASE}/test/user`, {
      method: "POST",
      body: JSON.stringify({ email: "kaputt" }),
    });
    expect([refused.status, await refused.json()]).toEqual([400, { failure: "invalidEmail" }]);
    const unreadable = await send(`${BASE}/auth/code`, { method: "POST", body: "{kein json" });
    expect([unreadable.status, await unreadable.json()]).toEqual([
      400,
      { reason: "invalid_object" },
    ]);
  });

  it("P4b Nach fünf falschen Versuchen ist der Code verbraucht (steht für die Grenze des echten Dienstes)", async () => {
    const server = new FakeServer({ auth: { newCode: () => "111111" } });
    const auth = new FakeHttpAuth({
      baseUrl: BASE,
      store: new MemoryStore(),
      fetch: fetchFrom(server),
    });
    server.auth.addUser("a@b.de");
    await auth.requestCode("a@b.de");
    for (let tries = 0; tries < 5; tries++) {
      expect(await failureOf(auth.verifyCode("a@b.de", "000000"))).toBe("wrongCode");
    }

    expect(await failureOf(auth.verifyCode("a@b.de", "111111"))).toBe("tooManyTries");
    expect(await failureOf(auth.verifyCode("a@b.de", "111111"))).toBe("expiredCode");
  });

  it("Antworten ohne Sitzung, Serverfehler und kaputter Speicher werden sauber behandelt", async () => {
    const store = new MemoryStore();
    const answering = (response: Response) =>
      new FakeHttpAuth({
        baseUrl: BASE,
        store,
        fetch: (async () => response.clone()) as unknown as typeof fetch,
      });

    expect(await failureOf(answering(Response.json({})).verifyCode("a@b.de", "1"))).toBe("unknown");
    expect(
      await failureOf(answering(new Response("x", { status: 502 })).requestCode("a@b.de")),
    ).toBe("serviceFailed");
    expect(
      await failureOf(
        answering(Response.json({ failure: "?" }, { status: 400 })).requestCode("a@b.de"),
      ),
    ).toBe("unknown");

    store.items.set(FAKE_AUTH_KEY, "kein JSON");
    expect(await answering(Response.json({})).session()).toBeNull();
    expect(fakeAuthToken(store)).toBeUndefined();
    await answering(Response.json({})).signOut();
  });
});
