<!--
SPDX-FileCopyrightText: 2026 honeycomb contributors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Datenbank-Auswirkungen von honeycomb (Analyse)

Status: Analyse, gelesen auf `origin/main` @ `b1e75a1` (2026-11-14). Auf ausdrücklichen Wunsch
des Owners auf Deutsch verfasst (Ausnahme zu Regel 8 in `CLAUDE.md`). Schätzungen sind als
solche markiert; gemessen wurde nichts.

## Frage

> What is honeycomb's impact on the Nextcloud database? Cover: its own tables (schema,
> migrations, indexes, expected row counts per photo/series and growth for a library of ~100k
> photos), the queries it runs against core tables (oc_filecache, oc_systemtag\*, metadata,
> etc.) and their cost (full scans, missing indexes, N+1), writes per culling action (flags,
> picks/rejects, undo), background jobs and what they write, locking/transactions, what is left
> behind on uninstall, and the needsDbUpgrade/occ upgrade on deploys. Give concrete numbers or
> estimates where possible, risks ranked, and recommendations.

## Antwort

honeycombs **eigene** Tabellen sind klein: bei 100k Bildern (RAW+JPEG) und vollständig
bewertetem Bestand rund 200k Zeilen bzw. grob **30–50 MB** inkl. Index, mit sauberen
`(user_id, file_id)`-Indizes. Die spürbare Last entsteht **in den Core-Tabellen**: die
Unterordner-Auflistung paginiert per `OFFSET` über `oc_filecache` (quadratisch), jede
Entscheidung schreibt zusätzlich XMP-Sidecars (Filecache, ETag-Propagation, Locks, Versionen,
Activity), und mehrere Endpunkte lösen Datei-IDs einzeln auf (N+1). Keine dieser Stellen ist
akut gefährlich; die OFFSET-Paginierung ist die erste, die bei großen Bibliotheken zählt.

## 1. Eigene Tabellen

### Schema und Indizes

| Tabelle | Spalten | Indizes | Quelle |
|---|---|---|---|
| `honeycomb_decisions` | `id`, `user_id`(64), `file_id`, `rating`, `colour_label`(16), `flag`(16), `keep_raw` | PK, **unique** `(user_id, file_id)` | `lib/Migration/Version000000Date20261110120000.php:31-40` |
| `honeycomb_positions` | `id`, `user_id`, `folder_set_key`(64), `folder_set` TEXT, `file_id`, `decided`, `total`, `updated_at` | PK, **unique** `(user_id, folder_set_key)`, `(user_id, updated_at)` | `…Version000000…:43-54` |
| `honeycomb_file_tags` | `id`, `user_id`, `file_id`, `tags` TEXT (JSON) | PK, **unique** `(user_id, file_id)` | `lib/Migration/Version000001Date20261113120000.php:28-34` |
| `honeycomb_tag_list` | `id`, `user_id`, `tag` | PK, `(user_id)` — **nicht** unique | `…Version000001…:37-42` |

Alle Lese- und Schreibzugriffe der App filtern auf `user_id` plus `file_id IN (…)` bzw.
`folder_set_key`, also immer über einen passenden Index (`lib/Db/FileRowQueries.php:62-93`,
`lib/Db/PositionMapper.php`). Keine Fremdschlüssel auf `oc_filecache` — Absicht, weil
Nextcloud selbst keine FKs nutzt; Waisen räumt der Hintergrundjob (§4).

Nicht von honeycomb genutzt: `oc_systemtag*`, `oc_vcategory*`, Kommentare. Entscheidungen und
Tags liegen bewusst in eigenen Tabellen (`docs/adr/0012-decision-storage.md`,
`docs/adr/0022-tag-storage.md`). Einstellungen und View-State liegen in `oc_preferences`
(`lib/Service/SettingsService.php:46`, max. 8 KB; `lib/Service/ViewStateService.php:54`,
zwei Booleans).

### Zeilen pro Foto und Serie

