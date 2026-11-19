# XMP-006 – XMP cache

- Status: implemented
- Area: xmp
- Origin: ADR 0032, `docs/dev/06-xmp-interop.md` Reading
- Depends on: LISTING-001, XMP-002, XMP-005, SETTINGS-001

## Purpose

Keeps, per user and source file, the values the client derived from a sidecar's or a JPEG's
embedded XMP bytes, so a folder visit reads only the files whose ETag changed. The cache can be
cleared at any time and is rebuilt from the files; it is never the base of a write (ADR 0032).

## Behaviour

- A row is `fileId`, `kind` (`sidecar` or `embedded`), `etag` (of the bytes read), `reader` (the
  version of the reading rules), `state` (`read`, `refused`, `none`), `reason` (only for
  `refused`), `rating` 0–5, `flag` (`picked`, `rejected`, `unflagged`), `colourLabel` (one of nine),
  `keepRaw` and `tags` (a list of tag paths). Each value is `null` when the source says nothing.
  One row per user and file id.
- `POST /apps/honeycomb/api/v1/xmp-cache/lookup` with `{"fileIds": [...]}` answers
  `{"entries": [...]}` with the stored rows only; `PUT /apps/honeycomb/api/v1/xmp-cache` with
  `{"entries": [...]}` stores whole rows, replacing a stored one; at most 60,000 each, in one
  transaction. `DELETE /apps/honeycomb/api/v1/xmp-cache` removes every row of the user and every
  visual hash of the user (SERIES-003).
- `400` for a malformed body; one malformed item writes nothing. `401` without a user.
- A save writes only the file ids the user reaches: a sidecar for `sidecar`, a JPEG for
  `embedded`; any other id is skipped (ADR 0031). The ids are looked up 1,000 at a time
  (ADR 0038). Saves and the `DELETE` are rate limited per user (APP-001.9).
- Under ADR 0040 the `flag` and `keepRaw` of a row no longer show in the cull: they serve the
  take-over of a picture without a row in `honeycomb_flags` (XMP-003.34) and the count of
  *Write picks/rejects to XMP* (XMP-003.39). Rating, colour label and tags show as before.
- A save adds the tags of the rows it stores to the user's tag list (TAGS-003.13).
- A row is valid while its `etag` equals the ETag the listing gives the file and its `reader` is
  the current version; the client reads every other listed source again and stores the new row.
  The cull reads every picture through the cache this way (XMP-003.1), and stores the row of each
  sidecar it saves, from the bytes saved and the new ETag.
- `occ honeycomb:cache:clear [<user>]` removes the XMP cache rows and visual hashes of one user,
  or of every user without an argument, and prints how many rows it removed. An unknown user
  fails with a message and removes nothing.
- *Clear cache* in the settings' *Cache* section sends the `DELETE` (SETTINGS-001.25).
- Neither the `DELETE` nor the command touches a sidecar, a position, a stored series, the settings
  or the tag list.
- The daily background job removes the rows of files deleted for good, like the other file row
  tables (DECISIONS-001). Deleting a user removes their rows.

## Acceptance criteria

### XMP-006.1 – Stored rows are looked up

- **Given** stored rows for a sidecar and for a JPEG's embedded XMP
- **When** they and an id without a row are looked up
- **Then** the answer has the two rows with every field as stored, and nothing for the third id

### XMP-006.2 – A save replaces whole rows

- **Given** a stored row for a sidecar
- **When** a row with another ETag and other values is saved for it
- **Then** a lookup answers only the new row

### XMP-006.3 – Ids the user does not reach are skipped

- **Given** a foreign file id, a vanished one, and an image id saved as `sidecar`
- **When** they are saved
- **Then** none of them gets a row, and the rows of the ids the user reaches are stored

### XMP-006.4 – A malformed body writes nothing

- **Given** a body with one malformed row, a body with more than 60,000 rows, or a request
  without a user
- **When** it is sent
- **Then** the answer is `400` (or `401`) and no row is written

### XMP-006.5 – Clear cache removes the user's cache and visual hashes only

- **Given** a user with cache rows, visual hashes, a position, a stored series and a tag list, and
  another user with cache rows
- **When** the user sends `DELETE /apps/honeycomb/api/v1/xmp-cache`
- **Then** the user's cache rows and visual hashes are gone; the position, series, tag list and
  the other user's rows stay

### XMP-006.6 – The occ command clears one user or every user

- **Given** two users with cache rows and visual hashes
- **When** `occ honeycomb:cache:clear alice` runs, then `occ honeycomb:cache:clear`
- **Then** the first removes only alice's rows and names the count, the second the rest; an
  unknown user fails with a message and removes nothing

### XMP-006.7 – A stale row is read again

- **Given** a cache row whose `etag` differs from the listed ETag, one with an older `reader`, one
  valid row, and a listed sidecar without a row
- **When** the cull opens them
- **Then** the first two and the fourth file are read again and their new rows stored; the third
  is not read, and its picture shows the row's values

### XMP-006.8 – Rows of deleted files and users go

- **Given** a row of a file deleted for good and the rows of a deleted user
- **When** the daily job runs and the user is deleted
- **Then** both sets of rows are removed

### XMP-006.9 – A save adds its tags to the tag list

- **Given** a row with the tags `Places/Rome` and `Trip` for a sidecar the user reaches, and one with
  the tag `Hidden` for a file the user does not reach
- **When** both are saved
- **Then** the user's tag list holds `Places/Rome` and `Trip`, not `Hidden`

### XMP-006.10 – A saved sidecar's row is stored

- **Given** a sidecar the cull saves with a rating of 4
- **When** the save answers `saved` with a new ETag
- **Then** the cache stores the sidecar's row with that ETag and the rating 4, so the next visit
  does not read it

### XMP-006.11 – A save looks its file ids up in batches

- **Given** a save of 2,000 rows
- **When** it is stored
- **Then** its file ids are looked up 1,000 at a time in the user's files, shares included, not
  one by one, and the same ids are reached as by a lookup of each (ADR 0038)

### XMP-006.12 – The flag fields serve the take-over and the count

- **Given** a picture with a row in `honeycomb_flags` saying *rejected*, whose sidecar's cache row
  states picked
- **When** the cull opens
- **Then** the picture shows *rejected* and no take-over is sent; *Write picks/rejects to XMP*
  counting the sidecar as differing is XMP-003.39

## Out of scope

- A cache shared between users per file id and ETag (ADR 0032 Consequences).

## History

| Date | Change |
|---|---|
| 2026-11-15 | Accepted with ADR 0032 |
| 2026-11-15 | The endpoints, the command and *Clear cache* (ADR 0032 PR 4); the save answers the ids stored |
| 2026-11-18 | The cull reads through the cache and stores the rows of the sidecars it saves (XMP-006.7, .10); a save feeds the tag list (.9) |
| 2026-11-18 | A save looks its file ids up 1,000 at a time (XMP-006.11, ADR 0038) |
| 2026-11-19 | ADR 0040: the flag fields serve only the take-over and the export count (.12 gap until M8 PR 6) |
| 2026-11-19 | M8 PR 6: a row wins over the cached flag fields (.12 implemented, its count with XMP-003.39) |
