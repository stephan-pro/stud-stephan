# Stud Stephan – Anforderungen

Stand: 31.10.2026 · Version 1.0 (abgenommen) · Product Owner: Stephan Prommer

„Stud“ heißen die Noppen auf den Klemmbausteinen.

## 1. Ziel

Stephan hat per Knopfdruck eine vollständige Übersicht über seine Klemmbaustein-Sammlung: vor allem Minifiguren (offiziell, modifiziert, custom), dazu MOC-Dioramen, Sets, Sonderteile und eine Wunschliste. Die App zeigt, was eine Figur ist, woher sie stammt, ob sie modifiziert ist und was sie aktuell wert ist.

Die Startseite wirkt wie eine **Vitrine** (große Bilder, stöbern). Zahlen gibt es gezielt im Dashboard.

## 2. Nutzer, Geräte, Mengengerüst

| Person | Geräte |
|---|---|
| Stephan (einziger Nutzer) | Windows-PC und Android-Handy (Redmi), gleichwertig |

Daten liegen online, damit Handy und PC denselben Stand haben. Anmeldung nur für Stephan (Krümel-Mail).

Erwartete Größe: 200–400 Minifiguren, 20–50 Sets, dazu Dioramen und Sonderteile. Die Planung rechnet mit dem Doppelten als Puffer.

## 3. Was die App verwaltet

| Objekt | Beschreibung |
|---|---|
| **Minifigur** | Offizielle LEGO-Figur, Figur eines anderen Herstellers oder gekaufte Custom-Figur. Kann modifiziert sein. Jedes Exemplar ist ein eigener Eintrag. |
| **Modifikation** | Getauschtes Teil an einer Figur (z. B. bedruckte Custom-Arme). |
| **Set** | Offizielles LEGO-Set oder Set eines anderen Herstellers (z. B. Bluebrixx). |
| **MOC / Diorama** | Eigener Bau mit Fotos, Links, Studio-Datei und den darin ausgestellten Figuren. |
| **Sonderteil** | GWP, Sammelmünzen und ähnliche Einzelstücke. |
| **Wunschliste** | Figuren und Sets, die Stephan noch haben möchte. |

Jedes Objekt hat einen **Hersteller**: LEGO, Bluebrixx, sonstiger Hersteller oder Custom-Anbieter (Name frei).

## 4. Funktionale Anforderungen

### F1 Erfassen per Foto
- Foto aufnehmen (Handy) oder hochladen (PC).
- Die App lässt das Foto von Brickognize erkennen (kostenlos) und zeigt die besten Vorschläge mit Bild, Name, Nummer und Trefferquote.
- Stephan wählt einen Vorschlag; die Katalogdaten werden übernommen (F2). Passt keiner, geht es mit Nummer, Link oder manuell weiter.
- Das eigene Foto wird an der Figur gespeichert.

Akzeptanzkriterien:
- Foto einer offiziellen Minifigur → mindestens ein Vorschlag mit BrickLink-Nummer (z. B. `sw0001`), auswählbar mit einem Tipp.
- Kein Treffer oder Dienst nicht erreichbar → verständlicher Hinweis und direkte Weiterleitung zur Eingabe per Nummer.

### F2 Erfassen per Nummer oder Suche
- Eingabe einer Set- oder Figurennummer oder Suche nach Namen.
- Für offizielle LEGO-Items füllt die App automatisch aus: Name, Nummer, Thema/Reihe, Jahr, Teilezahl, Katalogbild; bei Sets die enthaltenen Figuren; bei Figuren die Sets, in denen sie vorkommt.

### F3 Erfassen per Link
- Link einfügen: Rebrickable (Set oder MOC), Merlins Steine SetDB oder Webseite eines anderen Herstellers.
- Bei Rebrickable-Sets holt die App die Daten über die Schnittstelle.
- Bei Merlins Steine liest die App die eingefügte Seite einmalig aus und übernimmt, was sich zuverlässig erkennen lässt (Name, Hersteller, Setnummer, Teilezahl, Bild). Kein Massenabruf, nur die eine Seite pro Link.
- Bei MOCs und anderen Herstellern übernimmt die App, wenn möglich, Titel und Vorschaubild der Seite.
- Alles, was nicht erkannt wird, trägt Stephan ein. Der Link bleibt am Objekt gespeichert.