- **Entscheidung:** eine Zeile **pro Mitglied** eines Bildes, also 2 Zeilen pro RAW+JPEG-Paar,
  1 bei Einzeldatei (`src/logic/pairing.ts:68`, `docs/adr/0012-decision-storage.md:17`). Eine
  Entscheidung gleich dem Default (unbewertet, kein Label, `unflagged`) wird **nicht**
  gespeichert (`lib/Service/DecisionService.php:48`). Sidecars bekommen keine Zeile.
- **Tags:** eine Zeile pro getaggtem Mitglied, Tags als JSON; ohne Tags keine Zeile
  (`lib/Service/TagService.php:48`).
- **Serie:** hat keine eigene Zeile; Serien werden im Client berechnet (ADR 0021). „Pick this,
  reject the rest“ auf eine Serie von N Bildern erzeugt 2N Entscheidungszeilen.
- **Position:** max. 20 pro Benutzer (`PositionService::RECENT_LIMIT`,
  `lib/Service/PositionService.php:43-46`), unabhängig von der Bibliotheksgröße.
- **Tag-Liste:** eine Zeile pro je verwendetem Tag-Text und Benutzer; wächst nur, wird nie
  bereinigt (ADR 0022, D6).

### Wachstum bei ~100k Fotos (Schätzung)

Annahme: 100k Bilder als RAW+JPEG-Paare, ein Benutzer.

| Tabelle | Zeilen (Worst Case) | Größe inkl. Index (InnoDB, geschätzt ~150–250 B/Zeile) |
|---|---|---|
| `honeycomb_decisions` | 200k (jedes Bild hat eine Nicht-Default-Entscheidung) | ~30–50 MB |
| `honeycomb_file_tags` | 200k (jedes Bild getaggt) | ~40–70 MB (JSON-Text) |
| `honeycomb_positions` | ≤ 20 | vernachlässigbar |
| `honeycomb_tag_list` | einige Hundert bis Tausend | vernachlässigbar |
| `oc_preferences` | 3 Schlüssel | vernachlässigbar |

Realistischer ist ein Bruchteil: beim Aussortieren bleiben viele Bilder `unflagged` und
unbewertet und erzeugen dann keine Zeile. Zum Vergleich: dieselbe Bibliothek belegt in
`oc_filecache` bereits 200k–300k Zeilen (mit XMP) plus Metadaten- und Vorschau-Zeilen; honeycombs
eigene Tabellen bleiben deutlich darunter. Wachstum ist linear in entschiedenen Dateien und pro
Benutzer getrennt (geteilte Ordner: jeder Benutzer hat seine eigenen Zeilen zur selben
`file_id`).

## 2. Abfragen gegen Core-Tabellen

Alle Dateizugriffe laufen über `OCP\Files` (Regel 1); die SQL-Last entsteht daher indirekt im
Core.

### 2.1 Auflistung mit Unterordnern — OFFSET-Paginierung (wichtigster Punkt)

`ListingService::searchBelow` (`lib/Service/ListingService.php:109-121`) ruft `Folder::search`
mit `mimetype LIKE 'image/%' OR name LIKE '%.xmp' OR name LIKE '%.cr3' OR name LIKE '%.srw'`,
sortiert nach `fileid`, Seiten zu 5000 (`PAGE_SIZE`, Z. 26) per **`OFFSET`**, bis zu 60 000
Einträgen (`ENTRY_LIMIT`, Z. 25).

- `name LIKE '%…'` hat ein führendes Wildcard → kein Index nutzbar; der Core grenzt über
  `storage` + Pfadpräfix ein und filtert den gesamten Teilbaum. Die `mimetype`-Bedingung setzt
  der Core auf `mimepart` um, aber das `OR` mit `name` verhindert einen reinen Indexzugriff.
- Jede Seite muss alle Treffer des Teilbaums filtern und nach `fileid` sortieren, um dann
  `OFFSET k·5000` zu überspringen. Für 60k Einträge sind das 12 Seiten; gelesen werden
  zusammen etwa 5000·(1+…+12) ≈ **390k Ergebniszeilen** statt 60k, bei einem Teilbaum von
  200k Dateien grob **12 × 200k ≈ 2,4 Mio. Zeilenbesuche** pro Öffnen (Schätzung). Auf SSD
  einige Sekunden, auf langsamer HDD/kleinem Buffer-Pool spürbar mehr.
