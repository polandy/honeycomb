# XMP-007 – Migrating the stored decisions and tags to sidecars

- Status: implemented
- Area: xmp
- Origin: ADR 0032 (App state and migration), `docs/dev/06-xmp-interop.md`
- Withdrawn by: ADR 0040; M8 PR 4 removes the migration and sets the status `removed`
- Depends on: DECISIONS-001, TAGS-001, XMP-002, XMP-003, XMP-004, SETTINGS-001

## Purpose

Before ADR 0032 the ratings, flags, colour labels, *Keep RAW* marks and tags lived in the tables
`honeycomb_decisions` and `honeycomb_file_tags` (the legacy rows). The migration writes them into
the pictures' sidecars, removes each picture's rows once its sidecars hold them, and keeps the
rows of files the user no longer reaches until the user exports or discards them.

## Behaviour

**Withdrawn.** ADR 0040 drops the migration: honeycomb runs in no production, so M8 PR 5 drops
`honeycomb_decisions` and `honeycomb_file_tags` without writing their rows anywhere. M8 PR 4
removes the code, its tests and this spec's criteria; until then the merged code does what
follows.

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
otherwise and that tags are added. It needs
*Write decisions to XMP sidecars* set to *On* (SETTINGS-001.24), so every
picture gets a sidecar; with another setting the dialog says so and *Write to sidecars* is
disabled.

**Shared folders.** A picture in a shared folder needs the same confirmation as deciding it
(XMP-008.4): per opened folder including its subfolders, kept in `confirmedSharedFolders`. The
run skips every picture in a shared folder not confirmed; it keeps its rows. The dialog says how
many photos it skips, that everyone with access and digiKam, darktable and Lightroom see the
decisions of a confirmed folder, and offers one *Confirm <folder>* button per opened folder to
confirm. A confirmed folder's pictures are written by this run, or by the next one when it was
confirmed later, e.g. by deciding a picture there. With every picture skipped, *Write to
sidecars* is disabled.

On confirm, every decided picture's sidecars get all four decision fields of the
stored decision, every tagged picture's sidecars get its stored tags added (the union), in one
pass (XMP-003.16). The server keeps refusing what it refuses (XMP-002), among them an overwrite
without file versions. A picture whose every sidecar answered `saved`, or needed no save, is
acknowledged; a failed picture keeps its rows and is written again by the next run, so a run can
resume. The cull keeps showing every picture as it did; an acknowledged picture is no longer locked
(XMP-008.11). The cull stores no legacy rows (XMP-003.1), so a migrated picture never gets them
back and the notice does not return.

**The run.** The run writes 20 photos at a time. Until it ends the dialog stays open without
*Cancel*, its footer shows how many photos were written, and each part's saved pictures are
acknowledged as the part ends, so the notice's counts fall while it runs. It ends with one toast:
how many photos were written, or how many of them could not be written with *Details*, which
lists each failed sidecar with its reason and offers a retry (XMP-003.13); after `;` it adds how
many photos it skipped in shared folders not confirmed. A run that stops on
an error says so, and a run without photos says there is nothing to write.

**The notice.** While writing is *On* and legacy rows remain, the grid shows a notice. Its
heading says how many photos have decisions not yet in their sidecars; its text says that
digiKam, darktable and Lightroom cannot see them and to open a folder and choose the ⋯ entry; one
button per folder, `/Photos/A (2)`, opens that folder alone, without subfolders. With unreachable
rows it says how many files were deleted or are no longer shared, that their sidecars cannot be
written, and offers *Save a copy* and *Forget…*: *Save a copy* saves the export as
`honeycomb-legacy-rows.json` and says so in a toast; *Forget…* asks first, then acknowledges the
exported file ids and says how many files it forgot. The notice is read when the app opens and
after each part of a run, a copy or a forget; a failed read shows no notice and is logged.

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

### XMP-007.8 – The notice names the folders and offers a copy and forgetting

