# SERIES-006 – Quality values

- Status: implemented
- Area: series
- Origin: owner decisions 2026-11-20 (culling aids, milestone M11); ADR 0046
- Depends on: LISTING-001, SERIES-001, SERIES-003, SERIES-005

## Purpose

The browser measures how sharp each photo of a series is, once per file version for every user,
so the series compare can mark the sharpest one (SERIES-007). A value is a measurement, never a decision:
it flags, moves, deletes and writes nothing.

## Behaviour

- **Sharpness** (`src/logic/sharpness.ts`, method 1): the grey value of each pixel
  (0.299 R + 0.587 G + 0.114 B), the 3×3 Laplacian of every pixel off the photo's edge, its
  variance in each tile of an 8×8 grid over the photo as shown. The value is the mean of the best
  10 % of the tiles, rounded up to 7 of 64, and the focus tile is the index of the best tile,
  0–63, row by row. A tile without a measured pixel counts 0. A photo narrower or lower than
  3 pixels cannot be measured. The photo may arrive in bands of rows, top to bottom; the value
  does not depend on the bands.
- **The sharpest** of a series: the member whose value is at least 5 % above the second best;
  none when two are closer, when a member has no value or for fewer than two members.
- Each listing entry (LISTING-001) has `quality`, `{"method": 1, "sharpness": 812.4,
  "focusTile": 27}`, the stored value of the file when it was taken from the file's current etag,
  else `null`. A value is stored per file, not per user: every user who reaches the file gets it.
- `PUT /apps/honeycomb/api/v1/quality-values` with `{"values": [{"fileId": 9, "etag": "…",
  "method": 1, "sharpness": 812.4, "focusTile": 27}, ...]}`, at most 1,000 items, stores each
  item's value and answers `{"saved": [...]}` with the file ids stored, in request order. A stored
  value of the same file is replaced, whoever saved it.
