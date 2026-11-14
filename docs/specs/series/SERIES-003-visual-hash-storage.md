# SERIES-003 – Visual hash storage

- Status: implemented
- Area: series
- Origin: owner decision 2026-11-14 (fingerprints stored on the server); ADR 0024
- Depends on: LISTING-001, SERIES-001

## Purpose

A visual hash is computed once per file version and user, not once per device and browser: the
server keeps the hashes the browser computed and hands them out with the listing.

## Behaviour

- Each listing entry (LISTING-001) has `visualHash`: the user's stored hash of that file when it
  was taken from the file's current etag, else `null`.
- `PUT /apps/honeycomb/api/v1/visual-hashes` with `{"hashes": [{"fileId": 9, "etag": "…",
  "hash": "…"}, ...]}`, at most 1,000 items, stores each item's hash for the user and answers
  `{"saved": [...]}` with the file ids stored, in request order. A stored hash of the same file is
  replaced.
- An item is skipped, and missing from `saved`, when the user cannot reach its file id as a photo
  (unknown, another user's file, a folder, a sidecar) or its etag is not the file's current one.
- `400`, nothing written, for a body that is not a list of at most 1,000 items, an item without a
  positive integer `fileId`, with an `etag` that is not a string of 1 to 40 characters, with a
  `hash` that is not 16 lower-case hex digits, or a file id given twice. `401` without a user.
- The browser hashes only the hashable pictures (SERIES-001.17) whose shown member has no
  `visualHash`, and sends what it computed with `saveVisualHashes` in `src/api.ts`: every 100
  hashes and when no picture is left to hash. A failed save is logged; the hashes still count for
  the series of this visit. Browser storage holds no hashes; the key `honeycomb.visualHashes` of
  earlier versions is removed when a cull opens.

## Acceptance criteria

### SERIES-003.1 – The listing carries the stored hash

- **Given** a stored visual hash of a file, taken from its current etag
- **When** the user lists the file's folder
- **Then** the file's entry has that hash as `visualHash`; an entry without a stored hash has `null`

### SERIES-003.2 – A changed file loses its hash

- **Given** a stored visual hash of a file whose etag has changed since
- **When** the user lists its folder
- **Then** the entry's `visualHash` is `null`

### SERIES-003.3 – A save stores and replaces

- **Given** photos the user can reach, with or without a stored hash
- **When** the user saves a hash for each with the file's current etag
- **Then** the answer lists their file ids, in request order, and each stored hash is the new one

### SERIES-003.4 – A file the user cannot reach is skipped

- **Given** a save whose items name an unknown file id, another user's file, a folder or a sidecar
- **When** it arrives
- **Then** those items are not stored and missing from `saved`; the other items are stored

### SERIES-003.5 – A stale etag is skipped

- **Given** a save of a hash whose etag is no longer the file's
- **When** it arrives
- **Then** the hash is not stored and its file id is missing from `saved`

### SERIES-003.6 – A malformed save writes nothing

- **Given** a save with one malformed item: no positive integer file id, an etag that is not a
  string of 1 to 40 characters, a hash that is not 16 lower-case hex digits, a file id given twice;
  or a body that is not a list, or more than 1,000 items
- **When** it arrives
- **Then** the answer is `400` and no hash is stored

### SERIES-003.7 – Without a user

- **Given** no logged-in user
- **When** a save arrives
- **Then** the answer is `401` and nothing is written

### SERIES-003.8 – Each user apart

- **Given** two users who can both reach a file, one of them with a stored hash of it
- **When** the other lists it
- **Then** the other's entry has no `visualHash`

### SERIES-003.9 – Saves of one file at once

- **Given** two saves of the same file at once, so one hits the unique key of a row the other just
  wrote
- **When** the second one fails with that conflict
- **Then** it is repeated, at most three attempts in all (the last writer wins)

### SERIES-003.10 – A file deleted for good

- **Given** stored hashes of a file deleted for good and of a file still in place
- **When** the daily clean-up runs
- **Then** the hashes of the deleted file are gone and the others stay

### SERIES-003.11 – A deleted user

- **Given** a user with stored hashes
- **When** the user is deleted
- **Then** their hashes are gone

### SERIES-003.12 – Only the missing hashes are computed and saved

- **Given** an open cull whose hashable pictures partly come with a `visualHash`
- **When** the hashes are computed
- **Then** only the pictures without one are hashed, the delivered hashes count for the series at
  once, and the computed ones are saved every 100 hashes and when none is left to hash

### SERIES-003.13 – A failed save is logged

- **Given** computed hashes
- **When** saving them fails
- **Then** the failure is logged and the hashes still count for the series of this visit

### SERIES-003.14 – Browser storage holds no hashes

- **Given** a browser with visual hashes stored by an earlier version
- **When** a cull opens
- **Then** the stored key is removed and its hashes are not used

### SERIES-003.15 – A move carries the hash

- **Given** a stored hash of a file that a honeycomb move gives a new file id
- **When** the move is done
- **Then** the hash is stored under the new file id, with its etag

## Out of scope

- The hash, the link rule and when a picture is hashed: SERIES-001.
- A hash of a file changed or moved outside honeycomb: its etag or id changes, and it is hashed again.

## History

| Date | Change |
|---|---|
| 2026-11-14 | Written with the visual hash table and endpoint (owner decision, ADR 0024) |
