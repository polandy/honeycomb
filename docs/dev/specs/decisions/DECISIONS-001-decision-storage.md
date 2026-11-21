# DECISIONS-001 – Flag storage

- Status: implemented
- Area: decisions
- Origin: `docs/dev/plan.md` M2.4, Keep RAW and Remove RAWs; Q2, Q20; ADR 0005, ADR 0012,
  ADR 0040
- Depends on: LISTING-001, LISTING-002

## Purpose

The flag and *Keep RAW* are kept per picture on the server, in `honeycomb_flags`, the same for
every user who reaches the photo, so a cull continues on any device and the users of a shared
folder see one state (ADR 0040). Rating, colour label and tags live in the sidecars (XMP-003).

## Behaviour

ADR 0040 replaced the per-user rows of `honeycomb_decisions` by `honeycomb_flags` (M8 PR 5): the
migration drops the old table and its endpoints, and the criteria withdrawn below are removed.

**Flags:**

- A row is `fileId`, `flag` (`picked`, `rejected`, `unflagged`), `keepRaw` and `updatedAt` from
  the injected clock, one row per member file id, without a user. A row is never removed because
  it is back at the default: an *unflagged* row says the photo was taken over (XMP-003.1).
- The listing carries each entry's `flag`, `keepRaw` and `flagUpdated`, `null` without a row
  (LISTING-001.18). There is no lookup of arbitrary file ids.
- `PUT /apps/honeycomb/api/v1/flags` with `{"flags": [{"fileId", "flag", "keepRaw"}]}`, at most
  60,000, stores whole states in one transaction and answers `{"saved": [...], "skipped":
  [{"fileId", "reason"}]}`: `notFound` for an id the user does not reach as a photo, `notPermitted`
  for a file whose folder lacks UPDATE or CREATE. Ids are resolved per folder, not per file
  (ADR 0038). The last save wins.
- `POST /apps/honeycomb/api/v1/flags/take-over` with the same body inserts a row only where the
  file id has none, needs READ only and never changes a row; it answers the inserted ids under
  `saved` and an id that already has a row under `skipped` with `exists`. It reads the rows before
  its transaction, so on SQLite it waits for another save instead of failing (.34).
- A picture whose members' rows differ reads as the row with the latest `updatedAt` (Unix
  seconds); of rows saved in the same second the first member's wins, in the picture's member
  order.
- `400` for a malformed body; one malformed item writes nothing. `401` without a user. Both
  endpoints are rate limited per user (APP-001.9).
- A move that gives a file a new id carries its row over (MOVE-002). Deleting a picture through
  honeycomb removes the rows of the files it trashed or deleted (DELETE-001.15). Deleting a user
  leaves the rows.
- `occ honeycomb:cleanup` and *Clean up orphaned data* (SETTINGS-001.27) remove the rows whose
  file id no longer exists or lies in a trash bin, and report how many.

**Clean-up:**

- A daily background job removes the rows of files deleted for good. For each of the flag, visual
  hash, series and XMP cache tables it reads 1,000 rows at a time in row id order, asks the file
  cache which of their file ids still exist, without a join, and stops after 100 chunks. The row
  id it stopped at is kept in the app config, so the next run goes on from there; at the end of
  a table the next run starts again from the beginning.

## Acceptance criteria

### DECISIONS-001.1 – Lookup answers the stored rows (removed)

Withdrawn by ADR 0040; `honeycomb_decisions` and its endpoints are gone (M8 PR 5).

### DECISIONS-001.2 – Whole states, overwritten (removed)

Withdrawn by ADR 0040; `honeycomb_decisions` and its endpoints are gone (M8 PR 5).

### DECISIONS-001.3 – The default removes the row (removed)

Withdrawn by ADR 0040; `honeycomb_decisions` and its endpoints are gone (M8 PR 5).

### DECISIONS-001.4 – Each user apart (removed)

Withdrawn by ADR 0040; `honeycomb_decisions` and its endpoints are gone (M8 PR 5).

### DECISIONS-001.5 – A malformed save writes nothing (removed)

Withdrawn by ADR 0040; `honeycomb_decisions` and its endpoints are gone (M8 PR 5).

### DECISIONS-001.6 – A malformed lookup (removed)

Withdrawn by ADR 0040; `honeycomb_decisions` and its endpoints are gone (M8 PR 5).

### DECISIONS-001.7 – Without a user (removed)

Withdrawn by ADR 0040; `honeycomb_decisions` and its endpoints are gone (M8 PR 5).

### DECISIONS-001.8 – A picture's decision (removed)

