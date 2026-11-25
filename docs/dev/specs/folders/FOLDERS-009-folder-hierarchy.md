# FOLDERS-009 – Folder hierarchy, scope and the derived done

- Status: accepted
- Area: folders
- Origin: ADR 0060, owner decisions 2026-11-25; `docs/dev/mockup/folders/hierarchy.html`
- Depends on: FOLDERS-002, FOLDERS-003, FOLDERS-005, FOLDERS-006, FOLDERS-007, FOLDERS-008,
  SETTINGS-001, DECISIONS-002

## Purpose

The user walks the folders of the library level by level, chooses the level to cull on and whether
its subfolders belong to it, and sees how far a whole subtree is. Done stays a status of single
folders; a parent's state is derived.

## Behaviour

- **Level.** *Folders* shows one level at a time: a path below a library root, or the *Library*
  with the roots. With one root the view starts inside it. The breadcrumb names the levels; each
  one but the last goes back to it; it never goes above a root, but starts with *Library* when
  there are several roots.
- **The tree** is built from the rows of `GET /library/folders`. A folder without photos of its own
  is a level when a folder below it has photos; a folder with no photos in its subtree is not
  shown, and no text says it is missing.
- **Rows.** A row shows the folder as the list does (FOLDERS-007), and › when it has subfolders
  with photos; a tap on it opens that level. A chain of folders without photos of their own, each
  with exactly one subfolder with photos, is one row labelled with the names joined by ` / `; it
  ends at that last subfolder, with or without subfolders of its own.
- **Breadcrumb length.** More than 4 levels show the first, "…" and the last two; "…" shows the
  levels in between.
- **Include subfolders.** A switch in the header, on by default, saved per user as the setting
  `foldersIncludeSubfolders`. On: a row's photos, bars, state and *Cull* cover its whole subtree
  and *Cull* opens `{paths: [path], subfolders: true}`. Off: its own photos only and `subfolders:
  false`. A photo is counted once, as each pair lies in one folder. A row without subfolders with
  photos opens `subfolders: false` whatever the switch: the photos are the same, and its resume
  position and *Mark done* on *Cull finished* (FOLDERS-008.8) stay.
- **Level card.** Below the header, on every level but the *Library*: the level's name, its photos
  with subfolders and directly in it, its open photos and *Cull this level*, which opens the level
  as *Cull* does with the switch's scope.
- **Photos directly in ⟨folder⟩.** A level with photos of its own and subfolders also lists a
  separate row of that name, whatever the switch says. It shows the folder's own numbers and
  status, and its *Cull* opens `subfolders: false`.
- **Filters.** *All* lists the direct subfolders of the level. *Suggested* and *New photos* list
  every folder below the level flat, one row each with its own photos, ranked and sorted as
  FOLDERS-002, each labelled with its path below the level. At the *Library* level *Suggested* and
  *New photos* are the lists of FOLDERS-007 and *All* lists the roots. *Sort* shows for *Suggested*
  and *New photos*; *All* keeps the natural order of the names, the roots in their order.
- **Derived state of a row with subfolders.** Let the rateable folders with photos in the subtree
  be n, those of them done k. With n ≥ 1 and k = n the row reads *Done · all n folders*. With no
  undecided photo in the subtree and k < n it reads *Complete · n − k folders not marked done*
  and offers *Mark all done*. Otherwise it reads the open share and *k of n folders done*. Read-only
  folders are in no n and k; with n = 0 the row reads as a read-only folder does.
- **New photos.** The row's *n new* is the sum over the done folders in its scope; *Cull new*
  shows when it is above 0 and opens the row as *Cull* does, with the flag filter *Unflagged* only.
- **Previews.** A row with subfolders shows up to 3 pictures of its scope as its cover: the
  `previews` of its folders (FOLDERS-005.18) in subtree order, spread evenly over that list.
- **Mark all done.** In the ⋯ menu of every row with subfolders, with open photos too, and in
  the row of a complete subtree. It sends one `PUT /library/done` with every rateable folder
  with photos in the subtree that is not done, each with its photos. A toast says *Marked n
  folders done* with *Undo* for 8 s, and *· k read-only skipped* when folders were skipped; with
  nothing to mark the toast says so and sends nothing. *Undo* sends `DELETE /library/done` for
  the folders just marked.
