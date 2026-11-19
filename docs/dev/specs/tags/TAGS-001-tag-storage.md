# TAGS-001 – Tag storage

- Status: implemented
- Area: tags
- Origin: `docs/dev/07-tags.md` Model, D6, Implementation outline step 3; ADR 0005, ADR 0022,
  ADR 0040
- Depends on: XMP-006

## Purpose

A file's tags live only in its sidecars (TAGS-002, XMP-004). The server keeps per user the tag
list: every tag the user ever had, for autocomplete and the filter.

## Behaviour

- `GET /apps/honeycomb/api/v1/tags/list` answers `{"tagList": [...]}`, sorted and each tag once.
  The XMP cache save adds the tags it reads (XMP-006.9). `401` without a user.
- Deleting a user removes their tag list.
- The client function `loadTagList` in `src/api/user-data.ts` sends the request and rejects an
  answer without the list.
- ADR 0040 dropped `honeycomb_file_tags` with `tags/lookup`, `PUT tags`, `lookupTags`, `saveTags`
  and the carrying of file tags on a move (M8 PR 5).

## Acceptance criteria

### TAGS-001.1 – Lookup answers the stored rows (removed)

Withdrawn by ADR 0040; `honeycomb_file_tags` and its endpoints are gone (M8 PR 5).

### TAGS-001.2 – Whole states, overwritten (removed)

Withdrawn by ADR 0040; `honeycomb_file_tags` and its endpoints are gone (M8 PR 5).

### TAGS-001.3 – No tags removes the row (removed)

Withdrawn by ADR 0040; `honeycomb_file_tags` and its endpoints are gone (M8 PR 5).

### TAGS-001.4 – Each user apart (removed)

Withdrawn by ADR 0040; `honeycomb_file_tags` and its endpoints are gone (M8 PR 5).

### TAGS-001.5 – The tag list

- **Given** tags added to the tag list (XMP-006.9)
- **When** the user reads the tag list
- **Then** it holds every tag saved, sorted and each once, including tags no file has any more

### TAGS-001.6 – A malformed save writes nothing (removed)

Withdrawn by ADR 0040; `honeycomb_file_tags` and its endpoints are gone (M8 PR 5).

### TAGS-001.7 – A malformed lookup (removed)

Withdrawn by ADR 0040; `honeycomb_file_tags` and its endpoints are gone (M8 PR 5).

### TAGS-001.8 – Without a user (removed)

Withdrawn by ADR 0040; `honeycomb_file_tags` and its endpoints are gone (M8 PR 5).

### TAGS-001.9 – Saves of one file at once (removed)

Withdrawn by ADR 0040; `honeycomb_file_tags` and its endpoints are gone (M8 PR 5).

### TAGS-001.10 – A moved file (removed)

Withdrawn by ADR 0040; `honeycomb_file_tags` and its endpoints are gone (M8 PR 5).

### TAGS-001.11 – A file deleted for good (removed)

No tag is stored per file any more (ADR 0040, M8 PR 5); the tag list keeps its tags.

### TAGS-001.12 – A deleted user

- **Given** a user with a tag list
- **When** the user is deleted
- **Then** their tag list is gone; other users keep theirs

### TAGS-001.13 – The client

- **Given** the client function `loadTagList`
- **When** it loads the tag list
- **Then** it sends the request above and rejects an answer without the expected list

### TAGS-001.14 – A file the user does not reach (removed)

Withdrawn by ADR 0040; `honeycomb_file_tags` and its endpoints are gone (M8 PR 5).

### TAGS-001.15 – A save looks its file ids up in batches (removed)

Withdrawn by ADR 0040; `honeycomb_file_tags` and its endpoints are gone (M8 PR 5).

### TAGS-001.16 – No file tags in the database

- **Given** a cull in which the user tags a picture, and a move that gives a file a new id
- **When** the server is asked
- **Then** no tag is stored per file and no file-tag endpoint answers; the tag list holds the new
  tag through the XMP cache save (XMP-006.9) and is read by `tags/list` as before

## Out of scope

Reading tags from sidecars and writing them through (TAGS-002); the JPEG's embedded XMP
(XMP-005); tag entry, filter and tiles (*Tags 2* to *Tags 4*); renaming tags (D7).

## History

| Date | Change |
|---|---|
| 2026-11-13 | Written with the tag tables and endpoints (ADR 0022) |
| 2026-11-14 | A deadlock or lock wait timeout is repeated like a unique-key conflict (TAGS-001.9) |
| 2026-11-15 | A save skips file ids that are not the user's photos (TAGS-001.14, ADR 0031, risk review R10) |
| 2026-11-18 | A save looks its file ids up 1,000 at a time (TAGS-001.15, ADR 0038) |
| 2026-11-19 | ADR 0040: file tags only in the sidecars, the tag list stays (.1–.4, .6–.10, .14, .15 withdrawn; .16 gap) |
| 2026-11-19 | M8 PR 5: `honeycomb_file_tags` dropped (.1–.4, .6–.11, .14, .15 removed; .16 built) |
