# Stud Stephan – Datenquellen

Stand: 31.10.2026 · Ergebnis von Paket P2. **Status: Gerüst fertig, echte Ergebnisse stehen noch aus.**

Die Spalte „Erwartung“ beruht auf der öffentlichen Dokumentation der Dienste und ist **nicht geprüft**. Die Spalte „Befund“ füllt Claude Code, sobald der PO `npm run try:sources` ausgeführt und die Zusammenfassung in den Chat gestellt hat. Bis dahin ist kein Dienst „go“ oder „no-go“.

## Übersicht

| Dienst | Zweck | Zugang | Erwartung | Befund | Entscheidung |
|---|---|---|---|---|---|
| Rebrickable | Katalog: Sets, Figuren, Teilezahl, Bilder | API-Schlüssel (kostenlos) | geht | offen | offen |
| Brickognize | Fotoerkennung von Figuren | keiner | geht | offen | offen |
| BrickLink | Marktwerte neu/gebraucht | OAuth 1.0a, vier Werte | unklar ohne Verkäufer-Prüfung | offen | offen |
| Merlins Steine SetDB | Sets anderer Hersteller | keiner, Seite wird gelesen | Seitenaufbau unbekannt | offen | offen |

## Rebrickable

- Adresse: `https://rebrickable.com/api/v3/lego/`; Zugang: Header `Authorization: key <Schlüssel>`.
- Aufrufe im Test: `GET /minifigs/?search=sw0194`, `GET /sets/75372-1/`, `GET /sets/75372-1/minifigs/`, `GET /minifigs/<fig-nummer>/`.
- Grenze (Erwartung): etwa eine Anfrage pro Sekunde; das Skript wartet 1,1 s zwischen Anfragen und wiederholt bei HTTP 429.
- Offene Kernfrage: Rebrickable nummeriert Figuren selbst (`fig-004567`), BrickLink anders (`sw0194`). Das Skript prüft, ob das Feld `external_ids.BrickLink` geliefert wird. Davon hängt ab, ob P7 (Katalog) und P11 (Preise) dieselbe Figur ohne Handarbeit finden.
- Feldzuordnung (Erwartung): `set_num` → Nummer, `name` → Name, `num_parts` → Teilezahl, `set_img_url` → Bild, `year` → Jahr.
- Browser-Zugriff (CORS): wird geprüft; ohnehin nur über Edge Function.
- Befund: _offen_

## Brickognize

- Adresse: `POST https://api.brickognize.com/predict/figs/`, Foto als Formularfeld `query_image`, kein Schlüssel.
- Antwort (Erwartung): `items[]` mit `id` (BrickLink-Nummer, z. B. `sw0001`), `name`, `img_url`, `score` (0–1), `external_sites`.
- Das Skript gibt die drei besten Treffer mit Trefferquote aus.
- Befund: _offen_ (braucht `scripts/samples/minifig.jpg`)

## BrickLink

- Adresse: `GET https://api.bricklink.com/api/store/v1/items/MINIFIG/<nummer>/price?guide_type=sold&new_or_used=N|U&currency_code=EUR`.
- Zugang: OAuth 1.0a (HMAC-SHA1) mit Consumer Key/Secret und Token Value/Secret; die Signatur ist gegen ein bekanntes Beispiel getestet.
- Grenze (Erwartung): 5.000 Abfragen pro Tag.
- Besonderheit: BrickLink meldet Ablehnungen auch im Feld `meta.code` bei HTTP 200. Das Skript unterscheidet „abgelehnt“ (401/403, mit Begründung) von „Fehler“.
- Stand des Kontos: Verkäufer, Store API registriert, Verkäufer-Prüfung bewusst nicht gemacht. Der Lauf zeigt, ob der Preisguide so antwortet.
- Entscheidung: _offen_. Bei „no-go“ gilt der Rückfall aus P11: Wert von Hand.
- Befund: _offen_

## Merlins Steine SetDB

- Keine Schnittstelle. Das Skript lädt genau eine vom PO angegebene Seite und liest Name, Hersteller, Setnummer, Teilezahl und Bild (strukturierte Daten, `og:`-Angaben, Tabellen-/„Beschriftung: Wert“-Zeilen).
- Die geladene Seite liegt danach in `test-results/sources/merlin-page.html` (nur lokal), damit Claude Code das Auslesen an den echten Aufbau anpassen kann.
- Befund: _offen_
