# Stud Stephan – Umsetzungsplan

Stand: 31.10.2026 · Version 1.0 · Product Owner: Stephan Prommer
Grundlage: `docs/ANFORDERUNGEN.md` (v1.0), `docs/STRUKTUR.md` (v1.0), `docs/design/DESIGN.md` (v1.0), Klick-Dummy in `docs/design/dummy/` (nur Referenz, nicht lauffähig).

## 1. Leitentscheidungen

| Thema | Entscheidung | Warum |
|---|---|---|
| Oberfläche | Preact + TypeScript (strict) + Vite | Wie Krümel: klein, schnell, bekannt |
| Code-Stil | Biome (Formatierung + Linting) | Wie Krümel, ein Werkzeug statt zwei |
| Tests | Vitest (Fachlogik, Abdeckung ≥ 90 %), Playwright + axe (Abläufe, Chromium und WebKit, Desktop und Handy) | Wie Krümel |
| Daten, Anmeldung, Dateien | Supabase, eigenes Projekt `stud-stephan`, Free Plan, Region EU | Wie Krümel; Datenbank, Anmeldung per Code und Dateispeicher in einem |
| Externe Dienste | Nur über Supabase Edge Functions (Rebrickable, Brickognize, BrickLink, Link-Vorschau) | Schlüssel bleiben geheim, keine Probleme mit Browser-Sperren (CORS) |
| Preisabruf | Wöchentlich per `pg_cron` in Supabase, ruft die Edge Function `bricklink` | Kostenlos, läuft ohne PC |
| Online-Version | GitHub Pages: https://stephan-pro.github.io/stud-stephan/ | Kostenlos bei öffentlichem Repo |
| Repository | https://github.com/stephan-pro/stud-stephan, öffentlich, Lizenz EUPL-1.2 | Entscheidung des PO (31.10.2026) |
| Sprache | Nur Deutsch (keine Übersetzungs-Schicht) | N3; spart Aufwand gegenüber Krümel |
| Geld | Immer ganze Cent als Zahl (`1250` = 12,50 €) | Keine Rundungsfehler |
| Kennung offizieller Figuren | **BrickLink-Nummer** (`sw0194`); Sets über die Setnummer (`75372-1`, bei Rebrickable und BrickLink gleich) | Ergebnis P2: Rebrickable kennt die BrickLink-Nummern nicht, Brickognize und der Preisguide sprechen BrickLink. Eine Nummer für Erkennung, Katalog und Preis |
| Katalog | **BrickLink-Katalog** (Figur/Set-Details, Figuren eines Sets, Sets einer Figur) über die Edge Function `bricklink`; **Rebrickable** nur für Namenssuche bei Sets und für Themen | BrickLink liefert die passenden Nummern; dieselben Zugangsdaten wie für Preise |
| Reihen (F13) | Sets eines Themas aus Rebrickable → Figuren je Set aus dem BrickLink-Katalog → alle Figuren der Reihe mit BrickLink-Nummer, zwischengespeichert | Verbindet beide Kataloge über die gemeinsame Setnummer |

**Konsequenz Free Plan:** Krümel und Stud Stephan belegen zusammen die zwei kostenlosen Supabase-Projekte. Ein Projekt pausiert nach 7 Tagen ohne Nutzung; der Workflow `keepalive.yml` (wie bei Krümel) verhindert das.

## 2. Architektur in einem Bild

```
Handy / PC (Browser, PWA)
   │  Preact-App (GitHub Pages)
   ├──► Supabase: Datenbank (nur Stephan liest/schreibt, Row Level Security)
   ├──► Supabase: Dateispeicher (Fotos, Studio-Dateien; privat)
   └──► Supabase Edge Functions ──► Rebrickable (Katalog)
                                 ├─► Brickognize (Fotoerkennung)
                                 ├─► BrickLink (Katalog mit BrickLink-Nummern, Marktwerte)
                                 └─► Merlins Steine / andere Seiten (Link-Vorschau)
pg_cron (wöchentlich) ──► Edge Function „bricklink“ ──► BrickLink ──► Preisstände in der Datenbank
```

## 3. Ablauf pro Arbeitspaket

1. Neue Claude-Code-Sitzung (eine pro Paket).
2. `/paket <Kennung>` eintippen, z. B. `/paket P1`.
3. Claude Code liest die Doku, baut, testet, bis `npm run check` lokal und auf GitHub grün ist, und veröffentlicht.
4. Abschlussbericht lesen; die dort genannten Schritte des PO erledigen.
5. Das Paket ist fertig, wenn es in der Tabelle unten mit ✅ steht.

## 4. Arbeitspakete (Übersicht)

| Paket | Inhalt | Modell | Effort | Status |
|---|---|---|---|---|
| P1 | Grundgerüst, Prüfungen, Design-Tokens, Navigation | Opus | High | ✅ 31.10.2026 |
| P2 | Datenquellen prüfen (Spike) | Sonnet | Medium | ✅ 31.10.2026 |
| P3 | Datenmodell und Fachlogik | Opus | High | ✅ 31.10.2026 |
| P4a | Supabase: Tabellen, Regeln, Dateispeicher, Fake-Server | Opus | High | ✅ 31.10.2026 |
| P4b | Anmeldung per Code (nur Stephan) | Opus | High | ✅ 01.11.2026 |
| P4c | Fotos und Studio-Dateien hochladen | Sonnet | Medium | ✅ 01.11.2026 |
| P5 | Vitrine, Filter, Detailseiten | Sonnet | Medium | ✅ 01.11.2026 |
| P6 | Manuell erfassen, bearbeiten, löschen, Mods | Sonnet | Medium | ✅ 01.11.2026 (Hochformat-Foto am Redmi vom PO bestätigt) |
| P7 | Katalog (BrickLink-Nummern, Rebrickable-Suche) | Sonnet | Medium | ✅ 01.11.2026 (Prüfung mit sw0194 und 75372 vom PO bestätigt; „Stammt aus Set“ bleibt bei mehreren Sets leer, so gewollt) |
| P8 | Fotoerkennung (Brickognize) | Sonnet | Medium | ✅ 01.11.2026 (Prüfung am Redmi durch den PO bestätigt) |
| P9 | Erfassen per Link (Merlins Steine, Rebrickable, andere) | Sonnet | Medium | ✅ 01.11.2026 (Prüfung durch den PO bestätigt: Rebrickable und Custom-Shop mit Foto; bei Merlins Steine sperrt der Server das Bild, die Karte sagt es) |
| P10 | Dioramen | Sonnet | Medium | ✅ 01.11.2026 (Prüfung durch den PO bestätigt: echte .io-Datei hoch- und heruntergeladen; dazu der Bild-Abruf über link-preview) |
| P11 | Marktwerte und Wertentwicklung (BrickLink) | Opus | High | ✅ 02.11.2026 (vom PO bestätigt: „Jetzt aktualisieren“ mit 1 aktualisiert, 0 fehlgeschlagen, Wert-Karte mit „Stand vom …“ und erster Montagslauf in S12) |
| P12 | Wunschliste und Reihen | Sonnet | Medium | ✅ 01.11.2026 |
| P13 | Dashboard | Sonnet | Medium | offen |
| P14 | Einstellungen und Datensicherung | Sonnet | Medium | offen |
| P15 | PWA, PC-Feinschliff, Gerätetest, Version 1.0 | Opus | High | offen |

Reihenfolge: strikt von oben nach unten. P2 darf vor P1 fertig werden, braucht aber dessen Gerüst. Fällt in P2 BrickLink weg, schrumpft P11 auf „Wert von Hand“ (siehe P11).

## 5. Arbeitspakete (Tickets)

Tickets are written in English. Every acceptance criterion is at least one test, named after the criterion. UI text stays German.

### P1 – Project skeleton, quality gates, design tokens, navigation shell

**Goal:** An empty but deployable app with all quality gates from day one.

**Scope**
- Vite + Preact + TypeScript (strict), Biome, Vitest with coverage thresholds (≥ 90 % for `src/domain/`), Playwright with `@axe-core/playwright` in four projects (chromium-desktop, chromium-mobile, webkit-desktop, webkit-mobile).
- `npm run check` (Biome → tsc → Vitest with coverage → build → Playwright chromium-desktop) with short output; `npm run check:full` (all four projects); `npm run fix`; `npm run dev`; `npm run demo`; `npm run setup`.
- `.githooks/pre-commit` (secret scan of staged changes + Biome), `.github/workflows/check.yml` (on push/PR), `pages.yml` (deploy `main` to GitHub Pages after green check), `check-full.yml` (nightly + manual), `.github/dependabot.yml` (weekly, no auto-merge), actions pinned by hash.
- Design tokens from `docs/design/DESIGN.md` as CSS variables in `src/ui/tokens.css`; fonts Rubik and Mali self-hosted via `@fontsource`; contrast test for every used colour pair (`tokens.test.ts`).
- App shell: hash router with routes `#/vitrine` (start), `#/dioramen`, `#/erfassen`, `#/wunschliste`, `#/dashboard`, `#/einstellungen`; floating bottom nav on phones, left sidebar on PC (exactly as in the click dummy); every page has an `h1` that takes focus; empty pages say what will come.
- `LICENSE` (EUPL-1.2), `README.md` (German, short), `.env.example`.

