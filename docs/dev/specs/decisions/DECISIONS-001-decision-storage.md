# DECISIONS-001 – Decision storage

- Status: implemented
- Area: decisions
- Origin: `docs/dev/plan.md` M2.4, Keep RAW and Remove RAWs; Q2, Q20; ADR 0005, ADR 0012
- Depends on: LISTING-001, LISTING-002

## Purpose

Rating, colour label, flag and *Keep RAW* are kept per picture and user on the server, so a cull
continues on any device and each user of a shared folder keeps their own.

## Behaviour

- `POST /apps/honeycomb/api/v1/decisions/lookup` with `{"fileIds": [...]}` answers
  `{"decisions": [...]}` with the stored rows only; `PUT /apps/honeycomb/api/v1/decisions` with
  `{"decisions": [...]}` stores whole states, at most 60,000 each, in one transaction.
- A decision is `fileId`, `rating` 0–5, `colourLabel` (one of nine or `null`), `flag` (`picked`,
  `rejected`, `unflagged`) and `keepRaw`, one row per member file id. A row back at the default is
  removed.
- `400` for a malformed body; one malformed item writes nothing. `401` without a user.
- A save writes only the file ids the user reaches as a photo; any other id is skipped, its row
  neither written nor removed (ADR 0031), looked up 1,000 ids at a time (ADR 0038). Saves are rate limited per user (APP-001.9).
- Since ADR 0032 the rows are legacy rows (XMP-007): the client reads them for every member after
  the listing, and a picture shows them, locked, until the ⋯ entry writes them to its sidecars
  (XMP-003.2, XMP-008.11); a failed lookup is logged and the pictures show their sidecars. The
  client saves no decision any more; the sidecars and the XMP cache hold them (XMP-006).
- A daily background job removes the rows of files deleted for good, of every user. A file in the
  trash bin is not deleted for good: restored, it keeps its decision (DELETE-001.8). For each of
  the decision, tag and visual hash tables it reads 1,000 rows at a time in row id order, asks the
  file cache which of their file ids still exist, without a join, and stops after 100 chunks. The
  row id it stopped at is kept in the app config, so the next run goes on from there; at the end of
  a table the next run starts again from the beginning.
- Deleting a user removes their rows.

## Acceptance criteria

### DECISIONS-001.1 – Lookup answers the stored rows

- **Given** stored decisions
- **When** the user looks up file ids
- **Then** the answer holds the rows of those ids only; an id without a row is undecided

### DECISIONS-001.2 – Whole states, overwritten

- **Given** a stored decision
- **When** the user saves a new state for the same file id
- **Then** it replaces the whole earlier state

### DECISIONS-001.3 – The default removes the row

- **Given** a stored decision
- **When** the user saves the default (unrated, no label, unflagged, no *Keep RAW*)
- **Then** the row is gone and the file reads as undecided

### DECISIONS-001.4 – Each user apart

- **Given** two users deciding the same file
- **When** each looks up
- **Then** each reads only their own decision

### DECISIONS-001.5 – A malformed save writes nothing

- **Given** a save with one malformed item, a file id twice or more than 60,000 items
- **When** it arrives
- **Then** the answer is `400` and no row changes

### DECISIONS-001.6 – A malformed lookup

- **Given** a lookup that is not a list of positive integer ids or has more than 60,000
- **When** it arrives
- **Then** the answer is `400`

### DECISIONS-001.7 – Without a user

- **Given** no logged-in user
- **When** a lookup or save arrives
- **Then** the answer is `401` and nothing is read or written

### DECISIONS-001.8 – A picture's decision

- **Given** the rows of a picture's members
- **When** the client merges them
- **Then** the picture is undecided without a row and takes the members' state otherwise

### DECISIONS-001.9 – A failed lookup

- **Given** an open cull
- **When** the lookup fails or answers no decisions list
- **Then** the error is logged and every picture counts as undecided; the answer of a folder set
  no longer open is ignored

### DECISIONS-001.10 – Nothing to ask

- **Given** no file ids or no decisions
- **When** the client would look up or save
- **Then** it sends no request

### DECISIONS-001.11 – A file deleted for good

- **Given** decisions of a file in the trash bin and of a file still in place
- **When** the file is deleted from the trash bin and the clean-up job runs
- **Then** its rows are gone for every user; the other file keeps its decision, and the job run
  again removes nothing more

### DECISIONS-001.12 – A deleted user

- **Given** a user with stored decisions
- **When** the user is deleted
- **Then** their rows are gone, and a new user of the same name reads no decision

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

### DECISIONS-001.19 – A file the user does not reach

- **Given** a save naming a file id that is not in the user's files, or not a photo
- **When** it is stored
- **Then** the user's photos in it are stored, nothing is written for that id, and a save of no
  such photo writes nothing

### DECISIONS-001.20 – A save looks its file ids up in batches

- **Given** a save of 2,000 decisions
- **When** it is stored
- **Then** its file ids are looked up 1,000 at a time in the user's files, shares included, not
  one by one, and the same ids are reached as by a lookup of each (ADR 0038)

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