- **Given** writing *On* and an inventory of two folders and 3 unreachable files
- **When** the grid shows, and the user chooses *Save a copy*, then *Forget…* and confirms
- **Then** the notice names both folders and the 3 files, *Save a copy* saves the export as
  `honeycomb-legacy-rows.json` and toasts *Saved a copy as honeycomb-legacy-rows.json*, *Forget*
  acknowledges the exported file ids, toasts *Forgot the stored decisions of 3 files* and the
  notice is read again; *Cancel* forgets nothing, and without rows or with writing *Off* no notice
  shows
- **And** a long folder list scrolls inside the notice, which takes at most 30 % of the screen's
  height, so the grid keeps room on a phone

### XMP-007.9 – A failed inventory shows no notice

- **Given** an inventory request that fails
- **When** the app opens
- **Then** no notice shows and the failure is logged

### XMP-007.10 – A folder of the notice opens that folder

- **Given** the notice naming `/Photos/B (1)` while another folder is open
- **When** the user chooses `/Photos/B (1)`
- **Then** honeycomb lists `/Photos/B` without subfolders and opens its cull; a failed listing
  toasts *Could not open B.* and keeps the open cull

### XMP-007.11 – The run shows its progress and ends with one result

- **Given** 45 pictures with stored decisions
- **When** the ⋯ entry writes them
- **Then** they are written in parts of 20, 20 and 5 photos, the dialog shows *20 of 45 photos
  sent* after the first part, each part's pictures are acknowledged as it ends and the notice read
  again, and one toast says *Wrote the decisions of 45 photos to sidecars*

### XMP-007.12 – A run with failures ends with how many failed and why

- **Given** two pictures, one of whose sidecars cannot be saved, or a write that stops on an
  error, or no picture to write
- **When** the ⋯ entry writes them
- **Then** one toast says *Could not write 1 of 2 photos* with *Details* naming the sidecar and its
  reason; after an error it says *Could not write the sidecars; run it again later.* and
  acknowledges nothing; without pictures it says *No stored decisions to write here*

### XMP-007.13 – A shared folder not confirmed is skipped until confirmed

- **Given** writing *On*, a picture with a stored decision in a shared folder below the opened
  folder `/Trip` (file id 7) that is not confirmed, and one in a folder that is not shared
- **When** the user chooses *Write decisions to sidecars…* and confirms *Write to sidecars*
- **Then** the dialog says *1 photo in a shared folder you have not confirmed is skipped* and
  offers *Confirm Trip*; only the second picture's sidecars are saved and acknowledged, no
  sidecar of the shared folder is saved, and the toast says *Wrote the decisions of 1 photo to
  sidecars; skipped 1 photo in a shared folder not confirmed*
- **And** after *Confirm Trip* the settings keep 7 in `confirmedSharedFolders`, the dialog no
  longer skips, and the next run writes and acknowledges the shared picture; with every picture
  skipped *Write to sidecars* is disabled

### XMP-007.14 – The notice does not come back after a migration

- **Given** a picture with legacy rows that the ⋯ entry wrote and acknowledged
- **When** the user decides and tags it, and the cull opens its folder again
- **Then** no decision or tag is saved to the legacy tables, the picture shows its sidecars' values,
  and the notice stays away

## Out of scope

- Marking a folder of the notice as waiting for a confirmation: the inventory does not know which
  folders are shared; the dialog of the ⋯ entry names them.

- Filling the XMP cache on acknowledgement: the sidecars saved by the run fill it (XMP-006.10).
- Dropping the tables: ADR 0032 PR 9.

## History

| Date | Change |
|---|---|
| 2026-11-15 | Written with ADR 0032 PR 5 |
| 2026-11-17 | Clearer notice with folder buttons, *Save a copy* and *Forget…*; the run shows progress and one result (XMP-007.10–.12) |
| 2026-11-18 | Shared folders need the confirmation of XMP-008.4; the run skips those not confirmed (XMP-007.13, owner decision #187) |
| 2026-11-18 | An acknowledged picture is unlocked and gets no legacy rows back, so the notice stays away (XMP-007.14, ADR 0032) |
| 2026-11-19 | Withdrawn by ADR 0040; M8 PR 4 removes the migration and sets the status `removed` |