- An item is skipped, and missing from `saved`, when the user cannot reach its file id as a photo
  (unknown, another user's file, a folder, a sidecar) or its etag is not the file's current one.
- `400`, nothing written, for a body that is not a list of at most 1,000 items, an item without a
  positive integer `fileId`, with an `etag` that is not a string of 1 to 40 characters, a
  `method` that is not an integer from 1 to 255, a `sharpness` that is not a number of at least 0,
  a `focusTile` that is not an integer from 0 to 63, or a file id given twice. `401` without a
  user. A user may save at most 300 times a minute, as the visual hashes (SERIES-003.23).
- The cull measures the shown member of every picture of a series (SERIES-001, SERIES-005),
  decided or not, whose member has no `quality` of method 1; a picture outside a series is not
  measured. It starts once no visual hash is pending, measures one photo at a time in tile order
  in a worker of the hash pool (SERIES-003.26), from the loupe tier (4096 px) of that member,
  drawn in bands of rows so that only one band's pixels are held. A value of another method
  counts as missing. A file version whose measure failed is not measured again in this visit.
- The cull saves the computed values every 100 values and when none is left to measure. A
  limited save (`429`) waits as the hash save does (SERIES-003.27) and is sent again; a failed
  save is logged, and the values still count for this visit.
- A quality value is never written to a sidecar and never sent to Immich (ADR 0046).
- The daily clean-up removes the values of files deleted for good; a honeycomb move carries a
  value to the new file id; deleting a user leaves the values of files that still exist.
- *Clear cache* of one user and `occ honeycomb:cache:clear <user>` leave the values, which are
  every user's; `occ honeycomb:cache:clear` without a user removes them all (XMP-006.6).
- `scripts/sharpness-calibration.sh <folder>` measures every JPEG of each subfolder of a local
  folder, one series per subfolder, with the same module, and prints each series' values, ranks
  and sharpest, and each photo it could not measure (`docs/dev/calibration.md`). It only reads the folder.

## Acceptance criteria

### SERIES-006.1 – A sharp photo measures higher than its blurred copy

- **Given** a checkerboard and the same checkerboard blurred
- **When** both are measured
- **Then** the checkerboard's sharpness is higher, and a flat grey photo's is 0

### SERIES-006.2 – The focus region counts, not the whole photo

- **Given** a flat photo with detail in one tile only, and one with detail in seven tiles
- **When** they are measured
- **Then** the first one's focus tile is the index of its detailed tile and its value is a
  seventh of that tile's variance; the second one's value is the mean of the seven tiles

### SERIES-006.3 – Bands give the same value

- **Given** a photo measured in one band, and in bands of different heights
- **When** the values are compared
- **Then** sharpness and focus tile are the same; bands out of order, or more rows than the photo
  has, are refused

### SERIES-006.4 – A photo too small

- **Given** a photo narrower or lower than 3 pixels
- **When** it is to be measured
- **Then** the measure is refused

### SERIES-006.5 – The sharpest of a series

- **Given** the values of a series' members
- **When** the sharpest is asked
- **Then** it is the best member when it is at least 5 % above the second; none when closer, when
  a member has no value, or for fewer than two members

### SERIES-006.6 – The listing carries the current value

- **Given** a stored quality value of a file taken from its current etag, and one of a file whose
  etag has changed since
- **When** the user lists their folder
- **Then** the first entry has the value as `quality`, the second and an entry without a value
  have `null`

### SERIES-006.7 – A save stores and replaces

- **Given** photos the user can reach, with or without a stored value
- **When** the user saves a value for each with the file's current etag
- **Then** the answer lists their file ids, in request order, and each stored value is the new one

### SERIES-006.8 – A file the user cannot reach, or a stale etag, is skipped

- **Given** a save whose items name an unknown file id, another user's file, a sidecar, or a file
  whose etag is not the item's
- **When** it arrives
- **Then** those items are not stored and missing from `saved`; the other items are stored

### SERIES-006.9 – A malformed save writes nothing

- **Given** a save with one malformed item (file id, etag, method, sharpness or focus tile out of
  its range or of the wrong type, a file id given twice), a body that is not a list, or more than
  1,000 items
- **When** it arrives
- **Then** the answer is `400` and no value is stored

### SERIES-006.10 – Without a user

- **Given** no logged-in user
- **When** a save arrives
- **Then** the answer is `401` and nothing is written

### SERIES-006.11 – Saves are limited per user

- **Given** a user who saves quality values
- **When** they save more than 300 times within a minute
- **Then** Nextcloud answers the further saves `429` and writes nothing

### SERIES-006.12 – Every user gets the value

- **Given** two users who reach one file, one of whom saved its value
- **When** the other lists it
- **Then** the other's entry carries that value

### SERIES-006.13 – Saves of one file at once

- **Given** two saves of the same file at once, so one hits the unique key of a row the other just
  wrote
- **When** the second one fails with that conflict
- **Then** it is repeated, at most three attempts in all (the last writer wins)

### SERIES-006.14 – A file deleted for good, a moved file, a deleted user

- **Given** stored values of a file deleted for good, a file a honeycomb move gives a new id, and
  a file of a user who is deleted
- **When** the daily clean-up runs, the move is done and the user is deleted
- **Then** the first value is gone, the second is stored under the new file id with its etag, and
  the third stays while its file exists

### SERIES-006.15 – Only series members without a value are measured

- **Given** an open cull with a series of two whose members have no value, a series whose member
  has a value of method 1, one with a value of another method, and a single picture
- **When** the values are measured
- **Then** the members without a value of method 1 are measured, one at a time in tile order, and
  the single picture is not

### SERIES-006.16 – Measuring waits for the hashes

- **Given** an open cull with a visual hash still pending
- **When** the series are shown
- **Then** nothing is measured until no hash is pending

### SERIES-006.17 – A failed measure is not repeated

- **Given** a member whose measure failed
- **When** the shown pictures change
- **Then** the same file version is not measured again in this visit; a new version is

### SERIES-006.18 – Values are saved in batches

- **Given** computed values
- **When** 100 are computed, and when none is left to measure
- **Then** they are saved; a limited save waits and is sent again, a failed one is logged and the
  values still count for this visit

### SERIES-006.19 – The worker measures the loupe tier in bands

- **Given** a member to measure
- **When** a worker measures it
- **Then** it loads the member's loupe tier URL, draws the decoded photo in bands of rows at full
  size, and answers its sharpness and focus tile; a failed load or decode fails the measure

### SERIES-006.20 – Clearing a cache keeps the values

- **Given** stored quality values
- **When** a user clears their cache, and when `occ honeycomb:cache:clear` runs without a user
- **Then** the first keeps the values; the second removes them all

### SERIES-006.21 – The calibration report

- **Given** the measured photos of a series, one of which could not be measured
- **When** the calibration script reports the series
- **Then** it ranks the measured photos by sharpness with their focus tile, names the sharpest or
  none as the series compare would, and lists the photo not measured with its reason

### SERIES-006.22 – Quality measures are registered

- **Given** the registry of quality measures (`src/quality-measures.ts`), whose first entry
  is the sharpness
- **When** the cull, the worker or the info panel's label needs a measure
- **Then** it finds it by `id` in the registry, which gives each entry its `id`, stored `method`,
  `measure` (the function a worker runs on a photo's URL), `label` and display `slot`; the
  sharpness is `sharpness`, method 1, shown in the `loupe-info` slot; a worker job names a measure
  by its `id`, and an unknown `id` fails the job; behaviour is otherwise unchanged

## Out of scope

- The *Sharpest* mark, the rank in the info panel and the zoom onto the focus tile: SERIES-007.
- Measuring on the similarity page (SERIES-004): it lists photos without a hash and knows no
  series yet (`TODO.md`).
- Shake risk and clipping hints: milestone M11, PR 5.

## History

| Date | Change |
|---|---|
| 2026-11-20 | Written with the sharpness measure, its table and endpoint (owner decisions, ADR 0046) |
| 2026-11-20 | Out of scope: the mark, the rank and the zoom moved to SERIES-007 (M11 PR 3) |
| 2026-11-24 | Quality measures registered by id, method, measure, label and slot (SERIES-006.22) |