- **Reopen all.** In the ⋯ menu, enabled when a rateable folder below is done. One `DELETE
  /library/done` for every done folder of the subtree, no question, a toast *Reopened n folders*
  with *Undo*.
- **Batch endpoints.** `PUT /apps/honeycomb/api/v1/library/done` with `{"folders": [{"fileId",
  "photos"}]}` answers `200` with `{"done": [rows of FOLDERS-006], "skipped": [{"fileId",
  "reason"}]}`; `reason` is `read-only` or `done`. `DELETE` with `{"fileIds": [...]}` answers
  `204`. At most 500 folders per call, more is `400` with reason `too-many`; a malformed body
  is `400`. A folder that is none of the user's own files is `404`, an unreadable one `403`, and
  then nothing is written. All rows are written in one transaction, under one access check and
  one rate limit (ADR 0031). The counter `folders_done` counts each folder written.
- **Back from a cull.** *Back to folders* shows the same level with the same switch, filter, sort
  and scroll.
- **Failure.** A failed batch leaves the rows as they were and shows the error toast *Could not
  mark the folders done.* or *Could not reopen the folders.*, never the server's text.
- **Large subtrees.** A level card whose subtree holds more than 20,000 photos, whatever the
  switch says, adds the line *A large subtree: loading it takes a while.*; *Cull* stays enabled.

## Acceptance criteria

### FOLDERS-009.1 – A level without photos of its own

- **Given** `2024/Iceland` has no photos and three folders below it with photos
- **When** the user opens `2024`
- **Then** `Iceland` is a row with ›, *No photos of its own · 3 subfolders* and no *Cull* when the
  switch is off, and the photos of the three folders when it is on

### FOLDERS-009.2 – Folders without photos are not shown

- **Given** `Documents/Receipts` holds no photo
- **When** the user opens the level that contains `Documents`
- **Then** no row, note or count mentions `Documents`

### FOLDERS-009.3 – Chains are one row

- **Given** `Archive/Analog/Scans 1998` with `Archive` and `Analog` without photos of their own
- **When** the user opens the level that contains `Archive`
- **Then** one row *Archive / Analog / Scans 1998* opens the level `Scans 1998`

### FOLDERS-009.4 – The breadcrumb shortens

- **Given** a level five deep
- **When** the breadcrumb shows
- **Then** it shows the first level, "…" and the last two; "…" lists the levels between and a
  level of the breadcrumb opens it; with one root the *Library* is not a crumb above it, with
  several roots it is the first crumb

### FOLDERS-009.5 – The switch is on by default and saved

- **Given** a user without the setting `foldersIncludeSubfolders`
- **When** *Folders* shows, the user switches *Include subfolders* off and reloads the app
- **Then** it was on the first time and is off after the reload

### FOLDERS-009.6 – The scope of Cull

- **Given** the level `2023` and the row `2023-07 Sardinia` with subfolders
- **When** the switch is on and the user presses *Cull*, then with the switch off
- **Then** the folder set is `{paths: [".../2023-07 Sardinia"], subfolders: true}`, then
  `subfolders: false`

### FOLDERS-009.7 – A pair is counted once

- **Given** a folder with 3 RAW+JPEG pairs and a subfolder with 2
- **When** the switch is on
- **Then** the row shows 5 photos

### FOLDERS-009.8 – Photos directly in

- **Given** `2024` with 37 photos of its own and subfolders
- **When** the user opens `2024`
- **Then** a grey row *Photos directly in 2024* shows 37 photos with the folder's own status, with
  the switch on and off, and its *Cull* opens `subfolders: false`

### FOLDERS-009.9 – The derived state

- **Given** a subtree of 5 rateable folders with photos, 2 done, undecided photos left, and one
  read-only folder
- **When** the row shows
- **Then** it reads *2 of 5 folders done* and the read-only folder is in neither number; after the
  other 3 are done it reads *Done · all 5 folders*

### FOLDERS-009.10 – Complete but not marked

- **Given** a subtree with no undecided photo and 1 of 3 rateable folders done
- **When** the row shows
- **Then** it reads *Complete · 2 folders not marked done* and offers *Mark all done* in its row

### FOLDERS-009.11 – Mark all done

