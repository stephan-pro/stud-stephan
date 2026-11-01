// P14: the state of the four data sources for the settings (S12, card "Datenquellen").
import { describe, expect, it } from "vitest";
import {
  brickLinkFailure,
  brickLinkRoutes,
  fakeFetch,
  ok,
  type Route,
} from "./catalog.fixtures.ts";
import { catalogHandlerDeps } from "./environment.ts";
import { handleCatalog } from "./handler.ts";
import { CatalogError } from "./json.ts";
import { bricklinkProbe, checkSources } from "./sourcesService.ts";
import { SOURCE_IDS, type SourcesAnswer } from "./sourcesTypes.ts";

const ENV: Record<string, string> = {
  SUPABASE_URL: "https://projekt.supabase.co",
  REBRICKABLE_API_KEY: "zz-rk",
  BRICKLINK_CONSUMER_KEY: "zz-ck",
  BRICKLINK_CONSUMER_SECRET: "zz-cs",
  BRICKLINK_TOKEN_VALUE: "zz-tv",
  BRICKLINK_TOKEN_SECRET: "zz-ts",
};

const AUTH: Route = ["/auth/v1/user", ok({ id: "u" })];
const REBRICKABLE: Route = ["/lego/themes/", ok({ count: 1, results: [] })];
const BRICKOGNIZE: Route = ["api.brickognize.com", () => new Response("", { status: 405 })];
const MERLIN: Route = ["merlinssteine.de", () => new Response("<html></html>", { status: 200 })];
const WORKING: Route[] = [AUTH, REBRICKABLE, ...brickLinkRoutes(), BRICKOGNIZE, MERLIN];

function post(body: unknown): Request {
  return new Request("https://projekt.supabase.co/functions/v1/catalog", {
    method: "POST",
    headers: { Authorization: "Bearer jwt", apikey: "pk", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function sourcesOf(
  routes: Route[],
  env: Record<string, string | undefined> = ENV,
): Promise<SourcesAnswer> {
  const deps = catalogHandlerDeps((name) => env[name], fakeFetch(routes));
  const response = await handleCatalog(post({ op: "sources" }), deps);
  expect(response.status).toBe(200);
  return (await response.json()) as SourcesAnswer;
}

describe("Datenquellen (Funktion catalog, op sources)", () => {
  it("S12 Mit Schlüsseln und erreichbaren Diensten ist alles in Ordnung", async () => {
    expect(await sourcesOf(WORKING)).toEqual({
      op: "sources",
      sources: { rebrickable: "ok", bricklink: "ok", brickognize: "ok", merlin: "ok" },
    });
  });

  it("S12 Fehlen die Schlüssel, heißt es „nicht verbunden“; die Dienste ohne Schlüssel sind trotzdem erreichbar", async () => {
    const { sources } = await sourcesOf(WORKING, { SUPABASE_URL: ENV.SUPABASE_URL });

    expect(sources).toEqual({
      rebrickable: "missingKeys",
      bricklink: "missingKeys",
      brickognize: "ok",
      merlin: "ok",
    });
  });

  it("S12 Ein Schlüssel, den der Dienst abweist, ist „abgelehnt“", async () => {
    const { sources } = await sourcesOf([
      AUTH,
      ["/lego/themes/", () => new Response("", { status: 401 })],
      ["/items/SET/", brickLinkFailure(401, "TOKEN_VALUE_INVALID")],
      BRICKOGNIZE,
      MERLIN,
    ]);

    expect(sources).toMatchObject({ rebrickable: "refused", bricklink: "refused" });
  });

  it("S12 Ein Dienst mit Serverfehler oder ohne Antwort ist „nicht erreichbar“", async () => {
    const down = () => new Response("", { status: 503 });
    const { sources } = await sourcesOf([
      AUTH,
      ["/lego/themes/", down],
      ["/items/SET/", brickLinkFailure(500, "INTERNAL_SERVER_ERROR")],
      ["api.brickognize.com", down],
      ["merlinssteine.de", () => Promise.reject(new Error("offline")) as never],
    ]);

    expect(sources).toEqual({
      rebrickable: "unreachable",
      bricklink: "unreachable",
      brickognize: "unreachable",
      merlin: "unreachable",
    });
  });

  it("S12 Ist das Tageslimit von BrickLink erreicht, gilt der Schlüssel trotzdem als verbunden", async () => {
    const limited = bricklinkProbe({
      item: async () => {
        throw new CatalogError("limit_reached", "Tageslimit");
      },
    } as never);
    const unknown = bricklinkProbe({
      item: async () => {
        throw new Error("kaputt");
      },
    } as never);

    expect(await limited()).toBe("ok");
    expect(await unknown()).toBe("unreachable");
  });

  it("S12 Eine Prüfung, die selbst scheitert, ist „nicht erreichbar“, und die anderen laufen weiter", async () => {
    const answer = await checkSources({
      rebrickable: async () => {
        throw new Error("kaputt");
      },
      bricklink: async () => "ok",
      brickognize: async () => "refused",
      merlin: async () => "missingKeys",
    });

    expect(answer.sources).toEqual({
      rebrickable: "unreachable",
      bricklink: "ok",
      brickognize: "refused",
      merlin: "missingKeys",
    });
    expect(Object.keys(answer.sources)).toEqual([...SOURCE_IDS]);
  });

  it("S12 Die Antwort enthält keinen Schlüssel", async () => {
    const answer = JSON.stringify(await sourcesOf(WORKING));

    for (const secret of Object.values(ENV).filter((value) => value.startsWith("zz-"))) {
      expect(answer).not.toContain(secret);
    }
  });

  it("S12 Ohne Anmeldung gibt es keine Antwort und keinen Abruf", async () => {
    const log: string[] = [];
    const deps = catalogHandlerDeps(
      (name) => ENV[name],
      fakeFetch([["/auth/v1/user", () => new Response("", { status: 401 })], ...WORKING], log),
    );

    const response = await handleCatalog(post({ op: "sources" }), deps);

    expect(response.status).toBe(401);
    expect(log).toEqual(["GET https://projekt.supabase.co/auth/v1/user"]);
  });

  it("S12 Eine Umgebung ohne Prüfungen antwortet „nicht verfügbar“", async () => {
    const deps = { signedIn: async () => true, services: () => undefined };

    const response = await handleCatalog(post({ op: "sources" }), deps);

    expect(response.status).toBe(502);
  });
});
