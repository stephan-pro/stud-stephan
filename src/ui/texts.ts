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
  /** The account card in the settings (S12). */
  account: {
    label: "Konto",
    name: "Stephan",
    signOut: "Abmelden",
    demo: "Beispieldaten, ohne Anmeldung",
  },
} as const;