**Out of scope:** data, backend, PWA install (P15).

**Done when**
- `npm run check` is green locally and on GitHub; `check:full` is green.
- https://stephan-pro.github.io/stud-stephan/ shows the shell with working navigation on phone and PC sizes.
- axe reports no violations on every route in light mode.
- Nav matches the dummy: black pill, active item white with label, plus button `--pop`.

**PO steps:** In the repo settings, switch on GitHub Pages with source “GitHub Actions” (the report lists the exact clicks).

### P2 – Data source spike

**Goal:** Know for sure what each external service delivers before building on it.

**Scope**
- Script `npm run try:sources` (reads keys from `.env.local`, never prints them) that, run by the PO in his own terminal:
  1. Rebrickable: looks up minifig `sw0194` (via set/minifig search) and set `75372-1` incl. its minifigs.
  2. Brickognize: sends a photo from `scripts/samples/` (PO supplies one photo of an official minifig) to the minifig endpoint and prints the top 3 with confidence.
  3. BrickLink: price guide (sold, last 6 months) for one minifig, new and used, in EUR. Reports clearly if access is refused and why. Note (31.10.2026): the PO’s account is upgraded to seller and the Store API is registered (IP 0.0.0.0), but the seller verification (shipping method, listing, ID upload) is deliberately not done. Record exactly whether the price guide answers in this state.
  4. Merlins Steine SetDB: fetches one set page whose address the PO pastes, extracts name, manufacturer, set number, piece count, image; reports which fields were found.
- Result document `docs/DATENQUELLEN.md`: endpoints, auth, limits, CORS behaviour, field mapping to our model, observed quality, go/no-go per service.

**Out of scope:** any UI.

**Done when**
- The PO ran the script and `docs/DATENQUELLEN.md` contains real results for all four services.
- A clear go/no-go for BrickLink is recorded (and, if no-go, the fallback for P11).

**PO steps:** create Rebrickable key and BrickLink keys beforehand (see `docs/EINRICHTUNG.md`), put them into `.env.local`, add one sample photo, run the script, paste the output summary (no keys) into the chat.

### P3 – Domain model and core logic

**Goal:** All business rules as pure, fully tested functions.

**Scope** (`src/domain/`, no DOM, no storage, “today” as parameter)
- Types: `Minifig`, `ModPart`, `LegoSet` (status `complete | figuresRemoved | disassembled`), `Diorama`, `StudioFile`, `SpecialPart`, `WishItem` (priority `high | medium | low`, `targetPrice`), `PricePoint` (new/used, date, source), `Manufacturer`, `Condition` (`new | used`); money as integer cents; `schemaVersion`. Official minifigs, wish items and price points are keyed by the **BrickLink number** (`bricklinkId`, e.g. `sw0194`), sets by set number (`75372-1`); customs and other manufacturers have no catalog id (see section 1 and `docs/DATENQUELLEN.md`).
- `valueOf(item, prices)`: F10 rules incl. modified figures (= original market value in its condition) and manual values; `ownValueMissing` flag.
- `totals(collection)`: total value, purchase sum, difference, mod spend, items without value, counts per type and theme.
- `groupCopies(minifigs)`: F5 grouping for the showcase (`×3`).
- `assignToDiorama` / `removeDiorama`: F8 (a figure is in at most one diorama; deleting a diorama frees its figures).
- `wishStatus(item, price)`: F14 target reached (≤ target, cents exact).
- `seriesProgress(catalogFigures, collection, wishlist)`: F13 statuses present / missing / wished.
- `filterShowcase`, `sortShowcase`: F11 filters and sorts.
- Demo data (`src/demo/`) matching the click dummy.

**Done when**
- Every acceptance criterion of F5, F8, F10, F13, F14 in `ANFORDERUNGEN.md` is a named test and green.
- Coverage of `src/domain/` and `src/demo/` ≥ 90 %.

### P4a – Supabase: schema, row level security, storage, fake server

**Goal:** A secure backend that only Stephan can read and write, testable without internet.

**Scope**
- The project exists since 31.10.2026: name `stud-stephan`, ref `ohuqwiypmoqyuxsgouxw`, URL `https://ohuqwiypmoqyuxsgouxw.supabase.co` (public), region North EU (Stockholm, `eu-north-1`), Free plan, no GitHub connection in Supabase.
- Project settings chosen by the PO at creation (31.10.2026): Data API on, “Automatically expose new tables” **off**, “Enable automatic RLS” **on**. Migrations therefore grant table/function privileges explicitly (only what the app needs, only to `authenticated`), and RLS is enabled explicitly anyway.
- `supabase/` with `config.toml`, migrations for all P3 types (one table per object type, plus `price_points`, `studio_files`, `photos`), RLS on every table (`owner = auth.uid()`), private storage buckets `photos` and `studio-files` with owner-only policies, limits per row/file size.
- `Remote` interface in `src/backend/`, `SupabaseRemote`, `FakeRemote` + HTTP fake server for E2E (pattern from Krümel), one shared contract test suite for both.
- CI job `db`: runs migrations and RLS tests against a local Supabase in Docker (`npm run check:db`, CI only; the PO has no Docker).
- Keepalive workflow (daily ping) like Krümel.
- `docs/SUPABASE.md`: what lives where, which values are public (URL, publishable key) and which never leave the dashboard.

**Done when**
- `check` (fake) and `db` (real Postgres) are green on GitHub.
- A test proves a second user can neither read nor write any row or file.
- Migrations are applied to the real project (PO step) and the Security Advisor shows no errors.

**PO steps:** `npx supabase login`, `npx supabase link`, `npx supabase db push`; set repository variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

### P4b – Sign-in by email code (single user)

**Goal:** Only Stephan can sign in, on every device, without a password.

**Scope**
- Sign-in page S0 as in the dummy: email field, “Anmeldelink senden” → becomes a 6-digit code entry (like Krümel; no magic links), stays signed in per device, sign-out in settings.
- New accounts are impossible: sign-ups disabled in Supabase; Stephan’s account is created once by hand.
- Error texts for wrong/expired code, too many attempts, offline.
- SMTP via the Krümel Gmail account (dashboard setting only).

**Done when**
- E2E (fake): sign in, reload stays signed in, sign out, wrong code, expired code.
- Unknown address gets no mail and a neutral message (verified by the PO).
- The online version asks for sign-in and shows the shell afterwards.

**PO steps:** dashboard settings (email OTP, templates, SMTP, sign-ups off), create user, test on phone and PC.

### P4c – Photos and Studio files

**Goal:** Upload, show and download files reliably and small.

**Scope**
- Client-side photo resize to longest side 1,600 px and WebP (~200–300 KB) without a library (Canvas); EXIF orientation respected.
- Upload with progress, retry, delete; signed URLs for display; placeholder (tint + scribble) when no photo.
- Studio files (`.io`): upload, list, download byte-identical; size limit 25 MB.
- Storage usage shown in settings (used / 1 GB).

**Done when**
- Unit tests for resize maths; E2E (fake) for upload, delete, download byte-identical (F8 criterion).
- A 12-MP phone photo ends up ≤ 400 KB.

### P5 – Showcase, filters, detail pages

**Goal:** Browse the collection exactly as in the dummy.

**Scope:** S1 (collection card, chips, sort, filter button, grid with markers `×3`, `Mod`, `Kein Diorama`, grouped copies), S1a filter sheet (themes in two levels: main theme with its subthemes, both selectable – PO decision 31.10.2026), S2 minifig detail, S3 set detail (contained figures with owned/missing), S4 special part detail, loading placeholders, empty state, offline banner. PC layout with 5–6 columns. Photos in grid and detail via `Remote.signedUrl` (building blocks from P4c in `src/files/`); placeholder (tint + scribble) when an object has no photo (moved here from P4c).

**Done when:** F5 (grouping), F11 and the detail content of F5/F7/F9 work against fake and real data; E2E with axe on every page and the filter sheet; phone (390 × 844) and PC screenshots match the dummy closely.

