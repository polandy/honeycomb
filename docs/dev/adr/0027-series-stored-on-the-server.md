# 0027 – Series stored on the server

- Status: accepted
- Date: 2026-11-14
- Extends: [0024](0024-visual-hashes-stored-on-the-server.md)

## Context

A series is computed in the browser on every listing (ADR 0024, SERIES-001): pictures of one
camera in capture-time order, linked by capture time and visual hash, at most 60 s from first to
last. It has no identity: it changes as hashes arrive, when a picture is rejected and between
folder sets. The owner wants series made by hand from a selection, photos added to and removed
from a series, series merged, and a series marked done (issues #183, #185). All of that must
survive the next listing, another device and a new visual hash, so it has to be stored.

The owner decided on 2026-11-14 (#185, #183), each the recommended option:

- **D1 – a photo removed by hand** is *kept out*: never put into an automatic series again; by
  hand it can still join one. Rejected: kept out of that series only, so the same photos could
  come back as a series of their own.
- **D2 – a new photo that looks like a stored series** is not added; the user adds it by hand. A
  hint "1 photo looks like this series" can come later without a model change.
- **D3 – when a series is stored:** on first touch. Automatic series stay computed in the
  browser; a series is written when the user makes, changes, merges or marks it done. Rejected:
  writing every automatic series once its hashes are complete (needs a "complete" test, rewrites
  on every hash, races between devices), and computing series on the server (pairing and the
  link rule twice, against ADR 0006).
- **D4 – where editing lives:** a *Series…* menu in the grid's selection mode and menus in the
  series compare (title row and each card). Rejected: the compare only (loose photos could not
  become a series) and dragging tiles (poor on touch).
- **D5 – a merge** has no confirmation dialog; its toast offers *Undo*, like every decision.
- **#183 – Series done** is a status of the stored series. The unflagged pictures of a done
  series count as decided but keep their flag; nothing is written to sidecars.

How the browser gets the stored series (#187, architecture review R11):

- **Fields of each listing entry** (`seriesId`, `keptOut`), as visual hashes come (ADR 0024).
- **A lookup endpoint,** as decisions (ADR 0012) and tags (ADR 0022). Chosen: a series is the
  user's decision like a flag or a tag, written whole and undone like them, and the listing stays
  a list of files and their metadata.

## Decision

- **Words:** a *stored series* is one the user has acted on; its members are exactly its rows
  and nothing automatic changes them. An *automatic series* is computed as before from the
  pictures that are neither in a stored series nor *kept out*. Both are shown alike.
- **Tables** (names fit the 27/30-character limits of older Nextcloud versions; no foreign keys,
  no boolean columns):

  ```text
  honeycomb_series          id (bigint, autoincrement, PK), user_id (string 64),
                            status (string 16, 'open' | 'done', default 'open')
                            index honeycomb_series_user (user_id)
  honeycomb_series_files    id (bigint, autoincrement, PK), user_id (string 64),
                            file_id (bigint), series_id (bigint, null = kept out)
                            unique honeycomb_sfiles_user_file (user_id, file_id)
                            index  honeycomb_sfiles_user_series (user_id, series_id)
  ```

  One row per **member file id**, as decisions: a file is in at most one series. The browser
  reads a picture's member rows together and always writes every member.
- **Rules for the browser:** members of stored series and kept-out pictures are taken out before
  the automatic rule runs; the rule groups only the rest. A stored series is never cut at 60 s,
  may hold several cameras and is ordered by capture time, then name. A new photo or hash never
  joins a stored series (D2). Rejected members stay members and are hidden as today. A series of
  fewer than two shown pictures is not shown; its row stays.
- **Read:** `POST /apps/honeycomb/api/v1/series/lookup` with `{"fileIds": [...]}`, at most 60,000,
  answers `{"series": [{"id": 12, "status": "open", "fileIds": [...], "elsewhere": false}],
  "keptOut": [...]}`: each stored series with a member among the ids, with those members only,
  and `elsewhere` true when it has members outside them (another folder set); `keptOut` lists the
  requested ids that are kept out. One lookup per folder set after the listing, beside decisions
  and tags.
- **Write:** `PUT /apps/honeycomb/api/v1/series` with `{"series": [{"id": 12, "status": "done",
  "fileIds": [...]}, {"id": null, "status": "open", "fileIds": [...]}], "keptOut": [...],
  "released": [...]}` in one transaction, answering `{"ids": [12, 31], "saved": [...]}`: the id
  of each series item in request order and the file ids written. A series item sets the status
  and moves the listed files into the series; members not listed stay, so members in other
  folder sets are never lost. `id: null`, or an id the user no longer has, makes a new series.
  `keptOut` turns files into kept-out rows; `released` deletes their rows (back to automatic).
  Undo sends the earlier state of the same files and series back. At most 60,000 file ids and
  1,000 series items; a malformed body, a file id twice or a status other than `open` or `done`
  is `400` with nothing written. Unlike decisions, every file id is looked up, as for visual
  hashes: one that is not the user's photo is skipped and missing from `saved`.
- **Lifecycle:** `honeycomb_series_files` is a `FileRowStore`: the daily job removes rows of files
  deleted for good, a move in honeycomb carries rows to the new file id, and files in the trash
  bin keep their rows. After the file rows, the job removes series rows without a file row, paged
  by row id. Both tables go with a deleted user. A series left with one picture is not removed.
- **Series done:** the status is per series and user. A photo added to a done series reopens it;
  a removed one leaves it done; a merge is done only when every merged series was.
- **UI:** as the mockup `docs/dev/mockup/series-edit/index.html` and SERIES-005 describe it.

## Consequences

- One more lookup per folder set; nothing changes until a series is stored, and an untouched
  folder set stores no rows.
- Changing the automatic rule's constants later never touches a stored series.
- A photo kept out by mistake never regroups on its own; it is added back by hand.
- A merge or dissolve acts on the members the browser lists; members in another folder set stay
  in their series, and the compare says "Also in other folders".
- A move in the Files app across storages or a copy gives a new file id, which joins no stored
  series, as decisions are lost there today.
- Two devices editing the same series: the last write wins per file.
