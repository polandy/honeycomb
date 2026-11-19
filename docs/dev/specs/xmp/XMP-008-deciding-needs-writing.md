# XMP-008 – Rateable and read only

- Status: implemented
- Area: xmp
- Origin: ADR 0032 (Writability and permissions), sidecar PR 6; ADR 0040 (Rateable and read
  only)
- Depends on: LISTING-001, SETTINGS-001, XMP-003

## Purpose

Whoever may write a folder may rate in it (ADR 0040). A picture is *rateable* or *read only*, and
a read-only picture cannot be flagged, rated, labelled, marked *Keep RAW* or tagged. The cull
shows which pictures are read only before a step, and a write that fails is taken back for its
picture with the reason.

## Behaviour

**Two states (ADR 0040, M8 PR 3).** A picture is *rateable* when the folder of every member
grants UPDATE (2) and CREATE (4) in the listing's `permissions` (LISTING-001), otherwise *read
only*. A folder the listing does not name counts as rateable; the server checks every save again
(XMP-002, DECISIONS-001.24). A shared folder, a folder without versions and a sidecar that cannot
be read as XMP lock nothing. A step over pictures of which some are read only takes the rateable
ones as one undo step, leaves the others as they are, and says in its toast how many were not
changed, with *Details*; a step whose pictures are all read only takes nothing. The grid draws a
lock on each read-only tile (GRID-001.20), the loupe greys its controls (LOUPE-002.18).

**Failed writes (ADR 0040, M8 PR 6).** A rating, colour label or tag whose sidecar write fails
(`locked`, `notPermitted`, `changed` after the second read, `failed`, `noSpace`, or a sidecar
that is not XMP) is taken back for that picture, and the failure toast of XMP-003.13 names the
reason; the other pictures of the step stay changed. A flag or *Keep RAW* save that fails, or that
the server skips, is taken back the same way, logged, and a toast says how many photos were not
saved. Only the fields that still hold what the failed write set are taken back, so a later step
on the picture wins.

**The order of reasons.** A step that leaves pictures unchanged names the reason, `readOnly`.
The loupe's info panel says per picture why nothing is written.

**Before the sidecars are read.** A step is taken while the sidecars are still looked up; a
decision made meanwhile wins (XMP-003.3).

## Acceptance criteria

### XMP-008.1 – A picture whose folders allow it is writable (removed)

Withdrawn by ADR 0040 (M8 PR 3); .12 and .14 replace it.

### XMP-008.2 – *Off* comes first (removed)

Withdrawn by ADR 0040 (M8 PR 3); .12 and .14 replace it.

### XMP-008.3 – A folder without UPDATE or CREATE is read-only

- **Given** a member folder with permissions 1 (READ only)
- **When** the user decides or tags the picture
- **Then** nothing is decided and a toast says *Not changed: read only*

### XMP-008.4 – A shared folder is confirmed once per opened folder (removed)

Withdrawn by ADR 0040 (M8 PR 3); .12 and .14 replace it.

### XMP-008.5 – A folder without versions is locked (removed)

Withdrawn by ADR 0040 (M8 PR 3); .12 and .14 replace it.

### XMP-008.6 – A refused sidecar locks its picture for the visit (removed)

Withdrawn by ADR 0040 (M8 PR 3); .12 and .14 replace it.

### XMP-008.7 – A lock the user can lift is asked first (removed)

Withdrawn by ADR 0040 (M8 PR 3); .12 and .14 replace it.

### XMP-008.9 – A step decides the writable pictures and reports the locked ones (removed)

Withdrawn by ADR 0040 (M8 PR 3); .12 and .14 replace it.

### XMP-008.10 – Undo takes back the partial step as one step

- **Given** a step that decided the writable part of its pictures
- **When** the user chooses *Undo*
- **Then** the writable pictures get back their decisions in one step; the locked ones stay as
  they were