Akzeptanzkriterien:
- Seite nicht lesbar oder Aufbau geändert → die Erfassung öffnet sich trotzdem, mit gespeichertem Link und leeren Feldern; kein Abbruch.

### F4 Manuell erfassen und bearbeiten
- Jedes Objekt lässt sich vollständig von Hand anlegen, bearbeiten und löschen.

### F5 Minifiguren
Felder:
- Name, Katalognummer (falls vorhanden), Hersteller, Thema/Reihe
- **Zustand:** neu · gebraucht
- **Stammt aus Set:** Katalogangabe; optional verknüpft mit einem Set aus der eigenen Sammlung
- **Quelle / Herkunft:** wo erworben (Freitext oder Link), Datum, Kaufpreis
- Eigene Fotos (mehrere), Katalogbild
- **Modifiziert:** ergibt sich automatisch, sobald mindestens eine Modifikation erfasst ist (F6)
- Aktueller Wert (F10), Notiz

Mehrere Exemplare:
- Jedes Exemplar ist ein eigener Eintrag mit eigenen Fotos, eigenem Zustand und eigenen Mods.
- „Weiteres Exemplar anlegen“ übernimmt die Katalogdaten einer vorhandenen Figur.
- Die Vitrine fasst gleiche Figuren zu einer Kachel mit Anzahl zusammen (z. B. „×3“); ein Tipp zeigt die einzelnen Exemplare.

### F6 Modifikationen
- Je Figur eine Liste getauschter Teile.
- Felder je Teil: Position (Kopf, Torso, Arme, Hände, Beine, Kopfbedeckung, Zubehör, Sonstiges), Beschreibung, Anbieter, Link, Preis, Verbleib des Originalteils (Freitext).
- Die Preise der Mod-Teile zählen **nicht** zum Wert der Figur. Sie werden als „Ausgaben für Mods“ angezeigt (je Figur und im Dashboard).
- Ein Teilelager für noch nicht verbaute Custom-Teile gibt es in Version 1 nicht.

### F7 Sets
- Felder: Nummer, Name, Hersteller, Thema, Jahr, Teilezahl, Anzahl Figuren, Quelle, Kaufpreis, Wert, Fotos, Notiz.
- **Zustand:** neu (versiegelt) · gebraucht.
- **Status:** vollständig · Figuren entnommen · zerlegt.
- Die enthaltenen Figuren werden angezeigt; Figuren aus der eigenen Sammlung sind damit verknüpft.

### F8 MOCs / Dioramen
- Felder: Name, Fotos, Links (z. B. Rebrickable), Teilezahl (optional), Notiz.
- **Studio-Datei hochladen:** eine oder mehrere `.io`-Dateien je MOC; jederzeit wieder herunterladbar. Die App dient damit als dauerhafter Ablageort.
- Beliebig viele Figuren aus der Sammlung lassen sich zuordnen. Eine Figur steht in höchstens einem Diorama.
- An jeder Figur ist sichtbar, wo sie steht („Steht in“).
- **Steht in:** Eine Figur kann statt in einem Diorama auch in einem eigenen Set ausgestellt sein. Ihr Ort ist ein Diorama oder ein eigenes Set oder keiner, nie beides. Stammt eine Figur aus einem eigenen Set mit Status „vollständig“ und hat keinen eigenen Ort, gilt sie als in diesem Set ausgestellt (Automatik); bei „Figuren entnommen“ und „zerlegt“ nicht. Die Seite des Sets zeigt die „Ausgestellten Figuren“, auch Figuren aus anderen Sets. Eine Figur, die weder in einem Diorama noch in einem Set steht, ist „nicht ausgestellt“.

