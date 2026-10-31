# Stud Stephan – Datenquellen

Stand: 31.10.2026 · Ergebnis von Paket P2. Grundlage: Lauf von `npm run try:sources` durch den PO am 31.10.2026 mit echten Schlüsseln (Rebrickable, BrickLink), einem Probefoto und einer Seite der SetDB.

## Übersicht und Entscheidung

| Dienst | Zweck | Zugang | Befund | Entscheidung |
|---|---|---|---|---|
| Rebrickable | Katalog: Sets, Figuren, Teilezahl, Bilder | API-Schlüssel (kostenlos) | Set und Figuren vollständig; **keine BrickLink-Nummern** | **go** |
| Brickognize | Fotoerkennung von Figuren | keiner | liefert BrickLink-Nummer und Trefferquote | **go** |
| BrickLink | Marktwerte neu/gebraucht | OAuth 1.0a, vier Werte | Preisguide antwortet **ohne** Verkäufer-Verifizierung | **go** |
| Merlins Steine SetDB | Sets anderer Hersteller | keiner, Seite wird gelesen | alle fünf Felder auslesbar | **go** (mit Vorbehalt Seitenaufbau) |

Browser-Zugriff (CORS): erlaubt bei Rebrickable und Brickognize, **nicht** erlaubt bei BrickLink und Merlins Steine. Bleibt bei der Leitentscheidung: alle Dienste nur über Edge Functions.

## Rebrickable

- Adresse: `https://rebrickable.com/api/v3/lego/`; Zugang: Header `Authorization: key <Schlüssel>`.
- Grenze: etwa eine Anfrage pro Sekunde; das Skript wartet 1,1 s und wiederholt bei HTTP 429 (kam im Lauf nicht vor).
- Set `75372-1` (`GET /sets/75372-1/`): Name „Clone Trooper & Battle Droid Battle Pack“, Jahr 2024, 215 Teile, Bild. Feldzuordnung: `set_num` → Nummer, `name` → Name, `year` → Jahr, `num_parts` → Teilezahl, `set_img_url` → Bild.
- Figuren im Set (`GET /sets/75372-1/minifigs/`): 5 Einträge mit `set_num` (`fig-014663` …), `set_name`, `quantity`, Bild.
- **Rebrickable-Figurennummern (`fig-…`) sind nicht die BrickLink-Nummern (`sw0194`).** Die Suche `?search=sw0194` liefert 0 Treffer, und die Detailseiten der 5 Figuren enthalten kein `external_ids.BrickLink`. Folge für P7 und P11: die BrickLink-Nummer kommt **nicht** aus Rebrickable. Sie kommt aus Brickognize (Foto), von Hand oder aus der SetDB; Rebrickable liefert Name, Teile und Bild.
- CORS: erlaubt (`*`).

## Brickognize

- Adresse: `POST https://api.brickognize.com/predict/figs/`, Foto als Formularfeld `query_image`, kein Schlüssel.
- Antwort: `items[]` mit `id` (BrickLink-Nummer, hier `coltlbm28`), `name`, `img_url`, `score` (0–1), `external_sites` (`bricklink`).
- Lauf mit einem Foto von 2,2 MB: **ein** Vorschlag mit 78 %, nicht drei. P8 darf also nicht von drei Vorschlägen ausgehen und muss mit weniger umgehen. Wie gut der Treffer zum Foto passte, ist nicht bewertet; mehrere Fotos wurden nicht getestet.
- Das Foto wurde unverkleinert angenommen. P8 verkleinert es trotzdem vor dem Hochladen (Datenmenge, Speicher).
- CORS: erlaubt (`*`).

## BrickLink

- Adresse: `GET https://api.bricklink.com/api/store/v1/items/MINIFIG/<nummer>/price?guide_type=sold&new_or_used=N|U&currency_code=EUR`.
- Zugang: OAuth 1.0a (HMAC-SHA1), die Signatur funktioniert (Skript gegen ein bekanntes Beispiel getestet, im Lauf von BrickLink angenommen).
- Stand des Kontos: Verkäufer, Store API registriert, Verkäufer-Verifizierung (Versandart, Artikel, Ausweis) **nicht** gemacht. **Der Preisguide antwortet trotzdem.**
- Ergebnis für `sw0194`, EUR, verkauft in den letzten 6 Monaten: neu Ø 99,87 € (29,92 € bis 131,23 €, 14 Stück); gebraucht Ø 67,39 € (16,04 € bis 111,03 €, 97 Stück). Preise kommen als Text (`"99.8700"`) und werden in ganze Cent umgerechnet.
- Grenze laut BrickLink: 5.000 Abfragen pro Tag (nicht ausgereizt). Die Antwort enthält Währung und Stückzahl; bei wenigen Verkäufen ist der Durchschnitt unsicher, P11 zeigt die Stückzahl mit an.
- Ablehnungen meldet BrickLink auch im Feld `meta.code` bei HTTP 200; die Auswertung beachtet das.
- CORS: nicht erlaubt, also nur über Edge Function (der Server-Zugriff mit IP-Maske `0.0.0.0` ist so vorgesehen).
- **Entscheidung: go.** P11 bleibt wie geplant (automatische Marktwerte); der Rückfall „Wert von Hand“ bleibt trotzdem als Wert „selbst geschätzt“ erhalten. Sollte BrickLink die Verifizierung später doch verlangen, greift genau dieser Rückfall.

## Merlins Steine SetDB

- Keine Schnittstelle. Eine Seite eines Sets (`https://www.merlinssteine.de/sets/<hersteller>-<nummer>/`) ist 81 KB groß und wird mit einfachem Abruf geladen.
- Der Seitenaufbau enthält strukturierte Daten (JSON-LD, Objekt `Product` innerhalb eines `@graph`). Daraus und aus den Texten liest die App:
  - Name: `Product.name` ohne den Anhang „ | Set <Nummer>“,
  - Hersteller: `Product.brand.name` (sonst Zeile „Von: …“),
  - Setnummer: `Product.sku`,
  - Teilezahl: aus der Beschreibung („… 929 Teile“), kein eigenes Feld,
  - Bild: `og:image`.
- Weitere Angaben auf der Seite (jetzt nicht genutzt): EAN, „Steine von“ (z. B. Xingbao), Release, Kategorien, Variation, „Erweitert von“.
- Im ersten Lauf fehlten Hersteller, Setnummer und Teilezahl, weil das Auslesen den `@graph` nicht kannte. Nach der Anpassung liefert die gespeicherte Seite alle fünf Felder (geprüft mit der Datei des Laufs, nicht mit einem zweiten Abruf).
- Vorbehalt: Die Teilezahl steht nur im Beschreibungstext; ändert die Seite den Text, fehlt sie. Das Formular öffnet dann trotzdem (F3).
- Nur eine Seite getestet (BlueBrixx). Andere Hersteller zeigen laut Aufbau dieselbe Vorlage, bestätigt ist das nicht.
- CORS: nicht erlaubt (HTTP 405 auf die Vorabfrage), also nur über Edge Function.
