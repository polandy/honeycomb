# DECISIONS-001 – Decision storage

- Status: implemented
- Area: decisions
- Origin: `docs/plan.md` M2.4, Keep RAW and Remove RAWs; Q2, Q20; ADR 0005, ADR 0012
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
- The client reads the decisions of every member after the listing and merges them into the
  picture's decision; a failed lookup is logged and every picture counts as undecided.
- A daily background job removes the rows of files deleted for good, of every user. A file in the
  trash bin is not deleted for good: restored, it keeps its decision (DELETE-001.8).
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
- **When** the second one fails with that unique-key conflict
- **Then** the save is repeated, at most three attempts in all, and stores its state (the last
  writer wins); any other database error, or a conflict on every attempt, is not repeated and
  nothing of that save is stored

## Out of scope

Bulk changes (GRID-003), decisions in the loupe (LOUPE-002), undo (KEYS-001), XMP sidecars (M5).

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged M2.4 (#42) |
| 2026-11-10 | Rows of files deleted for good and of deleted users are removed (DECISIONS-001.11, .12) |
| 2026-11-11 | A save that loses a race on the unique key is repeated (DECISIONS-001.13) |