### P6 – Manual capture, edit, delete, mods

**Goal:** Everything can be entered and changed by hand.

**Scope:** S7 capture sheet (what/how), S8 form for every object type (sections per type, prefilled fields highlighted), S8a mod part sheet, “Weiteres Exemplar anlegen”, edit, delete with confirmation and “Rückgängig” for a few seconds. Validation messages at the field, focus on first error. Photo UI in the forms (moved here from P4c): pick or take photos, resize with `resizePhoto`, upload with `uploadFile` (show steps and retry), show, delete; limits from `rules.ts` (20 photos per object).

**Done when:** F4, F6 (incl. “Ausgaben für Mods” and value unchanged), F7, F9 forms work end to end; E2E with axe for every form state. PO check on the live site: a real photo from his phone (portrait) is shown upright and ends up ≤ 400 KB (EXIF orientation was not tested with a real phone photo in P4c).

### P7 – Catalog (BrickLink numbers, Rebrickable search)

**Goal:** Official LEGO items fill themselves in.

**Scope:** Edge Function `bricklink` (BrickLink OAuth keys as secrets; catalog item by number for minifigs and sets incl. image, year, category; set → contained minifigs via subsets; minifig → sets via supersets; later reused by P11 for prices) and Edge Function `catalog` (Rebrickable key as secret; name search for sets; themes for P12; name search for minifigs returns Rebrickable figures, which are resolved to a BrickLink number through one of their sets’ subsets and confirmed by the PO). Caching in the database for 30 days; S7b search with live results; prefill S8; set → contained figures (F7). Optional: German retail price (UVP) of a set if a source offers it.

**Done when:** F2 works for minifigs and sets; function tests with recorded responses; E2E against the fake; rate limit respected.

**PO steps:** set the Rebrickable key and the four BrickLink values as Supabase secrets in his own terminal and deploy both functions (exact commands in the report).

### P8 – Photo recognition (Brickognize)

**Goal:** Photo in, suggestions out.

**Scope:** Edge Function `recognize` (forwards the resized photo, returns up to 5 suggestions with confidence – P2 saw only one, so 1–5 must work; the BrickLink id is used directly with the `bricklink` catalog from P7), S7a with camera/file picker, suggestions, “Keiner passt”, error state; own photo is kept for the new item.

**Done when:** both F1 acceptance criteria are tests (with recorded responses); PO confirms with three real figures on the Redmi.

### P9 – Capture by link

**Goal:** Paste a link, get as much as possible filled in.

**Scope:** Edge Function `link-preview`: Rebrickable set links via API; Merlins Steine SetDB page parser (only the one pasted page, no crawling; parser covered by a stored sample page); any other page via Open Graph title/image. S7c with clipboard button and “bitte ergänzen” markers.

**Done when:** F3 incl. its acceptance criterion (unreadable page → form opens with link and empty fields); parser tests with the stored sample.

### P10 – Dioramas

**Goal:** Dioramas with photos, Studio files and assigned figures.

**Scope:** S5 list with “N Figuren ohne Diorama” banner, S6 detail, S6a assign sheet (multi-select, “steht in: …” with move confirmation), link figure ↔ diorama both ways. Photo and Studio file UI on the diorama (moved here from P4c): upload `.io` files with `uploadFile` and `studioFile.ts`, list, download byte-identical, delete; photos as in P6.

**Done when:** all three F8 acceptance criteria are E2E tests and green.

### P11 – Market values and value history (BrickLink)

**Goal:** Up-to-date values without manual work.

**Scope:** Prices via the Edge Function `bricklink` from P7 (BrickLink OAuth 1.0 keys as secrets; price guide sold/6 months, new and used, EUR; respects 5,000 calls/day), table `price_points`, weekly `pg_cron` job (Monday 03:00), failure handling (never overwrite, “Stand vom …”), value card with sparkline on S2/S3/S4, run status in S12 (last run, result, next run).

**Fallback if P2 said no-go:** no BrickLink function; value = purchase price or manual estimate everywhere; settings say “Marktwerte nicht verbunden”.

**Done when:** all F10 acceptance criteria are tests; one real weekly run has written prices (PO checks in S12).

**PO steps:** redeploy the `bricklink` function, enable the cron job (exact SQL in the report). Secrets are already set since P7.

### P12 – Wishlist and series

**Goal:** Know what is missing and what to buy next.

**Scope:** S9 (target reached section on top, priority, sorting), S9a edit sheet incl. “Erhalten” → prefilled S8, S10 series search (Rebrickable themes) and “Meine Reihen”, series figures built as described in section 1 (sets of the theme → BrickLink subsets, cached; one BrickLink call per set, within the daily limit), S10a series detail with present/missing/wished.

**Done when:** F13 and both F14 acceptance criteria are tests; E2E with axe.

### P13 – Dashboard

**Goal:** All numbers in one place.

**Scope:** S11 with period switch, total value chart (SVG, `role="img"` with full text description), tiles, counts per type, distribution by **subtheme** (PO decision 31.10.2026), top 10, “ohne Diorama” link, price date footer.

**Done when:** F12 complete; chart description matches the data (unit test); E2E with axe.

### P14 – Settings and backup

**Goal:** Control and safety.

**Scope:** S12 (account, data source status, price run status, storage usage, export/import, version). F15 export incl. photos and Studio files as one file (zip; library `fflate` if needed, justify), import replaces after confirmation with automatic backup first.

**Done when:** export → import round trip restores everything byte-identical (test); E2E with axe.

### P15 – PWA, PC polish, device test, release 1.0

**Goal:** A finished app on phone and PC.

**Scope:** manifest, icons (studs motif, no LEGO trademarks), service worker (offline read of the collection), install hint, PC layout check of every screen, open deviations from the dummy collected so far (P10: search icon in the diorama list, edit/delete as buttons at the bottom vs. icons at the top – decide once for all detail pages, “N Figuren zuordnen” button in `--pop` as in `Zuordnen.dc.html`; “Link einfügen” for dioramas only if the PO still wants it), open gaps from P12 (create a wish directly from the capture sheet via number, search or link; a set received from the wishlist gets its contained figures like a set from the catalog), `check:full`, `docs/GERAETETEST.md` checklist run by the PO on the Redmi and PC, `docs/WARTUNG.md`.

**Done when:** installable on Android, offline showcase readable, device checklist ticked by the PO, version 1.0 tagged.

## 6. Risiken

| Risiko | Auswirkung | Gegenmaßnahme |
|---|---|---|
| BrickLink verlangt später doch die Verkäufer-Verifizierung | keine automatischen Marktwerte, kein BrickLink-Katalog | Rückfall in P11 („Wert von Hand“); Katalog dann über Rebrickable, BrickLink-Nummer von Hand oder per Foto |
| Brickognize ändert oder sperrt die Schnittstelle | Fotoerkennung fällt aus | Erfassen per Nummer bleibt immer möglich |
| Merlins Steine ändert den Seitenaufbau | Link-Vorschau füllt weniger aus | F3 öffnet trotzdem das Formular |
| 1 GB Dateispeicher wird knapp | Upload schlägt fehl | Fotos verkleinern (P4c), Anzeige der Belegung (P14) |
| Supabase pausiert das Projekt | App lädt nicht | `keepalive.yml`, wöchentlicher Preisabruf |

## 7. Entscheidungen des PO

- 31.10.2026: Repository öffentlich, Lizenz EUPL-1.2.
- 31.10.2026: Keine Serienerfassung in Version 1.
- 31.10.2026: Stil F „Steinkasten-Mix“, Klick-Dummy abgenommen.
- 31.10.2026 (Ergebnis P2): BrickLink ist go, der Preisguide antwortet ohne Verkäufer-Verifizierung. Die BrickLink-Nummer einer Figur kommt nicht aus Rebrickable, sondern aus Brickognize, von Hand oder aus der SetDB (Details: `docs/DATENQUELLEN.md`). Ergänzt am selben Tag: Die BrickLink-Nummer ist die Kennung jeder offiziellen Figur; Katalogdaten kommen aus dem BrickLink-Katalog, Rebrickable nur für Namenssuche und Themen (Abschnitt 1).
- 31.10.2026 (P3, von Claude entschieden, vom PO änderbar):
  - Wert eines Objekts in dieser Reihenfolge: Marktwert (nur LEGO mit BrickLink- bzw. Setnummer, im eigenen Zustand) → selbst geschätzter Wert → Kaufpreis → 0 € und „ohne Wert“. Auch eine LEGO-Figur ohne BrickLink-Nummer zählt also mit ihrem Kaufpreis statt mit 0 €.
  - Fehlt im neuesten Preisstand ein Zustand, gilt dessen letzter bekannter Preis mit „Stand vom …“. Ein zweiter Abruf am selben Tag ersetzt den Stand dieses Tages; ohne Verkäufe entsteht kein Preisstand.
  - Dioramen zählen nur mit einem selbst geschätzten Wert zum Gesamtwert und nie als „ohne Wert“ (ihre Figuren zählen einzeln).
  - Gleiche Figur (Kachel „×3“) = gleicher Hersteller und gleiche Nummer, ohne Nummer gleicher Name. Zustand und Mods trennen die Kachel nicht.
  - Die Filter „Modifiziert ja/nein“ und „ohne Diorama“ zeigen nur Figuren. Thema-Filter und Dashboard nutzen das Hauptthema („Star Wars“ statt „Star Wars – The Clone Wars“).
  - Reihen: Eine vorhandene Figur bleibt „vorhanden“, auch wenn ein weiteres Exemplar auf der Wunschliste steht.
