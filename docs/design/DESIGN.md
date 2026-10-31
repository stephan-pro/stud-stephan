# Stud Stephan – Design

Stand: 31.10.2026 · Version 1.0 · Stilrichtung F „Steinkasten-Mix“ (abgenommen)

Vorlage: der Klick-Dummy in `docs/design/dummy/` (je Screen eine `.dc.html`-Datei; Quelltext eines Design-Tools, nicht lauffähig – nur als Referenz für Aufbau, Farben, Größen und Texte lesen). Die Beispieldaten darin sind ausgedacht.

## 1. Grundsätze

- **Vitrine zuerst:** Fotos sind der Star. Alles andere ist Rahmen.
- **Steinkasten-Gefühl:** dicke dunkle Rahmen, runde Formen, Noppen als kleines Motiv, Pastellfarben.
- **Persönlich:** „Hey Stephan“ und ein Satz zum Gesamtwert statt einer nüchternen Kennzahl.
- **Handgemacht:** Kritzelstriche und Handschrift für Titel und Preise – sparsam, nie für Fließtext.
- Keine Emojis, keine Verläufe, keine Schatten. Keine Markenzeichen von LEGO (Logo, Minifigur-Silhouette).
- Alle Werte als CSS-Variablen (Tokens); Komponenten nutzen nur Tokens.

## 2. Farben

| Token | Wert | Verwendung |
|---|---|---|
| `--bg` | #F4F5F7 | Seitenhintergrund |
| `--surface` | #FFFFFF | Karten, Kacheln, Eingabefelder |
| `--ink` | #14213D | Text, Rahmen, Noppen, Haupt-Knöpfe |
| `--ink-muted` | #4A5470 | Metazeilen, Labels (7,6:1 auf Weiß) |
| `--nav` | #111111 | Navigation (Handy-Leiste, PC-Seitenleiste) |
| `--accent` | #FFC93C | Sammlungskarte, Wert-Karten, Hervorhebungen |
| `--pop` | #F59AD6 | „Ich“ und „Neu“: Avatar, Plus-Knopf, Auswahl, Mod-Marker |
| `--tint-blue` | #9DC3F0 | Foto-Platzhalter, Priorität „niedrig“ |
| `--tint-pink` | #F59AD6 | Foto-Platzhalter, Priorität „hoch“ |
| `--tint-mint` | #B5E5CC | Foto-Platzhalter, „Zielpreis erreicht“, „aus Katalog übernommen“ |
| `--tint-sand` | #F2DDB8 | Foto-Platzhalter |
| `--tint-lilac` | #D9CCF7 | Foto-Platzhalter |
| `--positive` | #11552B | Wertzuwachs (Pfeil, Prozent) |
| `--danger` | #A3261C | Löschen, fehlgeschlagen |
| `--scrim` | rgba(20,33,61,0.45) | Abdunklung hinter Bottom-Sheets |

Text auf `--accent`, `--pop` und allen Tints ist immer `--ink`. Text auf `--nav` ist Weiß.

## 3. Schrift

- **Rubik** (400, 500, 700, 800) für alles Funktionale; selbst gehostet.
- **Mali** (700) für Handschrift: Seitentitel, Kartentitel, Preise und große Zahlen; selbst gehostet.
- Seitentitel 30 px Mali · Kartentitel 22 px Mali · großer Wert 42–46 px Mali · Preis in Kachel 21 px Mali.
- Objekttitel 15 px Rubik 700 · Metazeile 12–13 px Rubik 400 · Labels 13–14 px Rubik 700.

## 4. Form und Abstände

- **Rahmen:** 2 px `--ink` an Karten mit Farbe, Kacheln, Eingaben, Chips und Pills.
- **Radien:** Karten und Kacheln 22 px · Bottom-Sheet oben 28 px · Eingaben 14 px · Chips, Pills, Knöpfe, Navigation 999 px.
- Seitenrand 18 px (Handy), Abstand zwischen Karten 12–14 px.
- Tippflächen mindestens 44 × 44 px; runde Icon-Knöpfe 50 px.
- Unten 110 px frei, damit die schwebende Navigation nichts verdeckt.

## 5. Muster und Motive

- **Kritzelstriche:** weiße diagonale Linien (Strichstärke 5 px, Deckkraft 50–55 %, runde Enden, Steigung ca. 60°) über farbigen Flächen: Sammlungskarte, Wert-Karten, Foto-Platzhalter, Avatar. Nie über Text in Weiß.
- **Noppen:** vier Punkte (8 px, `--ink`) über „Hey Stephan“ und auf der Anmeldeseite. Sonst nicht.
- **Foto-Platzhalter:** Tint-Fläche mit Kritzelstrichen und Bild-Symbol, bis ein eigenes Foto oder das Katalogbild da ist.

## 6. Komponenten

- **Sammlungskarte (Vitrine oben):** `--accent`, Rahmen, Kritzel. Inhalt: „Stud Stephan“ + Wachstums-Pill · Trennlinie · „Deine Sammlung ist **4.820 €** wert“ · Pills „Figuren · Sets · Dioramen“.
- **Kachel (Vitrine):** weiß, Rahmen, Foto-Bereich oben (132 px) mit Markern „×3“ (`--ink`), „Mod“ (weiß mit Rahmen), „Kein Diorama“; darunter Name, Metazeile, Preis in Mali.
- **Wert-Karte (Details):** wie Sammlungskarte, mit Kaufpreis, Differenz, Mini-Verlauf, Preis im anderen Zustand, „Stand vom …“.
- **Chips:** aktiv `--ink` gefüllt mit weißer Schrift, sonst weiß mit Rahmen.
- **Haupt-Knopf:** `--ink`, weiße Schrift, Höhe 52 px. **Zweit-Knopf:** weiß mit Rahmen. **Gefahr:** weiß, Rahmen und Schrift `--danger`.
- **Bottom-Sheet (Handy) / Dialog (PC):** weiß, Griff oben, Titel in Mali, Aktionen unten.
- **Fortschrittsbalken (Reihen):** 12 px hoch, Rahmen, Füllung `--pop`.

## 7. Navigation

- **Handy:** schwebende Leiste unten (16 px Rand, Höhe 68 px, Radius 999 px), `--nav`. Einträge: Vitrine · Dioramen · [Plus] · Wunschliste · Dashboard. Aktiver Eintrag als weiße Pille mit Symbol und Text, übrige nur Symbol mit `aria-label`. Plus-Knopf rund in `--pop`.
- **PC:** Seitenleiste links (240 px, `--nav`, Radius 28 px, 16 px Abstand zum Rand) mit denselben Einträgen, alle mit Text; „Erfassen“ als `--pop`-Knopf oben. Inhalt rechts, Vitrine mit 5–6 Spalten.
- Avatar „S“ (`--pop`) oben links öffnet die Einstellungen.

## 8. Bewegung

- Antippen: Kachel und Knöpfe drücken sich kurz ein (scale 0,97, unter 150 ms).
- Bottom-Sheets gleiten von unten herein (unter 250 ms).
- Bei `prefers-reduced-motion: reduce` keine Animationen.
