# TAGS-001 – Tag storage

- Status: implemented
- Area: tags
- Origin: `docs/07-tags.md` Model, D6, Implementation outline step 3; ADR 0005, ADR 0022
- Depends on: DECISIONS-001

## Purpose

Each user's tags are kept per file on the server, beside the decisions, so a cull continues on any
device; the tag list keeps every tag the user ever had for autocomplete and the filter.

## Behaviour

- `POST /apps/honeycomb/api/v1/tags/lookup` with `{"fileIds": [...]}` answers
  `{"tags": [{"fileId": 9, "tags": ["Places/Italy"]}, ...]}` with the stored rows only;
  `PUT /apps/honeycomb/api/v1/tags` with `{"tags": [...]}` stores whole states, at most 60,000
  each, in one transaction; `GET /apps/honeycomb/api/v1/tags/list` answers `{"tagList": [...]}`.
- A tag is at most 255 characters; its names, split at `/`, are not empty, have no space at either
  end and contain no `|`. A file has at most 100 tags, each once; they are stored sorted.
- `400` for a malformed body; one malformed item writes nothing. `401` without a user.
- The client functions `lookupTags`, `saveTags` and `loadTagList` in `src/api.ts` send these
  requests and reject an answer without the expected list.

## Acceptance criteria

### TAGS-001.1 – Lookup answers the stored rows

- **Given** stored tags
- **When** the user looks up file ids
- **Then** the answer holds the rows of those ids only, in file id order, each file's tags sorted;
  an id without a row has no tags

### TAGS-001.2 – Whole states, overwritten

- **Given** a file with stored tags
- **When** the user saves a new list for it
- **Then** the list replaces the earlier one

### TAGS-001.3 – No tags removes the row

- **Given** a file with stored tags
- **When** the user saves an empty list for it
- **Then** the row is gone and the file reads as untagged

### TAGS-001.4 – Each user apart

- **Given** two users tagging the same file
- **When** each looks up, or reads the tag list
- **Then** each reads only their own tags

### TAGS-001.5 – The tag list

- **Given** saves that tag files
- **When** the user reads the tag list
- **Then** it holds every tag saved, sorted and each once, including tags no file has any more

### TAGS-001.6 – A malformed save writes nothing

- **Given** a save with one malformed item: a tag that is not a string, has an empty name, a name
  with a space at either end or a `|`, or is over 255 characters; a tag twice in one item; more
  than 100 tags; a file id twice; or more than 60,000 items
- **When** it arrives
- **Then** the answer is `400`, no row changes and the tag list does not grow

### TAGS-001.7 – A malformed lookup

- **Given** a lookup that is not a list of positive integer ids or has more than 60,000
- **When** it arrives
- **Then** the answer is `400`

### TAGS-001.8 – Without a user

- **Given** no logged-in user
- **When** a lookup, a save or a tag list request arrives
- **Then** the answer is `401` and nothing is read or written

### TAGS-001.9 – Saves of one file at once

- **Given** two saves of the same file at once, so one hits the unique key of a row the other just
  inserted
- **When** the second one fails with that conflict, or on MySQL with a deadlock or a lock wait
  timeout on the other's locks
- **Then** it is repeated, at most three attempts in all (the last writer wins); any other database
  error, or one of these on every attempt, is not repeated further and nothing of that save is
  stored

### TAGS-001.10 – A moved file

- **Given** a file with tags
- **When** a move gives it a new file id
- **Then** its tags follow to the new id; a failure to carry them is logged and the file stays
  moved

### TAGS-001.11 – A file deleted for good

- **Given** tags of a file deleted for good and of a file still in place
- **When** the daily clean-up job runs
- **Then** the deleted file's rows are gone for every user, the other keeps its tags, and the tag
  list keeps its tags

### TAGS-001.12 – A deleted user

- **Given** a user with stored tags
- **When** the user is deleted
- **Then** their rows and tag list are gone; other users keep theirs

### TAGS-001.13 – The client

- **Given** the client functions
- **When** they look up, save or load the tag list
- **Then** they send the requests above, send nothing for no file ids or no tags, and reject an
  answer without the expected list

## Out of scope

Reading tags from sidecars and writing them through (TAGS-002); the JPEG's embedded XMP
(XMP-005); tag entry, filter and tiles (*Tags 2* to *Tags 4*); renaming tags (D7).

## History

| Date | Change |
|---|---|
| 2026-11-13 | Written with the tag tables and endpoints (ADR 0022) |
| 2026-11-14 | A deadlock or lock wait timeout is repeated like a unique-key conflict (TAGS-001.9) |