Withdrawn by ADR 0040; `honeycomb_decisions` and its endpoints are gone (M8 PR 5).

### DECISIONS-001.9 – A failed lookup (removed)

Withdrawn by ADR 0040; `honeycomb_decisions` and its endpoints are gone (M8 PR 5).

### DECISIONS-001.10 – Nothing to ask (removed)

Withdrawn by ADR 0040; `honeycomb_decisions` and its endpoints are gone (M8 PR 5).

### DECISIONS-001.11 – A file deleted for good

- **Given** flags of a file in the trash bin and of a file still in place
- **When** the file is deleted from the trash bin and the clean-up job runs
- **Then** its row is gone; the other file keeps its flag, and the job run again removes nothing
  more

### DECISIONS-001.12 – A deleted user (removed)

Withdrawn by ADR 0040; `honeycomb_decisions` and its endpoints are gone (M8 PR 5).

### DECISIONS-001.13 – Saves of one file at once

- **Given** two saves of the same file that reach the server at the same time, so that one hits the
  unique key of a row the other just inserted
- **When** the second one fails with that unique-key conflict, or on MySQL with a deadlock or a
  lock wait timeout on the other's locks
- **Then** the save is repeated, at most three attempts in all, and stores its state (the last
  writer wins); any other database error, or one of these on every attempt, is not repeated
  further and nothing of that save is stored

### DECISIONS-001.14 – One save at a time per tab (removed)

The cull saves no decision any more (ADR 0032, XMP-006.7).

### DECISIONS-001.15 – A failed save puts back only what no later save stored (removed)

The cull saves no decision any more (ADR 0032, XMP-006.7).

### DECISIONS-001.16 – The clean-up goes through a table in chunks

- **Given** no rows, exactly 1,000 rows, 1,001 rows, or rows of files that are all deleted for good
- **When** the clean-up job runs
- **Then** it reads the rows 1,000 at a time after the last row id of the chunk before, removes
  the rows whose file is gone, and ends the pass at the first chunk shorter than 1,000

### DECISIONS-001.17 – A long table is cleaned over several runs

- **Given** more rows than one run reads
- **When** the clean-up job runs again
- **Then** it goes on after the last row id of the run before, and after the last row it starts
  again from the first

### DECISIONS-001.18 – A failed clean-up of one table

- **Given** a database error while one table is cleaned
- **When** the clean-up job runs
- **Then** the error is logged, the other tables are cleaned, and the next run goes on after the
  last chunk that was finished

### DECISIONS-001.19 – A file the user does not reach (removed)

Withdrawn by ADR 0040; `honeycomb_decisions` and its endpoints are gone (M8 PR 5).

### DECISIONS-001.20 – A save looks its file ids up in batches (removed)

Withdrawn by ADR 0040; `honeycomb_decisions` and its endpoints are gone (M8 PR 5).

### DECISIONS-001.21 – The listing carries the flags

- **Given** a folder with a photo that has a row and one that has none
- **When** the user lists it
- **Then** the first entry carries its `flag`, `keepRaw` and `flagUpdated`, the second `null` in
  all three

### DECISIONS-001.22 – One state for every user

- **Given** a folder shared between two users, and one of them sets a flag
- **When** the other lists the folder
- **Then** the other reads the same flag and *Keep RAW*; no row names a user

### DECISIONS-001.23 – A save stores whole states, the last one wins

- **Given** a stored row
- **When** the user saves a new state for the same file id, also *unflagged* without *Keep RAW*
- **Then** it replaces the whole earlier state, keeps the row, sets `updatedAt` from the clock and
  answers the id under `saved`

### DECISIONS-001.24 – A save skips what the user may not set

- **Given** a save naming a file the user does not reach as a photo and one whose folder lacks
  UPDATE or CREATE
- **When** it is stored
- **Then** the other ids are stored, those two are answered under `skipped` with `notFound` and
  `notPermitted`, and their rows are neither written nor removed

### DECISIONS-001.25 – A malformed save writes nothing

- **Given** a save or take-over with one malformed item, an unknown flag, a file id twice or more
  than 60,000 items
- **When** it arrives
- **Then** the answer is `400` and no row changes

### DECISIONS-001.26 – Without a user

- **Given** no logged-in user
- **When** a save or take-over arrives
- **Then** the answer is `401` and nothing is written

### DECISIONS-001.27 – Taking over inserts only

- **Given** a file with a row, one without, and a user who may only read their folder
- **When** the user takes over a state for both
- **Then** the file without a row gets it and is answered under `saved`; the row of the other is
  unchanged and its id is answered under `skipped` with `exists`