Akzeptanzkriterien:
- Figur einem Diorama zuordnen → sie erscheint in der Detailansicht des Dioramas und verschwindet aus dem Filter „nicht ausgestellt“.
- Diorama löschen → zugeordnete Figuren bleiben erhalten und sind wieder „nicht ausgestellt“.
- Figur einem Set zuordnen → sie steht nicht mehr in ihrem Diorama (nie beides), erscheint unter „Ausgestellte Figuren“ des Sets und verschwindet aus dem Filter „nicht ausgestellt“.
- Eine Figur aus einem eigenen, vollständigen Set ohne eigenen Ort steht automatisch in diesem Set; wird der Status „Figuren entnommen“ oder „zerlegt“, nicht mehr.
- Eine automatisch ausgestellte Figur „aus dem Set nehmen“ → nur sie ist nicht mehr ausgestellt, die anderen Figuren und der Status des Sets bleiben.
- Set löschen → Figuren, die darin standen, bleiben erhalten und stehen nicht mehr in einem Set.
- Hochgeladene Studio-Datei herunterladen → die Datei ist byte-gleich mit dem Original.

### F9 Sonderteile
- Felder: Art (GWP, Sammelmünze, Sonstiges), Name, Nummer (optional), Hersteller, Zustand, Quelle, Kaufpreis, Wert, Fotos, Notiz.

### F10 Wert und Wertentwicklung
- **Offizielle LEGO-Figuren, -Sets und -Sonderteile:** Marktwert aus dem BrickLink-Preisguide (Ø Verkaufspreis der letzten 6 Monate) passend zum Zustand (neu oder gebraucht), in Euro.
- **Modifizierte offizielle Figuren:** Es gilt der Marktwert der Original-Figur im eingetragenen Zustand.
- **Custom-Figuren, andere Hersteller, MOCs:** Kaufpreis oder ein von Stephan geschätzter Wert.
- Die App ruft die Marktwerte regelmäßig ab (z. B. wöchentlich) und speichert jeden Stand – jeweils neu und gebraucht. Daraus entstehen der Verlauf je Objekt und der Verlauf des Gesamtwerts.
- Je Objekt sichtbar: Kaufpreis, aktueller Wert, Differenz, Verlauf; zusätzlich der Preis im jeweils anderen Zustand zum Vergleich.

Akzeptanzkriterien:
- Offizielle Figur, Zustand gebraucht, BrickLink gebraucht 12 € / neu 18 € → Wert 12 €.
- Dieselbe Figur mit Mod-Teil für 5 € → Wert weiterhin 12 €; „Ausgaben für Mods“ 5 €.
- Zustand von gebraucht auf neu geändert → Wert sofort 18 €, ohne neuen Abruf.
- Nach jedem Abruf gibt es je offiziellem Objekt genau einen neuen Preisstand mit Datum.
- Ein fehlgeschlagener Abruf überschreibt keinen vorhandenen Wert; das Objekt zeigt „Stand vom …“.
- Objekte ohne Marktwert und ohne eingetragenen Wert zählen im Gesamtwert mit 0 € und werden als „ohne Wert“ ausgewiesen.

### F11 Vitrine (Startseite)
- Bildraster aller Objekte, eigene Fotos vor Katalogbild; gleiche Figuren gruppiert (F5).
- Suche, Filter (Objektart, Thema/Reihe, Hersteller, Zustand, modifiziert, nicht ausgestellt) und Sortierung (zuletzt hinzugefügt, Name, Wert).
- Tipp auf ein Bild öffnet die Detailansicht.

### F12 Dashboard
- Gesamtwert mit Verlauf; Kaufsumme gegenüber aktuellem Wert; Ausgaben für Mods.
- Anzahl je Objektart; Verteilung nach Thema/Reihe.
- Wertvollste Objekte.
- Figuren, die nicht ausgestellt sind (weder in einem Diorama noch in einem Set).

### F13 Fehlende Figuren
- Stephan wählt eine Reihe oder ein Thema (z. B. „Star Wars – The Clone Wars“).
- Die App zeigt alle offiziellen Figuren daraus mit Status: vorhanden · fehlt · auf der Wunschliste.
- Fehlende Figuren lassen sich mit einem Tipp auf die Wunschliste setzen.
- Zusätzlich gilt alles auf der Wunschliste als „fehlend“.

