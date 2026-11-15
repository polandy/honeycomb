# XMP-007 – Migrating the stored decisions and tags to sidecars

- Status: implemented
- Area: xmp
- Origin: ADR 0032 (App state and migration), `docs/06-xmp-interop.md`
- Depends on: DECISIONS-001, TAGS-001, XMP-002, XMP-003, XMP-004, SETTINGS-001

## Purpose

Before ADR 0032 the ratings, flags, colour labels, *Keep RAW* marks and tags lived in the tables
`honeycomb_decisions` and `honeycomb_file_tags` (the legacy rows). The migration writes them into
the pictures' sidecars, removes each picture's rows once its sidecars hold them, and keeps the
rows of files the user no longer reaches until the user exports or discards them.

## Behaviour

**Endpoints.** Logged in, with the CSRF token:

- `GET /apps/honeycomb/api/v1/legacy/folders` answers `{"folders": [...], "unreachable": <n>}`:
  one item `{"path": "/Photos/A", "files": <n>}` per folder that holds a photo with a legacy row,
  sorted by path, counting each file once; `unreachable` counts the file ids with a legacy row the
  user no longer reaches as a photo (deleted for good, unshared, or another user's).
- `GET /apps/honeycomb/api/v1/legacy/export` answers `{"decisions": [...], "tags": [...]}`, the
  legacy rows of the unreachable file ids, in the shapes of the decision and tag lookups
  (DECISIONS-001, TAGS-001).
- `DELETE /apps/honeycomb/api/v1/legacy` with `{"fileIds": [...]}` (the acknowledgement) removes
  the user's decision and tag rows of those file ids, at most 60,000, and answers `204`. It
  removes no tag of the tag list and no row of another user. It is rate limited per user
  (APP-001.9).
- `400` for a malformed body, `401` without a user.

**The ⋯ entry.** *Write decisions to sidecars…* in the grid's ⋯ menu is offered while a picture
of the cull has a stored decision other than undecided or a stored tag. It asks first: the dialog
names how many photos in which folders, says the database value wins where a sidecar says
otherwise and that tags are added, and warns when a picture lies in a shared folder. It needs
*Write decisions to XMP sidecars* set to *On* (SETTINGS-001.24), so every
picture gets a sidecar; with another setting the dialog says so and *Write to sidecars* is
disabled. On confirm, every decided picture's sidecars get all four decision fields of the
stored decision, every tagged picture's sidecars get its stored tags added (the union), in one
pass (XMP-003.16). The server keeps refusing what it refuses (XMP-002), among them an overwrite
without file versions. A picture whose every sidecar answered `saved`, or needed no save, is
acknowledged; a failed picture keeps its rows, is reported as in XMP-003.13, and is written again
by the next run, so a run can resume. The cull keeps showing every picture as it did.

**The notice.** While writing is *On* and legacy rows remain, the
grid shows a notice that names the folders still holding them, to open each and use the ⋯ entry.
With unreachable rows it says how many files and offers *Export* and *Discard*: *Export* saves
the export as `honeycomb-legacy-rows.json`; *Discard* asks first, then acknowledges the exported
file ids. The notice is read when the app opens and after each run, export or discard; a failed
read shows no notice and is logged.

## Acceptance criteria

### XMP-007.1 – The inventory names the folders with legacy rows

- **Given** a decision for a photo in `/Photos/A`, a decision and tags for another photo there,
  tags for a photo in `/Photos/B`, and a decision for a file id the user does not reach
- **When** the user sends `GET /apps/honeycomb/api/v1/legacy/folders`
- **Then** the answer is `/Photos/A` with 2 files, `/Photos/B` with 1, and 1 unreachable

### XMP-007.2 – The export holds the rows of unreachable file ids

- **Given** legacy rows of a reachable photo and of two file ids the user does not reach, one with
  a decision, one with tags
- **When** the user sends `GET /apps/honeycomb/api/v1/legacy/export`
- **Then** the answer holds the decision and the tags of the two unreachable ids only

### XMP-007.3 – The acknowledgement removes the rows of the file ids

- **Given** decision and tag rows of two photos of the user, and rows of the same ids for another
  user
- **When** the user acknowledges one of the photos
- **Then** its decision and tag rows are gone and the answer is `204`; the other photo's rows, the
  other user's rows and the tag list stay

### XMP-007.4 – A malformed acknowledgement removes nothing

- **Given** a body with a file id that is not a positive integer, more than 60,000 ids, or no user
- **When** it is sent
- **Then** the answer is `400` (or `401`) and no row is removed

### XMP-007.5 – The ⋯ entry writes every picture with legacy rows, the database winning

- **Given** writing *On*, a picture with a stored decision whose sidecar states
  other values, and a picture with stored tags only whose sidecar states a rating and a tag
- **When** the user chooses *Write decisions to sidecars…* and confirms *Write to sidecars*
- **Then** the first sidecar gets the stored rating, colour label, flag and *Keep RAW*, the second
  keeps its rating and holds both tags, a toast says how many photos were written, and both
  pictures' file ids are acknowledged

### XMP-007.6 – Only a picture with every sidecar saved is acknowledged

- **Given** two pictures with stored decisions, one whose sidecar save answers `notPermitted`, and
  one whose sidecar save answers `saved`
- **When** the ⋯ entry writes them
- **Then** only the second picture is acknowledged; the first keeps its rows and is reported

### XMP-007.7 – The ⋯ entry needs writing *On* and legacy rows

- **Given** writing *Off*, and a cull without a stored decision or tag
- **When** the user opens the ⋯ menu and chooses *Write decisions to sidecars…*
- **Then** the dialog says to turn on *Write decisions to XMP sidecars* in the settings and *Write to
  sidecars* is disabled; in the cull without legacy rows the entry is absent

### XMP-007.8 – The notice names the folders and offers export and discard

- **Given** writing *On* and an inventory of two folders and 3 unreachable files
- **When** the grid shows, and the user chooses *Export*, then *Discard* and confirms
- **Then** the notice names both folders and the 3 files, *Export* saves the export as
  `honeycomb-legacy-rows.json`, *Discard* acknowledges the exported file ids and the notice is
  read again; *Cancel* discards nothing, and without rows or with writing *Off* no notice shows

### XMP-007.9 – A failed inventory shows no notice

- **Given** an inventory request that fails
- **When** the app opens
- **Then** no notice shows and the failure is logged

## Out of scope

- Locking a picture that still has legacy rows, and reading the cull through the XMP cache:
  ADR 0032 PR 6. Until then the cull still stores decisions and tags in the database, so a
  picture decided again gets legacy rows again.
- Filling the XMP cache on acknowledgement: the cull reads a file without a cache row anyway
  (XMP-006), from PR 6.
- Dropping the tables: ADR 0032 PR 9.

## History

| Date | Change |
|---|---|
| 2026-11-15 | Written with ADR 0032 PR 5 |
