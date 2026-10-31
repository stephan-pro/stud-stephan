# Stud Stephan – Einrichtung Schritt für Schritt

Stand: 31.10.2026 · Für den Product Owner. Jeder Schritt mit genauen Klicks und Befehlen. Befehle sind für **PowerShell** unter Windows.

So liest du die Anleitung:
- `Grau hinterlegt` = genau so abtippen oder kopieren.
- **Fett** = so heißt der Knopf oder Menüpunkt auf dem Bildschirm.
- Zugangsschlüssel und Passwörter gehören **nie** in den Chat, in Bildschirmfotos oder ins Repository. Sie bleiben bei den Diensten selbst (Rebrickable und BrickLink zeigen sie dir jederzeit wieder an) und stehen zusätzlich nur in der Datei `.env.local` auf deinem PC. Ein Passwortmanager ist nicht nötig.

## Überblick: Was wann dran ist

| Teil | Wann | Dauer |
|---|---|---|
| A – Repository und Ordner | jetzt | ca. 10 Minuten |
| B – Konten bei Rebrickable und BrickLink | vor Paket P2 | ca. 20 Minuten |
| C – Supabase-Projekt | vor Paket P4a | ca. 10 Minuten |
| D – So läuft jedes Arbeitspaket | ab Paket P1, immer gleich | – |

---

## Teil A – Repository und Ordner

Ein **Repository** („Repo“) ist der Ordner deines Projekts auf GitHub, mit allen Versionen. Dein PC hat eine Kopie davon; Claude Code arbeitet in der Kopie und lädt Änderungen hoch („push“).

### A1 Repository auf GitHub anlegen

1. Öffne https://github.com/new (du bist als `stephan-pro` angemeldet).
2. **Owner:** `stephan-pro`.
3. **Repository name:** `stud-stephan`
4. **Description:** `Meine Klemmbaustein-Sammlung als Vitrine`
5. Wähle **Public**.
6. **Add README:** aus lassen.
7. **Add .gitignore:** `No .gitignore` lassen.
8. **Choose a license:** `None` lassen. Die EUPL-1.2 steht nicht in der Auswahl; die Datei `LICENSE` kommt mit den Startdateien.
9. Unten auf **Create repository** klicken.

Danach ist das Repo unter https://github.com/stephan-pro/stud-stephan erreichbar.

### A2 Startdateien hineinlegen lassen

Schreib mir im Chat: „Repo ist angelegt“. Ich lege dann diese Startdateien an und lade sie hoch:
- `CLAUDE.md` (Hinweise für Claude Code)
- `.claude/skills/paket/SKILL.md` (der Befehl `/paket`) und `.claude/settings.json`
- `docs/ANFORDERUNGEN.md`, `docs/STRUKTUR.md`, `docs/design/DESIGN.md`, `docs/UMSETZUNG.md`, `docs/EINRICHTUNG.md`
- `docs/design/dummy/` (alle Screens des Klick-Dummys als Vorlage)

Dafür fragt dich die App einmal, ob ich Schreibzugriff auf das Repo bekomme. Bestätige das.

### A3 Kopie auf deinen PC holen

1. Öffne den **Explorer** und geh zu dem Ordner, in dem dein Ordner `putzplan` liegt (also eine Ebene darüber).
2. Klick oben in die Adresszeile, sodass der Pfad markiert ist, und kopiere ihn mit `Strg+C`.
3. Öffne **PowerShell**: Windows-Taste drücken, `PowerShell` tippen, Enter.
4. Tippe `cd "` , füge den Pfad mit `Strg+V` ein, tippe `"` und drück Enter. Beispiel: `cd "C:\Users\Stephan\Projekte"`
5. Hol die Kopie:
   ```
   git clone https://github.com/stephan-pro/stud-stephan.git
   ```
6. Wechsle hinein:
   ```
   cd stud-stephan
   ```
7. Prüfe, ob meine Startdateien da sind:
   ```
   git log --oneline
   ```
   Du solltest eine Zeile mit „Startdateien“ sehen. Fehlt sie, hast du A2 noch nicht abgewartet: dann `git pull` eingeben.