- **Given** a subtree with 4 rateable folders not done, one read-only folder and open photos
- **When** the user presses *Mark all done* in the ⋯ menu
- **Then** one `PUT /library/done` carries the 4 folders with their photos, the toast says *Marked
  4 folders done · 1 read-only skipped* with *Undo*, and *Undo* sends one `DELETE` with the 4 ids

### FOLDERS-009.12 – Nothing to mark

- **Given** a subtree whose folders are all done
- **When** the user presses *Mark all done* in the menu
- **Then** no request is sent and a toast says there is nothing to mark

### FOLDERS-009.13 – Reopen all

- **Given** a subtree with 3 done folders
- **When** the user presses *Reopen all* in the ⋯ menu
- **Then** one `DELETE /library/done` carries the 3 ids without a question, the rows are open and
  the toast *Reopened 3 folders* offers *Undo*

### FOLDERS-009.14 – Filters inside the level

- **Given** the level `2024` and the filter *Suggested*
- **When** the list shows
- **Then** every folder with photos below `2024`, at any depth, is a row of its own photos, ranked
  as FOLDERS-002, labelled with its path below `2024`; *All* shows only the direct subfolders

### FOLDERS-009.15 – New photos of a subtree

- **Given** two done folders below a level with 12 and 5 *new*
- **When** the row shows and the user presses *Cull new*
- **Then** the row shows *17 new* and the subtree opens with `subfolders: true` and the flag filter
  *Unflagged* only; with the switch off the row shows its own folder's *new* and opens `subfolders:
  false`

### FOLDERS-009.16 – Back restores the level

- **Given** the level `2024/Iceland`, the switch off, the filter *Suggested*, scrolled
- **When** the user presses *Cull* and then *Back to folders*
- **Then** the same level, switch, filter, sort and scroll show

### FOLDERS-009.17 – The batch endpoint

- **Given** a body of 501 folders, a malformed body, an unknown file id, an unreadable folder
- **When** each is sent to `PUT /library/done`
- **Then** `400` with reason `too-many`, `400`, `404` and `403`, and no row is written; a valid
  body answers `200` with `done` and `skipped` with the reasons `read-only` and `done`

### FOLDERS-009.18 – A failed batch

- **Given** a server that refuses the batch
- **When** the user presses *Mark all done* or *Reopen all*
- **Then** the rows stay as they were and an error toast without the server's text shows
- **And** with more than 500 folders, the calls before the refused one stay written; the list
  shows them on its next load

### FOLDERS-009.19 – On a phone

- **Given** a phone and a tablet, light and dark
- **When** a level shows
- **Then** every control is at least 44 px, the breadcrumb wraps without a horizontal scroll and
  axe finds no serious fault

### FOLDERS-009.20 – Previews of a subtree

- **Given** a row with subfolders whose folders hold 0, 2 and 4 previews
- **When** the row shows
- **Then** its cover shows 3 of the 6 pictures: the first, the third and the last; with the
  switch off only the folder's own previews, and a subtree without previews shows the folder icon

### FOLDERS-009.21 – A large subtree

- **Given** a level whose subtree holds 20,001 photos, and one that holds 20,000
- **When** its level card shows
- **Then** the first says *A large subtree: loading it takes a while.* and the second does not;
  *Cull this level* is enabled on both

### FOLDERS-009.22 – The counts of the chips

- **Given** a level with subfolders, or the *Library*
- **When** the filter chips show
- **Then** *Suggested* and *New photos* count the rows their lists show, and *All* counts every
  folder with photos below the level, so it is never fewer than either; its list shows those
  folders as the rows of the level, a row with subfolders standing for several

## Out of scope

The folder summaries and the list's data: FOLDERS-005. The single-folder done endpoints:
FOLDERS-006. Shares and group
folders: phase 2.

## History

| Date | Change |
|---|---|
| 2026-11-25 | Written with ADR 0060 |
| 2026-11-25 | PR 3: the *Library* crumb with several roots, a row without subfolders culls without them, *Sort* only for the flat filters |
| 2026-11-25 | A chain ends at its last subfolder, also one without subfolders; a subtree of read-only folders only reads as a read-only folder (`folder-hierarchy.ts`) |
| 2026-11-25 | PR 5: previews of a subtree row, the large-subtree line, *Cull new* on a row with subfolders |
| 2026-11-25 | The *All* chip counts every folder below the level, as the other chips do (FOLDERS-009.22) |