### DECISIONS-001.28 – Members that disagree

- **Given** a picture whose JPEG row says *picked* and whose RAW row, changed later, says
  *rejected*
- **When** the client reads the picture
- **Then** it is *rejected*; without any row it is not taken over yet

### DECISIONS-001.29 – A save resolves its ids per folder

- **Given** a save of 2,000 flags in three folders
- **When** it is stored
- **Then** the rights are read once per folder, not per file, and the same ids are stored as by a
  save of each alone (ADR 0038)

### DECISIONS-001.30 – Saves of one file at once

- **Given** two saves or take-overs of the same file at the same time
- **When** one hits the unique key or, on MySQL, a deadlock or lock wait timeout
- **Then** it is repeated as in .13; a take-over that loses the race leaves the other's row

### DECISIONS-001.31 – The clean-up job cleans the flags

- **Given** flag rows of a file deleted for good and of a file still in place
- **When** the clean-up job runs
- **Then** the first row is gone, the second stays, in chunks as in .16 to .18

### DECISIONS-001.32 – Cleaning up orphaned data

- **Given** flag rows of a file that no longer exists, of a file in a trash bin and of a file in
  place
- **When** an admin runs `occ honeycomb:cleanup`
- **Then** the first two rows are gone, the third stays, and the command prints how many it
  removed; run again it removes none

### DECISIONS-001.33 – A deleted user leaves the flags

- **Given** a user who set flags in a folder another user reaches
- **When** the user is deleted
- **Then** the rows stay and the other user still reads them

### DECISIONS-001.34 – A take-over beside another save

- **Given** a take-over while another save commits, such as a cull opening while another tab saves
  its flags on SQLite
- **When** it is stored
- **Then** it waits for that save instead of failing: the first statement of its transaction is a
  write, and an id another save inserted meanwhile is repeated as in .30

### DECISIONS-001.35 – Cleaning up all data

- **Given** rows in every honeycomb table and in the users' honeycomb preferences
- **When** an admin runs `occ honeycomb:cleanup --all --dry-run`
- **Then** it prints the row count of each and deletes nothing

- **Given** the same rows
- **When** an admin runs `occ honeycomb:cleanup --all`
- **Then** every table and the preferences are empty and the command prints how many rows went from
  each; the tables, the `oc_migrations` rows and the app's state stay

- **Then** every deletion is rolled back, the command names the failure, exits non-zero and prints
  no success line
- **When** an admin runs `occ honeycomb:cleanup --all`
- **Then** the command names the failure, exits non-zero and prints no success line

- **Given** `--dry-run` without `--all`
- **When** an admin runs `occ honeycomb:cleanup --dry-run`
- **Then** the command refuses, exits non-zero and removes nothing

## Out of scope

Bulk changes (GRID-003), decisions in the loupe (LOUPE-002), undo (KEYS-001), XMP sidecars (M5).

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged M2.4 (#42) |
| 2026-11-10 | Rows of files deleted for good and of deleted users are removed (DECISIONS-001.11, .12) |
| 2026-11-11 | A save that loses a race on the unique key is repeated (DECISIONS-001.13) |
| 2026-11-14 | A tab sends one save at a time, the newest state per file (DECISIONS-001.14, .15) |
| 2026-11-14 | A deadlock or lock wait timeout is repeated like a unique-key conflict (DECISIONS-001.13) |
| 2026-11-14 | The clean-up job pages by row id without joining the file cache (DECISIONS-001.16–.18) |
| 2026-11-15 | A save skips file ids that are not the user's photos (DECISIONS-001.19, ADR 0031, risk review R10) |
| 2026-11-18 | The cull reads the rows as legacy rows and saves none (.14, .15 removed, ADR 0032, XMP-006.7) |
| 2026-11-18 | A save looks its file ids up 1,000 at a time (DECISIONS-001.20, ADR 0038) |
| 2026-11-19 | ADR 0040: flags per picture in `honeycomb_flags`, the old rows withdrawn (.21–.33 gaps until M8 PR 5) |
| 2026-11-19 | M8 PR 4: the rows lock nothing and nothing migrates them; M8 PR 5 drops them |
| 2026-11-19 | M8 PR 5: `honeycomb_flags` built (.21–.33), `honeycomb_decisions` dropped (.1–.10, .12, .19, .20 removed) |
| 2026-11-19 | M8 PR 6: a take-over reads before its transaction, so SQLite does not fail it (.34) |
| 2026-11-20 | `occ honeycomb:cleanup --all [--dry-run]` empties all honeycomb data (.35, E16/B17) |
