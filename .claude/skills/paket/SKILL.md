---
name: paket
description: Setzt ein Arbeitspaket aus docs/UMSETZUNG.md (P1 bis P15, P4a–P4c) komplett um, vom Code über Tests und grünes npm run check (ab P4a auch den Job db auf GitHub) bis zur aktualisierten Online-Version. Aufruf mit /paket <Kennung> und optional Zusatzhinweisen.
argument-hint: <Kennung, z. B. P1 oder P4a> [Zusatzhinweise]
disable-model-invocation: true
---

# Arbeitspaket umsetzen

Aufruf: `/paket <Kennung> [Zusatzhinweise]`. Eingabe: $ARGUMENTS

Das erste Wort ist die Kennung (Groß-/Kleinschreibung egal). Alles danach sind Zusatzhinweise des Product Owners; sie gehen bei Widerspruch zur Paketbeschreibung vor.

Quelle ist `docs/UMSETZUNG.md`: Tabelle in Abschnitt 4 (Status) und das Ticket in Abschnitt 5 (Scope, Out of scope, Done when, PO steps). Fehlt die Kennung oder gibt es kein solches Paket, frag nach, statt zu raten. Steht das Paket schon auf ✅, sag das und frag, ob es erneut bearbeitet werden soll. Sind frühere Pakete nicht fertig, sag es und frag.

## 1. Lesen

- `CLAUDE.md` (Befehle, Regeln, Wortliste) – auch wenn es schon im Kontext steht.
- `docs/UMSETZUNG.md`: Abschnitt 1 (Leitentscheidungen), das Ticket, Abschnitt 6 (Risiken), Abschnitt 7 (Entscheidungen des PO, gehen dem übrigen Plan vor).
- `docs/ANFORDERUNGEN.md`: die Anforderungen (F…, N…), die das Paket berührt, mit ihren Akzeptanzkriterien.
- Bei Oberfläche: `docs/STRUKTUR.md` (die betroffenen Screens S… und Abläufe A…), `docs/design/DESIGN.md` und die passenden Dateien in `docs/design/dummy/` als Vorlage.
- Ab P3: `docs/DATENQUELLEN.md` (Ergebnis von P2), soweit externe Dienste betroffen sind.
- Den vorhandenen Code, an dem das Paket ansetzt (erst lesen, dann ändern; Bausteine wiederverwenden).

## 2. Umsetzen

- Regeln aus `CLAUDE.md` einhalten. Genau dieses Paket umsetzen, nicht die nächsten. Brauchst du etwas aus einem späteren Paket, nimm die kleinste Lösung und nenne sie im Bericht.
- Jeder Punkt unter „Done when“ und jedes berührte Akzeptanzkriterium ist mindestens ein Test, benannt danach. Fachlogik: Unit-Tests (≥ 90 %). Oberfläche: E2E-Tests mit axe auf jeder neuen Seite und jedem Dialog, in Desktop- und Handygröße.
- Die Oberfläche sieht aus wie im Klick-Dummy. Weichst du ab, begründe es im Bericht.
- Sieh dir neue Oberfläche kurz im Browser an (`npm run demo` oder Dev-Server), nicht nur den Testbericht.
- `npm run check` bleibt unabhängig von Internet, Docker und Schlüsseln. Externe Dienste nur über Edge Functions; Tests mit Fake-Server und aufgezeichneten Antworten.
- Keine Geheimnisse ins Repo. Schritte, die Schlüssel brauchen (`npx supabase secrets set …`, `.env.local`), führt nur der PO in seinem Terminal aus.
- Ist eine Anforderung unklar und ändert die Antwort das Ergebnis deutlich, frag den PO. Sonst entscheide, begründe knapp und nenne es im Bericht.

## 3. Prüfen und veröffentlichen

1. `npm run check` lokal, bis es grün ist (nur die Kurzausgabe lesen). Rote Tests nicht abschwächen oder überspringen; Ursache beheben. Flackernde Tests unter Last wiederholen (`npx playwright test <Datei> --repeat-each 4 --workers 8`) und die Ursache beheben.
2. Doku nachführen (Schritt 4), alles zusammen committen (Nachricht auf Deutsch, `Paket P…: …`, mit der Attributionszeile der Sitzung) und auf `main` pushen. Das Paket ist ausdrücklich zum Veröffentlichen beauftragt.
3. Auf die Workflows des Commits warten (`gh run list`, dann `gh run watch <id> --exit-status`): `check`, ab P4a auch `db`. Bei Fehlern `gh run view <id> --log-failed`, beheben, erneut pushen.
4. Auf den Workflow `pages` warten und prüfen, dass https://stephan-pro.github.io/stud-stephan/ den neuen Stand ausliefert (z. B. eine neue Zeichenkette im ausgelieferten `assets/index-*.js` suchen).

Fertig ist das Paket erst, wenn alles grün ist, die Online-Version aktuell ist und alle PO-Schritte des Pakets bestätigt sind. Sonst offen den Stand nennen, nicht „fertig“ melden.

## 4. Doku nachführen (knapp)

- `docs/UMSETZUNG.md`: in der Tabelle (Abschnitt 4) den Status auf `✅ <Datum>` setzen. Neue Abhängigkeiten sofort mit Begründung eintragen. Entscheidungen, die das Verhalten für den Nutzer ändern, in Abschnitt 7 eintragen.
- `CLAUDE.md`: Befehle, Aufbau (Ordner, wichtige Dateien, Testhilfen) und Wortliste ergänzen, wenn sich etwas geändert hat. Kurz halten.
- Sonst keine Doku-Nacharbeit.

## 5. Abschlussbericht an den PO

Kurz, verständlich, ohne Fachjargon, in dieser Reihenfolge:

1. **Was entstanden ist.**
2. **Welche Tests dazugekommen sind** (Anzahl, was sie abdecken).
3. **Welche Entscheidungen** du getroffen hast (und welche in Abschnitt 7 stehen).
4. **Was du ausprobieren kannst** (nummerierte Schritte, online oder mit `npm run demo`).
5. **Was du selbst tun musst** (nummerierte Schritte mit genauen Klicks, vollständigen Adressen und kompletten PowerShell-Befehlen) und welche „Done when“-Punkte davon abhängen.

Nenne ehrlich, was nicht fertig oder nicht geprüft ist, und Auffälliges.
