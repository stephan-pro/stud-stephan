import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROUTE,
  documentTitle,
  PHONE_NAVIGATION,
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
