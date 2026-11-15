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
- A user may save at most 300 times a minute (`#[UserRateLimit]`, ADR 0026); a save beyond that
  is answered `429` by Nextcloud, without a `Retry-After` header, and writes nothing. The cull
  waits as long as the similarity page does (SERIES-004.14) and sends the same hashes again;
  hashing goes on meanwhile and no other save is sent (SERIES-003.27).
- The browser hashes only the hashable pictures (SERIES-001.17) whose shown member has no
  `visualHash`, and sends what it computed with `saveVisualHashes` in `src/api.ts`: every 100
  hashes and when no picture is left to hash; it resolves to the `saved` file ids, which the
  grid does not use, and rejects an answer without them. A failed save is logged; the hashes
  still count for the series of this visit. Browser storage holds no hashes; the key
  `honeycomb.visualHashes` of earlier versions is removed when a cull opens.
- The browser hashes a picture's shown member from the small grid tier, the very URL the grid
  tile loads first (`smallSource`), so the browser's cache serves it: a pair by its JPEG, a
  RAW-only picture by the JPEG embedded in the RAW (IMAGES-001.6). It hashes in the Web Workers
  of the similarity page (SERIES-004), not on the main thread, one picture at a time in the
  order of the tiles, so the six tile loads (GRID-001.15) keep their priority (SERIES-003.26).
- Each hashable picture has a hash state: *hashed* (delivered or computed), *pending* or *failed*
  (its preview could not be loaded or hashed). A failed file version is not hashed again in this
  visit; the next visit tries it once more. A picture that is not hashable has no hash state.
- A strip over the top of the grid shows the similarity of the cull's hashable pictures, at
  every width, laid over the grid so that the tiles do not move when it comes or goes: while
  some are pending, a bar and *Comparing photos 120/300*; when the last pending one is done,
  *Photos compared* for 2 s; once none is pending, *Similarity: 3 photos not compared* in the
  warning colour when some failed, else *Similarity: not saved* when the last save failed, and
  it stays; nothing once every one is hashed and saved, and nothing for a cull that opens with
  every hash delivered. Screen readers hear the progress in steps of 10 %, not on every hash.
  The toolbar shows no similarity.
- The series badge (SERIES-002.10) of a series with a pending member has a dashed outline, and
  its tooltip and the tile's label add *Series may still change*: its members can still split
  or join when their hashes arrive.

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

### SERIES-003.16 – Each picture knows its hash state

- **Given** an open cull with hashable pictures, some delivered with a hash, one being hashed and
  one whose preview failed, and a picture that is not hashable
- **When** the state of each is asked
- **Then** they are *hashed*, *pending* and *failed*, and the last one has none

### SERIES-003.17 – A failed hash is not repeated

- **Given** a picture whose preview failed to hash
- **When** the shown pictures change, as after a decision or another pairing
- **Then** the same file version is not hashed again in this visit; a new version is

### SERIES-003.18 – The similarity while hashing

- **Given** an open cull with hashable pictures still pending
- **When** the grid shows, on a phone or a desktop
- **Then** a strip over the top of the grid shows a bar and *Comparing photos* with the hashed and
  the hashable count, the toolbar shows no similarity, and the tiles do not move when the strip
  comes or goes; the grid keeps the strip's height free above its first row, so the strip covers
  no tile while the grid is scrolled to the top

### SERIES-003.19 – Failures show

- **Given** an open cull with no hashable picture pending
- **When** some failed, or the last save of hashes failed
- **Then** the strip stays and shows how many photos were not compared, else that the hashes were
  not saved, in the warning colour

### SERIES-003.20 – Gone when every hash is there

- **Given** an open cull whose last pending picture is hashed, and every hash saved
- **When** the grid shows
- **Then** the strip shows *Photos compared* for 2 s and then nothing; a cull that opens with every
  hash delivered, or without hashable pictures, shows no strip

### SERIES-003.21 – RAW-only pictures and pairs are hashed

- **Given** a RAW-only picture and a RAW+JPEG pair in one burst
- **When** they are hashed
- **Then** the RAW-only picture is hashed from its RAW's grid preview and the pair from its JPEG's

### SERIES-003.22 – The hash loads no second preview

- **Given** a picture the grid shows
- **When** it is hashed
- **Then** the hasher loads the same URL as the tile's small preview, with the same URL builder

### SERIES-003.23 – Saves are limited per user

- **Given** a user who saves visual hashes
- **When** they save more than 300 times within a minute
- **Then** Nextcloud answers the further saves `429` and writes nothing

### SERIES-003.24 – Progress is announced in steps

- **Given** an open cull with hashable pictures still pending
- **When** hashes arrive
- **Then** screen readers are told the progress only when it passes a step of 10 %, and when the
  photos are compared

### SERIES-003.25 – A series that may still change

- **Given** a series the compare offers with a member still pending
- **When** the grid shows its tiles
- **Then** their series badge has a dashed outline, and its tooltip and the tile's label add
  *Series may still change*; once no member is pending, the badge is plain again

### SERIES-003.26 – The cull hashes in a worker

- **Given** an open cull with pictures to hash
- **When** they are hashed
- **Then** a Web Worker of the pool the similarity page uses (SERIES-004.15, .16) hashes each
  from its small grid tier URL, one picture at a time and in the order of the tiles; the cull's
  page allows workers from its own origin

### SERIES-003.27 – A limited save in the cull waits

- **Given** computed hashes in an open cull
- **When** the server limits their save (`429`)
- **Then** the cull waits as long as the server asks, 60 s without a header, and sends the same
  hashes again; it keeps hashing meanwhile, sends no other save, and the save does not count as
  failed

## Out of scope

- The hash, the link rule and when a picture is hashed: SERIES-001.
- A hash of a file changed or moved outside honeycomb: its etag or id changes, and it is hashed again.

## History

| Date | Change |
|---|---|
| 2026-11-14 | Written with the visual hash table and endpoint (owner decision, ADR 0024) |
| 2026-11-14 | Hash states, the similarity in the toolbar, no repeat of a failed hash (owner request) |
| 2026-11-14 | `saveVisualHashes` resolves to the saved file ids, for the similarity page (SERIES-004) |
| 2026-11-14 | Saves limited to 300 a minute per user (ADR 0026) |
| 2026-11-14 | The similarity moves from the toolbar to a strip over the grid; a series that may still change has a dashed badge (owner decision #181) |
| 2026-11-15 | The cull hashes in the similarity page's workers, and a limited save waits (review R12 b) |