- Nebenbefund: `LIKE '%.xmp'` ist auf PostgreSQL case-sensitiv, MySQL mit `_ci`-Kollation
  nicht. Eine Datei `IMG_1.XMP` würde auf PostgreSQL nicht gefunden, obwohl
  `ListingService::isSidecar` (Z. 104-106) per `strtolower` vergleicht. Nicht verifiziert,
  aber als Test wert.

Ohne Unterordner nutzt die Auflistung `getDirectoryListing()` (ein indizierter Zugriff über
`parent`) — unkritisch.

### 2.2 Metadaten

`EntryFactory::create` (`lib/Service/EntryFactory.php:37`) holt `oc_files_metadata` per
`getMetadataForFiles` gebündelt zu 1000 IDs (`METADATA_BATCH`). 60k Einträge = 60 IN-Abfragen
über den Primärschlüssel — unkritisch, kein N+1.

### 2.3 Freigabe-Prüfung pro Ordner

`ListingService::folderOf` (Z. 77-80) prüft **pro distinktem Ordner** einmal (`??=` in Z. 67)
`SharedFolders::isShared` → `IShareManager::getAccessList(…, recursive: true)`
(`lib/Service/SharedFolders.php:34`), für externe Speicher zusätzlich `oc_mounts`
(Z. 43). Das sind einige Abfragen je Ordner und Share-Provider. Bei 2000 Ordnern im Teilbaum
grob 5k–10k kleine, indizierte Abfragen pro Auflistung (Schätzung) — ein echtes N+1 über
Ordner, aber auf Ordner- statt Dateiebene.

### 2.4 Einzelauflösung von Datei-IDs (N+1)

`getFirstNodeById` pro Datei-ID in `SidecarReader` (Z. 38), `EmbeddedXmpReader` (Z. 41),
`SidecarWriter` (Z. 72), `TrashService` (Z. 93), `MoveService` (Z. 178) und `ImageService`
(Z. 42). Jede Auflösung kostet 1–3 Primärschlüssel-Abfragen (`oc_filecache`, Mount-Cache ist
pro Request im Speicher). Die Sidecar-Lookups laufen in Batches zu 1000 (`src/api.ts:19`): ein
Batch = ~1000–3000 Abfragen. Beim **ersten Öffnen** eines Ordners mit XMP-Sidecars werden alle
Sidecars noch unentschiedener Bilder gelesen (`src/sidecar-sync.ts:33-42`) — bei 50k Bildern
50 Requests, ~50k–150k PK-Abfragen (Schätzung). Danach nur noch geänderte Bilder.

Das Bild-Endpoint (`/images/{fileId}`) macht dasselbe pro Kachel plus die Vorschau-Suche des
Cores; durch `immutable`-Caching (ADR 0010) einmal pro Datei und Stufe.

### 2.5 Vorschauen (größter indirekter Speicherverbrauch)

Drei Stufen 256/1024/4096 (`lib/Service/ImageService.php:21`) plus das Core-Maximum → bis zu
4 Vorschau-Einträge pro Datei in Nextclouds Vorschau-Speicher (je nach Version Filecache-Zeilen
im `appdata`-Ordner bzw. eine eigene Vorschau-Tabelle). Bei 100k Bildern und vorgewärmten
Stufen grob **200k–400k zusätzliche Zeilen** — mehr als alle honeycomb-Tabellen zusammen.
Diese teilen sich Files/Photos, soweit gleiche Größen angefragt werden.

## 3. Schreibvorgänge pro Aktion

