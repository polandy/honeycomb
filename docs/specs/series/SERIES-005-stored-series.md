# SERIES-005 – Stored series: make, change, merge, series done

- Status: accepted
- Area: series
- Origin: owner decisions 2026-11-14 on #185 (D1a–D5a) and #183; ADR 0027; mockup
  `docs/mockup/series-edit/index.html`
- Depends on: SERIES-001, SERIES-002, GRID-002, GRID-003, DECISIONS-001, KEYS-001

## Purpose

The user corrects the automatic series: makes a series from photos, adds and removes photos,
merges series, dissolves one and marks one done. What they did stays, on every device and
through every new visual hash.

## Behaviour

- **Stored and automatic.** A *stored series* is one the user has made, changed, merged or
  marked done; its members are exactly what the user put there. Members of stored series and
  *kept out* pictures are taken out first; the automatic rule (SERIES-001) groups only the rest.
  The toolbar count, grid badge, loupe chip, filmstrip frame, series compare and series viewer
  show both alike, ordered by the first capture time.
- **A stored series** is never cut at 60 s, may hold several cameras, and is ordered by capture
  time, then name. Rejected members stay members and are hidden as in SERIES-001. With fewer than
  two shown pictures it is not shown. Its badge reads `⧉ 4` with a pin, `⧉ 4` with a check when
  done; the compare's subtitle adds "edited by hand", and "Also in other folders" when it has
  members outside the folder set.
- **Storage** per user and member file id (ADR 0027): `POST /apps/honeycomb/api/v1/series/lookup`
  reads, `PUT /apps/honeycomb/api/v1/series` writes. An automatic series is stored, with its shown
  members, the moment the user first edits it or marks it done.
- **Grid, selection mode:** the action bar's *Series…* button opens a menu that offers what fits
  the selection, with counts:

  | Selection | Offered |
  |---|---|
  | two or more photos, none in a series | *New series from n photos* |
  | photos of one series and loose photos | *Add n photos to series ⧉ k*, *New series from n photos* |
  | photos of two or more series | *Merge k series · m photos* (their whole series and the loose selected photos), *New series from n photos* |
  | any photo in a series | *Remove n photos from their series* |

  An entry that does not fit is shown disabled with the reason in its second line.
- **Series compare:** the title row's ⋯ menu offers *Merge with the next series*, *Merge with the
  previous series* (next and previous by first capture time among every series of the folder
  set), *Series done* (pressed when done; pressing it again reopens the series) and *Dissolve
  this series*. Each card's ⋯ menu offers *Remove from this series* and *View full screen*. The
  loupe gets nothing new; its series chip opens the compare.
- **Undo:** every edit is one undo step with one toast: "Made a series of 4 photos", "Added 3
  photos to the series", "Merged 2 series · 8 photos", "Removed IMG_0402 from the series",
  "Removed 2 photos from their series", "Dissolved the series · 4 photos", "Marked the series
  done", "Reopened the series", each followed by *Undo*. No confirmation dialog.
- **Series done:** the unflagged pictures of a done series count as decided — in the progress,
  *next undecided*, *Recent*'s decided count and the series compare, which no longer offers the
  series — but stay unflagged: the flag filter and the sidecars see no change.

## Acceptance criteria

### SERIES-005.1 – A stored series keeps its members

- **Given** a stored series of four pictures
- **When** a new visual hash arrives, a fifth picture that looks alike is listed, or the series
  spans more than 60 s or two cameras
- **Then** it still has exactly its four members; the fifth picture can form an automatic series
  with other loose pictures only

### SERIES-005.2 – The automatic rule groups only the rest

- **Given** pictures in stored series and kept-out pictures among loose ones
- **When** the series are formed
- **Then** the automatic series are formed from the loose pictures alone, and stored and automatic
  series are listed together by first capture time

### SERIES-005.3 – Rejected members are hidden, a lone member is no series

- **Given** a stored series of three pictures
- **When** two are rejected
- **Then** the series is not shown and its rows stay; unflagging one shows the series again

### SERIES-005.4 – New series from a selection

- **Given** selection mode with four loose photos selected
- **When** the user chooses *Series…* → *New series from 4 photos*
- **Then** the four form a stored series, the toast reads "Made a series of 4 photos · Undo", and
  undo makes them loose again

### SERIES-005.5 – A new series takes photos out of their series

- **Given** a selection of photos that belong to other series
- **When** the user chooses *New series from n photos*
- **Then** they leave their series and form the new one; a series left below two shown pictures
  is not shown

### SERIES-005.6 – Add photos to a series

- **Given** a selection of photos of one series ⧉ 5 and three loose photos
- **When** the user chooses *Add 3 photos to series ⧉ 5*
- **Then** the series has eight members and is stored; a done series is reopened

### SERIES-005.7 – Merge series from a selection

- **Given** a selection that touches two series and one loose photo
- **When** the user chooses *Merge 2 series · m photos*
- **Then** every shown member of both series and the loose photo form one stored series, with no
  dialog, and the toast reads "Merged 2 series · m photos · Undo"

### SERIES-005.8 – Merge with the next or previous series

- **Given** the series compare on a series that has a next series in the folder set
- **When** the user chooses *Merge with the next series* in the title row's ⋯ menu
- **Then** both become one stored series and the compare shows it; the entry is disabled with
  "None after this one" on the last series, and likewise for the previous series

