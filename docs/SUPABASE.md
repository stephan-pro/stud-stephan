# Stud Stephan – Supabase

Stand: 31.10.2026 (Paket P4b). Für den Product Owner und spätere Sitzungen. Die App meldet sich seit P4b an; Daten liest und schreibt sie ab P5.

## Was wo liegt

| Was | Wo | Öffentlich? |
|---|---|---|
| Projekt `stud-stephan`, Ref `ohuqwiypmoqyuxsgouxw`, Region North EU (Stockholm, `eu-north-1`), Free Plan, ohne GitHub-Verbindung | supabase.com, Konto des PO | – |
| Projekt-URL `https://ohuqwiypmoqyuxsgouxw.supabase.co` und Publishable Key `sb_publishable_…` | GitHub-Repository-Variablen `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`; lokal `.env.local` (Vorlage `.env.example`) | ja (stehen später ohnehin in der App) |
| Datenbank-Passwort | nur beim PO; `npx supabase link` / `db push` fragen es im eigenen Terminal ab | **nein** |
| Secret Key / service_role | bleibt im Dashboard; ab P7 nutzen ihn nur die Edge Functions auf dem Server | **nein** |
| Rebrickable- und BrickLink-Schlüssel | nur als Supabase-Secrets (ab P7, `npm run deploy:functions`, PO im eigenen Terminal) und in `.env.local` | **nein** |
| Tabellen, Regeln, Funktionen, Dateiablagen | `supabase/migrations/` im Repo, eingespielt mit `npx supabase db push` | ja |

| Absender der Anmeldecodes | Gmail-Konto von Krümel (`kruemel.haushaltsapp@gmail.com`) per SMTP, eigenes App-Passwort „Stud Stephan“ | Adresse ja |
| App-Passwort des Gmail-Kontos | nur im Dashboard (Authentication → Emails → SMTP Settings) | **nein** |
| Mailvorlage mit dem Code | `supabase/templates/code.html` (in „Magic Link“ und „Confirm signup“ kopiert) | ja |

Kein Geheimnis gehört ins Repository, in den Chat oder in GitHub Actions. Der Hook `.githooks/pre-commit` bricht Commits mit erkennbaren Schlüsseln ab.

## Aufbau der Datenbank (P4a)

- **Tabellen** (Schema `public`), je Zeile ein Objekt als JSON (`data`) mit Besitzer (`owner`) und Kennung (`id`): `minifigs`, `lego_sets`, `special_parts`, `dioramas`, `wish_items`. Dazu `photos` (eine Zeile je Foto, mit Reihenfolge), `studio_files` (je Studio-Datei eines Dioramas) und `price_points` (je Katalognummer und Tag ein Preisstand mit neu und gebraucht). Mod-Teile stehen in ihrer Figur (sie gehören nur zu ihr und werden mit ihr gespeichert).
- **Zeilenschutz (RLS)** auf jeder Tabelle: lesen und schreiben nur der Besitzer (`owner = auth.uid()`). Rechte nur für angemeldete Nutzer (`authenticated`); ohne Anmeldung geht nur `ping`.
- **Funktionen** (laufen mit den Rechten des Aufrufers): `load_collection` (alles auf einmal), `save_object`, `delete_object` (Diorama löschen gibt seine Figuren frei, F8; Set löschen löst die Verknüpfung „Stammt aus Set“), `save_price_point`, `ping`.
- **Grenzen:** Objekt höchstens 32 KB, höchstens 20 Fotos je Objekt und 20 Studio-Dateien je Diorama.
- **Dateiablagen** (privat): `photos` (WebP, JPEG, PNG; höchstens 2 MB je Datei) und `studio-files` (höchstens 25 MB). Jede Datei liegt unter `<Nutzer-ID>/…`; nur der Besitzer liest, schreibt oder löscht sie.

Im Code: `src/backend/` (`Remote` = Schnittstelle, `SupabaseRemote`, `FakeRemote`, Fake-Server). Dieselben Vertragstests laufen gegen den Fake (`npm run check`) und gegen eine echte lokale Datenbank (`npm run check:db`, nur in CI, Job `db`).

## Anmeldung (P4b)

- Nur per **6-stelligem Code** aus der E-Mail, kein Link, kein Passwort. Die App fragt den Code mit `shouldCreateUser: false` an; eine unbekannte Adresse bekommt keine Mail, die App zeigt trotzdem dieselbe Meldung wie bei Stephans Adresse.
- **Neue Konten sind abgeschaltet** („Allow new users to sign up“ aus). Stephans Konto legt der PO einmal von Hand an.
- Die Sitzung bleibt je Gerät im Browser-Speicher (`stud-stephan:auth`); Abmelden in den Einstellungen.
- Online-Version: Der Workflow `pages` baut mit den Repository-Variablen `VITE_SUPABASE_URL` und `VITE_SUPABASE_PUBLISHABLE_KEY`; fehlt eine, bricht der Build ab. `npm run dev` braucht dieselben Werte in `.env.local`.
- Lokale Instanz (`check:db`): dieselben Regeln in `supabase/config.toml`, Codes aus dem Mail-Fänger Mailpit (`supabase/tests/auth.test.ts`).