| Aktion | honeycomb-Tabellen | Core (indirekt) |
|---|---|---|
| Pick/Reject/Rating/Label auf ein Paar | 1 Transaktion: `DELETE … IN (2)` + 0–2 `INSERT` (`lib/Db/DecisionMapper.php:33-36`) | XMP-Write-Through außerhalb geteilter Ordner (`src/cull.ts:176-198`): Sidecar-Lookup, dann pro Sidecar `.part` anlegen + `move` (`lib/Service/SidecarWriter.php:48-54`) → Filecache INSERT/UPDATE/DELETE, ETag/mtime-Propagation über **jeden Elternordner**, Datei-Locks (bei DB-Locking Zeilen in `oc_file_locks`), ggf. `oc_files_versions` und `oc_activity` |
| Zurück auf Default (unflag) | nur `DELETE` | dito |
| Undo | wie die Aktion, mit den Vorher-Zeilen (`src/cull.ts:156-163`) | dito |
| Pick this, reject the rest (N Bilder) | 1 Transaktion: `DELETE IN (2N)` + 2N einzelne `INSERT` | N Sidecars |
| Massenaktion über 60k Dateien | 1 Transaktion: 60 `DELETE`-Chunks + bis 60k `INSERT` | bis 30k Sidecar-Writes |
| Tag-Änderung | 1 Transaktion: `DELETE` + `INSERT` je Datei + `SELECT` Tag-Liste + `INSERT` je neuem Tag (`lib/Db/TagMapper.php:35-75`) | Sidecar-Write wie oben |
| Navigation in der Lupe | Position: `DELETE` + `INSERT` (Transaktion), `SELECT` aller ≤21 Positionen, ggf. `DELETE` (`lib/Service/PositionService.php:42-46`); Client serialisiert, max. eine in Flug (`src/resume.ts:44-57`) | — |
| Verschieben | bei neuer `file_id` 2 `UPDATE` (`lib/Db/FileRowQueries.php:24-32`) | Core-Move |
| Löschen | — (Zeile bleibt, solange die Datei im Papierkorb ist) | Core-Papierkorb (`oc_files_trash`, Filecache) |

Kernaussage: Eine Entscheidung kostet honeycomb selbst **3–4 Statements**; der XMP-Write-Through
kostet im Core grob **15–40 Statements** pro Bild (Schätzung, abhängig von Ordnertiefe,
Locking-Backend, Versions- und Activity-App). Ohne Redis-Locking ist `oc_file_locks` der
Haupttreiber. Inserts erfolgen einzeln über `QBMapper::insert`, nicht als Bulk-Insert.

## 4. Hintergrundjob

`RemoveVanishedDecisions` (`lib/BackgroundJob/RemoveVanishedDecisions.php:29-37`), täglich,
zeitunkritisch. Für `honeycomb_decisions` und `honeycomb_file_tags`:

```sql
SELECT DISTINCT r.file_id FROM oc_honeycomb_decisions r
LEFT JOIN oc_filecache f ON r.file_id = f.fileid
WHERE f.fileid IS NULL LIMIT 1000
```

(`lib/Db/FileRowQueries.php:35-56`), danach `DELETE … WHERE file_id IN (…)`, Schleife bis
weniger als 1000 Treffer.

- Es gibt **keinen Index mit `file_id` vorn** (der Unique-Index beginnt mit `user_id`); die
  Abfrage ist ein Full Scan der eigenen Tabelle plus ein PK-Lookup in `oc_filecache` je Zeile.
  Bei 200k Zeilen: 200k PK-Lookups, Sekunden, einmal täglich — unkritisch.
- Jede Schleifenrunde scannt erneut von vorn: nach einer großen Löschung (z. B. 50k Dateien
  endgültig gelöscht → 50 Runden) entsprechend 50 Scans. Auch das bleibt im Minutenbereich.
- Schreibt nur `DELETE`s und eine Log-Zeile. `honeycomb_positions` und `honeycomb_tag_list`
  bereinigt er nicht (Positionen sind auf 20 begrenzt, Tag-Liste per Design).
- Benutzer-Löschung räumt alle vier Tabellen (`lib/Listener/ForgetDeletedUser.php`).

## 5. Sperren und Transaktionen

