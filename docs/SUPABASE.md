# Stud Stephan – Supabase

Stand: 31.10.2026 (Paket P4a). Für den Product Owner und spätere Sitzungen. Die App nutzt die Datenbank erst ab P4b/P5; bis dahin liegen dort nur Tabellen, Regeln und die beiden Dateiablagen.

## Was wo liegt

| Was | Wo | Öffentlich? |
|---|---|---|
| Projekt `stud-stephan`, Ref `ohuqwiypmoqyuxsgouxw`, Region North EU (Stockholm, `eu-north-1`), Free Plan, ohne GitHub-Verbindung | supabase.com, Konto des PO | – |
| Projekt-URL `https://ohuqwiypmoqyuxsgouxw.supabase.co` und Publishable Key `sb_publishable_…` | GitHub-Repository-Variablen `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`; lokal `.env.local` (Vorlage `.env.example`) | ja (stehen später ohnehin in der App) |
| Datenbank-Passwort | nur beim PO; `npx supabase link` / `db push` fragen es im eigenen Terminal ab | **nein** |
| Secret Key / service_role | bleibt im Dashboard; ab P7 nutzen ihn nur die Edge Functions auf dem Server | **nein** |
| Rebrickable- und BrickLink-Schlüssel | ab P7 nur als Supabase-Secrets (`npx supabase secrets set …`, PO im eigenen Terminal) | **nein** |
| Tabellen, Regeln, Funktionen, Dateiablagen | `supabase/migrations/` im Repo, eingespielt mit `npx supabase db push` | ja |

Kein Geheimnis gehört ins Repository, in den Chat oder in GitHub Actions. Der Hook `.githooks/pre-commit` bricht Commits mit erkennbaren Schlüsseln ab.

## Aufbau der Datenbank (P4a)

- **Tabellen** (Schema `public`), je Zeile ein Objekt als JSON (`data`) mit Besitzer (`owner`) und Kennung (`id`): `minifigs`, `lego_sets`, `special_parts`, `dioramas`, `wish_items`. Dazu `photos` (eine Zeile je Foto, mit Reihenfolge), `studio_files` (je Studio-Datei eines Dioramas) und `price_points` (je Katalognummer und Tag ein Preisstand mit neu und gebraucht). Mod-Teile stehen in ihrer Figur (sie gehören nur zu ihr und werden mit ihr gespeichert).
- **Zeilenschutz (RLS)** auf jeder Tabelle: lesen und schreiben nur der Besitzer (`owner = auth.uid()`). Rechte nur für angemeldete Nutzer (`authenticated`); ohne Anmeldung geht nur `ping`.
- **Funktionen** (laufen mit den Rechten des Aufrufers): `load_collection` (alles auf einmal), `save_object`, `delete_object` (Diorama löschen gibt seine Figuren frei, F8; Set löschen löst die Verknüpfung „Stammt aus Set“), `save_price_point`, `ping`.
- **Grenzen:** Objekt höchstens 32 KB, höchstens 20 Fotos je Objekt und 20 Studio-Dateien je Diorama.
- **Dateiablagen** (privat): `photos` (WebP, JPEG, PNG; höchstens 2 MB je Datei) und `studio-files` (höchstens 25 MB). Jede Datei liegt unter `<Nutzer-ID>/…`; nur der Besitzer liest, schreibt oder löscht sie.

Im Code: `src/backend/` (`Remote` = Schnittstelle, `SupabaseRemote`, `FakeRemote`, Fake-Server). Dieselben Vertragstests laufen gegen den Fake (`npm run check`) und gegen eine echte lokale Datenbank (`npm run check:db`, nur in CI, Job `db`).

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
| `20261031120000_collection.sql` (P4a) | Tabellen, Zeilenschutz, Funktionen, Dateiablagen `photos` und `studio-files`, `ping` | spielt der PO ein |

## Kostenloser Tarif: Grenzen

- 500 MB Datenbank, 1 GB Dateispeicher, 5 GB Datenverkehr im Monat; höchstens zwei aktive kostenlose Projekte (Krümel und Stud Stephan).
- **Pausierung:** Ein kostenloses Projekt pausiert nach 7 Tagen ohne Nutzung. Dagegen ruft der Workflow `keepalive` (`.github/workflows/keepalive.yml`) täglich `ping` auf (nur mit dem öffentlichen Key, ohne Daten). Pausiert es trotzdem: im Dashboard „Restore project“ klicken.
- **GitHub schaltet geplante Workflows ab**, wenn im Repository 60 Tage lang nichts passiert. GitHub schickt vorher eine Mail; dann unter Actions → keepalive → „Enable workflow“ wieder einschalten.
- **Keine herunterladbaren Backups** im Free Plan. Deshalb ab P14 regelmäßig in der App eine Datensicherung herunterladen.

## Prüfliste Dashboard (nach jeder Migration)

Alle Adressen beginnen mit `https://supabase.com/dashboard/project/ohuqwiypmoqyuxsgouxw`. Nur ansehen; keine Schlüssel oder Passwörter in Chat oder Bildschirmfotos.

1. **Security Advisor:** `…/advisors/security` → „Refresh“. *Soll:* 0 Fehler. Warnungen und Hinweise: Text kopieren und Claude geben, nichts auf eigene Faust „beheben“.
2. **Tabellen:** `…/editor`, Schema „public“. *Soll:* die acht Tabellen aus „Aufbau“, bei keiner der Hinweis „RLS disabled“.
3. **Dateiablagen:** `…/storage/buckets`. *Soll:* `photos` und `studio-files`, beide ohne „Public“.