### A4 Ordner in Claude Code öffnen

1. Öffne die **Claude-Desktop-App** und wechsle oben in den Bereich **Code**.
2. Wähle als Ordner `stud-stephan` (den Ordner aus A3).
3. Fertig. Paket P1 startest du wie in Teil D beschrieben.

---

## Teil B – Konten bei Rebrickable und BrickLink (vor Paket P2)

Paket P2 prüft, was die Dienste wirklich liefern. Dafür braucht es deine Zugangsschlüssel auf deinem PC.

### B1 Rebrickable (Katalog, kostenlos)

1. Konto anlegen: https://rebrickable.com/register/ (falls du noch keins hast), E-Mail bestätigen.
2. Öffne https://rebrickable.com/api/ und folge dem Link zum API-Schlüssel. Er führt in deine Kontoeinstellungen, Reiter **API**. Dort auf **Generate new API Key** klicken.
3. Nichts weiter aufbewahren: Der Schlüssel steht jederzeit auf dieser Seite, wenn du angemeldet bist. Du kopierst ihn in Schritt B3 direkt von dort. Erledigt am 31.10.2026.

### B2 BrickLink (Marktwerte)

1. Konto anlegen oder anmelden: https://www.bricklink.com/
2. Öffne https://www.bricklink.com/v2/api/register_consumer.page und bestätige die API-Nutzungsbedingungen.
3. **Wenn BrickLink jetzt eine Registrierung als Verkäufer verlangt:** Hier nicht weitermachen, sondern ein Bildschirmfoto der Meldung machen (ohne Schlüssel darauf) und es mir schicken. Wir entscheiden dann gemeinsam, ob du das willst. Ohne BrickLink trägst du Werte von Hand ein.
4. Sonst: Unter **Access Token** einen neuen Zugang anlegen. Bei **IP Address** und **IP Mask** jeweils `0.0.0.0` eintragen. Das heißt „von überall“; nötig, weil später der Server in Supabase die Preise abruft.
5. Du bekommst vier Werte: **Consumer Key**, **Consumer Secret**, **Token Value**, **Token Secret**. Sie stehen jederzeit auf https://www.bricklink.com/v2/api/register_consumer.page; du kopierst sie in Schritt B3 direkt von dort.

Stand 31.10.2026: Als Verkäufer angemeldet und API registriert, aber **nicht verifiziert** (die drei Schritte „Become a verified seller“ mit Versandart, Artikel und Ausweis sind bewusst nicht erledigt). P2 prüft, ob der Preisguide trotzdem antwortet.

### B3 Schlüssel auf dem PC hinterlegen

Erst möglich, wenn Paket P1 fertig ist (dann gibt es die Vorlage `.env.example`).

1. PowerShell im Ordner `stud-stephan` öffnen (wie A3, Schritte 3, 4 und 6).
2. Vorlage kopieren:
   ```
   Copy-Item .env.example .env.local
   ```
3. Datei öffnen:
   ```
   code .env.local
   ```
