import { describe, expect, it } from "vitest";
import {
  CACHE_PREFIX,
  cacheName,
  NEVER_CACHED,
  precacheUrls,
  staleCaches,
  strategyFor,
} from "./swPolicy";

const SCOPE = "https://stephan-pro.github.io/stud-stephan/";
const KEPT = new Set(
  precacheUrls(["./", "assets/index-abc.js", "assets/index-def.css", "icons/icon-192.png"], SCOPE),
);

const get = (url: string, mode = "cors") => ({ method: "GET", url, mode });

describe("P15 Service Worker hält nur die App-Dateien vor", () => {
  it("P15 Die Dateiliste wird zu vollen Adressen im Bereich der App, jede nur einmal", () => {
    expect(precacheUrls(["./", "assets/a.js", "assets/a.js"], SCOPE)).toEqual([
      SCOPE,
      `${SCOPE}assets/a.js`,
    ]);
  });

  it("P15 Das Öffnen der App kommt aus dem Speicher (Start ohne Verbindung)", () => {
    expect(strategyFor(get(SCOPE, "navigate"), SCOPE, KEPT)).toBe("shell");
    expect(strategyFor(get(`${SCOPE}index.html?x=1`, "navigate"), SCOPE, KEPT)).toBe("shell");
  });

  it("P15 Eigene Dateien der App kommen aus dem Speicher, auch mit Anhang an der Adresse", () => {
    expect(strategyFor(get(`${SCOPE}assets/index-abc.js`), SCOPE, KEPT)).toBe("file");
    expect(strategyFor(get(`${SCOPE}icons/icon-192.png?v=2`), SCOPE, KEPT)).toBe("file");
  });

  it("P15 Unbekannte Dateien gehen ins Netz und werden nicht gespeichert", () => {
    expect(strategyFor(get(`${SCOPE}assets/other.js`), SCOPE, KEPT)).toBe("network");
  });

  it("P15 Nie zwischengespeichert: Anmeldung, Funktionen, Daten und Dateispeicher", () => {
    for (const part of NEVER_CACHED) {
      const url = `${SCOPE}${part.slice(1)}v1/x`;
      expect(strategyFor(get(url), SCOPE, new Set([url])), part).toBe("network");
      expect(strategyFor(get(url, "navigate"), SCOPE, KEPT), part).toBe("network");
    }
  });

  it("P15 Nie zwischengespeichert: Supabase und andere Server", () => {
    for (const url of [
      "https://ohuqwiypmoqyuxsgouxw.supabase.co/auth/v1/token",
      "https://ohuqwiypmoqyuxsgouxw.supabase.co/functions/v1/catalog",
      "https://ohuqwiypmoqyuxsgouxw.supabase.co/rest/v1/minifigs",
      "https://ohuqwiypmoqyuxsgouxw.supabase.co/storage/v1/object/sign/photos/a.webp?token=x",
      "https://img.bricklink.com/ItemImage/MN/0/sw0194.png",
      "http://localhost:4180/collection",
    ]) {
      expect(strategyFor(get(url), SCOPE, KEPT), url).toBe("network");
    }
    // Another page of the same server outside the app.
    expect(strategyFor(get("https://stephan-pro.github.io/kruemel/"), SCOPE, KEPT)).toBe("network");
  });

  it("P15 Schreibzugriffe werden nie zwischengespeichert", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(strategyFor({ method, url: SCOPE, mode: "navigate" }, SCOPE, KEPT), method).toBe(
        "network",
      );
      expect(
        strategyFor({ method, url: `${SCOPE}assets/index-abc.js`, mode: "cors" }, SCOPE, KEPT),
      ).toBe("network");
    }
  });

  it("P15 Eine unlesbare Adresse geht unberührt ins Netz", () => {
    expect(strategyFor(get("kein:link:::"), SCOPE, KEPT)).toBe("network");
  });

  it("P15 Eine neue Version räumt nur die alten Speicher der App weg", () => {
    expect(cacheName("v2")).toBe(`${CACHE_PREFIX}v2`);
    expect(
      staleCaches(["stud-stephan-v1", "stud-stephan-v2", "kruemel-v1", "other"], "v2"),
    ).toEqual(["stud-stephan-v1"]);
  });
});