Soll-Einstellungen im Dashboard (Adressen beginnen mit `https://supabase.com/dashboard/project/ohuqwiypmoqyuxsgouxw`):

| Wo | Soll |
|---|---|
| `…/auth/providers` → „Email“ | Email an, „Confirm email“ an, „Email OTP Length“ 6, „Email OTP Expiration“ 600 |
| `…/auth/providers` (oben, „User Signups“) | „Allow new users to sign up“ **aus** |
| `…/auth/smtp` | „Enable custom SMTP“ an, Host `smtp.gmail.com`, Port `465`, Benutzer und Absender `kruemel.haushaltsapp@gmail.com`, Absendername „Stud Stephan“ |
| `…/auth/templates` | „Magic Link“ und „Confirm signup“: Betreff „Dein Anmeldecode für Stud Stephan“, Text aus `supabase/templates/code.html` (mit `{{ .Token }}`, ohne Link) |
| `…/auth/users` | genau ein Konto: Stephans Adresse |

Eingerichtet und vom PO geprüft am 01.11.2026: Anmeldung am PC und am Handy, eine unbekannte Adresse bekommt keine Mail und kein Konto, Security Advisor ohne Fehler.

## Datenbank ändern

Jede Änderung ist eine neue Datei in `supabase/migrations/` (nie eine eingespielte ändern). In CI prüft `npm run check:db` sie gegen eine frische lokale Instanz. Ins echte Projekt spielt sie der PO im eigenen Terminal ein (PowerShell im Ordner `stud-stephan`):

```
npx supabase login
npx supabase link --project-ref ohuqwiypmoqyuxsgouxw
npx supabase db push
```

`login` öffnet den Browser, `link` fragt das Datenbank-Passwort ab (einmal pro Rechner), `db push` zeigt die neuen Migrationen und spielt sie nach Rückfrage ein. Docker ist dafür nicht nötig. `npx supabase migration list` zeigt danach je Migration „Local“ und „Remote“; stehen in beiden Spalten dieselben Zeitstempel, ist alles eingespielt.

| Migration | Inhalt | Im echten Projekt |
|---|---|---|
| `20261031120000_collection.sql` (P4a) | Tabellen, Zeilenschutz, Funktionen, Dateiablagen `photos` und `studio-files`, `ping` | eingespielt (31.10.2026); Security Advisor vom PO geprüft, Zugriff ohne Anmeldung von außen gesperrt (nur `ping`) |
| `20261101120000_catalog.sql` (P7) | Tabellen `catalog_cache` und `catalog_usage` (nur für die Edge Functions, für die App gesperrt), Funktion `catalog_count_call` | eingespielt (spätestens 01.11.2026 zusammen mit P11, SQL Editor); die Datei darf mehrfach laufen |
| `20261102120000_price_run.sql` (P11) | Erweiterungen `pg_cron` und `pg_net`; Tabellen `price_runs` und `price_run_items` (Besitzer liest, nur die Funktionen schreiben); Warteschlange `price_run_begin/claim/finish/release`, Zähler `price_count_call`, Stand `price_run_status`; Aufruf der Funktion `price_run_call` (Geheimnis aus dem Vault); drei Cron-Jobs | eingespielt (01.11.2026, SQL Editor, vom PO gemeldet); die Datei darf mehrfach laufen |
| `20261102130000_event_trigger_rights.sql` (nach P11) | Nimmt `anon` und `authenticated` das Ausführungsrecht an Event-Trigger-Funktionen mit SECURITY DEFINER in `public` (betrifft `rls_auto_enable()` von „Enable automatic RLS“; Security-Advisor-Warnungen vom 01.11.2026) | eingespielt (SQL Editor, vom PO gemeldet); die Datei darf mehrfach laufen |

## Edge Functions (P7)