- 31.10.2026 (P4a, von Claude entschieden, vom PO änderbar):
  - Set löschen → seine Figuren bleiben; „Stammt aus Set“ behält die Katalogangabe (z. B. „75372-1“), nur die Verknüpfung mit dem eigenen Set entfällt. Diorama löschen → seine Fotos und Studio-Dateien werden mitgelöscht, die Figuren bleiben (F8).
  - Grenzen: höchstens 20 Fotos je Objekt, Foto höchstens 2 MB (WebP, JPEG oder PNG), höchstens 20 Studio-Dateien je Diorama, Studio-Datei höchstens 25 MB, Objekt ohne Dateien höchstens 32 KB Text.
- 31.10.2026 (PO, ersetzt den Punkt „Thema-Filter und Dashboard nutzen das Hauptthema“ aus P3): **Themen zweistufig.** Der Filter der Vitrine zeigt Hauptthemen mit ihren Unterthemen darunter (z. B. Star Wars → The Clone Wars, The Mandalorian); wählbar ist beides. Das Dashboard „Nach Thema“ zeigt die Verteilung nach **Unterthema**. Umsetzung: Fachlogik bei Bedarf in P5 anpassen (Filter) bzw. in P13 (Dashboard).
- 01.11.2026 (PO, P5-Nacharbeit): Im Filter heißt der Knopf unten kurz „N anzeigen“ (wie im Dummy) und bricht nicht um. Unterthemen erscheinen erst, wenn das Hauptthema gewählt ist: eingerückt unter den Hauptthemen, als Chips nebeneinander; Haupt- und Unterthema bleiben einzeln wählbar. (Von Claude ergänzt: Ist ein Unterthema gewählt, bleibt es sichtbar, auch wenn man das Hauptthema wieder abwählt, damit kein aktiver Filter unsichtbar wird.)

- 31.10.2026 (P4b, von Claude entschieden, vom PO änderbar):
  - Der Knopf auf der Anmeldeseite heißt „Code senden“ statt „Anmeldelink senden“ (Dummy), der Hinweis darunter spricht vom Code: Es kommt kein Link, sondern ein 6-stelliger Code.
  - Eine unbekannte Adresse bekommt keine Mail, aber dieselbe Seite „Code eingeben“ mit „Wenn … zu Stud Stephan gehört, ist jetzt eine Mail … unterwegs“; jeder Code ist dort „falsch“. So verrät die App nicht, welche Adresse ein Konto hat.
  - Nach dem Abmelden startet die nächste Anmeldung in der Vitrine. Öffnet man einen Link auf eine Seite (z. B. `#/dioramen`) abgemeldet, führt die Anmeldung genau dorthin.
  - `npm run demo` zeigt die App ohne Anmeldung (Konto-Karte: „Beispieldaten, ohne Anmeldung“). `npm run dev` und die Online-Version melden sich bei Supabase an, `npm run check` beim Fake-Server (Build-Modus `e2e`).

- 01.11.2026 (P4b-Nachtrag, von Claude entschieden): Antwortet Supabase mit einem Serverfehler (5xx, z. B. weil der Mailversand scheitert), zeigt die Anmeldeseite „Der Code konnte gerade nicht verschickt oder geprüft werden. Versuch es in ein paar Minuten noch einmal.“ „Keine Verbindung zum Server“ kommt nur noch, wenn gar keine Antwort ankommt.
- 01.11.2026 (P4c, von Claude entschieden, vom PO änderbar):
  - Fotos werden auf höchstens 1.600 px an der langen Seite verkleinert und als WebP (Ziel ≤ 300 KB) gespeichert; reicht die Qualitätsstufe nicht, sinkt erst die Qualität, dann die Größe (1.280, 1.024 px). Browser, die kein WebP schreiben können (Safari), speichern JPEG. Die Drehung aus den EXIF-Daten wendet der Browser beim Laden an.
  - Der Fortschritt beim Hochladen zeigt Schritte (Senden, Warten auf den nächsten Versuch, Fertig) statt Prozent: `fetch` meldet keine gesendeten Bytes. Bis zu 4 Versuche mit 1, 2, 4 Sekunden Pause; eine Ablehnung des Servers wird nicht wiederholt.
  - Speicherplatz: 1 GB zählt als 1.000.000.000 Bytes; die Anzeige in den Einstellungen rechnet in Schritten zu 1.000. Die Belegung wird beim Öffnen der Einstellungen aus dem Dateispeicher gelesen (keine neue Migration).
  - Die Oberfläche zum Auswählen, Anzeigen und Löschen von Fotos und Studio-Dateien kommt mit den Seiten, die sie brauchen (P5 Anzeige und Platzhalter, P6 Fotos auswählen und löschen, P10 Dioramen mit Studio-Dateien); P4c liefert die Bausteine (`src/files/`, `Remote.signedUrl`) und die Speicheranzeige.

