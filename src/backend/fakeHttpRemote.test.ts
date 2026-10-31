import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aMinifig } from "../domain/fixtures";
import { createFakeHttpRemote } from "./fakeHttpRemote";
import { type RunningFakeServer, startFakeHttpServer } from "./fakeHttpServer";
import { describeRemoteContract } from "./remote.contract";

let running: RunningFakeServer;

beforeAll(async () => {
  running = await startFakeHttpServer(0);
});

afterAll(async () => {
  await running.close();
});

async function account(): Promise<string> {
  const response = await fetch(`${running.url}/test/user`, { method: "POST" });
  return ((await response.json()) as { token: string }).token;
}

describeRemoteContract("FakeHttpRemote (Fake-Server über HTTP)", async () => ({
  a: createFakeHttpRemote({ baseUrl: running.url, token: await account() }),
  b: createFakeHttpRemote({ baseUrl: running.url, token: await account() }),
}));

describe("Fake-Server", () => {
  it("Antwortet auf die Bereitschaftsprüfung", async () => {
    const response = await fetch(`${running.url}/health`);
    expect(await response.json()).toBe("ok");
  });

  it("Ohne gültigen Schlüssel scheitert der Aufruf vorübergehend (wie eine abgelaufene Sitzung)", async () => {
    const remote = createFakeHttpRemote({ baseUrl: running.url, token: "falsch" });

    await expect(remote.load()).rejects.toMatchObject({ permanent: false });
  });

  it("Server nicht erreichbar → vorübergehender Fehler", async () => {
    const remote = createFakeHttpRemote({ baseUrl: "http://localhost:1", token: "x" });

    await expect(remote.save("minifig", aMinifig())).rejects.toMatchObject({ permanent: false });
  });

  it("Unbekannte Adressen und unlesbare Daten werden abgelehnt", async () => {
    const token = await account();
    const headers = { Authorization: `Bearer ${token}` };

    const unknown = await fetch(`${running.url}/gibt-es-nicht`, { headers });
    const broken = await fetch(`${running.url}/objects/minifig?schemaVersion=1`, {
      method: "POST",
      headers,
      body: "{kein json",
    });
    const badPath = await fetch(`${running.url}/files/photos/%E0%A4%A`, { headers });

    expect([unknown.status, broken.status, badPath.status]).toEqual([404, 400, 400]);
    expect(await broken.json()).toEqual({ reason: "invalid_object" });
  });

  it("Erlaubt Aufrufe aus dem Browser (CORS)", async () => {
    const response = await fetch(`${running.url}/collection`, { method: "OPTIONS" });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });
});