- `catalog` (Suche und Katalogeintrag für Figuren und Sets) und `bricklink` (Katalogabfragen einzeln; P11 ergänzt Preise). Code: `supabase/functions/<name>/index.ts` (nur der Anschluss), Logik und Tests in `supabase/functions/_shared/` (laufen mit `npm run check`, ohne Internet).
- Geheimnisse (nur auf dem Server, als Supabase-Secrets): `REBRICKABLE_API_KEY`, `BRICKLINK_CONSUMER_KEY`, `BRICKLINK_CONSUMER_SECRET`, `BRICKLINK_TOKEN_VALUE`, `BRICKLINK_TOKEN_SECRET`. `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` legt Supabase jeder Funktion selbst hinein; der Service-Role-Key bleibt dort.
- Setzen und Bereitstellen (PO, eigenes Terminal, kein Datenbank-Passwort, kein Docker): `npx supabase login`, dann `npm run deploy:functions` (`scripts/deploy-functions.mjs` liest die fünf Werte aus `.env.local`, übergibt sie über eine kurzzeitige Datei und zeigt sie nie an).
- Aufruf aus der App: `supabase.functions.invoke("catalog", …)` mit der Anmeldung des Nutzers; die Funktion fragt bei `…/auth/v1/user` nach, ob sie gültig ist.

## Preisabruf (P11)

- **Zeitplan (pg_cron, UTC):** `stud-stephan-price-run` Montag 02:00 (`price_run_weekly`: ein Lauf je Besitzer mit Sammlung, dann ein Aufruf), `stud-stephan-price-run-continue` alle 5 Minuten (`price_run_continue`: ruft nur, wenn ein Lauf offen und nicht pausiert ist), `stud-stephan-cron-cleanup` täglich 03:30 (Protokoll älter als 14 Tage löschen). Ansehen: `…/integrations/cron/jobs` im Dashboard oder `select * from cron.job;`.
- **Aufruf:** `price_run_call` schickt per pg_net `POST …/functions/v1/bricklink` mit `{op: "priceRun"}` und dem Kopf `x-price-run-secret`.
- **Geheimnis:** derselbe Wert zweimal, nie im Repo, nie im Chat: im **Vault** unter dem Namen `price_run_secret` (`…/integrations/vault/secrets`) und als Supabase-Secret `PRICE_RUN_SECRET` der Funktion (`npm run deploy:functions` liest es aus `.env.local`). Fehlt der Vault-Eintrag, ruft die Datenbank nichts auf. Optional `project_url` im Vault, sonst `https://ohuqwiypmoqyuxsgouxw.supabase.co`.
- **Tageslimit:** gemeinsamer Zähler mit dem Katalog in `catalog_usage` (`bricklink` gesamt, `bricklink-prices` nur Preise): Katalog bis 4.500, Preise bis 4.950 gesamt und höchstens 2.500 eigene.
- **Prüfen, ob es läuft:** In der App Einstellungen → Preisabruf (Letzter Lauf, Ergebnis). Im Dashboard `…/integrations/cron/jobs` → Job → „History“; Antworten der Funktion unter `…/functions/bricklink/logs`.

## Kostenloser Tarif: Grenzen

- 500 MB Datenbank, 1 GB Dateispeicher, 5 GB Datenverkehr im Monat; höchstens zwei aktive kostenlose Projekte (Krümel und Stud Stephan).
- **Pausierung:** Ein kostenloses Projekt pausiert nach 7 Tagen ohne Nutzung. Dagegen ruft der Workflow `keepalive` (`.github/workflows/keepalive.yml`) täglich `ping` auf (nur mit dem öffentlichen Key, ohne Daten). Pausiert es trotzdem: im Dashboard „Restore project“ klicken.
- **GitHub schaltet geplante Workflows ab**, wenn im Repository 60 Tage lang nichts passiert. GitHub schickt vorher eine Mail; dann unter Actions → keepalive → „Enable workflow“ wieder einschalten.
- **Keine herunterladbaren Backups** im Free Plan. Deshalb ab P14 regelmäßig in der App eine Datensicherung herunterladen.

## Prüfliste Dashboard (nach jeder Migration)

Alle Adressen beginnen mit `https://supabase.com/dashboard/project/ohuqwiypmoqyuxsgouxw`. Nur ansehen; keine Schlüssel oder Passwörter in Chat oder Bildschirmfotos.

1. **Security Advisor:** `…/advisors/security` → „Refresh“. *Soll:* 0 Fehler. Warnungen und Hinweise: Text kopieren und Claude geben, nichts auf eigene Faust „beheben“. Bekannt und gewollt: „Leaked Password Protection Disabled“ (die App hat keine Passwörter, nur Codes per Mail; die Prüfung gibt es zudem erst im Pro-Plan).
2. **Tabellen:** `…/editor`, Schema „public“. *Soll:* die acht Tabellen aus „Aufbau“ (ab P7 dazu `catalog_cache` und `catalog_usage`, ab P11 `price_runs` und `price_run_items`), bei keiner der Hinweis „RLS disabled“.
3. **Dateiablagen:** `…/storage/buckets`. *Soll:* `photos` und `studio-files`, beide ohne „Public“.