### F14 Wunschliste
- Figuren und Sets, per Suche, Nummer, Link oder aus F13.
- Je Eintrag: **Priorität** (hoch · mittel · niedrig), **Zielpreis** (optional), gewünschter Zustand, aktueller Marktpreis (falls verfügbar), Notiz.
- Liegt der Marktpreis auf oder unter dem Zielpreis, ist der Eintrag deutlich als „Zielpreis erreicht“ markiert und steht oben.
- Sortierung nach Priorität, Preis oder Name.
- „Erhalten“ verschiebt den Eintrag in die Sammlung und öffnet die Erfassung mit vorausgefüllten Daten.

Akzeptanzkriterien:
- Zielpreis 20 €, Marktpreis 19,50 € → „Zielpreis erreicht“; Marktpreis 20,01 € → keine Markierung.
- Kein Zielpreis oder kein Marktpreis → keine Markierung.

### F15 Datensicherung
- Export aller Daten (inklusive Fotos und Studio-Dateien) als Datei und Import aus dieser Datei.

## 5. Rahmenbedingungen

- **N1 Kosten:** Betrieb kostenlos. Externe Dienste nur mit kostenlosem Zugang.
- **N2 Geräte:** responsiv für PC und Handy; als PWA auf Android installierbar; Kamera am Handy nutzbar.
- **N3 Sprache:** Deutsch; Beträge in Euro.
- **N4 Lizenz:** Open Source keine Pflicht.
- **N5 Barrierefreiheit:** keine formale Anforderung.
- **N6 Abhängigkeiten:** so wenige wie möglich; jede neue Bibliothek wird begründet.
- **N7 Anmeldung:** nur ein Konto (Stephan); alle Daten privat.
- **N8 Speicherplatz:** Fotos werden beim Hochladen verkleinert (längste Seite ca. 1.600 px, modernes Bildformat, ca. 200–300 KB). Schätzung bei doppeltem Mengengerüst: unter 1 GB inklusive Studio-Dateien – muss in eine kostenlose Speicherstufe passen.

## 6. Externe Datenquellen

| Dienst | Wofür | Zugang | Status |
|---|---|---|---|
| Rebrickable | Katalog: offizielle LEGO-Sets, Figuren, Themen, Teilezahlen, Bilder | kostenloser API-Schlüssel | geklärt |
| Brickognize | Fotoerkennung | kostenlos | vor der Umsetzung testen |
| BrickLink | Marktwerte neu/gebraucht (Preisguide) | Konto mit Zugangsschlüsseln; laut mehreren Quellen Registrierung als Verkäufer nötig; Limit 5.000 Abfragen/Tag | **Risiko – vor der Umsetzung prüfen** |
| Merlins Steine SetDB (https://www.merlinssteine.de/setdb/) | Sets anderer Hersteller (ca. 39.000 Sets von 92 Herstellern) | keine Schnittstelle; die App liest einzelne eingefügte Seiten | vor der Umsetzung Seitenaufbau prüfen |

Fällt BrickLink weg, gibt es für Marktwerte keine kostenlose Alternative mit Schnittstelle (BrickEconomy nur mit Premium-Abo). Dann gilt für alle Objekte der eingetragene Wert.

Ändert Merlins Steine den Seitenaufbau, kann das Auslesen jederzeit ausfallen. F3 ist so gebaut, dass dann nur der Komfort fehlt, nicht die Funktion.

## 7. Qualität und Tests

Wie bei Krümel: Jeder Stand ist ohne Claude und ohne Tokens prüfbar (`npm run check`: Formatierung, Linting, Typprüfung, Tests mit Abdeckung, Build; End-to-End-Tests in Desktop- und Handygröße; Prüfung bei jedem Hochladen auf GitHub; Prüfung vor jedem Commit; Dependabot). Externe Dienste werden in Tests durch feste Beispielantworten ersetzt. Jedes Akzeptanzkriterium ist mindestens ein Test.

## 8. Sparsamer Umgang mit Tokens

Wie bei Krümel: kurze `CLAUDE.md`, eine Aufgabe pro Sitzung, vor einer Frage an Claude läuft `npm run check`, klare Ordnerstruktur.

## 9. Bewusst nicht in Version 1

Fotoerkennung über die Claude-API, Teilelager für Custom-Teile, Teilelisten von MOCs importieren, Verkaufen, weitere Nutzer, Push-Benachrichtigungen (auch für „Zielpreis erreicht“).
