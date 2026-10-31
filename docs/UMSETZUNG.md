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
| Preisabruf | Wöchentlich per `pg_cron` in Supabase, ruft die Edge Function `prices` | Kostenlos, läuft ohne PC |
| Online-Version | GitHub Pages: https://stephan-pro.github.io/stud-stephan/ | Kostenlos bei öffentlichem Repo |
| Repository | https://github.com/stephan-pro/stud-stephan, öffentlich, Lizenz EUPL-1.2 | Entscheidung des PO (31.10.2026) |
| Sprache | Nur Deutsch (keine Übersetzungs-Schicht) | N3; spart Aufwand gegenüber Krümel |
| Geld | Immer ganze Cent als Zahl (`1250` = 12,50 €) | Keine Rundungsfehler |

**Konsequenz Free Plan:** Krümel und Stud Stephan belegen zusammen die zwei kostenlosen Supabase-Projekte. Ein Projekt pausiert nach 7 Tagen ohne Nutzung; der Workflow `keepalive.yml` (wie bei Krümel) verhindert das.

## 2. Architektur in einem Bild

```
Handy / PC (Browser, PWA)
   │  Preact-App (GitHub Pages)
   ├──► Supabase: Datenbank (nur Stephan liest/schreibt, Row Level Security)
   ├──► Supabase: Dateispeicher (Fotos, Studio-Dateien; privat)
   └──► Supabase Edge Functions ──► Rebrickable (Katalog)
                                 ├─► Brickognize (Fotoerkennung)
                                 ├─► BrickLink (Marktwerte)
                                 └─► Merlins Steine / andere Seiten (Link-Vorschau)
pg_cron (wöchentlich) ──► Edge Function „prices“ ──► BrickLink ──► Preisstände in der Datenbank
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
| P2 | Datenquellen prüfen (Spike) | Sonnet | Medium | offen |
| P3 | Datenmodell und Fachlogik | Opus | High | offen |
| P4a | Supabase: Tabellen, Regeln, Dateispeicher, Fake-Server | Opus | High | offen |
| P4b | Anmeldung per Code (nur Stephan) | Opus | High | offen |
| P4c | Fotos und Studio-Dateien hochladen | Sonnet | Medium | offen |
| P5 | Vitrine, Filter, Detailseiten | Sonnet | Medium | offen |
| P6 | Manuell erfassen, bearbeiten, löschen, Mods | Sonnet | Medium | offen |
| P7 | Katalogsuche (Rebrickable) | Sonnet | Medium | offen |
| P8 | Fotoerkennung (Brickognize) | Sonnet | Medium | offen |
| P9 | Erfassen per Link (Merlins Steine, Rebrickable, andere) | Sonnet | Medium | offen |
| P10 | Dioramen | Sonnet | Medium | offen |
| P11 | Marktwerte und Wertentwicklung (BrickLink) | Opus | High | offen |
| P12 | Wunschliste und Reihen | Sonnet | Medium | offen |
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
  3. BrickLink: price guide (sold, last 6 months) for one minifig, new and used, in EUR. Reports clearly if access is refused and why.
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
- Types: `Minifig`, `ModPart`, `LegoSet` (status `complete | figuresRemoved | disassembled`), `Diorama`, `StudioFile`, `SpecialPart`, `WishItem` (priority `high | medium | low`, `targetPrice`), `PricePoint` (new/used, date, source), `Manufacturer`, `Condition` (`new | used`); money as integer cents; `schemaVersion`.
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

**Scope:** S1 (collection card, chips, sort, filter button, grid with markers `×3`, `Mod`, `Kein Diorama`, grouped copies), S1a filter sheet, S2 minifig detail, S3 set detail (contained figures with owned/missing), S4 special part detail, loading placeholders, empty state, offline banner. PC layout with 5–6 columns.

**Done when:** F5 (grouping), F11 and the detail content of F5/F7/F9 work against fake and real data; E2E with axe on every page and the filter sheet; phone (390 × 844) and PC screenshots match the dummy closely.

### P6 – Manual capture, edit, delete, mods

**Goal:** Everything can be entered and changed by hand.

**Scope:** S7 capture sheet (what/how), S8 form for every object type (sections per type, prefilled fields highlighted), S8a mod part sheet, “Weiteres Exemplar anlegen”, edit, delete with confirmation and “Rückgängig” for a few seconds. Validation messages at the field, focus on first error.

**Done when:** F4, F6 (incl. “Ausgaben für Mods” and value unchanged), F7, F9 forms work end to end; E2E with axe for every form state.

### P7 – Catalog search (Rebrickable)

**Goal:** Official LEGO items fill themselves in.

**Scope:** Edge Function `catalog` (Rebrickable key as secret; search by number and name; minifig details incl. sets it appears in; set details incl. minifigs); caching in the database for 30 days; S7b search with live results; prefill S8; set → contained figures (F7).

**Done when:** F2 works for minifigs and sets; function tests with recorded responses; E2E against the fake; rate limit respected.

**PO steps:** `npx supabase secrets set REBRICKABLE_API_KEY=…` in his own terminal, `npx supabase functions deploy catalog`.

### P8 – Photo recognition (Brickognize)

**Goal:** Photo in, suggestions out.

**Scope:** Edge Function `recognize` (forwards the resized photo, returns top 5 with confidence, maps BrickLink ids to Rebrickable via P7), S7a with camera/file picker, suggestions, “Keiner passt”, error state; own photo is kept for the new item.

**Done when:** both F1 acceptance criteria are tests (with recorded responses); PO confirms with three real figures on the Redmi.

### P9 – Capture by link

**Goal:** Paste a link, get as much as possible filled in.

**Scope:** Edge Function `link-preview`: Rebrickable set links via API; Merlins Steine SetDB page parser (only the one pasted page, no crawling; parser covered by a stored sample page); any other page via Open Graph title/image. S7c with clipboard button and “bitte ergänzen” markers.

**Done when:** F3 incl. its acceptance criterion (unreadable page → form opens with link and empty fields); parser tests with the stored sample.

### P10 – Dioramas

**Goal:** Dioramas with photos, Studio files and assigned figures.

**Scope:** S5 list with “N Figuren ohne Diorama” banner, S6 detail, S6a assign sheet (multi-select, “steht in: …” with move confirmation), link figure ↔ diorama both ways.

**Done when:** all three F8 acceptance criteria are E2E tests and green.

### P11 – Market values and value history (BrickLink)

**Goal:** Up-to-date values without manual work.

**Scope:** Edge Function `prices` (BrickLink OAuth 1.0 keys as secrets; price guide sold/6 months, new and used, EUR; respects 5,000 calls/day), table `price_points`, weekly `pg_cron` job (Monday 03:00), failure handling (never overwrite, “Stand vom …”), value card with sparkline on S2/S3/S4, run status in S12 (last run, result, next run).

**Fallback if P2 said no-go:** no BrickLink function; value = purchase price or manual estimate everywhere; settings say “Marktwerte nicht verbunden”.

**Done when:** all F10 acceptance criteria are tests; one real weekly run has written prices (PO checks in S12).

**PO steps:** set BrickLink secrets, deploy function, enable the cron job (exact SQL in the report).

### P12 – Wishlist and series

**Goal:** Know what is missing and what to buy next.

**Scope:** S9 (target reached section on top, priority, sorting), S9a edit sheet incl. “Erhalten” → prefilled S8, S10 series search (Rebrickable themes) and “Meine Reihen”, S10a series detail with present/missing/wished.

**Done when:** F13 and both F14 acceptance criteria are tests; E2E with axe.

### P13 – Dashboard

**Goal:** All numbers in one place.

**Scope:** S11 with period switch, total value chart (SVG, `role="img"` with full text description), tiles, counts per type, themes, top 10, “ohne Diorama” link, price date footer.

**Done when:** F12 complete; chart description matches the data (unit test); E2E with axe.

### P14 – Settings and backup

**Goal:** Control and safety.

**Scope:** S12 (account, data source status, price run status, storage usage, export/import, version). F15 export incl. photos and Studio files as one file (zip; library `fflate` if needed, justify), import replaces after confirmation with automatic backup first.

**Done when:** export → import round trip restores everything byte-identical (test); E2E with axe.

### P15 – PWA, PC polish, device test, release 1.0

**Goal:** A finished app on phone and PC.

**Scope:** manifest, icons (studs motif, no LEGO trademarks), service worker (offline read of the collection), install hint, PC layout check of every screen, `check:full`, `docs/GERAETETEST.md` checklist run by the PO on the Redmi and PC, `docs/WARTUNG.md`.

**Done when:** installable on Android, offline showcase readable, device checklist ticked by the PO, version 1.0 tagged.

## 6. Risiken

| Risiko | Auswirkung | Gegenmaßnahme |
|---|---|---|
| BrickLink verlangt Verkäufer-Registrierung | keine automatischen Marktwerte | P2 klärt es zuerst; Rückfall in P11 |
| Brickognize ändert oder sperrt die Schnittstelle | Fotoerkennung fällt aus | Erfassen per Nummer bleibt immer möglich |
| Merlins Steine ändert den Seitenaufbau | Link-Vorschau füllt weniger aus | F3 öffnet trotzdem das Formular |
| 1 GB Dateispeicher wird knapp | Upload schlägt fehl | Fotos verkleinern (P4c), Anzeige der Belegung (P14) |
| Supabase pausiert das Projekt | App lädt nicht | `keepalive.yml`, wöchentlicher Preisabruf |

## 7. Entscheidungen des PO

- 31.10.2026: Repository öffentlich, Lizenz EUPL-1.2.
- 31.10.2026: Keine Serienerfassung in Version 1.
- 31.10.2026: Stil F „Steinkasten-Mix“, Klick-Dummy abgenommen.

## 8. Abhängigkeiten

| Paket | Art | Wofür / warum |
|---|---|---|
| `preact` | App | Oberfläche (Leitentscheidung, wie Krümel) |
| `@fontsource-variable/rubik`, `@fontsource/mali` | App | Schriften selbst gehostet, keine Anfrage an Google Fonts (DESIGN.md 3) |
| `vite`, `typescript` | Entwicklung | Build und Typprüfung (Leitentscheidung) |
| `@biomejs/biome` | Entwicklung | Formatierung und Linting in einem Werkzeug |
| `vitest`, `@vitest/coverage-v8` | Entwicklung | Unit-Tests mit Abdeckung |
| `@playwright/test`, `@axe-core/playwright` | Entwicklung | Abläufe im Browser, Barrierefreiheit |

Symbole sind eigene SVG-Pfade aus dem Klick-Dummy (keine Symbol-Bibliothek).
