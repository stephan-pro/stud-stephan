# Stud Stephan – Wartung

Stand: 01.11.2026 · Version 1.0 · für Stephan

Stud Stephan läuft ohne Server auf deinem PC: die App liegt bei GitHub Pages, die Daten bei Supabase, der Preisabruf läuft montags von selbst. Damit das so bleibt, gibt es ein paar kleine Aufgaben. Hier steht, **was**, **wann** und **wie** – Schritt für Schritt.

**Die drei goldenen Regeln**

1. Schlüssel und Passwörter nie in den Chat, in Bildschirmfotos oder ins Repository. Sie stehen nur in `.env.local` auf deinem PC und als Supabase-Secrets.
2. Im Supabase-Dashboard nichts „auf eigene Faust beheben“. Warnungen kopieren und Claude geben.
3. Vor jeder größeren Änderung eine Datensicherung herunterladen (Einstellungen → **Datensicherung** → **Export**).

Wichtige Adressen (alle zum Anklicken):

| Was | Adresse |
|---|---|
| Die App | https://stephan-pro.github.io/stud-stephan/ |
| Repository (Code, Actions, Pull Requests) | https://github.com/stephan-pro/stud-stephan |
| GitHub Actions (alle automatischen Abläufe) | https://github.com/stephan-pro/stud-stephan/actions |
| Supabase-Projekt | https://supabase.com/dashboard/project/ohuqwiypmoqyuxsgouxw |
| Rebrickable-Schlüssel | https://rebrickable.com/api/ |
| BrickLink-Schlüssel | https://www.bricklink.com/v2/api/register_consumer.page |

---

## 1. Was regelmäßig zu tun ist

### Jede Woche (2 Minuten)

1. App öffnen → **Einstellungen** → Karte **Preisabruf**: Unter „Letzter Lauf“ steht der letzte Montag, unter „Ergebnis“ „… aktualisiert“. Steht dort viel „fehlgeschlagen“: die Nummern abschreiben und Claude geben.
2. Karte **Datenquellen**: Alle vier Punkte sind grün. Steht bei Rebrickable oder BrickLink „Schlüssel prüfen“ → Abschnitt 2.
3. Montags kommen eventuell **Dependabot-Vorschläge** (Updates) → Abschnitt 4.

### Jeden Monat (10 Minuten)

1. **Datensicherung:** Einstellungen → **Datensicherung** → **Export**. Die App erinnert dich nach 30 Tagen selbst (sandfarbener Hinweis in der Karte). Die ZIP-Datei liegt in deinen Downloads – kopier sie zusätzlich an einen zweiten Ort (z. B. USB-Stick oder Cloud-Ordner). Alte Sicherungen darfst du löschen; behalte die letzten drei.
2. **GitHub Actions ansehen:** https://github.com/stephan-pro/stud-stephan/actions öffnen. Links stehen die Abläufe. Bei **keepalive** sollte der letzte Lauf einen grünen Haken haben (er läuft täglich). Steht oben ein gelber Kasten „This scheduled workflow is disabled …“: auf **Enable workflow** klicken. (GitHub schaltet zeitgesteuerte Abläufe nach 60 Tagen ohne Änderung im Repository ab und schickt dir dazu eine Mail.)
3. **Speicherplatz:** Einstellungen → Karte **Speicherplatz**. Über 800 MB von 1 GB: Claude fragen, was man aufräumen kann (z. B. alte Studio-Dateien).

### Alle drei Monate (10 Minuten)

1. **Security Advisor:** https://supabase.com/dashboard/project/ohuqwiypmoqyuxsgouxw/advisors/security → **Refresh**. *Soll:* 0 Fehler. Bekannt und in Ordnung: „Leaked Password Protection Disabled“. Alles andere: Text kopieren und Claude geben.
2. **Einmal ohne Verbindung prüfen:** Am Redmi Flugmodus an, App öffnen – die Vitrine muss erscheinen. Flugmodus wieder aus.

---

## 2. Schlüssel erneuern

