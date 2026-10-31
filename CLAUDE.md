# Stud Stephan – Hinweise für Claude

Persönliche App von Stephan (einziger Nutzer) für seine Klemmbaustein-Sammlung: Minifiguren (offiziell, modifiziert, custom), Sets, Sonderteile, MOC-Dioramen, Wunschliste, Marktwerte. Anzeigename „Stud Stephan“, im Code `stud-stephan`. Online: https://stephan-pro.github.io/stud-stephan/

Doku: Anforderungen `docs/ANFORDERUNGEN.md` · Screens und Abläufe `docs/STRUKTUR.md` · Design `docs/design/DESIGN.md` · Plan und Arbeitspakete `docs/UMSETZUNG.md` · Einrichtung für den PO `docs/EINRICHTUNG.md`. `docs/design/dummy/*.dc.html` ist der abgenommene Klick-Dummy: nur als Referenz für Aufbau, Farben, Größen und Texte lesen, nicht lauffähig, nie in die App kopieren.

## Stand

P3: Gerüst mit Navigation und leeren Seiten; Datenmodell und Fachlogik in `src/domain/`, Demo-Daten in `src/demo/` (noch nicht in der Oberfläche). Fortschritt: Tabelle in `docs/UMSETZUNG.md`, Abschnitt 4.

## Befehle

- **Nach Änderungen `npm run check` ausführen und nur die Kurzausgabe lesen** (Erfolg = eine Zeile; Fehler = nur Datei, Zeile, Meldung). Berichte und Traces bleiben auf der Platte.
- `npm run check` – Biome → tsc → Vitest mit Abdeckung → Build → Playwright (chromium-desktop). Schreibt nichts um. Muss grün sein; läuft bei jedem Push in CI.
- `npm run check:full` – wie `check`, Playwright in allen vier Projekten. Vor einem Release.
- `npm run fix` – einzige Stelle, die formatiert (`biome check --write .`).
- `npm run dev` · `npm run demo` (Beispieldaten aus `src/demo/`) · `npm run setup` (Pakete + Playwright-Browser).
- `npm run try:sources` – P2, nur der PO in seinem Terminal (liest `.env.local`, ruft echte Dienste auf, gibt keine Schlüssel aus). Code in `src/sources/` (Tests mit Fake-Fetch), Ergebnis in `docs/DATENQUELLEN.md`.
- `npm run check:db` – ab P4a, nur in CI (der PO hat kein Docker).
- `/paket <Kennung> [Hinweise]` – setzt ein Arbeitspaket aus `docs/UMSETZUNG.md` um (Skill `.claude/skills/paket/SKILL.md`).
- Vorschau im Browser-Fenster: `.claude/launch.json` → `demo` (Port 5190), dann `http://localhost:5190/stud-stephan/` öffnen.

## Aufbau

- `src/main.tsx` lädt Schriften, `src/ui/tokens.css` (alle Design-Werte) und `src/ui/app.css`, zeichnet `src/ui/App.tsx`.
- `src/ui/route.ts` – Hash-Router (`#/vitrine` …), reine Funktionen. `src/ui/texts.ts` – alle Texte.
- `src/ui/components/` – `Navigation` (Handy-Leiste und PC-Seitenleiste), `PageHeader` (die eine `h1`, bekommt nach Seitenwechsel den Fokus), `Icon` (SVG-Pfade aus dem Dummy).
- `src/domain/` – `types.ts` (alle Objekte, `SCHEMA_VERSION`), `money.ts` (`formatMoney` …), `prices.ts` (Marktpreis, Preisabruf `recordPriceRun`), `value.ts` (`valueOfItem`, `modSpend`), `totals.ts`, `showcase.ts` (Gruppen ×3, Filter, Sortierung), `dioramas.ts`, `wishlist.ts`, `series.ts`. Testbausteine `fixtures.ts` (`aMinifig`, `aPrice`, `aCollection` …).
- `src/demo/collection.ts` – `DEMO_COLLECTION`, `DEMO_SERIES`, `DEMO_TODAY` nach dem Klick-Dummy.
- Tests: `*.test.ts` neben dem Code; `tokens.test.ts` prüft Tokens gegen DESIGN.md und Kontraste, `designRules.test.ts` verbietet feste Farben, Radien und Abstände außerhalb von `tokens.css`. E2E in `tests/e2e/` (`helpers.ts`: Größen `PHONE`/`PC`, `expectNoAccessibilityViolations`).
- `scripts/check.mjs` (Kurzausgabe), `scripts/short-reporter.mjs`, `scripts/scan-secrets.mjs` (Pre-Commit-Hook `.githooks/`).
- Workflows: `check` (jeder Push), `pages` (nach grünem `check` auf `main`), `check-full` (nachts, von Hand).

