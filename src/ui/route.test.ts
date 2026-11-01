import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROUTE,
  detailHash,
  documentTitle,
  locationHash,
  PHONE_NAVIGATION,
  parseLocation,
  parseRoute,
  ROUTE_PATHS,
  ROUTES,
  routeHash,
  routeLabel,
  SIDEBAR_NAVIGATION,
} from "./route";
import { TEXTS } from "./texts";

describe("P1 Hash-Router", () => {
  it.each([
    ["#/vitrine", "showcase"],
    ["#/dioramen", "dioramas"],
    ["#/erfassen", "capture"],
    ["#/wunschliste", "wishlist"],
    ["#/dashboard", "dashboard"],
    ["#/einstellungen", "settings"],
  ] as const)("P1 Die Adresse %s öffnet die Seite %s", (hash, route) => {
    expect(parseRoute(hash)).toBe(route);
  });

  it("P1 Die Vitrine ist die Startseite", () => {
    expect(DEFAULT_ROUTE).toBe("showcase");
    expect(parseRoute("")).toBe("showcase");
    expect(parseRoute("#")).toBe("showcase");
    expect(parseRoute("#/")).toBe("showcase");
  });

  it("P1 Eine unbekannte Adresse öffnet die Vitrine", () => {
    expect(parseRoute("#/gibt-es-nicht")).toBe("showcase");
    expect(parseRoute("#inhalt")).toBe("showcase");
    expect(parseRoute("#/Dioramen")).toBe("showcase");
  });

  it("P1 Ein Schrägstrich am Ende oder ein fehlender am Anfang stört nicht", () => {
    expect(parseRoute("#/dioramen/")).toBe("dioramas");
    expect(parseRoute("#wunschliste")).toBe("wishlist");
  });

  it("P1 Jede Seite hat genau eine Adresse, und die führt zurück zur Seite", () => {
    expect(new Set(Object.values(ROUTE_PATHS)).size).toBe(ROUTES.length);
    for (const route of ROUTES) {
      expect(parseRoute(routeHash(route))).toBe(route);
    }
    expect(routeHash("dioramas")).toBe("#/dioramen");
  });
});

describe("P5 Adressen der Detailseiten", () => {
  it.each([
    ["minifig", "figur"],
    ["legoSet", "set"],
    ["specialPart", "sonderteil"],
  ] as const)("P5 Die Detailseite %s hat die Adresse #/vitrine/%s/<Kennung>", (type, path) => {
    const detail = { type, id: "abc-1" };
    expect(detailHash(detail)).toBe(`#/vitrine/${path}/abc-1`);
    expect(parseLocation(detailHash(detail))).toEqual({ route: "showcase", detail });
  });

  it("P5 Sonderzeichen in der Kennung überstehen die Adresse", () => {
    const detail = { type: "minifig", id: "ä b/c#?" } as const;
    expect(parseLocation(detailHash(detail)).detail).toEqual(detail);
  });

  it("P5 Eine Detailseite zählt in der Navigation zur Vitrine", () => {
    expect(parseRoute("#/vitrine/set/set-1")).toBe("showcase");
  });

  it.each([
    "#/vitrine/figur",
    "#/vitrine/figur/",
    "#/vitrine/gibtsnicht/abc",
    "#/vitrine/figur/abc/mehr",
    "#/dioramen/figur/abc",
    "#/vitrine/figur/%E0%A4%A",
  ])("P5 Die unvollständige Adresse %s öffnet die Vitrine", (hash) => {
    expect(parseLocation(hash)).toEqual({ route: "showcase" });
  });

  it("P5 Die übliche Schreibweise einer Adresse", () => {
    expect(locationHash({ route: "dioramas" })).toBe("#/dioramen");
    expect(locationHash(parseLocation("#/vitrine/figur/x/"))).toBe("#/vitrine/figur/x");
  });

  it("P5 Der Titel einer Detailseite ist der Name des Objekts", () => {
    expect(documentTitle("showcase", "Captain Rex")).toBe("Captain Rex – Stud Stephan");
  });
});

describe("P1 Navigation", () => {
  it("P1 Handy: Vitrine · Dioramen · Plus · Wunschliste · Dashboard", () => {
    expect(PHONE_NAVIGATION.map(routeLabel)).toEqual([
      "Vitrine",
      "Dioramen",
      "Erfassen",
      "Wunschliste",
      "Dashboard",
    ]);
  });

  it("P1 PC: dieselben Einträge in der Seitenleiste, Erfassen als eigener Knopf darüber", () => {
    expect(SIDEBAR_NAVIGATION).toEqual(PHONE_NAVIGATION.filter((route) => route !== "capture"));
  });

  it("P1 Jede Seite hat einen Namen und einen Text, was dort kommt", () => {
    for (const route of ROUTES) {
      expect(TEXTS.routes[route].label.length).toBeGreaterThan(0);
      expect(TEXTS.routes[route].comingSoon.length).toBeGreaterThan(20);
    }
  });

  it("P1 Der Titel im Browser-Tab nennt Seite und App", () => {
    expect(documentTitle("dioramas")).toBe("Dioramen – Stud Stephan");
  });
});
