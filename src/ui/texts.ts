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
    show: (count: number) => `${count} anzeigen`,
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
  /** Actions of a detail page (P6). */
  actions: {
    edit: "Bearbeiten",
    copy: "Weiteres Exemplar anlegen",
    remove: "Löschen",
  },
  /** S7: what to capture and how (P6: only by hand; the rest comes with P7, P8 and later). */
  capture: {
    title: "Was erfassen?",
    close: "Schließen",
    what: {
      minifig: "Figur",
      legoSet: "Set",
      specialPart: "Sonderteil",
      diorama: "Diorama",
      wish: "Wunsch",
    },
    how: "Wie?",
    ways: {
      photo: { title: "Foto", text: "Die App erkennt offizielle Figuren" },
      search: { title: "Nummer oder Suche", text: "z. B. sw0631 oder „Clone Trooper“" },
      link: { title: "Link einfügen", text: "Rebrickable, Merlins Steine, Hersteller" },
      manual: { title: "Manuell", text: "Für Customs und alles ohne Katalog" },
    },
    soon: "Kommt bald",
    onlyFigures: "Erkannt werden nur Figuren",
    noCatalogForParts: "Für Sonderteile gibt es keinen Katalog",
    later: "Diorama und Wunsch kommen bald.",
  },
  /** S7b search in the catalog (P7, F2). */
  search: {
    tabTitle: "Suchen",
    title: "Suchen",
    back: "Zurück zum Erfassen",
    label: "Nummer oder Name",
    placeholder: {
      minifig: "z. B. sw0194 oder Captain Rex",
      legoSet: "z. B. 75372 oder Battle Pack",
    },
    kinds: { minifig: "Figuren", legoSet: "Sets" },
    kindsLabel: "Was suchen?",
    idle: "Gib eine Nummer oder einen Namen ein. Die Nummer einer Figur ist die BrickLink-Nummer, z. B. sw0194.",
    searching: "Suche läuft …",
    results: (count: number) =>
      count === 1 ? "1 Treffer im Katalog" : `${count} Treffer im Katalog`,
    none: "Kein Treffer im Katalog.",
    noneHint: "Prüf die Schreibweise oder leg es von Hand an.",
    pick: (name: string) => `${name} übernehmen`,
    manual: "Nichts dabei? Manuell anlegen",
    failed: {
      offline:
        "Der Katalog ist gerade nicht erreichbar. Prüf deine Verbindung oder leg es von Hand an.",
      unavailable:
        "Der Katalog antwortet gerade nicht. Versuch es später noch einmal oder leg es von Hand an.",
      limit_reached:
        "Für heute sind alle Katalog-Abfragen verbraucht. Morgen geht es wieder; von Hand anlegen geht immer.",
      not_signed_in: "Du bist nicht mehr angemeldet. Melde dich neu an.",
    },
    retry: "Noch einmal suchen",
    unknownNumber: "Nummer unbekannt",
    facts: (facts: readonly string[]) => facts.join(" · "),
    imageAlt: (name: string) => `${name}, Katalogbild`,
  },
  /** S7a photo recognition (P8, F1). */
  recognition: {
    title: "Foto-Erkennung",
    back: "Zurück zum Erfassen",
    empty:
      "Mach ein Foto der Figur oder wähl eins aus. Am besten steht sie vor ruhigem Hintergrund und ist ganz zu sehen.",
    pick: "Foto aufnehmen oder wählen",
    again: "Neues Foto",
    yourPhoto: "Dein Foto",
    photoAlt: "Dein Foto der Figur",
    resizing: "Foto wird verkleinert …",
    recognizing: "Wird erkannt …",
    suggestions: (count: number) => (count === 1 ? "1 Vorschlag" : `${count} Vorschläge`),
    scoreLabel: "Trefferquote",
    choose: (name: string, percent: string) => `${name}, ${percent}, übernehmen`,
    none: {
      title: "Keine Figur erkannt",
      text: "Probier ein anderes Foto, oder such die Figur per Nummer.",
    },
    notFitting: "Keiner passt – per Nummer suchen",
    failed: {
      title: "Erkennung gerade nicht erreichbar",
      offline: "Prüf deine Verbindung. Per Nummer geht es auch ohne Foto-Erkennung.",
      unavailable: "Der Dienst antwortet gerade nicht. Versuch es später noch einmal.",
      limit_reached: "Der Dienst ist gerade überlastet. Versuch es später noch einmal.",
      not_signed_in: "Du bist nicht mehr angemeldet. Melde dich neu an.",
      unreadable: "Dieses Foto konnte nicht gelesen werden. Nimm ein anderes.",
    },
    retry: "Noch einmal erkennen",
    byNumber: "Per Nummer weiter",
  },
  /** S7c capture by link (P9, F3). */
  linkCapture: {
    title: "Link einfügen",
    back: "Zurück zum Erfassen",
    label: "Link",
    placeholder: "Rebrickable, Merlins Steine oder Hersteller-Seite",
    paste: "Aus Zwischenablage einfügen",
    pasteFailed: "Die Zwischenablage ließ sich nicht lesen. Füg den Link von Hand ein.",
    idle: "Füg einen Link ein: ein Set von Rebrickable oder BrickLink, eine Seite der Merlins Steine SetDB oder die Seite eines Herstellers. Gelesen wird nur diese eine Seite.",
    reading: "Link wird gelesen …",
    notAnAddress: "Das ist keine Web-Adresse. Sie beginnt mit https://.",
    recognized: "Erkannt",
    sources: {
      rebrickable: "Rebrickable",
      bricklink: "BrickLink",
      merlin: "Merlins Steine SetDB",
      page: "Webseite",
    },
    rows: {
      name: "Name",
      manufacturer: "Hersteller",
      number: { minifig: "Nummer", legoSet: "Setnummer", specialPart: "Nummer" },
      pieceCount: "Teilezahl",
      image: "Bild",
      kind: "Art",
      catalogNumber: "Nummer",
    },
    kinds: { minifig: "Figur", legoSet: "Set" },
    imageTaken: "übernommen",
    pleaseAdd: "bitte ergänzen",
    catalogNote: "Name, Teile und Bild holt die App gleich aus dem Katalog.",
    next: "Weiter",
    imageAlt: "Vorschaubild der Seite",
    nothingFound: {
      title: "Aus dieser Seite ließ sich nichts lesen",
      text: "Das Formular öffnet sich trotzdem, der Link wird gespeichert. Die Angaben trägst du selbst ein.",
    },
    failed: {
      title: "Die Seite lässt sich nicht lesen",
      blocked:
        "Diese Adresse darf die App nicht abrufen. Gelesen werden nur öffentliche Webseiten (http oder https).",
      unreachable:
        "Die Seite antwortet nicht, ist zu groß oder keine normale Webseite. Der Link lässt sich trotzdem speichern.",
      offline: "Prüf deine Verbindung. Der Link lässt sich trotzdem speichern.",
      unavailable: "Das Lesen von Links geht gerade nicht. Der Link lässt sich trotzdem speichern.",
      not_signed_in: "Du bist nicht mehr angemeldet. Melde dich neu an.",
    },
    retry: "Noch einmal lesen",
    withoutPreview: "Ohne Vorschau weiter – Link wird gespeichert",
  },
  /** S8 filled from the catalog (P7) or from a link (P9). */
  catalogForm: {
    linkBanner: "Grüne Felder stammen aus dem Link. Du kannst sie ändern.",
    linkPrefilledNote: "Aus dem Link übernommen",
    linkLoading: "Der Link wird gelesen …",
    linkUnreadable:
      "Die Seite ließ sich nicht lesen. Der Link ist gespeichert; trag die Angaben selbst ein.",
    banner: "Grüne Felder kommen aus dem Katalog. Du kannst sie ändern.",
    loading: "Der Katalogeintrag wird geholt …",
    failed: {
      title: "Der Katalogeintrag kommt nicht an",
      text: "Du kannst es noch einmal versuchen oder die Angaben von Hand eintragen.",
      retry: "Noch einmal versuchen",
      manual: "Von Hand anlegen",
      notFound: "Diesen Eintrag gibt es im Katalog nicht (mehr).",
    },
    numberMissing:
      "Die BrickLink-Nummer wurde im Katalog nicht gefunden. Trag sie ein, wenn du sie kennst; sie ist für den Marktpreis nötig.",
    fromSetHint: (numbers: readonly string[]) => `Kommt vor in: ${numbers.join(", ")}`,
    prefilledNote: "Aus dem Katalog übernommen",
  },
  /** S8 form (P6): entering and editing by hand. */
  form: {
    cancel: "Abbrechen",
    save: "Speichern",
    saving: "Wird gespeichert …",
    titleNew: {
      minifig: "Neue Figur",
      legoSet: "Neues Set",
      specialPart: "Neues Sonderteil",
    },
    titleCopy: "Weiteres Exemplar",
    titleCatalog: {
      minifig: "Neue Figur",
      legoSet: "Neues Set",
    },
    titleEdit: (name: string) => `${name} bearbeiten`,
    notFound: {
      title: "Nicht gefunden",
      text: "Dieses Objekt gibt es nicht (mehr) in deiner Sammlung.",
    },
    summary: (count: number) =>
      count === 1 ? "1 Angabe stimmt noch nicht." : `${count} Angaben stimmen noch nicht.`,
    optional: "freiwillig",
    saveFailed: {
      offline: "Das Speichern hat nicht geklappt: keine Verbindung. Deine Eingaben sind noch da.",
      server:
        "Das Speichern hat nicht geklappt. Deine Eingaben sind noch da. Versuch es noch einmal.",
      too_many_photos: "Ein Objekt kann höchstens 20 Fotos haben.",
      too_large: "Die Angaben sind zu lang für ein Objekt. Kürz die Notiz oder die Links.",
      refused: "Der Server hat das Speichern abgelehnt. Prüf die Angaben.",
    },
    sections: {
      photos: "Fotos",
      basics: "Basisdaten",
      condition: "Zustand",
      status: "Status",
      kind: "Art",
      origin: "Herkunft",
      value: "Wert",
      mods: "Modifikationen",
      note: "Notiz und Links",
    },
    fields: {
      name: "Name",
      number: { minifig: "Katalognummer", legoSet: "Setnummer", specialPart: "Nummer" },
      manufacturer: "Hersteller",
      manufacturerName: "Name des Herstellers",
      theme: "Thema / Reihe",
      year: "Jahr",
      pieceCount: "Teile",
      minifigCount: "Figuren im Set",
      source: "Quelle",
      acquired: "Erworben am",
      acquiredPlaceholder: "MM.JJJJ",
      purchasePrice: "Kaufpreis",
      pricePlaceholder: "z. B. 25,00",
      fromSet: "Stammt aus Set",
      fromSetPlaceholder: "Setnummer oder leer lassen",
      manualValue: "Wert (selbst geschätzt)",
      manualValueHint:
        "Zählt nur, wenn es keinen Marktpreis gibt. Der Marktpreis geht vor, danach dein Wert, dann der Kaufpreis.",
      links: "Links (einer pro Zeile)",
      note: "Notiz",
    },
    manufacturers: { lego: "LEGO", bluebrixx: "Bluebrixx", other: "Andere", custom: "Custom" },
    errors: {
      required: "Das brauchen wir noch.",
      tooLong: "Das ist zu lang.",
      money: "Gib einen Betrag ein, z. B. 12,50.",
      month: "Gib Monat und Jahr ein, z. B. 03.2025.",
      wholeNumber: "Gib eine ganze Zahl ein.",
      year: "Gib ein Jahr zwischen 1900 und 2100 ein.",
      url: "Das ist keine Webadresse (https://…).",
    },
    photos: {
      add: "Foto hinzufügen",
      addMore: (left: number) => `Foto hinzufügen, noch ${left} möglich`,
      full: "Mehr als 20 Fotos gehen nicht.",
      hint: "Das erste Foto ist das Titelbild.",
      alt: (index: number, count: number) => `Foto ${index} von ${count}`,
      makeCover: (index: number) => `Foto ${index} zum Titelbild machen`,
      remove: (index: number) => `Foto ${index} entfernen`,
      cover: "Titelbild",
      working: "Wird verkleinert …",
      sending: (attempt: number, attempts: number) =>
        attempt === 1
          ? "Wird hochgeladen …"
          : `Wird hochgeladen (Versuch ${attempt} von ${attempts}) …`,
      waiting: "Neuer Versuch gleich …",
      failed: "Hochladen nicht geklappt",
      retry: "Noch einmal versuchen",
      discard: "Verwerfen",
      unreadable: "Dieses Foto konnte nicht gelesen werden.",
      refused: "Der Server nimmt dieses Foto nicht an.",
      noServer: "Ohne Server lassen sich keine Fotos speichern.",
    },
    mods: {
      count: (count: number) => (count === 1 ? "1 Teil" : `${count} Teile`),
      add: "Mod-Teil hinzufügen",
      /** Read out after the position and the description of a part, which are on the button. */
      edit: "bearbeiten",
      remove: (position: string) => `${position} entfernen`,
      spend: "Ausgaben für Mods",
      none: "Noch keine Teile getauscht.",
    },
  },
  /** S8a: one swapped part of a figure (P6). */
  mod: {
    titleNew: "Mod-Teil hinzufügen",
    titleEdit: "Mod-Teil bearbeiten",
    close: "Schließen",
    position: "Position",
    description: "Beschreibung",
    vendor: "Anbieter",
    url: "Link",
    price: "Preis",
    originalPart: "Verbleib Originalteil",
    cancel: "Abbrechen",
    add: "Hinzufügen",
    apply: "Übernehmen",
    positionRequired: "Wähl eine Position.",
  },
  /** Deleting (P6): asks first, then offers to take it back for a few seconds. */
  remove: {
    title: (name: string) => `${name} löschen?`,
    text: {
      minifig: "Die Figur und ihre Fotos werden gelöscht.",
      legoSet: "Das Set und seine Fotos werden gelöscht. Die Figuren daraus bleiben.",
      specialPart: "Das Sonderteil und seine Fotos werden gelöscht.",
    },
    confirm: "Löschen",
    cancel: "Abbrechen",
    close: "Schließen",
    done: (name: string) => `${name} ist gelöscht.`,
    undo: "Rückgängig",
    failed: "Das Löschen hat nicht geklappt. Die Sammlung wird neu geladen.",
  },
  /** The account card in the settings (S12). */
  account: {
    label: "Konto",
    name: "Stephan",
    signOut: "Abmelden",
    demo: "Beispieldaten, ohne Anmeldung",
  },
} as const;