- 01.11.2026 (P5, von Claude entschieden, vom PO änderbar):
  - Die Vitrine lädt die Sammlung einmal beim Start der App. Was später gespeichert wird (ab P6), aktualisiert die Anzeige beim Speichern; bis dahin zeigt ein Neuladen neue Daten. Ohne Verbindung zeigt eine Leiste oben „Keine Verbindung“, die geladene Sammlung bleibt stehen; ein Offline-Speicher für den Start ohne Netz kommt mit P15.
  - Die Kachel einer Gruppe (×3) zeigt den Wert des wertvollsten Exemplars (nicht die Summe); ein Objekt ohne Marktwert und ohne eigenen Wert zeigt „ohne Wert“ statt „0,00 €“.
  - Eine enthaltene Figur eines Sets gilt als „vorhanden“, wenn eine LEGO-Figur mit derselben BrickLink-Nummer in der Sammlung steht (ohne Nummer: gleicher Name und mit dem Set verknüpft). „2 / 4“ zählt Stücke: zwei Clone Trooper im Set, drei eigene Exemplare → 2 von 2 vorhanden.
  - Der Filter wirkt sofort beim Antippen; der Knopf unten nennt die Zahl der Ergebnisse. Themen zweistufig: ein Hauptthema nimmt alle Unterthemen mit, ein Unterthema nur sich selbst (Entscheidung vom 31.10.2026).
  - Handy: Die Lupe öffnet das Suchfeld; am PC steht es immer da (wie im PC-Dummy).
  - Noch nicht dabei, weil das Paket es bringt: „+2,5 % Woche“ in der Sammlungskarte (Verlauf des Gesamtwerts, P13), „Bearbeiten“, „Weiteres Exemplar anlegen“ und „Löschen“ (P6), Diorama verlinken und „Einem Diorama zuordnen“ (P10), „＋ Wunschliste“ bei fehlenden Figuren eines Sets (P12). Ein Diorama steht auf der Figur mit Namen und Bild, noch ohne Link.
  - Neuer Design-Wert: `--line` (#E1E4EA) für die Trennlinien in Listen, in `DESIGN.md` und `tokens.css` eingetragen.

- 01.11.2026 (P8, von Claude entschieden, vom PO änderbar):
  - **Weg.** Erfassen → Figur → „Foto“ öffnet `#/erfassen/foto`. Dort wählt oder fotografiert man (am Handy fragt das Gerät nach Kamera oder Galerie), das Foto wird mit `resizePhoto` verkleinert und an die Funktion `recognize` geschickt, nie direkt an Brickognize. Nur Figuren; bei Sets und Sonderteilen ist der Weg ausgegraut („Erkannt werden nur Figuren“).
  - **Vorschläge.** Bis zu 5, bester zuerst (grün), mit Katalogbild, Name, BrickLink-Nummer und Trefferquote. Brickognize liefert weder Jahr noch Thema, deshalb steht in der Zeile (anders als im Dummy) nur die Nummer; die BrickLink-Abfragen für Jahr und Thema würden das Tageslimit belasten. Ein Tipp öffnet das Formular aus dem Katalog (P7) mit grünen Feldern. Einträge ohne BrickLink-Nummer oder nur mit Nummern anderer Seiten werden weggelassen.
  - **Eigenes Foto.** Es bleibt im Speicher des Browsers, solange man auf dem Weg Foto → Suche → Formular ist, und wird beim Öffnen eines Formulars für eine neue Figur wie ein dort gewähltes Foto hochgeladen (Titelbild). Verlässt man den Weg (z. B. zurück zum Erfassen-Blatt), ist es weg. „Abbrechen“ im Formular führt zu den Vorschlägen zurück, solange das Foto da ist.
  - **Fehler.** Kein Treffer: „Keine Figur erkannt“ mit Weg zur Suche. Dienst gestört, offline oder überlastet: „Erkennung gerade nicht erreichbar“ mit „Noch einmal erkennen“ und „Per Nummer weiter“. Ein Foto, das nicht gelesen werden kann, wird abgelehnt.
  - **Funktion.** Prüft wie `catalog`/`bricklink` selbst die Anmeldung (`isSignedIn`), nimmt nur WebP/JPEG/PNG bis 3 MB, braucht keinen Schlüssel. Eine Zeitgrenze von 25 s für Brickognize.
  - **`npm run deploy:functions`** meldet bei Bedarf selbst bei Supabase an (`npx supabase login`), setzt die Schlüssel und stellt alle Funktionen bereit (jetzt auch `recognize`): ein Aufruf reicht.
  - Demo und Tests nutzen drei Beispiel-Vorschläge (`src/demo/recognition.ts`).

- 01.11.2026 (P7, von Claude entschieden, vom PO änderbar):
  - **Nummer oder Name.** Eine BrickLink-Nummer (`sw0194`) oder Setnummer (`75372`, ohne „-1“ wird es ergänzt) fragt BrickLink direkt und gibt höchstens einen Treffer. Ein Name sucht bei Rebrickable (bis zu 8 Treffer; BrickLink hat keine Namenssuche). Ab 2 Zeichen, 0,4 s nach dem letzten Tastendruck.
  - **Figur nach Name.** Rebrickable kennt die BrickLink-Nummer nicht (P2). Beim Übernehmen sucht die Funktion in den ersten beiden Sets der Figur die gleichnamige Figur im BrickLink-Katalog. Gleicher Name (ohne Groß-/Kleinschreibung und Satzzeichen) = BrickLink-Nummer wird eingetragen; sonst bleibt das Feld leer, der Hinweis „Die BrickLink-Nummer wurde im Katalog nicht gefunden …“ steht darunter, und du trägst sie ein. Die „Bestätigung“ ist also das grüne Feld im Formular, das du ändern kannst.
  - **Was übernommen wird.** Figur: Name, BrickLink-Nummer, Thema („Hauptthema – Unterthema“), Katalogbild, „Stammt aus Set“ (nur wenn die Figur in genau einem Set vorkommt, sonst steht „Kommt vor in: …“ darunter). Set: Name, Setnummer, Thema, Jahr, Teile (Rebrickable), Zahl der Figuren, Katalogbild und die enthaltenen Figuren (F7). Hersteller ist immer LEGO. Zustand, Herkunft, Preis und Fotos trägst du ein. Die UVP eines Sets (optional im Paket) gibt keine der beiden Quellen her und fehlt.
  - **Zwischenspeicher und Grenze.** Fertige Katalogeinträge und Themen liegen 30 Tage in der Datenbank (`catalog_cache`); ein Eintrag, bei dem ein Teil (z. B. Rebrickable) ausfiel, wird nicht gemerkt. BrickLink wird höchstens 4.500 Mal am Tag gefragt (`catalog_usage`, Grenze von BrickLink: 5.000; der Rest bleibt für den Preisabruf in P11). Danach sagt die Suche „Für heute sind alle Katalog-Abfragen verbraucht“. Ohne die beiden Tabellen (Migration noch nicht eingespielt) arbeitet die Funktion ohne Zwischenspeicher weiter.
  - **Anmeldung der Funktionen.** Beide Funktionen prüfen selbst, ob der Aufruf von einem angemeldeten Konto kommt (Anfrage an den Anmeldedienst des Projekts) und sind mit `verify_jwt = false` bereitgestellt; die Prüfung des Gateways passt nicht zu den neuen Schlüsseln. Ohne Anmeldung gibt es keine Antwort und keine Abfrage bei BrickLink.
  - **Funktion `bricklink`.** Bietet nur die Katalogabfragen (Eintrag, Figuren eines Sets, Sets einer Figur) einzeln an; die App ruft `catalog`. P11 ergänzt den Preisabruf in derselben Funktion.
  - **Sonderteile** haben keine Suche (der Weg ist im Erfassen-Blatt ausgegraut: „Für Sonderteile gibt es keinen Katalog“); im Dummy gab es dafür einen dritten Chip. Die Trefferzeile hat ein Bild im Format der Kacheln (72 × 56 px) statt des runden 52-px-Bildes. Der Titel des Formulars bleibt „Neue Figur“ / „Neues Set“; der grüne Hinweis oben sagt, dass es aus dem Katalog kommt.
  - Die Vorschau (`npm run demo`) und die Tests nutzen einen kleinen Beispielkatalog in `src/demo/catalog.ts` statt der echten Funktionen.

- 01.11.2026 (P6, von Claude entschieden, vom PO änderbar):
  - **Erfassen (S7):** Nur „Manuell“ führt weiter (Figur, Set, Sonderteil). Foto, Nummer/Suche und Link sowie die Arten Diorama und Wunsch sind sichtbar, aber ausgegraut mit „Kommt bald“ (P7, P8, P10, P12). Adressen: `#/erfassen/figur|set|sonderteil` (neu), `#/erfassen/figur/kopie/<id>` (weiteres Exemplar, nur Figuren), `#/vitrine/figur|set|sonderteil/<id>/bearbeiten` (bearbeiten).
  - **Formular (S8):** Der Fehler steht am Feld, oben steht „N Angaben stimmen noch nicht“, der Fokus geht auf das erste falsche Feld. Der Abschnitt „Wert“ (selbst geschätzt) steht bei allen drei Arten, mit dem Hinweis auf die Reihenfolge Marktpreis → eigener Wert → Kaufpreis. „Erworben am“ nimmt „MM.JJJJ“ oder „TT.MM.JJJJ“; ein genauer Tag geht beim Bearbeiten nicht verloren. „Stammt aus Set“ verknüpft das eigene Set, dessen Nummer (mit oder ohne „-1“) passt. Beim Bearbeiten bleiben, was das Formular nicht zeigt: Diorama, Katalogbild, enthaltene Figuren eines Sets, Anlegezeit und der Tag eines unveränderten geschätzten Werts. Nach dem Speichern ersetzt die Detailseite das Formular im Verlauf („Zurück“ führt nicht ins alte Formular).
  - **Weiteres Exemplar:** übernimmt Name, Nummer, Hersteller, Thema und „Stammt aus Set“; Zustand (neu), Quelle, Preis, Fotos, Mods und Notiz bleiben leer.
  - **Fotos im Formular:** Ein Tipp auf die Kamera-Fläche öffnet die Auswahl des Geräts (am Handy Kamera oder Galerie), mehrere Fotos auf einmal sind möglich. Jedes wird mit `resizePhoto` verkleinert und mit `uploadFile` hochgeladen (Schritte „Wird verkleinert“, „Wird hochgeladen (Versuch 2 von 4)“, bei Fehlschlag „Noch einmal versuchen“ / „Verwerfen“). Statt Ziehen gibt es pro Foto einen Stern-Knopf „zum Titelbild machen“ (erstes Foto = Titelbild). Ein im Formular hochgeladenes, aber nie gespeichertes Foto wird bei „Abbrechen“, beim Verlassen der Seite oder beim Entfernen wieder aus dem Dateispeicher gelöscht.
  - **Mod-Teile (S8a):** Position und Beschreibung sind Pflicht, Preis, Link, Anbieter und Verbleib freiwillig. Teile lassen sich im Formular antippen (ändern) und entfernen; die Summe „Ausgaben für Mods“ erscheint schon im Formular und zählt nie zum Wert.
  - **Löschen:** erst eine Rückfrage, dann verschwindet das Objekt sofort und eine Leiste bietet 8 Sekunden lang „Rückgängig“. Der Server wird erst nach diesen 8 Sekunden gefragt (oder wenn die App in den Hintergrund geht oder ein zweites Objekt gelöscht wird); „Rückgängig“ löscht deshalb nichts, auch keine Fotos. Scheitert das endgültige Löschen, kommt das Objekt zurück und die App sagt es. Schließt man den Tab innerhalb der 8 Sekunden, bleibt das Objekt erhalten.
  - **Demo:** `npm run demo` speichert, bearbeitet und löscht jetzt im Speicher (ein Neuladen setzt zurück); Fotos lassen sich dort nicht anzeigen.
  - **Kleiner Fehler behoben:** Wechselte die Adresse zwischen dem ersten Zeichnen und dem Anhängen des Adress-Lauschers, blieb die alte Seite stehen; die App liest die Adresse jetzt nach dem Anhängen noch einmal.

- 01.11.2026 (P9, Sicherheit der Funktion `link-preview`, Vorgabe des PO; die Funktion ruft beliebige Adressen ab, deshalb gelten diese Grenzen, umgesetzt in `supabase/functions/_shared/safeFetch.ts`, getestet in `link.test.ts`):
  - **Anmeldung:** dieselbe Prüfung wie `catalog`, `bricklink` und `recognize` (`isSignedIn`, `verify_jwt = false`); ohne Anmeldung 401 und **kein** Abruf.
  - **Adresse:** nur `https` und `http`, nur Port 80 und 443, keine Anmeldedaten in der Adresse. Keine IP-Adresse als Rechnername (auch nicht als Zahl, in Hex oder verkürzt, kein IPv6), kein `localhost`, keine Namen ohne Punkt und keine internen Endungen (`.local`, `.internal`, `.lan`, `.home`, `.corp`, `.intranet`, `.home.arpa` …). Zusätzlich wird der Name nachgeschlagen (A und AAAA) und abgelehnt, wenn **eine** Antwort privat, intern oder reserviert ist (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16 mit der Cloud-Metadaten-Adresse, 100.64/10, Multicast, IPv6 `::1`, `fc00::/7`, `fe80::/10` …, auch als IPv4 eingebettet).
  - **Weiterleitungen:** höchstens 3, von Hand verfolgt; jedes Ziel wird wie eine eingefügte Adresse geprüft (auch das Nachschlagen des Namens). Die vierte Weiterleitung bricht ab.
  - **Keine fremden Angaben:** Header und Cookies der Anfrage der App gehen nie an die Seite; gesendet werden nur drei feste Kopfzeilen (`Accept`, `Accept-Language`, `User-Agent`), `credentials: omit`, nur GET ohne Körper.
  - **Grenzen:** 10 Sekunden für alles zusammen (Abruf, Weiterleitungen und Lesen), 2 MB für die Seite (zu große Seiten werden abgebrochen, nicht abgeschnitten gelesen); ausgewertet wird nur `text/html`.
  - **Bilder:** Bild-Adressen aus der Seite (`og:image`) gehen nur als `https`-Link ohne Anmeldedaten und höchstens 500 Zeichen weiter und werden beim Lesen der Seite **nie** abgerufen (ein einzelnes Bild holt erst der zweite Aufruf, siehe „Bild einer Seite“ unter P10). Von der Seite kommt nichts außer den fünf Feldern (Name, Hersteller, Setnummer, Teilezahl, Bild) zurück.
  - **Rebrickable und BrickLink** (`/sets/<Nr>`, `/minifigs/fig-…`, `catalogitem.page?S=` oder `?M=`) werden gar nicht abgerufen: die Nummer aus der Adresse geht an den vorhandenen Katalog (P7), das Formular ist das grüne Katalogformular. Rebrickable-MOCs und andere Seiten dieser Anbieter werden wie jede andere Seite gelesen.
  - **Bekannte Restlücke:** Das Nachschlagen des Namens und der eigentliche Abruf sind zwei Schritte; ein Angreifer, der den Namen dazwischen umstellt (DNS-Rebinding), wäre nicht erkannt. Gemildert, weil nur du angemeldet bist, nur du Adressen einfügst und von der Seite nie der Inhalt zurückkommt, nur fünf Felder.
- 01.11.2026 (P9, Verhalten, von Claude entschieden, vom PO änderbar):
  - **Weg.** Erfassen → Art wählen → „Link einfügen“ (`#/erfassen/link/figur|set|sonderteil`, S7c). Der Link wird nach einer kurzen Pause automatisch gelesen (oder über „Aus Zwischenablage einfügen“). Die Karte „Erkannt“ zeigt Quelle, Bild und die Zeilen der Art, was fehlt, steht als „bitte ergänzen“ da. „Weiter“ öffnet das Formular (`#/erfassen/<art>/link/<Adresse>`) mit grünen Feldern; der Link steht im Feld „Links“ und bleibt am Objekt.
  - **Rebrickable/BrickLink** zeigen statt der Felder Art und Nummer; das Formular holt die Daten aus dem Katalog (`#/erfassen/set|figur/katalog/<Nr>/link/<Adresse>`). Führt der Link zu einer Figur, obwohl „Set“ gewählt war, öffnet sich das Figuren-Formular.
  - **Merlins Steine:** Name, Hersteller, Setnummer, Teilezahl, Bild. Die echte Seite (Stand 01.11.2026, `…/sets/bb-109580/`) hat keine Produktdaten mehr; Setnummer und Name kommen deshalb auch aus dem Titel („… • Set 109580 • SetDB“), Hersteller aus „Von: …“, Teilezahl aus der Beschreibung. Beispielseiten als Testdateien: `supabase/functions/_shared/samples/`.
  - **Andere Seiten:** nur Titel und Vorschaubild (Open Graph, sonst `<title>`); der Titel enthält oft den Shopnamen („… | BlueBrixx“), den du kürzt. Hersteller bleibt unverändert, bis du ihn wählst; wurde ein Hersteller gefunden: „BlueBrixx“ und „LEGO“ als Auswahl, alles andere als „Andere“ mit Namen.
  - **Nicht lesbar** (Seite antwortet nicht, zu groß, kein HTML, Adresse nicht erlaubt, Dienst gestört, offline): Hinweis mit Grund, „Noch einmal lesen“ (wo Warten helfen kann) und „Ohne Vorschau weiter – Link wird gespeichert“; das Formular öffnet sich dann leer bis auf den Link (F3). Ein Neuladen des Formulars liest den Link noch einmal; geht auch das nicht, ist es leer mit Link.
  - **Bilder anderer Seiten (PO-Test 01.11.2026):** Merlins Steine sendet `Cross-Origin-Resource-Policy: same-site`; der Browser zeigt sein Bild deshalb auf der App nicht an, obwohl die Adresse stimmt. Die Karte schreibt dann „gesperrt – nimm ein eigenes Foto“ statt „übernommen“. Das Bild herunterladen und selbst speichern war der einzige Weg; es ist inzwischen als zweiter Aufruf der Funktion umgesetzt (siehe „Bild einer Seite“ unter P10).
  - **Funktion** `link-preview` mit `npm run deploy:functions` bereitgestellt (ohne neuen Schlüssel). Demo und Tests nutzen Beispielseiten in `src/demo/links.ts`.

- 01.11.2026 (P10, von Claude entschieden, vom PO änderbar):
  - **Seiten.** Liste S5 `#/dioramen`, Detail S6 `#/dioramen/<id>`, Zuordnen S6a `#/dioramen/<id>/zuordnen` (eine eigene Seite statt Blatt, wie im Dummy: Schließen-Knopf, Suche, „Nur ohne Diorama“/„Alle“, Raster mit Mehrfachauswahl, unten „N Figuren zuordnen“), Bearbeiten `#/dioramen/<id>/bearbeiten`, neu `#/erfassen/diorama`. Im Erfassen-Blatt ist „Diorama“ frei; weil der Dummy nur Link und Manuell nennt, aber ein Diorama keine Katalogdaten hat, führt nur „Manuell“ weiter (ein Link kommt in das Feld „Links“ des Formulars). „Link einfügen“ mit Seitenvorschau gibt es für Dioramen nicht.
  - **Banner** „N Figuren haben noch kein Diorama“ öffnet die Vitrine mit dem Filter „Nur Figuren ohne Diorama“. Die Suche oben rechts der Dummy-Liste fehlt (bei wenigen Dioramen unnötig).
  - **Figur ↔ Diorama.** Auf der Seite einer Figur steht das Diorama mit Bild und Namen als Link zum Diorama; ohne Diorama gibt es „Einem Diorama zuordnen“ (Blatt mit der Liste der Dioramen), mit Diorama „Aus dem Diorama nehmen“. Zuordnen verschiebt eine Figur aus einem anderen Diorama erst nach Rückfrage („steht in: …“); dabei wird jede Figur einzeln gespeichert (die Zuordnung steht an der Figur), schlägt eine fehl, sagt die Seite es und behält sie ausgewählt.
  - **Studio-Dateien.** Hochladen im Formular und auf der Detailseite („Datei hochladen“, speichert sofort), Herunterladen auf der Detailseite und im Formular, Entfernen nur im Formular (wirkt beim Speichern; der Server räumt die nicht mehr genannten Dateien weg). Es wird nur geprüft, dass der Name auf `.io` endet, die Datei nicht leer und höchstens 25 MB groß ist, höchstens 20 je Diorama; den Inhalt prüft die App nicht (Studio-Dateien sind ZIP-Archive, aber ein falscher Inhalt schadet nicht). Heruntergeladen werden die Bytes unverändert unter dem Namen, den die Datei beim Hochladen hatte. Dateien aus einem Formular, das ohne Speichern verlassen wird, werden wieder aus dem Speicher genommen.
  - **Fotos** wie bei Figuren (`PhotoField`): erstes Foto = Titelbild, Liste und Detail zeigen es.
  - **Löschen** wie in Abschnitt 7 festgelegt: erst Rückfrage („Das Diorama mit seinen Fotos und Studio-Dateien wird gelöscht. Die Figuren bleiben …“), dann 8 Sekunden „Rückgängig“; erst danach löscht der Server das Diorama samt Fotos und Studio-Dateien, die Figuren bleiben und gelten wieder als „ohne Diorama“.
  - **Wert.** Ein Diorama hat das freiwillige Feld „Wert (selbst geschätzt)“ (F10: Eigenbauten haben keinen Marktpreis); die Gesamtwert-Rechnung dafür kommt mit P13.
  - **Darstellung.** Wie im Dummy: Karten mit großem Bild, rosa Banner, runde Figurenbilder in der Detailseite, „Figuren zuordnen“ rosa. Bearbeiten und Löschen sind wie bei den anderen Detailseiten Symbole oben rechts (der Dummy hat sie unten als Knöpfe).

- 01.11.2026 (P10, Bild einer Seite, Vorgabe des PO; umgesetzt in `supabase/functions/_shared/safeFetch.ts` (`fetchImage`), `linkService.ts` (`fetchLinkImage`), `handler.ts`, getestet in `link.test.ts`): Seiten wie Merlins Steine sperren das Einbetten ihrer Bilder (`Cross-Origin-Resource-Policy: same-site`). Damit das Bild trotzdem nutzbar ist, hat `link-preview` einen zweiten Aufruf `{image: <Adresse>}`, der genau ein Bild abruft:
  - **Gleiche Sicherheit wie für Seiten:** Anmeldung zuerst (401, kein Abruf), nur http/https auf Port 80/443 ohne Anmeldedaten, keine IP-Adresse, kein `localhost`, keine internen Namen, Nachschlagen des Namens (eine private Antwort genügt zum Ablehnen), höchstens 3 Weiterleitungen von Hand, jedes Ziel wird wie eine eingefügte Adresse geprüft, 10 Sekunden für alles, feste Kopfzeilen ohne Cookies und ohne die Header der App.
  - **Nur Bilder:** `image/jpeg`, `image/png` oder `image/webp`, höchstens 3 MB (nach der Größenangabe und beim Lesen). Zusätzlich müssen die ersten Bytes zum Typ passen (JPEG `FF D8 FF`, PNG-Kennung, WebP `RIFF…WEBP`); HTML als „Bild“, SVG und GIF werden abgelehnt. Die Antwort ist JSON `{kind: "image", contentType, data}` (Bytes als base64), kein Durchreichen der Bild-Antwort der fremden Seite.
  - **In der App:** Die Karte „Erkannt“ (S7c) holt das Bild über die Funktion und zeigt es („übernommen“; solange es lädt „wird geholt …“; klappt es nicht, gilt wie bisher „gesperrt – nimm ein eigenes Foto“). Das Formular zeigt „Bild von merlinssteine.de übernommen. Es wird beim Speichern als erstes Foto angelegt.“ mit „Nicht übernehmen“. Erst beim Speichern wird das Bild mit `resizePhoto` verkleinert und als erstes eigenes Foto hochgeladen (davor liegt nichts auf dem Server; ein Formular, das ohne Speichern verlassen wird, hinterlässt nichts). Das Bild der Seite wird dann nicht zusätzlich als Katalogbild-Adresse behalten. Klappt das Holen nicht, sagt das Formular es und speichert ohne Bild (die Adresse bleibt wie bisher Katalogbild).
  - **Rebrickable und BrickLink** (Katalog) sind nicht betroffen: ihre Bilder kommen aus dem Katalog.
  - **Bereitstellen:** `npm run deploy:functions` (ohne neuen Schlüssel), sonst läuft die Vorschau weiter wie bisher, aber das Bild kommt nicht.

- 01.11.2026 (P11, Vorgaben des PO: Geheimnis für den Cron-Job, Portionen, Tageslimit, Wunschliste, „Jetzt aktualisieren“; Rest von Claude entschieden, vom PO änderbar):
  - **Ablauf.** Ein Lauf ist eine Warteschlange in der Datenbank (`price_runs`, `price_run_items`, Migration `20261102120000_price_run.sql`). Beim Start kommt jede offizielle Figur und jedes Set der Sammlung und der Wunschliste mit BrickLink-Nummer genau einmal hinein (gleiche Nummer, auch in anderer Schreibweise, nur einmal). Die Funktion `bricklink` arbeitet sie in Portionen ab: höchstens 50 s je Aufruf vom Cron-Job, 20 s je Aufruf aus der App (Grenze im Free-Plan: 150 s). Was übrig bleibt, macht der nächste Aufruf; ein Eintrag, den ein abgebrochener Aufruf genommen hatte, ist nach 3 Minuten wieder frei.
  - **Keine doppelten Preisstände.** Jeder Preisstand eines Laufs trägt den Tag, an dem der Lauf begann (deutsche Zeit), auch wenn er über Mitternacht läuft; je Nummer und Tag gibt es genau einen (ein zweiter Lauf am selben Tag ersetzt ihn, wie in P3 festgelegt). Ein Eintrag, der fertig ist, wird nie ein zweites Mal gefragt.
  - **Fehler.** Kein Verkauf in 6 Monaten: kein neuer Preisstand („ohne Verkäufe“). BrickLink kennt die Nummer nicht: sofort „fehlgeschlagen“. BrickLink gestört: in späteren Aufrufen noch zweimal versucht, dann „fehlgeschlagen“. In allen Fällen bleibt der alte Wert mit „Stand vom …“ (F10). Die Einstellungen nennen die Nummern der fehlgeschlagenen Einträge.
  - **Tageslimit.** Preisabruf und Katalog zählen auf demselben Zähler (`catalog_usage`). Der Katalog hört bei 4.500 auf (P7), der Preisabruf bei 4.950 insgesamt und nimmt sich selbst höchstens 2.500 Abfragen am Tag (2 je Eintrag: neu und gebraucht, also bis 1.250 Einträge am Tag). Ist das erreicht, wartet der Lauf bis 00:05 UTC des nächsten Tages und geht dann von selbst weiter.
  - **Zeitplan.** pg_cron startet jeden Montag um 02:00 UTC (03:00 deutscher Winterzeit, 04:00 Sommerzeit) einen Lauf für jeden mit Sammlung und ruft danach alle 5 Minuten die Funktion erneut, solange ein Lauf offen und nicht pausiert ist (sonst ohne Aufruf). Ein dritter Job löscht die Protokollzeilen von pg_cron nach 14 Tagen.
  - **Ausweis des Cron-Jobs.** pg_net sendet den Kopf `x-price-run-secret` mit dem Wert aus dem Supabase Vault (`price_run_secret`); die Funktion vergleicht ihn mit ihrem Secret `PRICE_RUN_SECRET` (mindestens 32 Zeichen, Vergleich ohne Zeitverrat). Ohne Geheimnis im Vault ruft die Datenbank nichts auf; ohne oder mit falschem Kopf antwortet die Funktion 401 und fragt BrickLink nicht. Die Projektadresse steht in der Migration und kann im Vault (`project_url`) überschrieben werden. Das Geheimnis legt nur der PO an; es steht nie im Repo.
  - **„Jetzt aktualisieren“ (S12).** Ruft die Funktion mit der Anmeldung auf: startet einen Lauf (oder setzt einen offenen fort) und ruft weiter, solange die Seite offen ist und es vorangeht; danach liest die App die Sammlung neu. Schließt man die Seite, macht der Cron-Job in 5-Minuten-Schritten weiter.
  - **Karte „Preisabruf“** wie im Dummy: Letzter Lauf (mit „· von Hand“), Ergebnis („312 aktualisiert, 2 fehlgeschlagen“, dazu „N ohne Verkäufe“, während des Laufs „läuft: 40 von 312 abgefragt“, beim Tageslimit wann es weitergeht), Übersprungen („N ohne BrickLink-Nummer“), Fehlgeschlagen (Nummern), Nächster Lauf; darunter ein kurzer Hinweis und der Knopf. Die Karte „Datenquellen“ des Dummys kommt mit P14.
  - **Sonderteile** fragt der Abruf nicht ab: Ihre Nummer sagt nicht, welche Art BrickLink-Eintrag sie sind (Set, Teil, Gear). Sie behalten eigenen Wert oder Kaufpreis. (Ersetzt den Satz in P3, dass Sonderteile von LEGO einen Marktpreis bekommen.)
  - **Wert-Karte.** Zeigt beim Marktwert zusätzlich, aus wie vielen Verkäufen der Durchschnitt stammt („Stand vom … · BrickLink · Ø aus 97 Verkäufen“, Hinweis aus P2). Als Durchschnitt gilt wie in P2 `avg_price`, als Zahl `total_quantity` der „verkauft, letzte 6 Monate“-Antwort in EUR. Eine Setnummer ohne Variante („75372“) wird für BrickLink zu „75372-1“.
  - **Wert-Karte wie im Dummy (PO, 01.11.2026):** Die Texte folgen jetzt `Figur.dc.html`: „Aktueller Wert (gebraucht)“, darunter „Kaufpreis 25,00 € · **+13,50 €**“ und „Neu wäre sie 52,00 € wert“ (bei Sets und Sonderteilen „… wäre es …“) als Zeilen statt der Kästchen aus P5, Wert in 42 px. Eigener Wert, Kaufpreis als Wert und „ohne Wert“ behalten ihre Überschriften und Hinweise.

- 01.11.2026 (P12, Vorgaben des PO: Unterthemen, Plan mit Warnung, Tageslimit, Preisstände, „+ Wunschliste“; Rest von Claude entschieden, vom PO änderbar):
  - **Reihen bauen auf Unterthemen auf.** Angeboten werden Rebrickable-Themen unterhalb eines Hauptthemas und Themen ohne Unterthemen („Star Wars – The Clone Wars“, „Collectible Minifigures – The LEGO Batman Movie Series“), nie ein Hauptthema mit Unterthemen. Die Suche nimmt jedes Wort des Namens (englische Namen); „Sammelserie“, „Sammelfiguren“ zählen als „collectible“. Ein Thema umfasst die Sets seiner Unterthemen (bis 25 Themen).
  - **Vor dem Anlegen** (Blatt „Reihe anlegen“): „N Sets – dafür sind N BrickLink-Abfragen nötig“. Über **300 Sets** warnt die App (Knopf „Trotzdem anlegen“), über **1.000** legt sie die Reihe nicht an. Die Mengen stehen in `seriesTypes.ts` (`SERIES_WARNING_SETS`, `SERIES_MAX_SETS`).
  - **Aufbau** wie der Preisabruf eine Warteschlange in der Datenbank (Migration `20261103120000_series.sql`: `series_builds`, `series_build_sets`, Funktionen `series_*`, Tabellen für die App gesperrt). Ein Set = eine BrickLink-Abfrage (`subsets`), gezählt auf dem Zähler des Katalogs (Grenze 4.500 am Tag, der Rest bleibt dem Preisabruf). Die Figuren eines Sets werden 30 Tage zwischengespeichert (`series:figures:<Set>`), Sets und Themen ebenso. Ist das Tageslimit erreicht, bekommt die Reihe eine Pause bis 00:05 UTC und macht danach von selbst weiter; der Cron-Job alle 5 Minuten ruft die Funktion auch dann, wenn nur eine Reihe offen ist (`price_run_continue` ersetzt). Die geöffnete Reihenseite arbeitet zusätzlich in Portionen (20 s je Aufruf). Ein Set, das BrickLink nicht kennt, zählt als fehlgeschlagen (Hinweis auf der Seite); gestörter Dienst: 3 Versuche.
  - **Ablauf der Funktion:** Aufrufe `{op: "series", action: search | plan | start | work | list | get | remove}` in der Funktion `bricklink`, mit Anmeldung. Der Cron-Aufruf arbeitet Preisabruf und Reihen im selben Aufruf ab.
  - **Meine Reihen** (S10): zuletzt geöffnete zuerst, Fortschritt „34 / 52“ aus den Figuren der Reihe und der Sammlung; das Lesen für die Liste zählt nicht als „geöffnet“. Reihen lassen sich löschen (Figuren und Wünsche bleiben).
  - **Reihe im Detail** (S10a): Filter Alle · Fehlen (auch Gewünschte) · Vorhanden; vorhanden → Figur, fehlt/gewünscht → Wunschblatt. Eine Figur, die schon da ist, bleibt „vorhanden“ (P3).
  - **Wunschliste** (S9): „Zielpreis erreicht“ (Marktpreis ≤ Zielpreis, Stand aus dem Preisabruf P11, der die Wunschliste schon abfragt) steht oben, danach die Liste nach Priorität, Preis oder Name (ein Knopf wechselt). Die Lupe der Dummy-Seite fehlt (wenige Einträge). Das Wunschblatt (S9a) ist ein Blatt wie die anderen; „Entfernen“ fragt noch einmal nach.
  - **„Erhalten“** öffnet `#/erfassen/figur|set/wunsch/<id>` mit grünen Feldern aus dem Wunsch; mit dem Speichern verschwindet der Wunsch. Ein erhaltenes Set hat danach noch keine enthaltenen Figuren (die kommen nur aus dem Katalog).
  - **„+ Wunschliste“** bei einer fehlenden Figur eines Sets (S3, nur mit BrickLink-Nummer) und in einer Reihe öffnet dasselbe Blatt mit Priorität „mittel“, Zustand „gebraucht“ (Sets: „neu“).
  - **Noch nicht dabei:** Einen Wunsch direkt aus dem Erfassen-Blatt (Nummer, Suche, Link) anzulegen; „Wunsch“ bleibt dort ausgegraut mit dem Hinweis, wo man Wünsche anlegt.

- 01.11.2026 (P12-Nacharbeit, Vorgabe des PO: Bilder werden nicht mehr abgeschnitten): Gespeichert wird immer das ganze Bild, nur die Anzeige ändert sich (`Cover.tsx`, `app.css`). **Katalogbilder** überall `object-fit: contain` auf `--surface` (weiß) mit etwas Innenabstand. **Eigene Fotos** auf der Detailseite (`cover--hero`, Galerie) `contain` auf der Platzhalter-Tönung; in Kacheln und kleinen Bildern (Reihen, Sets, Dioramen, Listen) weiter `cover`, aber `object-position: center top`, damit der Kopf drin bleibt. Test `tests/e2e/pictures.spec.ts` (Hoch- und Querformat, Handy und PC).

## 8. Abhängigkeiten

| Paket | Art | Wofür / warum |
|---|---|---|
| `preact` | App | Oberfläche (Leitentscheidung, wie Krümel) |
| `@fontsource-variable/rubik`, `@fontsource/mali` | App | Schriften selbst gehostet, keine Anfrage an Google Fonts (DESIGN.md 3) |
| `vite`, `typescript` | Entwicklung | Build und Typprüfung (Leitentscheidung) |
| `@biomejs/biome` | Entwicklung | Formatierung und Linting in einem Werkzeug |
| `vitest`, `@vitest/coverage-v8` | Entwicklung | Unit-Tests mit Abdeckung |
| `@playwright/test`, `@axe-core/playwright` | Entwicklung | Abläufe im Browser, Barrierefreiheit |
| `@types/node` | Entwicklung | Typen für `node:crypto` (BrickLink-Signatur, später Edge Functions) |
| `@supabase/supabase-js` | App | Datenbank, Dateispeicher und ab P4b Anmeldung (Leitentscheidung Supabase, wie Krümel) |
| `supabase` | Entwicklung | Supabase-CLI: lokale Instanz für `check:db` in CI, `db push` und `secrets set` beim PO |

Symbole sind eigene SVG-Pfade aus dem Klick-Dummy (keine Symbol-Bibliothek).