Ein Schlüssel muss erneuert werden, wenn der Dienst es verlangt, wenn die Karte **Datenquellen** „Schlüssel prüfen“ zeigt oder wenn du glaubst, dass jemand anderes ihn gesehen hat. Jedes Mal gleich: **beim Dienst neu erzeugen → in `.env.local` eintragen → `npm run deploy:functions`**.

### `.env.local` öffnen

1. Claude Code (oder Windows-Explorer) öffnen, Ordner `C:\Users\Anwender\Projekte\stud-stephan`.
2. Die Datei `.env.local` mit dem Editor öffnen (Rechtsklick → **Öffnen mit** → **Editor**). Sie ist nicht im Repository und wird nie hochgeladen.
3. Nach dem Ändern speichern (`Strg+S`) und schließen.

### Rebrickable

1. https://rebrickable.com/api/ öffnen, anmelden, dem Link zum API-Schlüssel folgen (Kontoeinstellungen, Reiter **API**).
2. **Generate new API Key** klicken und den neuen Schlüssel kopieren.
3. In `.env.local` die Zeile `REBRICKABLE_API_KEY=` suchen und alles hinter dem `=` durch den neuen Schlüssel ersetzen.
4. Weiter mit „Übertragen“ unten.

### BrickLink (vier Werte)

1. https://www.bricklink.com/v2/api/register_consumer.page öffnen und anmelden.
2. Dort stehen **Consumer Key**, **Consumer Secret** und unter den Zugriffs-Token **Token Value** und **Token Secret**. Zum Erneuern beim Token **Regenerate** (bzw. einen neuen Token für die IP `0.0.0.0` anlegen).
3. In `.env.local` die vier Zeilen `BRICKLINK_CONSUMER_KEY=`, `BRICKLINK_CONSUMER_SECRET=`, `BRICKLINK_TOKEN_VALUE=`, `BRICKLINK_TOKEN_SECRET=` mit den neuen Werten füllen.
4. Weiter mit „Übertragen“.

### Geheimnis des Preisabrufs (`PRICE_RUN_SECRET`)

Dieses Geheimnis steht an **zwei** Stellen und muss an beiden gleich sein.

1. In PowerShell (im Projektordner) einen neuen Zufallswert erzeugen – er erscheint nur in deinem Fenster:

   ```powershell
   -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
   ```

2. Den Wert markieren und kopieren. In `.env.local` hinter `PRICE_RUN_SECRET=` einfügen, speichern.
3. Supabase-Dashboard → https://supabase.com/dashboard/project/ohuqwiypmoqyuxsgouxw/integrations/vault/secrets → Eintrag `price_run_secret` → **Edit** (Stift) → bei **Secret** den neuen Wert einfügen → **Save**.
4. Weiter mit „Übertragen“.

### Übertragen (für alle drei)

```powershell
npm run deploy:functions
```

Das Skript meldet dich bei Bedarf bei Supabase an (Browser öffnet sich), setzt die Werte als Supabase-Secrets – ohne sie anzuzeigen – und stellt die Funktionen neu bereit. Danach in der App **Einstellungen** öffnen: Karte **Datenquellen** zeigt wieder alles grün. Beim Preisabruf-Geheimnis zusätzlich in der Karte **Preisabruf** auf **Jetzt aktualisieren** tippen; es läuft durch.

### Mail-Versand (Gmail, gemeinsam mit Krümel)

Der Code zum Anmelden kommt über das Gmail-Konto von Krümel. Ändert sich dort das Passwort oder das App-Passwort, kommen keine Codes mehr (die Anmeldeseite sagt dann „Der Code konnte gerade nicht verschickt … werden“).

