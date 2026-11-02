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
        "Hier findest du bald den Stand der Datenquellen, die Datensicherung und die Version der App.",
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
  /** S11 dashboard (P13). */
  dashboard: {
    periodGroup: "Zeitraum",
    periods: { threeMonths: "3 Monate", year: "1 Jahr", all: "Gesamt" },
    value: "Gesamtwert",
    /** The badge on the value: how the value changed over the period shown. */
    changeIn: { threeMonths: "in 3 Monaten", year: "in 12 Monaten", all: "seit Beginn" },
    changeSince: (date: string) => `seit ${date}`,
    chartTitle: "Verlauf des Gesamtwerts",
    chart: (
      from: string,
      to: string,
      first: string,
      last: string,
      direction: "up" | "down" | "same",
      high: string,
      highDate: string,
      low: string,
      lowDate: string,
      count: number,
    ) =>
      `Gesamtwert vom ${from} bis ${to}, ${count} Preisstände: von ${first} auf ${last}, ${
        { up: "gestiegen", down: "gefallen", same: "gleich geblieben" }[direction]
      }. Höchster Wert ${high} am ${highDate}, niedrigster Wert ${low} am ${lowDate}.`,
    historyFrom: (date: string) => `Verlauf ab ${date}`,
    historyFirst: (date: string) =>
      `Erster Preisstand am ${date}. Die Linie entsteht mit dem nächsten Preisabruf.`,
    historyNone:
      "Noch kein Verlauf. Er entsteht aus den wöchentlichen Preisabrufen (Einstellungen → Preisabruf).",
    tiles: {
      purchase: "Kaufsumme",
      difference: "Wertdifferenz",
      mods: "Ausgaben für Mods",
      modsNote: "zählt nicht zum Wert",
      withoutValue: "Ohne Wert",
      withoutValueNote: "Objekte",
    },
    kinds: {
      title: "Nach Objektart",
      figures: (count: number) => (count === 1 ? "1 Figur" : `${count} Figuren`),
      sets: (count: number) => (count === 1 ? "1 Set" : `${count} Sets`),
      dioramas: (count: number) => (count === 1 ? "1 Diorama" : `${count} Dioramen`),
      specialParts: (count: number) => (count === 1 ? "1 Sonderteil" : `${count} Sonderteile`),
    },
    themes: {
      title: "Nach Thema",
      none: "Ohne Thema",
      rest: "Sonstige",
      share: (name: string, percent: number) => `${name}: ${percent} %`,
      empty: "Sobald deine Figuren und Sets ein Thema haben, siehst du hier die Verteilung.",
    },
    top: {
      title: "Am wertvollsten",
      empty: "Noch kein Stück mit Wert.",
    },
    notOnDisplay: "nicht ausgestellt",
    footer: (date: string) => `Preise Stand vom ${date} · Quelle BrickLink`,
    footerNone: "Noch keine Preise abgerufen · Quelle BrickLink",
  },
  /** The price run card in the settings (S12, P11). */
  priceRun: {
    title: "Preisabruf",
    loading: "Wird geladen …",
    failedToLoad: "Der Stand des Preisabrufs konnte gerade nicht gelesen werden.",
    retry: "Noch einmal versuchen",
    lastRun: "Letzter Lauf",
    result: "Ergebnis",
    skipped: "Übersprungen",
    failedNumbers: "Fehlgeschlagen",
    nextRun: "Nächster Lauf",
    never: "noch keiner",
    started: (time: string, manual: boolean) => (manual ? `${time} · von Hand` : time),
    done: (updated: number, failed: number, empty: number) =>
      [
        `${updated} aktualisiert`,
        `${failed} fehlgeschlagen`,
        ...(empty > 0 ? [`${empty} ohne Verkäufe`] : []),
      ].join(", "),
    nothingToAsk: "Keine Figuren oder Sets mit BrickLink-Nummer",
    running: (done: number, total: number) => `läuft: ${done} von ${total} abgefragt`,
    paused: (done: number, total: number, until: string) =>
      `${done} von ${total} abgefragt. Das Tageslimit von BrickLink ist erreicht, es geht am ${until} weiter.`,
    withoutNumber: (count: number) =>
      count === 1 ? "1 ohne BrickLink-Nummer" : `${count} ohne BrickLink-Nummer`,
    note: "Jeden Montag fragt die App die Marktwerte deiner offiziellen Figuren, Sets und Wünsche bei BrickLink ab. Mit dem Knopf geht es sofort; das dauert etwa eine Sekunde je Eintrag.",
    update: "Jetzt aktualisieren",
    updating: "Wird aktualisiert …",
    progress: (done: number, total: number) => `${done} von ${total} abgefragt …`,
    finished: "Der Preisabruf ist fertig.",
    failures: {
      offline: "Keine Verbindung zum Server. Prüf das Internet und versuch es noch einmal.",
      limit_reached:
        "Für heute sind alle BrickLink-Abfragen verbraucht. Der Abruf geht morgen von selbst weiter.",
      unavailable: "Der Preisabruf ist gerade nicht erreichbar. Versuch es später noch einmal.",
    },
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
    "Keine Verbindung. Lesen geht weiter; Erfassen und Ändern gehen erst wieder mit Verbindung.",
  /** The same bar while the copy kept on the device is shown (P15). */
  offlineCopy: (savedAt: string) =>
    `Keine Verbindung – du siehst den Stand vom ${savedAt}. Lesen geht; Erfassen und Ändern gehen erst wieder mit Verbindung.`,
  /** Online, but the server did not answer: the copy is shown. */
  serverCopy: (savedAt: string) =>
    `Der Server antwortet gerade nicht – du siehst den Stand vom ${savedAt}. Erfassen und Ändern gehen erst wieder, wenn er antwortet.`,
  serverCopyRetry: "Noch einmal versuchen",
  /** Where capturing or changing is switched off without a connection (P15). */
  readOnly: "Ohne Verbindung kannst du nichts erfassen oder ändern. Deine Eingaben bleiben stehen.",
  readOnlyShort: "Geht erst wieder mit Verbindung",
  /** A new version of the app is ready (service worker, P15); it never takes over by itself. */
  update: {
    message: "Neue Version verfügbar",
    action: "Neu laden",
  },
  /** S12: the install hint (P15). */
  install: {
    title: "App installieren",
    offered:
      "Stud Stephan lässt sich wie eine App installieren: mit eigenem Symbol auf dem Startbildschirm, ohne Browserleiste und auch ohne Verbindung lesbar.",
    button: "Installieren",
    installed: "Stud Stephan ist auf diesem Gerät als App installiert.",
    manual:
      "Im Browser-Menü (⋮ oben rechts) „App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen. Ist sie schon installiert, öffne sie über ihr Symbol.",
  },
  /** S1 showcase (P5). */
  showcase: {
    searchOpen: "Suchen",
    searchClose: "Suche schließen",
    searchLabel: "Sammlung durchsuchen",
    searchPlaceholder: "In der Sammlung suchen",
    card: {
      lead: "Deine Sammlung ist",
      worth: "wert",
      week: (change: string) => `${change} Woche`,
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
      notOnDisplay: "Nicht ausgestellt",
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
    notOnDisplay: "Nur nicht ausgestellte Figuren",
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
      market: (condition: string) => `Aktueller Wert (${condition})`,
      manual: "Wert (selbst geschätzt)",
      purchase: "Kaufpreis als Wert",
      none: "Noch kein Wert",
      withoutValue: "ohne Wert",
      purchasePrice: "Kaufpreis",
      /** "Neu wäre sie 52,00 € wert" (die Figur), "… wäre es …" (das Set, das Sonderteil). */
      otherCondition: (condition: string, price: string, pronoun: string) =>
        `${condition} wäre ${pronoun} ${price} wert`,
      pronoun: { minifig: "sie", legoSet: "es", specialPart: "es" },
      asOfMarket: (date: string) => `Stand vom ${date} · BrickLink`,
      /** P11: how many sales the average stands on (few = uncertain). */
      asOfMarketSold: (date: string, sold: number) =>
        `Stand vom ${date} · BrickLink · Ø aus ${sold} ${sold === 1 ? "Verkauf" : "Verkäufen"}`,
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
    /** "Steht in": the diorama or own set a figure is displayed in. */
    stand: {
      title: "Steht in",
      none: "Diese Figur ist nicht ausgestellt. Sie steht weder in einem Diorama noch in einem deiner Sets.",
      kinds: { diorama: "Diorama", set: "Set" },
      automatic: "Set, automatisch (vollständig)",
      automaticHint:
        "Die Figur stammt aus diesem Set und das Set ist vollständig, also gilt sie als ausgestellt. Hast du sie entnommen, setz den Status des Sets auf „Figuren entnommen“.",
      openDiorama: "Diorama ansehen",
      openSet: "Set ansehen",
      takeFromDiorama: "Aus dem Diorama nehmen",
      takeFromSet: "Aus dem Set nehmen",
      choose: "Diorama oder Set wählen",
      chooseElsewhere: "Woanders ausstellen",
      failed: "Das Speichern hat nicht geklappt. Versuch es noch einmal.",
      sheetTitle: "Wo steht die Figur?",
      sheetClose: "Schließen",
      kindGroup: "Wo",
      searchSets: "Set suchen",
      noSets: "Du hast noch kein Set.",
      noSetMatch: (query: string) => `Kein Set passt zu „${query}“.`,
      createSet: "Set erfassen",
      createDiorama: "Diorama erfassen",
      noDioramas: "Du hast noch kein Diorama.",
      backToShowcase: "Zurück zur Vitrine",
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
      addWish: "+ Wunschliste",
      wished: "auf der Wunschliste",
      addWishLabel: (name: string) => `${name} auf die Wunschliste setzen`,
      quantity: (count: number) => `×${count}`,
      noFigures: "Zu diesem Set sind noch keine Figuren angegeben.",
      displayedTitle: "Ausgestellte Figuren",
      displayedNone: "In diesem Set ist noch keine Figur ausgestellt.",
      displayedAutomatic: "automatisch",
      displayedAssign: "Figuren zuordnen",
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
    onlyFigures: "Erkannt werden nur Figuren",
    noCatalogForParts: "Für Sonderteile gibt es keinen Katalog",
    wishHint:
      "Einen Wunsch findest du per Nummer, Suche oder Link. Auch in einer Reihe und bei einer fehlenden Figur eines Sets kannst du Wünsche anlegen.",
    wishWays: "Wünsche per Nummer, Suche oder Link",
    onlyManual: "Ein Diorama erfasst du von Hand",
  },
  /** A wish from the capture sheet: number, search or link (P15). */
  wishCapture: {
    searchTitle: "Wunsch per Nummer oder Suche",
    linkTitle: "Wunsch per Link",
    pick: (name: string) => `${name} auf die Wunschliste`,
    loading: "Der Katalogeintrag wird geholt …",
    retry: "Noch einmal versuchen",
    next: "Weiter zum Wunsch",
    kindsLabel: "Figur oder Set",
    noneHint: "Prüf die Schreibweise oder leg den Wunsch über einen Link an.",
    setFigures: {
      title: "Set oder Figur wünschen",
      intro: (count: number) =>
        count === 1
          ? "In diesem Set steckt 1 Figur. Wünsch eine einzelne Figur oder das ganze Set."
          : `In diesem Set stecken ${count} Figuren. Wünsch eine einzelne Figur oder das ganze Set.`,
      close: "Set-Ansicht schließen",
      listLabel: "Figuren des Sets",
      add: "+ Wunschliste",
      addLabel: (name: string) => `${name} auf die Wunschliste setzen`,
      wished: "Gewünscht",
      wishedLabel: (name: string) => `${name}: Wunsch ansehen`,
      owned: "Vorhanden",
      quantity: (count: number) => `${count}×`,
      wholeSet: "Ganzes Set wünschen",
      wholeSetWished: "Wunsch für das Set ansehen",
    },
    failed: {
      offline: "Keine Verbindung zum Katalog. Prüf das Internet und versuch es noch einmal.",
      limit_reached: "Für heute sind alle Katalog-Abfragen verbraucht. Morgen geht es wieder.",
      not_found: "Diesen Eintrag kennt der Katalog nicht.",
      unavailable: "Der Katalog antwortet gerade nicht. Versuch es gleich noch einmal.",
    },
  },
  /** S5 list, S6 detail, S6a assign sheet and the diorama form (P10, F8). */
  dioramas: {
    back: "Zurück zu den Dioramen",
    searchLabel: "Dioramen durchsuchen",
    searchPlaceholder: "In den Dioramen suchen",
    noMatch: (query: string) => `Kein Diorama passt zu „${query}“.`,
    loading: "Die Dioramen werden geladen …",
    figures: (count: number) => (count === 1 ? "1 Figur" : `${count} Figuren`),
    pieces: (count: number) => `${count.toLocaleString("de-DE")} Teile`,
    withoutBanner: {
      count: (count: number) => (count === 1 ? "1 Figur" : `${count} Figuren`),
      text: (count: number) => (count === 1 ? "ist nicht ausgestellt" : "sind nicht ausgestellt"),
      action: "Anzeigen",
    },
    empty: {
      title: "Noch kein Diorama",
      text: "Erfass dein erstes Diorama mit Fotos, Studio-Dateien und den Figuren, die darin stehen.",
      action: "Erstes Diorama erfassen",
    },
    notFound: {
      title: "Nicht gefunden",
      text: "Dieses Diorama gibt es nicht (mehr) in deiner Sammlung.",
    },
    loadFailed: {
      title: "Die Dioramen konnten nicht geladen werden",
      text: "Prüf das Internet und versuch es noch einmal.",
      retry: "Noch einmal versuchen",
    },
    detail: {
      figuresTitle: "Figuren in diesem Diorama",
      noFigures: "Noch keine Figur steht in diesem Diorama.",
      assign: "Figuren zuordnen",
      value: "Wert (selbst geschätzt)",
      valueSince: (date: string) => `Eingetragen am ${date}`,
      pieces: "Teile",
    },
    studio: {
      title: "Studio-Dateien",
      none: "Noch keine Studio-Datei. Lad deine .io-Datei hoch, dann ist sie hier gut aufgehoben.",
      upload: "Datei hochladen",
      download: (name: string) => `${name} herunterladen`,
      downloading: "Wird geladen …",
      downloadFailed: "Das Herunterladen hat nicht geklappt. Versuch es noch einmal.",
      uploadFailed: "Das Hochladen hat nicht geklappt. Versuch es noch einmal.",
      saving: "Wird gespeichert …",
      meta: (size: string, date: string) => `${size} · ${date}`,
      remove: (name: string) => `${name} entfernen`,
      full: "Mehr als 20 Studio-Dateien gehen nicht.",
      hint: "Nur .io-Dateien aus Studio, bis 25 MB.",
      noServer: "Ohne Server lassen sich keine Dateien speichern.",
      working: (name: string) => `${name}: wird hochgeladen …`,
      sending: (name: string, attempt: number, attempts: number) =>
        attempt === 1
          ? `${name}: wird hochgeladen …`
          : `${name}: wird hochgeladen (Versuch ${attempt} von ${attempts}) …`,
      waiting: (name: string) => `${name}: neuer Versuch gleich …`,
      failed: (name: string) => `${name}: Hochladen nicht geklappt`,
      retry: "Noch einmal versuchen",
      discard: "Verwerfen",
      problems: {
        not_io: "Das ist keine Studio-Datei. Sie muss auf .io enden.",
        empty: "Diese Datei ist leer.",
        too_large: "Diese Datei ist größer als 25 MB.",
        refused: "Der Server nimmt diese Datei nicht an.",
      },
    },
    assign: {
      title: "Figuren zuordnen",
      close: "Schließen",
      searchLabel: "Figur suchen",
      onlyWithout: "Nur nicht ausgestellte",
      all: "Alle",
      filterGroup: "Welche Figuren",
      standsIn: (name: string) => `steht in: ${name}`,
      none: "Keine Figur gefunden.",
      noneWithout: "Alle deine Figuren sind schon ausgestellt. Probier „Alle“.",
      submit: (count: number) => (count === 1 ? "1 Figur zuordnen" : `${count} Figuren zuordnen`),
      submitNone: "Figuren wählen",
      saving: "Wird gespeichert …",
      failed: "Das Zuordnen hat nicht geklappt. Versuch es noch einmal.",
      partly: "Nicht alle Figuren ließen sich zuordnen. Versuch es noch einmal.",
      move: {
        title: (count: number) =>
          count === 1 ? "1 Figur verschieben?" : `${count} Figuren verschieben?`,
        text: (names: string) => `Diese Figuren stehen schon woanders: ${names}.`,
        confirm: "Verschieben",
        cancel: "Abbrechen",
        close: "Schließen",
      },
    },
    form: {
      titleNew: "Neues Diorama",
      titleEdit: (name: string) => `${name} bearbeiten`,
      notFound: {
        title: "Nicht gefunden",
        text: "Dieses Diorama gibt es nicht (mehr) in deiner Sammlung.",
      },
      sections: {
        photos: "Fotos",
        basics: "Basisdaten",
        value: "Wert",
        studio: "Studio-Dateien",
        note: "Notiz und Links",
      },
      fields: {
        name: "Name",
        pieceCount: "Teile",
        manualValue: "Wert (selbst geschätzt)",
        manualValueHint: "Ein Eigenbau hat keinen Marktpreis. Hier schätzt du selbst.",
      },
    },
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
    imageLoading: "wird geholt …",
    imageBlocked: "gesperrt – nimm ein eigenes Foto",
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
  /** S9 wishlist and S9a wish sheet (P12, F14). */
  wishlist: {
    switchLabel: "Wunschliste oder Reihen",
    tabs: { wishes: "Wunschliste", series: "Reihen" },
    loading: "Die Wunschliste wird geladen …",
    reached: "Zielpreis erreicht",
    reachedBadge: "Zielpreis erreicht",
    entries: (count: number) => (count === 1 ? "1 Eintrag" : `${count} Einträge`),
    sortLabel: "Sortieren nach",
    sorts: { priority: "Nach Priorität", price: "Nach Preis", name: "Nach Name" },
    priorities: { high: "hoch", medium: "mittel", low: "niedrig" },
    priorityChoices: { high: "Hoch", medium: "Mittel", low: "Niedrig" },
    set: "Set",
    fromSeries: (name: string) => `aus Reihe ${name}`,
    target: (price: string) => `Ziel ${price}`,
    noPrice: "kein Marktpreis",
    /** The bin of each entry and its question. */
    remove: {
      button: (name: string) => `${name} von der Wunschliste entfernen`,
      title: (name: string) => `„${name}“ entfernen?`,
      text: "Der Wunsch verschwindet von der Wunschliste. Was schon in deiner Sammlung steht, bleibt.",
      confirm: "Ja, entfernen",
      keep: "Behalten",
      close: "Schließen",
      removing: "Wird entfernt …",
      failed: "Das Entfernen hat nicht geklappt. Prüf die Verbindung und versuch es noch einmal.",
    },
    empty: {
      title: "Deine Wunschliste ist noch leer",
      text: "Such unter „Reihen“ eine Reihe und setz fehlende Figuren mit einem Tipp auf die Wunschliste. Fehlende Figuren eines Sets legst du auch auf der Seite des Sets an.",
      action: "Reihe suchen",
    },
    loadFailed: {
      title: "Die Wunschliste konnte nicht geladen werden",
      text: "Prüf das Internet und versuch es noch einmal.",
      retry: "Noch einmal versuchen",
    },
  },
  wishSheet: {
    titleEdit: "Wunsch bearbeiten",
    titleNew: "Auf die Wunschliste",
    close: "Schließen",
    reachedNote: (price: string) => `Marktpreis ${price} – Zielpreis erreicht`,
    marketNote: (price: string, date: string) => `Marktpreis ${price} · Stand vom ${date}`,
    noMarketNote: "Kein Marktpreis verfügbar",
    priority: "Priorität",
    targetPrice: "Zielpreis",
    targetPriceHint: "Leer lassen, wenn es keinen Zielpreis gibt.",
    condition: "Gewünschter Zustand",
    note: "Notiz",
    errors: {
      money: "Das ist kein Betrag. Schreib es z. B. so: 20,00",
      tooLong: "Die Notiz ist zu lang.",
    },
    save: "Speichern",
    add: "Auf die Wunschliste setzen",
    saving: "Wird gespeichert …",
    received: "Erhalten – in die Sammlung",
    remove: "Von der Wunschliste entfernen",
    removeSure: "Wirklich entfernen?",
    removeConfirm: "Ja, entfernen",
    removeKeep: "Behalten",
    removing: "Wird entfernt …",
    failed: "Das hat nicht geklappt. Prüf das Internet und versuch es noch einmal.",
    alreadyWished: "Diese Figur steht schon auf deiner Wunschliste.",
  },
  /** S10 series, S10a series detail and the plan before creating one (P12, F13). */
  series: {
    back: "Zurück zu den Reihen",
    searchLabel: "Reihe oder Thema suchen",
    searchPlaceholder: "Reihe oder Thema suchen",
    searchHint:
      "Eine Reihe baut auf einem Unterthema auf, z. B. „Clone Wars“ oder „Batman Movie“. Du kannst auch eine Set- oder Figurennummer eingeben, z. B. 75372 oder sw0194.",
    searching: "Es wird gesucht …",
    noThemes:
      "Dazu gibt es kein Unterthema. Tipp: Gib englische Namen ein, z. B. Clone Wars, oder eine Set- oder Figurennummer, z. B. 75372 oder sw0194.",
    tooBigTheme: "sehr groß – wähle ein Unterthema",
    onlySet: (number: string, figures: number) =>
      `Nur dieses Set: ${number} (${figures === 1 ? "1 Figur" : `${figures} Figuren`})`,
    onlySetNote: "Eine Reihe aus genau diesem Set",
    foundBy: {
      set: (number: string) => `Thema von Set ${number}`,
      figure: (number: string) => `Thema der Figur ${number}`,
    },
    moreHits: "Es passen noch mehr Themen. Gib mehr vom Namen ein, um die Liste zu verkleinern.",
    searchFailed: {
      offline: "Keine Verbindung zum Server. Prüf das Internet und versuch es noch einmal.",
      limit_reached: "Für heute sind alle Abfragen verbraucht. Versuch es morgen noch einmal.",
      unavailable: "Die Suche ist gerade nicht erreichbar. Versuch es später noch einmal.",
    },
    mine: "Meine Reihen",
    loading: "Deine Reihen werden geladen …",
    loadFailed: "Deine Reihen konnten gerade nicht gelesen werden.",
    retry: "Noch einmal versuchen",
    empty: "Noch keine Reihe. Such oben ein Thema und leg die erste Reihe an.",
    progress: (present: number, total: number) => `${present} / ${total}`,
    progressLabel: (present: number, total: number) => `${present} von ${total} Figuren`,
    building: (done: number, total: number) => `wird aufgebaut: ${done} von ${total} Sets`,
    paused: (until: string) => `Pause bis ${until} (Tageslimit von BrickLink)`,
    plan: {
      title: "Reihe anlegen",
      close: "Schließen",
      sets: (count: number) => (count === 1 ? "1 Set" : `${count} Sets`),
      calls: (count: number) =>
        count === 1 ? "1 BrickLink-Abfrage" : `${count} BrickLink-Abfragen`,
      summary: (sets: string, calls: string) => `${sets} – dafür sind ${calls} nötig.`,
      explain:
        "Zu jedem Set fragt die App bei BrickLink die Figuren ab. Das läuft über das Tageslimit, das sich der Katalog und der Preisabruf teilen. Ist es verbraucht, macht die App am nächsten Tag von selbst weiter.",
      warning: (limit: number) =>
        `Das sind mehr als ${limit} Sets. Der Aufbau dauert dann lange und verbraucht viele Abfragen des Tages. Wähl lieber ein kleineres Unterthema.`,
      tooBig: (max: number) =>
        `Mehr als ${max} Sets kann eine Reihe nicht haben. Wähl ein kleineres Unterthema.`,
      create: "Reihe anlegen",
      createAnyway: "Trotzdem anlegen",
      creating: "Wird angelegt …",
      loading: "Es wird gezählt …",
      failed: "Das hat nicht geklappt. Prüf das Internet und versuch es noch einmal.",
    },
    detail: {
      title: "Reihe",
      notFound: {
        title: "Reihe nicht gefunden",
        text: "Diese Reihe gibt es nicht (mehr).",
      },
      figuresOf: (total: number) => `von ${total} Figuren`,
      missingLine: (missing: number, wished: number) =>
        `${missing} fehlen · ${wished} davon auf der Wunschliste`,
      allThere: "Alle Figuren sind da.",
      filters: { all: "Alle", missing: "Fehlen", present: "Vorhanden" },
      filterLabel: "Anzeigen",
      legend: { present: "vorhanden", wished: "auf Wunschliste", missing: "grau = fehlt" },
      addToWishlist: "+ Wunschliste",
      statusPresent: "vorhanden",
      statusWished: "auf der Wunschliste",
      statusMissing: "fehlt",
      noFigures: (asked: number, total: number) =>
        asked === 0
          ? "In dieser Reihe hat BrickLink bisher keine Figuren gefunden."
          : `BrickLink hat zu ${asked} von ${total} Sets keine Figuren gefunden.`,
      nothingShown: "Dazu gibt es in dieser Reihe nichts.",
      building: (done: number, total: number) =>
        `Die Reihe wird noch aufgebaut: ${done} von ${total} Sets sind abgefragt. Die Liste wächst von selbst.`,
      paused: (until: string) =>
        `Das Tageslimit von BrickLink ist erreicht. Die App macht am ${until} von selbst weiter.`,
      failedSets: (count: number) =>
        count === 1
          ? "1 Set kennt BrickLink nicht; seine Figuren fehlen hier."
          : `${count} Sets kennt BrickLink nicht; ihre Figuren fehlen hier.`,
      workFailed: "Der Aufbau ist gerade nicht erreichbar. Er geht später von selbst weiter.",
      remove: "Reihe löschen",
      removeSure: "Die Reihe wird gelöscht. Deine Figuren und Wünsche bleiben.",
      removeConfirm: "Ja, löschen",
      removeKeep: "Behalten",
    },
  },
  /** S8 filled from the catalog (P7) or from a link (P9). */
  catalogForm: {
    linkBanner: "Grüne Felder stammen aus dem Link. Du kannst sie ändern.",
    linkPrefilledNote: "Aus dem Link übernommen",
    linkLoading: "Der Link wird gelesen …",
    imageLoading: (source: string) => `Das Bild von ${source} wird geholt …`,
    imageTaken: (source: string) =>
      `Bild von ${source} übernommen. Es wird beim Speichern als erstes Foto angelegt.`,
    imageSkip: "Nicht übernehmen",
    imageFailed: "Das Bild der Seite ließ sich nicht holen. Du kannst ein eigenes Foto hinzufügen.",
    imageWait: "Das Bild wird noch geholt. Gleich noch einmal speichern.",
    imageSaveFailed:
      "Das Bild der Seite ließ sich nicht speichern. Versuch es noch einmal oder wähl „Nicht übernehmen“.",
    linkUnreadable:
      "Die Seite ließ sich nicht lesen. Der Link ist gespeichert; trag die Angaben selbst ein.",
    banner: "Grüne Felder kommen aus dem Katalog. Du kannst sie ändern.",
    wishBanner:
      "Grüne Felder kommen aus deinem Wunsch. Mit dem Speichern verschwindet er von der Wunschliste.",
    wishPrefilledNote: "Aus dem Wunsch übernommen",
    wishCatalogFailed:
      "Die Figuren des Sets konnten gerade nicht aus dem Katalog geholt werden. Du kannst trotzdem speichern; „Enthaltene Figuren“ bleibt dann leer.",
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
    titleWish: { minifig: "Figur erhalten", legoSet: "Set erhalten" },
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
      setFocus: (index: number) => `Bildausschnitt von Foto ${index} festlegen`,
      focus: {
        title: "Bildausschnitt",
        close: "Bildausschnitt schließen",
        hint: "Tippe auf die Stelle, die in Kacheln und kleinen Bildern sichtbar bleiben soll, meist die Figur. Mit den Pfeiltasten verschiebst du den Punkt, mit Umschalt feiner.",
        areaLabel: (name: string) => `Bildausschnitt von ${name}`,
        valueText: (x: number, y: number) => `${x} % von links, ${y} % von oben`,
        preview: "So sieht die Kachel aus.",
        reset: "Mitte",
        done: "Fertig",
      },
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
      diorama:
        "Das Diorama mit seinen Fotos und Studio-Dateien wird gelöscht. Die Figuren bleiben, stehen dann aber in keinem Diorama.",
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
  /** The card "Datenquellen" in the settings (S12, P14): state of the four sources, never a key. */
  sources: {
    title: "Datenquellen",
    loading: "Wird geprüft …",
    failed: "Der Stand der Datenquellen konnte gerade nicht gelesen werden.",
    retry: "Noch einmal prüfen",
    names: {
      rebrickable: "Rebrickable",
      bricklink: "BrickLink",
      brickognize: "Brickognize",
      merlin: "Merlins Steine",
    },
    /** The line under the name: state, then what the source is for (or what is missing). */
    lines: {
      rebrickable: {
        ok: "verbunden · Namenssuche und Themen",
        missingKeys: "nicht verbunden · Namenssuche und Reihen fehlen",
        refused: "Schlüssel abgelehnt · Namenssuche und Reihen fehlen",
        unreachable: "gerade nicht erreichbar · Namenssuche und Themen",
      },
      bricklink: {
        ok: "verbunden · Katalog und Marktwerte",
        missingKeys: "nicht verbunden · Marktwerte fehlen",
        refused: "Schlüssel abgelehnt · Marktwerte fehlen",
        unreachable: "gerade nicht erreichbar · Katalog und Marktwerte",
      },
      brickognize: {
        ok: "erreichbar · Fotoerkennung",
        missingKeys: "nicht verbunden · Fotoerkennung fehlt",
        refused: "abgelehnt · Fotoerkennung fehlt",
        unreachable: "nicht erreichbar · Fotoerkennung geht gerade nicht",
      },
      merlin: {
        ok: "erreichbar · Link-Vorschau",
        missingKeys: "nicht verbunden · Link-Vorschau fehlt",
        refused: "abgelehnt · Link-Vorschau fehlt",
        unreachable: "nicht erreichbar · Link-Vorschau geht gerade nicht",
      },
    },
    /** The small label for a source that needs the person's attention. */
    chips: { missingKeys: "Schlüssel fehlt", refused: "Schlüssel prüfen" },
    note: "Die App zeigt nie einen Schlüssel an. Schlüssel setzt du wie in der Einrichtung beschrieben.",
  },
  /** The card "Datensicherung" in the settings (S12, P14, F15). */
  backup: {
    title: "Datensicherung",
    intro: "Alle Daten inklusive Fotos und Studio-Dateien als eine Datei.",
    size: (size: string) => `Die Datei wird etwa ${size} groß.`,
    bigHint: "Bei einer großen Datei sicherst du am Handy besser im WLAN.",
    export: "Export",
    import: "Import",
    fileLabel: "Sicherungsdatei wählen",
    last: {
      never: "Auf diesem Gerät gibt es noch keine Sicherung. Am besten legst du gleich eine an.",
      recent: (date: string) => `Letzte Sicherung auf diesem Gerät: ${date}`,
      due: (date: string, days: number) =>
        `Die letzte Sicherung auf diesem Gerät ist ${days} Tage her (${date}). Zeit für eine neue?`,
    },
    progress: {
      reading: "Die Daten werden gelesen …",
      files: (done: number, total: number) => `Dateien werden gesichert: ${done} von ${total} …`,
      checking: "Die fertige Datei wird geprüft …",
      checkingFile: "Die Sicherungsdatei wird geprüft …",
      before: (done: number, total: number) =>
        `Dein jetziger Stand wird gesichert: ${done} von ${total} …`,
      uploading: (done: number, total: number) =>
        `Dateien werden hochgeladen: ${done} von ${total} …`,
      objects: (done: number, total: number) => `Daten werden eingespielt: ${done} von ${total} …`,
      prices: (done: number, total: number) => `Preisstände: ${done} von ${total} …`,
      cleanup: "Es wird aufgeräumt …",
    },
    exported: (fileName: string, what: string, size: string) =>
      `Gesichert in ${fileName}: ${what} (${size}). Die Datei wurde geprüft und liegt in deinen Downloads.`,
    skipped: (count: number) =>
      count === 1
        ? "1 Datei fehlte im Speicher oder war kein gültiges Bild und ist nicht in der Sicherung."
        : `${count} Dateien fehlten im Speicher oder waren keine gültigen Bilder und sind nicht in der Sicherung.`,
    imported: (date: string, fileName: string) =>
      `Fertig. Deine Sammlung ist jetzt der Stand der Sicherung vom ${date}. Der Stand davor liegt in ${fileName} in deinen Downloads.`,
    /** The sheet before replacing. */
    sheet: {
      title: "Sicherung einspielen?",
      close: "Schließen",
      from: (time: string) => `Sicherung vom ${time}`,
      replaces:
        "Das ersetzt deine ganze jetzige Sammlung. Die Zahlen zeigen: jetzt → in der Sicherung.",
      safety:
        "Vorher lädt die App deinen jetzigen Stand automatisch als Sicherungsdatei herunter. Danach wird ersetzt. Klappt das nicht, bekommst du deinen jetzigen Stand zurück.",
      prices: "Preisstände werden ergänzt, keine gelöscht.",
      confirm: "Ersetzen",
      cancel: "Abbrechen",
    },
    /** Singular and plural of what a backup holds: "1 Figur", "286 Figuren". */
    counts: {
      minifigs: ["Figur", "Figuren"],
      sets: ["Set", "Sets"],
      specialParts: ["Sonderteil", "Sonderteile"],
      dioramas: ["Diorama", "Dioramen"],
      wishlist: ["Wunsch", "Wünsche"],
      prices: ["Preisstand", "Preisstände"],
      photos: ["Foto", "Fotos"],
      studioFiles: ["Studio-Datei", "Studio-Dateien"],
    },
    kinds: {
      minifig: "Figur",
      legoSet: "Set",
      specialPart: "Sonderteil",
      diorama: "Diorama",
      wishItem: "Wunsch",
      price: "Preisstand",
    },
    problems: {
      notZip:
        "Das ist keine Sicherung von Stud Stephan: Die Datei ist keine ZIP-Datei oder wurde nicht ganz heruntergeladen.",
      damaged:
        "Die Datei ist beschädigt oder unvollständig. Lade die Sicherung noch einmal herunter oder nimm eine andere.",
      unsupportedZip:
        "Das ist keine Sicherung von Stud Stephan: Die ZIP-Datei ist anders aufgebaut.",
      notBackup: "Das ist keine Sicherung von Stud Stephan.",
      tooNew:
        "Die Sicherung stammt aus einer neueren Version der App. Lade die Seite neu und versuch es noch einmal.",
      tooOld:
        "Die Sicherung stammt aus einer älteren Version der App, für die es keine Umstellung gibt.",
      invalidData: (what: string) => `In der Sicherung stimmt eine Angabe nicht (${what}).`,
      missingFile: (entry: string) => `In der Sicherung fehlt eine Datei (${entry}).`,
      badFile: (entry: string | undefined) =>
        entry
          ? `Eine Datei in der Sicherung ist nicht erlaubt oder kein gültiges Bild (${entry}).`
          : "Eine Datei in der Sicherung ist nicht erlaubt oder kein gültiges Bild.",
      tooBig: "Die Sicherung ist größer, als der Speicher fasst (1 GB), oder hat zu viele Dateien.",
      fileTrouble:
        "Eine Datei ließ sich nicht aus dem Speicher lesen. Prüf die Verbindung und versuch es noch einmal.",
      selfCheck: (reason: string) =>
        `Die fertige Datei hat die eigene Prüfung nicht bestanden und wird deshalb nicht angeboten (${reason}).`,
      unknown: "Das hat nicht geklappt. Versuch es bitte noch einmal.",
      nothingChanged: "Es wurde nichts verändert.",
    },
    restoreFailed: {
      restored: (fileName: string | undefined) =>
        `Das Einspielen hat nicht geklappt. Deine Sammlung ist wie vorher.${
          fileName ? ` Die Sicherung deines Stands liegt in ${fileName}.` : ""
        }`,
      notRestored: (fileName: string | undefined) =>
        `Das Einspielen hat nicht geklappt, und dein alter Stand ist nicht ganz zurückgekommen. Ändere bitte nichts mehr und spiel die Sicherung deines Stands wieder ein${
          fileName ? ` (${fileName})` : ""
        }.`,
    },
  },
  version: (version: string) => `Stud Stephan · Version ${version}`,
} as const;
