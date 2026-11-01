// All texts of the interface in one place (CLAUDE.md: never scattered in components).

import { type AuthFailure, CODE_DIGITS, CODE_MINUTES } from "../auth/auth";
import type { Route } from "./route";

interface RouteTexts {
  /** Name in the navigation, heading and browser tab. */
  readonly label: string;
  /** What the still empty page will show (P1: the pages have no content yet). */
  readonly comingSoon: string;
}

export const TEXTS = {
  appName: "Stud Stephan",
  greeting: "Hey Stephan",
  avatarInitial: "S",
  skipLink: "Zum Inhalt springen",
  mainNavigation: "Hauptnavigation",
  back: "Zurück",
  comingSoonTitle: "Kommt bald",
  routes: {
    showcase: {
      label: "Vitrine",
      comingSoon:
        "Hier stehen bald deine Figuren, Sets und Sonderteile als großes Bildraster – mit Wert, Filtern und Sortierung.",
    },
    dioramas: {
      label: "Dioramen",
      comingSoon:
        "Hier erscheinen bald deine Dioramen mit Fotos, Studio-Dateien und den Figuren, die darin stehen.",
    },
    capture: {
      label: "Erfassen",
      comingSoon:
        "Hier erfasst du bald Neues: per Foto, per Nummer oder Suche, per Link oder ganz von Hand.",
    },
    wishlist: {
      label: "Wunschliste",
      comingSoon:
        "Hier sammelst du bald deine Wünsche mit Priorität und Zielpreis und siehst, welche Figuren einer Reihe dir noch fehlen.",
    },
    dashboard: {
      label: "Dashboard",
      comingSoon:
        "Hier siehst du bald alle Zahlen: Gesamtwert und Verlauf, Kaufsumme, Ausgaben für Mods und deine wertvollsten Stücke.",
    },
    settings: {
      label: "Einstellungen",
      comingSoon:
        "Hier findest du bald den Stand der Datenquellen und des Preisabrufs, die Datensicherung und die Version der App.",
    },
  } satisfies Record<Route, RouteTexts>,
  /** S0 sign-in (P4b): address, then the code from the mail. */
  signIn: {
    tabTitle: "Anmelden",
    tagline: "Deine Sammlung. Eine Vitrine.",
    title: "Anmelden",
    emailLabel: "E-Mail",
    emailPlaceholder: "deine@mail.de",
    sendCode: "Code senden",
    sending: "Wird gesendet …",
    intro:
      "Kein Passwort nötig. Du bekommst einen Code per Mail und bleibst auf diesem Gerät angemeldet.",
    codeTitle: "Code eingeben",
    /** Neutral: the same for every address, whether it has an account or not. */
    codeSent: (email: string) =>
      `Wenn ${email} zu Stud Stephan gehört, ist jetzt eine Mail mit einem ${CODE_DIGITS}-stelligen Code unterwegs. Er gilt ${CODE_MINUTES} Minuten.`,
    codeLabel: "Code aus der Mail",
    verify: "Anmelden",
    verifying: "Wird geprüft …",
    codeFormat: `Der Code hat ${CODE_DIGITS} Ziffern. Tipp ihn bitte vollständig ein.`,
    resendWait:
      "Keine Mail da? Schau im Spam-Ordner nach. Einen neuen Code kannst du nach einer Minute anfordern.",
    resendReady: "Keine Mail da? Schau im Spam-Ordner nach oder fordere einen neuen Code an.",
    resend: "Neuen Code senden",
    resent: "Ein neuer Code ist unterwegs.",
    otherEmail: "Andere Adresse",
    failures: {
      invalidEmail: "Das sieht nicht nach einer E-Mail-Adresse aus. Prüf bitte die Schreibweise.",
      wrongCode: "Der Code stimmt nicht. Prüf die Ziffern und versuch es noch einmal.",
      expiredCode: "Der Code ist abgelaufen oder schon benutzt. Fordere bitte einen neuen Code an.",
      tooManyTries: "Zu viele Versuche. Warte eine Minute und versuch es dann noch einmal.",
      offline: "Keine Verbindung zum Server. Prüf das Internet und versuch es noch einmal.",
      serviceFailed:
        "Der Code konnte gerade nicht verschickt oder geprüft werden. Versuch es in ein paar Minuten noch einmal.",
      unknown: "Das hat nicht geklappt. Versuch es bitte später noch einmal.",
    } satisfies Record<AuthFailure, string>,
  },
  /** The storage card in the settings (S12): what the files take of the free space. */
  storage: {
    title: "Speicherplatz",
    loading: "Wird geladen …",
    used: (used: string, limit: string) => `${used} von ${limit} belegt`,
    meter: "Belegter Speicherplatz",
    failed: "Der Speicherplatz konnte gerade nicht gelesen werden.",
    retry: "Noch einmal versuchen",
  },
  manufacturers: { lego: "LEGO", bluebrixx: "Bluebrixx" },
  conditions: { new: "Neu", used: "Gebraucht" },
  setStatus: {
    complete: "Vollständig",
    figuresRemoved: "Figuren entnommen",
    disassembled: "Zerlegt",
  },
  specialPartKinds: {
    gwp: { chip: "GWP", long: "Gratisbeigabe (GWP)" },
    coin: { chip: "Sammelmünze", long: "Sammelmünze" },
    other: { chip: "Sonstiges", long: "Sonstiges" },
  },
  modPositions: {
    head: "Kopf",
    torso: "Torso",
    arms: "Arme",
    hands: "Hände",
    legs: "Beine",
    headgear: "Kopfbedeckung",
    accessory: "Zubehör",
    other: "Sonstiges",
  },
  /** Bar at the top when the device has no connection. */
  offline:
    "Keine Verbindung. Was schon geladen ist, bleibt lesbar; neue Daten gibt es erst wieder mit Verbindung.",
  /** S1 showcase (P5). */
  showcase: {
    searchOpen: "Suchen",
    searchClose: "Suche schließen",
    searchLabel: "Sammlung durchsuchen",
    searchPlaceholder: "In der Sammlung suchen",
    card: {
      lead: "Deine Sammlung ist",
      worth: "wert",
      figures: (count: number) => (count === 1 ? "1 Figur" : `${count} Figuren`),
      sets: (count: number) => (count === 1 ? "1 Set" : `${count} Sets`),
      dioramas: (count: number) => (count === 1 ? "1 Diorama" : `${count} Dioramen`),
    },
    typeGroup: "Objektart",
    types: { all: "Alle", minifig: "Figuren", legoSet: "Sets", specialPart: "Sonderteile" },
    sortLabel: "Sortieren nach",
    sorts: { recent: "Zuletzt hinzugefügt", name: "Name", value: "Wert" },
    filterButton: "Filter",
    filterButtonActive: (count: number) => `Filter, ${count} aktiv`,
    results: (count: number) => (count === 1 ? "1 Ergebnis" : `${count} Ergebnisse`),
    loading: "Die Sammlung wird geladen …",
    tile: {
      copies: (count: number) => `×${count}`,
      modified: "Mod",
      withoutDiorama: "Kein Diorama",
      set: "Set",
      withoutValue: "ohne Wert",
    },
    empty: {
      title: "Deine Vitrine ist noch leer",
      text: "Sobald du die erste Figur, ein Set oder ein Sonderteil erfasst, steht es hier.",
      action: "Erste Figur erfassen",
    },
    noResults: {
      title: "Nichts gefunden",
      text: "Zu dieser Suche und diesen Filtern passt nichts in deiner Sammlung.",
      reset: "Suche und Filter zurücksetzen",
    },
    loadFailed: {
      title: "Die Sammlung konnte nicht geladen werden",
      text: "Prüf das Internet und versuch es noch einmal.",
      retry: "Noch einmal versuchen",
    },
    copies: {
      title: (name: string) => `${name}: welches Exemplar?`,
      text: (count: number) => `Du hast diese Figur ${count}-mal.`,
      close: "Schließen",
      acquired: (month: string) => `Erworben ${month}`,
      mods: (count: number) => (count === 1 ? "1 Mod" : `${count} Mods`),
    },
  },
  /** S1a filter (P5): a bottom sheet on the phone, a side panel on the PC. */
  filter: {
    title: "Filter",
    close: "Schließen",
    theme: "Thema / Reihe",
    manufacturer: "Hersteller",
    manufacturers: { lego: "LEGO", bluebrixx: "Bluebrixx", other: "Andere", custom: "Custom" },
    condition: "Zustand",
    modified: "Modifiziert",
    modifiedOptions: { any: "Egal", yes: "Ja", no: "Nein" },
    withoutDiorama: "Nur Figuren ohne Diorama",
    reset: "Zurücksetzen",
    show: (count: number) => (count === 1 ? "1 Ergebnis anzeigen" : `${count} Ergebnisse anzeigen`),
  },
  /** S2, S3 and S4 detail pages (P5). */
  detail: {
    back: "Zurück zur Vitrine",
    gallery: "Fotos",
    photoCounter: (index: number, count: number) => `${index} / ${count}`,
    photoAlt: (name: string, index: number, count: number) => `${name}, Foto ${index} von ${count}`,
    catalogAlt: (name: string) => `${name}, Katalogbild`,
    modified: "Modifiziert",
    notFound: {
      title: "Nicht gefunden",
      text: "Dieses Objekt gibt es nicht (mehr) in deiner Sammlung.",
    },
    value: {
      market: (condition: string) => `Marktwert, ${condition}`,
      manual: "Wert (selbst geschätzt)",
      purchase: "Kaufpreis als Wert",
      none: "Noch kein Wert",
      withoutValue: "ohne Wert",
      purchasePrice: "Kaufpreis",
      difference: "Differenz",
      otherCondition: (condition: string, price: string) => `${condition}: ${price}`,
      asOfMarket: (date: string) => `Stand vom ${date} · BrickLink`,
      asOfManual: (date: string) => `Eingetragen am ${date}`,
      noMarket: "Kein Marktpreis verfügbar",
      noMarketPurchase: "Kein Marktpreis verfügbar. Der Kaufpreis gilt als Wert.",
      noValueAtAll: "Kein Marktpreis und kein Wert eingetragen. Zählt mit 0 €.",
      history: (from: string, fromDate: string, to: string, toDate: string) =>
        `Verlauf des Marktwerts: ${from} am ${fromDate}, ${to} am ${toDate}`,
    },
    origin: {
      title: "Herkunft",
      kind: "Art",
      number: "Nummer",
      source: "Quelle",
      acquired: "Erworben",
      purchasePrice: "Kaufpreis",
      fromSet: "Stammt aus Set",
    },
    diorama: {
      title: "Diorama",
      none: "Diese Figur steht in keinem Diorama.",
    },
    mods: {
      title: "Modifikationen",
      count: (count: number) => (count === 1 ? "1 Teil" : `${count} Teile`),
      original: (where: string) => `Original ${where}`,
      spend: "Ausgaben für Mods",
      notInValue: "zählt nicht zum Wert",
    },
    copies: {
      title: "Exemplare",
      once: "Du hast diese Figur einmal.",
      several: (count: number) => `Du hast diese Figur ${count}-mal. Die anderen Exemplare:`,
    },
    note: "Notiz",
    links: "Links",
    set: {
      title: "Set",
      pieces: "Teile",
      figures: "Figuren laut Katalog",
      figuresTitle: "Enthaltene Figuren",
      progress: (have: number, total: number) => `${have} / ${total}`,
      progressLabel: (have: number, total: number) => `${have} von ${total} Figuren vorhanden`,
      missing: "fehlt",
      quantity: (count: number) => `×${count}`,
      noFigures: "Zu diesem Set sind noch keine Figuren angegeben.",
    },
  },
  /** The account card in the settings (S12). */
  account: {
    label: "Konto",
    name: "Stephan",
    signOut: "Abmelden",
    demo: "Beispieldaten, ohne Anmeldung",
  },
} as const;