1. Im Google-Konto von Krümel ein neues **App-Passwort** erzeugen (https://myaccount.google.com/apppasswords).
2. https://supabase.com/dashboard/project/ohuqwiypmoqyuxsgouxw/auth/smtp öffnen → bei **Password** das neue App-Passwort einfügen → **Save changes**.
3. In der App abmelden und neu anmelden: Der Code kommt.

---

## 3. Supabase-Pause

Ein kostenloses Supabase-Projekt schläft nach 7 Tagen ohne Nutzung ein. Dagegen fragt der Ablauf **keepalive** jeden Tag kurz nach (und der Preisabruf jeden Montag).

**So merkst du, dass es schläft:** Die App zeigt „Der Server antwortet gerade nicht – du siehst den Stand vom …“ (oder die Anmeldung klappt nicht), und Supabase schickt eine Mail „Your project has been paused“.

**Aufwecken:**

1. https://supabase.com/dashboard/project/ohuqwiypmoqyuxsgouxw öffnen und anmelden.
2. Auf **Restore project** klicken und warten, bis oben „Project is active“ steht (einige Minuten).
3. App neu laden – alles ist wieder da (beim Einschlafen geht nichts verloren).
4. Danach prüfen, warum es passiert ist: https://github.com/stephan-pro/stud-stephan/actions → **keepalive**. Ist der Ablauf abgeschaltet: **Enable workflow**. Ist er rot: den Fehlertext Claude geben.

Wichtig: Krümel und Stud Stephan belegen zusammen die zwei kostenlosen Projekte. Ein drittes Projekt geht im Free Plan nicht.

---

## 4. Updates

### App-Bausteine (Dependabot)

Jeden Montag schaut Dependabot, ob es neue Versionen der Bausteine gibt, und öffnet dafür Vorschläge (Pull Requests). Nichts wird von selbst übernommen.

1. https://github.com/stephan-pro/stud-stephan/pulls öffnen.
2. Bei jedem Vorschlag von **dependabot** steht unten, ob die Prüfungen grün sind (grüner Haken) oder rot (rotes Kreuz).
3. Am einfachsten: In Claude Code eine neue Sitzung öffnen und schreiben: „Prüf die offenen Dependabot-PRs, lass `npm run check:full` laufen und übernimm, was grün bleibt.“ Claude erklärt, was übernommen wurde und was nicht.
4. Selbst übernehmen geht auch, aber nur bei grünem Haken und nur bei kleinen Updates („minor/patch“ im Titel): im Pull Request **Merge pull request** → **Confirm merge**. Große Sprünge (eigener PR für ein einzelnes Paket, z. B. „bump vite from 8 to 9“) immer Claude prüfen lassen.

### Die App auf deinen Geräten

Nach jeder Änderung an der App zeigt die installierte App oben **Neue Version verfügbar** mit **Neu laden**. Sie wechselt nie von selbst, damit nichts halb Eingetipptes verloren geht. Tipp auf **Neu laden**, wenn du gerade nichts eingibst. Schließt du die App ganz und öffnest sie wieder, kommt der Hinweis spätestens dann.

### Node.js auf dem PC

Das Projekt nutzt Node.js 24 (steht in der Datei `.nvmrc`). Ein Update von Node machst du nur, wenn Claude dazu rät; dann `https://nodejs.org` → die angegebene Version („LTS“) herunterladen und installieren, danach im Projektordner:

```powershell
npm run setup
```

---

## 5. Wenn etwas nicht geht

| Was du siehst | Was du tust |
|---|---|
| „Keine Verbindung“ oben, obwohl Internet da ist | Seite neu laden. Bleibt es: Abschnitt 3 (Supabase-Pause) |
| Kein Code per Mail | Spam-Ordner prüfen, eine Minute warten, „Neuen Code senden“. Bleibt es: Abschnitt 2, Mail-Versand |
| Datenquellen „Schlüssel prüfen“ | Abschnitt 2 |
| Preisabruf läuft nicht mehr | Karte Preisabruf ansehen; Text an Claude. Oft hilft `npm run deploy:functions` |
| Ein Ablauf bei GitHub Actions ist rot | Auf den roten Lauf klicken, den Fehlertext kopieren und Claude geben |
| Etwas ist kaputt gegangen und du willst den alten Stand | Einstellungen → Datensicherung → **Import** → letzte gute ZIP-Datei. Vorher legt die App automatisch eine Sicherung des jetzigen Stands an |