### XMP-008.8 – Deciding does not wait for the sidecars

- **Given** a cull whose sidecar lookup has not answered yet
- **When** the user picks a picture
- **Then** the pick is taken at once and wins over the sidecar's decision when it arrives

### XMP-008.11 – A picture with legacy rows is locked until they are written (removed)

- **Given** a picture with a legacy decision and one with legacy tags only
- **When** the user rates both, then the ⋯ entry writes them to their sidecars
- **Then** neither is rated, the toast says *2 photos not changed: stored decisions are not yet in
  the sidecars* and the info panel says *Not written, stored decisions not yet in its sidecars*;
  once they are acknowledged both show what they showed before and are writable

### XMP-008.12 – A picture whose folders grant UPDATE and CREATE is rateable

- **Given** a picture whose member folders grant UPDATE and CREATE, also one that is shared and
  keeps no versions, or folders the listing does not name
- **When** its state is read
- **Then** it is rateable, and a step on it asks nothing first; a listing item of another shape is
  dropped and counts as not named

### XMP-008.13 – One rule for all six values

- **Given** a picture with a member folder that grants READ and UPDATE but not CREATE
- **When** the user flags, rates, labels, marks *Keep RAW* or tags it, alone or in a step
- **Then** nothing of it changes and nothing is saved, neither in the database nor in a sidecar

### XMP-008.14 – A step takes the rateable pictures and reports the read-only ones

- **Given** a pick of ten pictures, three of them in a read-only folder
- **When** the user takes it
- **Then** seven are picked as one undo step and the toast says *Picked 7 photos; 3 photos not
  changed: read only* with *Undo* and *Details*, which unfold each read-only photo's name; with all
  ten read only nothing is taken and the toast says *Not changed: read only*

### XMP-008.15 – A failed sidecar write is taken back for its picture

- **Given** three stars on ten rateable pictures, one sidecar of them answering `locked`
- **When** the write ends
- **Then** nine keep the stars, the one gets back its earlier rating, and the toast says *Could not
  write 1 sidecar.* with the text for `locked` (XMP-003.33) and *Details*; the same holds for
  `notPermitted`, `changed`, `failed` and a sidecar that is not XMP, with their own words

### XMP-008.16 – A full storage is named

- **Given** a sidecar save that fails because the storage or the owner's quota is full
- **When** the server answers
- **Then** the sidecar is answered `noSpace`, the change is taken back for its picture, and the
  toast names the full storage (XMP-003.33)

### XMP-008.17 – A failed flag save is taken back

- **Given** a flag on two pictures whose flag save fails with a server error
- **When** the answer comes
- **Then** both pictures get back their earlier flag and the failure is logged and shown in a
  toast; a flag on a picture whose sidecar is locked is saved, and an id the server skips is taken
  back alone

## Out of scope

- Moving and deleting, which check their own rights (MOVE-002, DELETE-001).

## History

| Date | Change |
|---|---|
| 2026-11-15 | Written with sidecar PR 6 (ADR 0032) |
| 2026-11-18 | A step decides the writable pictures and reports the locked ones (.7 changed, .9, .10; owner decision on #221 (a)) |
| 2026-11-18 | A picture with legacy rows is locked until the ⋯ entry writes them (`legacy`, .11; ADR 0032 App state and migration 2) |
| 2026-11-19 | ADR 0040: two states, rateable and read only; failed writes are taken back (.1, .2, .4–.7, .9, .11 withdrawn; .12–.17 gaps) |
| 2026-11-19 | M8 PR 3: rateable, read only and `legacy` (.3 changed, .1, .2, .4–.7, .9 removed; .12, .14 implemented) |
| 2026-11-19 | M8 PR 4: no `legacy` state, so the order of reasons has one entry (.11 removed, .14) |
| 2026-11-19 | M8 PR 6: failed writes taken back, the toast of XMP-003.13 names the reason (.13, .15–.17 implemented) |