- Jede Speicherung ist `DELETE`+`INSERT` in einer Transaktion (`QBMapper::atomic`). Bei
  `UNIQUE`-Verletzung durch parallele Speicherungen (zwei Tabs) wiederholt `RetryOnConflict`
  bis zu dreimal (`lib/Service/RetryOnConflict.php:31`).
- **Deadlocks werden nicht wiederholt.** Unter MySQL/InnoDB `REPEATABLE READ` nimmt ein
  `DELETE` auf nicht existierende Schlüssel Gap-Locks; zwei parallele Transaktionen, die in
  dieselbe Lücke einfügen, können sich gegenseitig blockieren. Die Folge wäre ein 500 statt
  eines Retries; der Client setzt die Anzeige zurück. Selten, aber möglich.
- Eine Massenaktion über 60k Dateien hält eine Transaktion mit bis zu 60k Inserts offen; sie
  sperrt nur die Zeilen und Lücken dieses Benutzers, kann aber Sekunden dauern und blockiert
  parallele Speicherungen desselben Benutzers so lange.
- `honeycomb_tag_list` hat keinen Unique-Index (MySQL-Kollation, ADR 0022:14-21); parallele
  Speicherungen können denselben Tag doppelt einfügen. `tagList` dedupliziert in PHP — harmlos,
  nur zusätzliche Zeilen.
- Datei-Sperren (Sidecar-Write, Move, Trash) laufen über das Core-Locking; mit
  DB-Locking-Provider erzeugt jede Sperre Schreibzugriffe auf `oc_file_locks`.

## 6. Was bei Deinstallation zurückbleibt

honeycomb hat **keine Uninstall-Repair-Steps** (`appinfo/info.xml` deklariert keine).

- `app:disable`: alles bleibt — vier Tabellen mit Daten, `oc_migrations`-Einträge (app
  `honeycomb`), `oc_appconfig`-Schlüssel, `oc_preferences` (`settings`, `infoPanelOpen`,
  `gestureGuideSeen`), der Job in `oc_jobs` (wird vom Core übersprungen bzw. entfernt, sobald
  die Klasse nicht mehr ladbar ist).
- `app:remove`: entfernt den Code; ob Tabellen und Einstellungen mit entfernt werden, hängt
  von der Nextcloud-Version und `--keep-data` ab. **Für NC 35 nicht verifiziert** — vor einer
  Aussage im Benutzerhandbuch im e2e-Container prüfen.
- Unabhängig davon bleiben bewusst: geschriebene XMP-Sidecars in den Benutzerdateien (ADR 0005)
  und die erzeugten Vorschauen im Core-Vorschau-Speicher (werden mit der Datei gelöscht oder
  per `occ preview:…`-Werkzeugen aufgeräumt).

## 7. needsDbUpgrade und `occ upgrade`