4. Hinter jedes `=` den passenden Wert einfügen, direkt kopiert von der Seite des Dienstes (Rebrickable: https://rebrickable.com/api/ → **Generate an API Key**; BrickLink: https://www.bricklink.com/v2/api/register_consumer.page). Die beiden Supabase-Zeilen bleiben vorerst leer (kommen mit P4a). Speichern (`Strg+S`), schließen.

`.env.local` wird nie hochgeladen (sie steht in `.gitignore`, und der Prüf-Hook bricht ab, falls doch ein Schlüssel auftaucht).

### B4 Ein Probefoto

1. Fotografier eine **offizielle** Minifigur mit dem Handy vor einem einfarbigen Hintergrund.
2. Speichere das Foto im Projekt als `scripts\samples\minifig.jpg` (den Ordner legt P2 an).

---

## Teil C – Supabase-Projekt (vor Paket P4a)

Supabase ist die Datenbank mit Anmeldung und Dateispeicher, wie bei Krümel.

1. Öffne https://supabase.com/dashboard und melde dich an wie bei Krümel.
2. Klick auf **New project**.
3. **Organization:** deine Organisation (dieselbe wie bei Krümel).
4. **Project name:** `stud-stephan`
5. **Database Password:** auf **Generate a password** klicken. Du brauchst es nur einmal in P4a beim Befehl `npx supabase link`. Supabase zeigt es danach nicht wieder an; geht es verloren, setzt du es im Dashboard neu (Project Settings → Database → **Reset database password**).
6. **Region:** `Europe` (oder, falls die Liste es anbietet, Frankfurt).
7. **Security:** **Enable Data API** an lassen · **Automatically expose new tables** ausschalten · **Enable automatic RLS** einschalten. (Einen Plan wählst du hier nicht; das Projekt übernimmt den kostenlosen Tarif deiner Organisation.)
8. **Create new project** klicken und warten, bis das Projekt bereit ist (ein paar Minuten).

Gut zu wissen: Krümel und Stud Stephan belegen damit deine zwei kostenlosen Projekte. Ein drittes kostenloses Projekt ginge erst, wenn eins pausiert ist.

Alles Weitere (Projekt verknüpfen, Tabellen einspielen, Geheimnisse setzen) bekommst du mit genauen Befehlen im Abschlussbericht der Pakete P4a, P4b, P7, P8 und P11.

---

## Teil D – So läuft jedes Arbeitspaket

Die Pakete stehen in `docs/UMSETZUNG.md` (Tabelle in Abschnitt 4). Immer eins nach dem anderen, von oben nach unten.

### D1 Paket starten

1. Claude-Desktop-App → **Code** → Ordner `stud-stephan`.
2. **Neue Sitzung** starten (für jedes Paket eine eigene; das spart Tokens).
3. Modell und Effort aus den Spalten „Modell“ und „Effort“ wählen (z. B. Opus mit High für P1). Ein neues Projekt musst du in Claude Code nicht anlegen: Der Ordner ist das Projekt.
4. Eintippen und Enter:
   ```
   /paket P1
   ```
   (für die nächsten Pakete entsprechend `/paket P2`, `/paket P3` usw.)

### D2 Während Claude Code arbeitet

- Claude Code fragt manchmal, ob es einen Befehl ausführen darf (z. B. `npm install` oder `git push`). Lies kurz, was dasteht, und bestätige.
- Du musst nicht zuschauen. Am Ende kommt ein Abschlussbericht.

### D3 Nach dem Paket

1. Abschlussbericht lesen. Der Abschnitt „Was du selbst tun musst“ enthält nummerierte Schritte. Die erledigst du.
2. Online-Version ansehen: https://stephan-pro.github.io/stud-stephan/ (ab Paket P1).
3. Wenn alles passt, ist das Paket in `docs/UMSETZUNG.md` mit ✅ markiert.

### D4 Wenn etwas nicht klappt

1. PowerShell im Ordner `stud-stephan` öffnen.
2. Prüfen:
   ```
   npm run check
   ```
3. Ist das Ergebnis rot, kopier **nur die Fehlermeldung** (nicht die ganze Ausgabe) in eine neue Claude-Code-Sitzung und schreib dazu, bei welchem Paket es passiert ist.

### D5 Mit mir hier im Chat

Du kannst jederzeit hierher zurückkommen, z. B. um einen Abschlussbericht prüfen zu lassen, eine Entscheidung zu besprechen oder den nächsten Prompt vorzubereiten.

---

## Kleines Wörterbuch

| Wort | Bedeutung |
|---|---|
| Repository (Repo) | Projektordner mit allen Versionen, liegt auf GitHub |
| Commit | ein gespeicherter Zwischenstand mit Beschreibung |
| Push / Pull | Zwischenstände hoch- bzw. herunterladen |
| Workflow (GitHub Actions) | automatische Prüfung bzw. Veröffentlichung nach jedem Push |
| `npm run check` | prüft alles auf einmal: Stil, Typen, Tests, Build |
| Edge Function | kleines Programm auf dem Supabase-Server, z. B. für den Preisabruf |
| Secret | geheimer Wert (Schlüssel), liegt nur bei Supabase oder auf deinem PC |
| `.env.local` | Datei mit deinen Schlüsseln, nur auf deinem PC |