## Regeln

- Stack wie Krümel: Preact, TypeScript strict, Vite, Biome, Vitest, Playwright + axe, Supabase, GitHub Pages. Neue Abhängigkeiten nur mit Begründung in `docs/UMSETZUNG.md` (Abschnitt „Abhängigkeiten“, beim ersten Eintrag anlegen).
- Code-Namen englisch, Oberfläche nur Deutsch. Texte der Oberfläche zentral in `src/ui/texts.ts`, nie verstreut in Komponenten.
- Fachlogik in `src/domain/`: reine Funktionen, kein DOM, kein Speicher, „heute“ als Parameter (`"YYYY-MM-DD"`), Abdeckung ≥ 90 %.
- Geld immer als ganze Cent (`number`), Anzeige über eine Formatierfunktion (`12,50 €`).
- Jedes Akzeptanzkriterium ist mindestens ein Test, benannt nach dem Kriterium. Jede neue Seite und jeder Dialog bekommt einen E2E-Test mit axe.
- Farben, Radien, Abstände nur über die Tokens aus `DESIGN.md` (`src/ui/tokens.css`); keine festen Werte in Komponenten.
- Keine Markenzeichen von LEGO (Logo, Minifigur-Silhouette) in Symbolen oder Bildern.
- **Geheimnisse:** API-Schlüssel (Rebrickable, BrickLink), Datenbank-Passwort, Service-Role-Key und SMTP-Passwort kommen nie ins Repo, in Tests, Logs, Chat oder Bildschirmfotos. Lokal nur in `.env.local`, auf dem Server nur als Supabase-Secrets. Öffentlich sind nur `VITE_SUPABASE_URL` und `VITE_SUPABASE_PUBLISHABLE_KEY`. Claude erzeugt und sieht keine Schlüssel; die Befehle dazu führt der PO selbst aus.
- Externe Dienste ruft nur eine Edge Function auf, nie die App direkt. `npm run check` braucht weder Internet noch Docker noch Schlüssel (Fake-Server und aufgezeichnete Antworten).
- Dateien immer mit dem Write- oder Edit-Werkzeug anlegen und ändern, nie per Shell (kein `echo >`, Heredoc, `sed -i`, `node -e`).
- Entwicklungsumgebung: Windows mit PowerShell; Shell-Befehle nur zum Ausführen (npm, git, gh, npx supabase), in PowerShell-Syntax.
- Der PO ist Einsteiger: Schritte für ihn immer nummeriert, mit genauen Klicks, vollständigen Adressen und kompletten Befehlen; nichts abkürzen.

## Wortliste

| Oberfläche | Code |
|---|---|
| Vitrine | showcase |
| Minifigur / Exemplar | minifig / copy |
| Modifikation / Mod-Teil | mod / modPart |
| Ausgaben für Mods | modSpend |
| Set / Status (vollständig · Figuren entnommen · zerlegt) | legoSet / setStatus (`complete`, `figuresRemoved`, `disassembled`) |
| Sonderteil (GWP, Sammelmünze) | specialPart (`gwp`, `coin`, `other`) |
| Diorama / Studio-Datei | diorama / studioFile |
| Hersteller | manufacturer |
| Zustand (neu · gebraucht) | condition (`new`, `used`) |
| Herkunft / Quelle | source |
| Kaufpreis | purchasePrice |
| Marktwert / Preisstand | marketValue / pricePoint |
| Wert (selbst geschätzt) | manualValue |
| Wunschliste / Priorität / Zielpreis | wishlist / priority (`high`, `medium`, `low`) / targetPrice |
| Zielpreis erreicht | targetReached |
| Reihe (Thema) / Fortschritt | series / seriesProgress |
| Erfassen | capture |
| Fotoerkennung | recognition |
| Katalog | catalog |
| Datensicherung (Export/Import) | backup (exportData/importData) |