- Nextcloud führt App-Migrationen nur bei einer **Versionsänderung** in `appinfo/info.xml`
  aus. Die Version stand von #31 bis zum Release `v0.1.0` (2026-11-13) auf `0.1.0`; die
  zweite Migration (`Version000001…`, #119) kam während dieser Zeit hinzu. Eine Instanz, die
  honeycomb **vor #119** mit `0.1.0` installiert und danach nur den Code aktualisiert hat, hat
  `honeycomb_file_tags` und `honeycomb_tag_list` **nicht** → Tag-Endpunkte schlagen fehl.
  Abhilfe dort: `occ migrations:migrate honeycomb` oder App neu aktivieren. Frische
  Installationen von `v0.1.0` sind nicht betroffen.
- Jede künftige Release erhöht die Version (release-please, `release-please-config.json:14-15`)
  → Nextcloud meldet `needsDbUpgrade` für die **ganze Instanz**, bis `occ upgrade` (oder
  `occ app:update honeycomb` / App-Store-Update, das die Migration selbst ausführt) gelaufen
  ist. Bei manuellem Deployment (Tarball, Git) ist das Web-UI bis dahin gesperrt.
- Die Migrationen sind idempotent (`hasTable`-Prüfung) und billig (`CREATE TABLE`). Künftige
  `ALTER TABLE` auf `honeycomb_decisions` (200k Zeilen) wären auf MySQL ≥ 8 meist online und
  in Sekunden erledigt.

## Risiken (absteigend)

1. **OFFSET-Paginierung der Unterordner-Suche** (§2.1): quadratisch in der Seitenzahl,
   Full-Filter des Teilbaums je Seite. Trifft jedes Öffnen eines großen Ordnerbaums.
2. **XMP-Write-Through pro Entscheidung** (§3): 5–10× mehr Core-Schreiblast als honeycomb
   selbst; bei DB-Locking ohne Redis und tiefen Ordnern spürbar, v. a. bei Massenaktionen.
3. **Fehlende Migration auf früh installierten Instanzen** (§7): funktional, nicht
   performancebezogen, aber ein harter Fehler.
4. **N+1 bei Sidecar-Lookups** beim ersten Öffnen eines Ordners mit vielen Sidecars (§2.4).
5. **Deadlock ohne Retry** bei parallelen Speicherungen auf MySQL (§5).
6. **Lange Transaktion** bei Massenaktionen über 60k Dateien (§5).
7. **Vorschau-Speicher** (§2.5): Speicherplatz und Zeilen, aber im Core und erwartbar.
8. **Kleinkram:** Rescan-Schleife im Hintergrundjob, doppelte Tag-Listen-Zeilen, kein
   Index mit `file_id` vorn — alle unkritisch.

## Empfehlungen und Folgearbeiten

1. **Keyset- statt OFFSET-Paginierung** in `ListingService::searchBelow`: Folgeseiten mit
   `fileid > <letzte fileid>` (`ISearchComparison::COMPARE_GREATER_THAN` auf `fileid`) und
   `OFFSET 0`. Gleiche Ergebnisse, linearer Aufwand. Test: eine Seitengrenze in einem
   Fixture-Baum.
2. **Groß-/Kleinschreibung der Sidecar- und RAW-Suche auf PostgreSQL** prüfen (§2.1) und ggf.
   `COMPARE_ILIKE` verwenden; e2e läuft nur gegen eine Datenbank.
3. **Deadlock in `RetryOnConflict` mitbehandeln** (`DbException::REASON_DEADLOCK`, ggf.
   `REASON_LOCK_WAIT_TIMEOUT`).
4. **Bulk-Insert** in `DecisionMapper::replace`/`TagMapper::replace` (ein mehrzeiliges
   `INSERT` pro 1000er-Chunk statt Einzel-Inserts) — verkürzt Massen-Transaktionen deutlich.
5. **Deployment-Doku:** im Benutzer-/Admin-Handbuch (`docs/user/`) festhalten, dass jedes
   Release `occ upgrade` bzw. `occ app:update honeycomb` braucht, und für vor #119 installierte
   Instanzen `occ migrations:migrate honeycomb` nennen.
6. **Admin-Hinweis zu Redis-Locking:** honeycombs Sidecar-Writes profitieren stark davon;
   Nextcloud empfiehlt es ohnehin.
7. **Deinstallation verifizieren** (`app:remove` auf NC 35 im e2e-Container) und das Ergebnis
   dokumentieren; bei Bedarf einen Uninstall-Repair-Step, der die vier Tabellen und die
   Präferenzen entfernt (ADR nötig, da Datenlöschung).
8. Optional, nur wenn §2.4 messbar stört: Datei-IDs gebündelt auflösen (z. B. eine
   `oc_filecache`-Abfrage über `IRootFolder`/`ICacheFactory`-APIs, sofern öffentlich
   verfügbar) — Regel 1 beachten.
9. Optional: Index `(file_id)` auf `honeycomb_decisions` und `honeycomb_file_tags` für den
   Hintergrundjob — erst bei Bibliotheken deutlich über 1 Mio. Zeilen sinnvoll.

Messung als nächster Schritt (wie die Empfehlungen 1–7 in `TODO.md` erfasst): die
Schätzungen in §2.1 und §3 mit einem Fixture-Baum von ~100k Dateien im e2e-Container und
aktiviertem Query-Log (`'debug' => true` bzw. `log_query`) bestätigen.