### SERIES-005.9 – A merged series is done only when all were

- **Given** a done series and an open one
- **When** they are merged
- **Then** the merged series is open; two done series merge into a done one

### SERIES-005.10 – Remove a photo keeps it out

- **Given** the series compare on a series of four
- **When** the user chooses *Remove from this series* in a card's ⋯ menu
- **Then** the photo leaves the series, keeps its flags, is kept out of every automatic series
  from then on, and the toast reads "Removed IMG_0402 from the series · Undo"

### SERIES-005.11 – Remove photos from the grid

- **Given** a selection with two photos in series
- **When** the user chooses *Remove 2 photos from their series*
- **Then** both are kept out; a series that keeps two or more shown pictures is stored with them

### SERIES-005.12 – A kept-out photo can join a series by hand

- **Given** a kept-out photo
- **When** the user adds it to a series or makes a new series with it
- **Then** it is a member of that series

### SERIES-005.13 – Dissolve a series

- **Given** the series compare on a series of four
- **When** the user chooses *Dissolve this series*
- **Then** its four photos are kept out, the compare moves on as after *Skip*, and undo brings the
  series back with the same members

### SERIES-005.14 – Series done counts the series as decided

- **Given** a series with two unflagged pictures and one picked
- **When** the user chooses *Series done*
- **Then** the toast reads "Marked the series done · Undo", the progress and *Recent* count all
  three as decided, *next undecided* skips them, the compare no longer offers the series, and the
  two keep their unflagged flag and sidecars

### SERIES-005.15 – Reopen a done series

- **Given** a done series opened from the loupe's series chip
- **When** the user presses the pressed *Series done* entry
- **Then** the series is open again and the toast reads "Reopened the series · Undo"

### SERIES-005.16 – Adding reopens, removing does not

- **Given** a done series
- **When** a photo is added to it, or one is removed from it
- **Then** adding reopens it; removing leaves it done

### SERIES-005.17 – The badge and the subtitle

- **Given** a stored open series, a done series and an automatic series
- **When** the grid and the compare show them
- **Then** the badges read `⧉ n` with a pin, with a check and plain; the compare's subtitle of a
  stored series adds "edited by hand"

### SERIES-005.18 – Members in other folders

- **Given** a stored series with members in two folders, and only one folder open
- **When** the compare shows the series
- **Then** it shows the listed members, the subtitle adds "Also in other folders", and editing or
  *Pick this, reject the rest* changes only the listed members

### SERIES-005.19 – A failed save puts the series back

- **Given** an edit whose save fails
- **When** the user makes it
- **Then** the series show as before the edit, except the files a later save stored, and the error
  is logged; saves go one at a time, as decisions do (DECISIONS-001.14, .15)

### SERIES-005.20 – Lookup

- **Given** stored series and kept-out files of the user
- **When** `POST /apps/honeycomb/api/v1/series/lookup` is sent with file ids
- **Then** it answers each series with a member among them (id, status, those members,
  `elsewhere`) and the kept-out ids among them; another user's rows are never answered

### SERIES-005.21 – Write

- **Given** a valid `PUT /apps/honeycomb/api/v1/series`
- **When** it is sent
- **Then** in one transaction the listed files move into their series, statuses are set,
  `keptOut` and `released` files are written, the answer lists each series' id in request order
  and the saved file ids; members not listed stay in their series

### SERIES-005.22 – Write: new and vanished series ids

- **Given** a series item with `id: null`, or with an id the user does not have
- **When** it is written
- **Then** a new series is made and its id answered

### SERIES-005.23 – Write: invalid bodies

- **Given** a body that is not as ADR 0027 describes, more than 60,000 file ids or 1,000 series
  items, a file id or a series id twice, or a status other than `open` or `done`
- **When** it is sent
- **Then** the answer is `400` and nothing is written; without a user it is `401`

### SERIES-005.24 – Write: foreign files are skipped

- **Given** a write that names a file id the user cannot reach as a photo
- **When** it is written
- **Then** that file is skipped and missing from `saved`; the rest is written

### SERIES-005.25 – Lifecycle

- **Given** stored rows
- **When** a member is deleted for good, moved in honeycomb, put in the trash bin, or the user is
  deleted
- **Then** the daily job removes its row and afterwards every series without a row; a move carries
  the row to the new file id; a file in the trash bin keeps it; a deleted user's rows of both
  tables go

### SERIES-005.26 – A failed read stores nothing

- **Given** a series lookup that fails
- **When** the cull opens
- **Then** the error is logged, every series is automatic, and decisions and tags still load

## Out of scope

- A hint that a new photo looks like a stored series (D2; can come later).
- Keys for the series edits; the menus are reached by touch, mouse and keyboard focus.
- Writing series or *Series done* to sidecars.

## History

| Date | Change |
|---|---|
| 2026-11-14 | Accepted with ADR 0027 (#185 PR 0). |
| 2026-11-14 | Backend of SERIES-005.20–25 (#185 PR 1); a series id twice is a `400`. |
| 2026-11-14 | Delivery and logic of SERIES-005.1–3, .26 (#185 PR 2): the browser reads the rows per folder set and forms automatic series from the loose pictures only. |
