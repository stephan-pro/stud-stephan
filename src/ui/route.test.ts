import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROUTE,
  detailHash,
  documentTitle,
  formHash,
  locationHash,
  PHONE_NAVIGATION,
  parseLocation,
  parseRoute,
  photoHash,
  ROUTE_PATHS,
  ROUTES,
  routeHash,
  routeLabel,
  SIDEBAR_NAVIGATION,
  searchHash,
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

describe("P6 Adressen der Formulare", () => {
  it.each([
    ["minifig", "figur"],
    ["legoSet", "set"],
    ["specialPart", "sonderteil"],
  ] as const)("P6 Neu erfassen: #/erfassen/%2$s öffnet das Formular für %1$s", (type, path) => {
    const form = { type, mode: "new" } as const;
    expect(formHash(form)).toBe(`#/erfassen/${path}`);
    expect(parseLocation(formHash(form))).toEqual({ route: "capture", form });
  });

  it("P6 Bearbeiten liegt unter der Vitrine und kennt das Objekt", () => {
    const form = { type: "legoSet", mode: "edit", id: "set 1/ä" } as const;
    expect(formHash(form)).toBe("#/vitrine/set/set%201%2F%C3%A4/bearbeiten");
    expect(parseLocation(formHash(form))).toEqual({ route: "showcase", form });
    expect(parseRoute(formHash(form))).toBe("showcase");
  });

  it("P6 Ein weiteres Exemplar gibt es nur für Figuren", () => {
    const form = { type: "minifig", mode: "copy", id: "minifig-rex" } as const;
    expect(formHash(form)).toBe("#/erfassen/figur/kopie/minifig-rex");
    expect(parseLocation(formHash(form))).toEqual({ route: "capture", form });
    expect(parseLocation("#/erfassen/set/kopie/x")).toEqual({ route: "showcase" });
  });

  it("P6 Die Seite „Erfassen“ ohne Art öffnet die Auswahl", () => {
    expect(parseLocation("#/erfassen")).toEqual({ route: "capture" });
    expect(locationHash({ route: "capture" })).toBe("#/erfassen");
    expect(locationHash(parseLocation("#/erfassen/figur/"))).toBe("#/erfassen/figur");
  });

  it.each([
    "#/erfassen/gibtsnicht",
    "#/erfassen/figur/kopie",
    "#/erfassen/figur/kopie/",
    "#/erfassen/figur/kopie/a/b",
    "#/erfassen/figur/etwas/a",
    "#/vitrine/figur/abc/bearbeiten/mehr",
    "#/vitrine/figur/abc/loeschen",
    "#/vitrine/figur/%E0%A4%A/bearbeiten",
    "#/dioramen/figur/abc/bearbeiten",
    "#/erfassen/figur/kopie/%E0%A4%A",
  ])("P6 Die unvollständige Adresse %s öffnet die Vitrine", (hash) => {
    expect(parseLocation(hash)).toEqual({ route: "showcase" });
  });
});

describe("P7 Adressen der Katalogsuche und des Formulars aus dem Katalog", () => {
  it("P7 Die Suche liegt unter Erfassen: #/erfassen/suche/figur und …/set", () => {
    expect(searchHash("minifig")).toBe("#/erfassen/suche/figur");
    expect(searchHash("legoSet")).toBe("#/erfassen/suche/set");
    expect(parseLocation("#/erfassen/suche/figur")).toEqual({
      route: "capture",
      search: "minifig",
    });
    expect(parseLocation("#/erfassen/suche/set/")).toEqual({ route: "capture", search: "legoSet" });
  });

  it("P7 Für Sonderteile und unbekannte Arten gibt es keine Suche", () => {
    expect(parseLocation("#/erfassen/suche/sonderteil")).toEqual({ route: "showcase" });
    expect(parseLocation("#/erfassen/suche/xyz")).toEqual({ route: "showcase" });
  });

  it("P7 Das Formular aus dem Katalog trägt die Nummer in der Adresse", () => {
    const form = { type: "minifig", mode: "catalog", ref: "sw0194" } as const;
    expect(formHash(form)).toBe("#/erfassen/figur/katalog/sw0194");
    expect(parseLocation("#/erfassen/figur/katalog/sw0194")).toEqual({ route: "capture", form });
    const set = { type: "legoSet", mode: "catalog", ref: "75372-1" } as const;
    expect(parseLocation(formHash(set))).toEqual({ route: "capture", form: set });
    const odd = { type: "minifig", mode: "catalog", ref: "fig-014/663" } as const;
    expect(parseLocation(formHash(odd))).toEqual({ route: "capture", form: odd });
  });

  it("P7 Ohne Nummer oder für Sonderteile öffnet sich die Vitrine", () => {
    expect(parseLocation("#/erfassen/sonderteil/katalog/x")).toEqual({ route: "showcase" });
    expect(parseLocation("#/erfassen/figur/katalog/%E0%A4%A")).toEqual({ route: "showcase" });
  });

  it("P7 Die Schreibweise der Suche und des Katalogformulars ist die normale", () => {
    expect(locationHash({ route: "capture", search: "minifig" })).toBe("#/erfassen/suche/figur");
    const form = { type: "legoSet", mode: "catalog", ref: "75372-1" } as const;
    expect(locationHash({ route: "capture", form })).toBe("#/erfassen/set/katalog/75372-1");
  });
});

describe("P8 Adresse der Foto-Erkennung", () => {
  it("P8 Die Foto-Erkennung liegt unter Erfassen: #/erfassen/foto", () => {
    expect(photoHash()).toBe("#/erfassen/foto");
    expect(parseLocation("#/erfassen/foto")).toEqual({ route: "capture", photo: true });
    expect(parseLocation("#/erfassen/foto/")).toEqual({ route: "capture", photo: true });
    expect(locationHash({ route: "capture", photo: true })).toBe("#/erfassen/foto");
  });

  it("P8 Mit weiteren Teilen ist es keine Foto-Erkennung", () => {
    expect(parseLocation("#/erfassen/foto/x")).toEqual({ route: "showcase" });
    expect(parseLocation("#/vitrine/foto")).toEqual({ route: "showcase" });
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
