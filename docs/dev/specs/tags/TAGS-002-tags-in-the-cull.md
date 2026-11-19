# TAGS-002 – Tags in the cull

- Status: implemented
- Area: tags
- Origin: `docs/dev/07-tags.md` Model, Reading, Writing (D1, D2, D9), outline step 3; ADR 0005,
  ADR 0022, ADR 0023, ADR 0040
- Depends on: TAGS-001, XMP-003, XMP-004, XMP-005

## Purpose

Brings the tags into the cull: a picture shows the tags of its sidecars, and every tag change is
written through to the picture's sidecars, so digiKam, darktable and Lightroom see it.

## Behaviour

**Concept D (ADR 0040).** A tag change is written through for every rateable picture, shared or
not (.22). M8 PR 5 dropped the stored tags; M8 PR 6 makes a read-only picture untaggable
(XMP-008.13). Until then the text below holds.

**A picture's tags** are the union of its members' sidecar tags, sorted, read when a cull opens and
again when the pairing settings change.

**Reading.** A picture shows the tags of its sidecars, read
through the XMP cache with its decision (XMP-003, XMP-006) as XMP-004 says: the union of every
sidecar read and not refused, and of the embedded XMP while it counts. They are not written back,
and nothing is stored in the database.
A picture tagged meanwhile keeps the user's tags.
A tag the cache cannot hold (over 255 characters, or beyond the first 100 of a picture in sort
order) is left out and logged as a warning.

**The embedded XMP** of the picture's JPEG (`image/jpeg`) is one more source (D1) while the JPEG
has no sidecar of its own, neither `<JPEG file>.xmp` nor the shared `<base name>.xmp`; one that
exists replaces it, as in digiKam. It is read with the sidecars when the cull opens and for every
write (XMP-003.22), and never written. A picture whose embedded XMP cannot be looked up shows
no tags from its sidecars and is not written through; its sidecars fail as when they cannot be
read.

**A tag change** (tags added, tags removed) applies to each chosen picture's tags; the result is
shown at once for every member. Nothing is stored in the database: the sidecars hold it, and the
XMP cache save of each saved sidecar adds its tags to the tag list (XMP-006.9).

**Writing through.** Each changed rateable picture (XMP-008) gets the change written to its
sidecars, in the same passes as the decisions (XMP-003): every sidecar is read unless honeycomb
holds its bytes, the change is applied to the union of their tags as they are then, and that set is
written to every sidecar, and, to a new `<member file>.xmp` for each member without one while any
tag is left. The JPEG gets its new sidecar also when no tag is left but its embedded XMP held tags,
so the removal lasts. Only the three tag fields change (XMP-004); the decision fields stay as the
sidecar holds them. Changes waiting for the same pass are applied in order and saved once
(XMP-003.16). A sidecar answering `changed` is read again and gets the change once more. A sidecar
that cannot be written is reported like a decision's (XMP-003.13); *Retry failed sidecars* applies
the same change again.

**Files moved back.** Files put back into the cull (an undone delete) have their sidecars read.

## Acceptance criteria

### TAGS-002.1 – The stored tags are read when the cull opens (removed)

Withdrawn by ADR 0040; `honeycomb_file_tags` is gone (M8 PR 5).

### TAGS-002.2 – A picture shows its sidecars' tags

- **Given** a pair whose RAW's sidecar holds `Places/Lisbon` and whose JPEG's
  sidecar holds `People/Anna`
- **When** the cull opens
- **Then** the picture shows both tags, no tags are saved to the database, and no sidecar is
  saved

### TAGS-002.3 – Stored tags win over the sidecars (removed)

Withdrawn by ADR 0040; `honeycomb_file_tags` is gone (M8 PR 5).

### TAGS-002.4 – Tags given meanwhile win over the sidecars

- **Given** a picture whose sidecar lookup has not answered yet
- **When** the user tags it and the lookup then answers with other tags
- **Then** the picture keeps the user's tags

### TAGS-002.5 – A tag the cache cannot hold is left out

- **Given** sidecar tags of which one is over 255 characters, and a sidecar with 101 tags
- **When** they are read
- **Then** the long tag and the last tag in sort order are left out and each is logged as a warning;
  the others are shown and cached

### TAGS-002.6 – A failed stored read shows the sidecars' tags (removed)

Withdrawn by ADR 0040; `honeycomb_file_tags` is gone (M8 PR 5).

### TAGS-002.7 – A tag change is shown for every member

- **Given** a pair whose RAW's sidecar has `Places/Lisbon` and whose JPEG has none
- **When** the user adds `Events/Wedding` and removes `Places/Lisbon`
- **Then** the picture shows `Events/Wedding` at once and no tags are saved to the database

### TAGS-002.8 – A failed save puts the tags back and writes nothing (removed)

The cull saves no tags to the database any more (ADR 0032, XMP-006.7); a failed sidecar write is
reported (TAGS-002.13).

### TAGS-002.9 – A tag change is written through

- **Given** a rateable pair with sidecars holding `Places/Lisbon` and, added by
  another program after the listing, `People/Anna`
- **When** the user adds `Events/Wedding` and removes `Places/Lisbon`
- **Then** each sidecar is saved with `Events/Wedding` and `People/Anna` in the three tag fields and
  its rating, flag and colour label unchanged

### TAGS-002.10 – A member without a sidecar gets one while tags are left

- **Given** a pair without sidecars
- **When** the user tags it, and later removes its last tag
- **Then** the first change creates `<member file>.xmp` for both members with the tag; the second
  saves over them without the tag fields, and a pair without sidecars that loses its last tag gets
  no new sidecar

### TAGS-002.11 – A sidecar changed meanwhile gets the change once more

- **Given** a sidecar whose save answers `changed`
- **When** a tag change is written through
- **Then** the sidecar is read again and saved with the change applied to its tags of that moment

### TAGS-002.12 – Nothing is written through in a shared folder (removed)

Withdrawn by ADR 0040 (M8 PR 3); tags are written through in a shared folder (.22).

### TAGS-002.13 – A failed sidecar is retried with the same change

- **Given** a tag change whose sidecar answers `notPermitted`
- **When** the write finishes and the user chooses *Retry failed sidecars*
- **Then** the toast and report of XMP-003.13 appear, and the retry writes the same change to that
  sidecar

### TAGS-002.14 – Files moved back have their tags read

- **Given** a deleted picture whose sidecar holds tags
- **When** its files are put back into the cull
- **Then** its sidecars are read and the picture shows those tags

### TAGS-002.15 – The JPEG's embedded tags are taken over

- **Given** a pair whose RAW's sidecar holds `People/Anna` and whose JPEG has
  no sidecar of its own and embeds `Places/Lisbon`
- **When** the cull opens
- **Then** the picture shows both tags; only that JPEG's embedded XMP was looked up

### TAGS-002.16 – A sidecar of the JPEG replaces its embedded XMP

- **Given** pictures, one with `<JPEG file>.xmp`, one with the shared `<base name>.xmp`, one a RAW
  alone, and one a HEIC
- **When** the cull opens
- **Then** no embedded XMP is looked up

### TAGS-002.17 – A failed embedded lookup shows no tags

- **Given** pictures whose JPEGs embed tags, one answering `notPermitted`, and then a lookup
  request that fails
- **When** the cull opens
- **Then** a warning is logged, the picture that failed shows no tags while the others show theirs,
  and after the failed request no picture shows tags while their decisions still show

### TAGS-002.18 – A tag write applies the change to the embedded tags

- **Given** a pair whose RAW's sidecar holds `Places/Lisbon` and whose JPEG has no sidecar and
  embeds `People/Anna`
- **When** the user adds `Events/Wedding`
- **Then** the RAW's sidecar and a new `<JPEG file>.xmp` are saved with `Events/Wedding`,
  `People/Anna` and `Places/Lisbon`, and the JPEG is not written

### TAGS-002.19 – Removing the embedded tags creates the JPEG's sidecar

- **Given** a JPEG alone without a sidecar that embeds `People/Anna`
- **When** the user removes `People/Anna`
- **Then** a new `<JPEG file>.xmp` is saved without tag fields, and the next tag write does not
  look the embedded XMP up

### TAGS-002.20 – A failed embedded lookup writes nothing for the picture

- **Given** a tag change for a picture whose embedded XMP lookup fails
- **When** it is written through
- **Then** none of its sidecars is saved, they are reported as not written, and *Retry failed
  sidecars* looks the embedded XMP up again

### TAGS-002.21 – Tag saves go one at a time (removed)

The cull saves no tags to the database any more (ADR 0032, XMP-006.7).

### TAGS-002.22 – Tags are written through in a shared folder

- **Given** a rateable picture with a member in a folder shared with another user
- **When** the user tags it
- **Then** the change is written to its sidecars as in .9, without asking first

### TAGS-002.23 – A failed tag write is taken back (gap)

- **Given** a tag change on two pictures, a sidecar of one answering `locked`
- **When** the write ends
- **Then** that picture gets back its earlier tags, the other keeps the change, and the toast names
  the reason (XMP-008.15)

## Out of scope

- The tag entry, undo, toasts and the tag list in the UI: TAGS-003; multi-select by long-press
  (*Tags 3*); filter, tile and info panel (*Tags 4*).
- Re-reading sidecars another program changes while the cull is open, as for decisions (XMP-003).

## History

| Date | Change |
|---|---|
| 2026-11-13 | Written with *Tags 1*: take-over from sidecars and write-through |
| 2026-11-13 | The JPEG's embedded XMP as one more source (*Tags 1b*, .15–.20) |
| 2026-11-14 | Tag saves go one at a time, the newest tags per file (.21) |
| 2026-11-14 | Tag changes waiting for one sidecar pass are saved once (XMP-003.16) |
| 2026-11-15 | The embedded XMP is looked up for the decision too, also with stored tags (XMP-003.22) |
| 2026-11-18 | The cull reads tags through the XMP cache and stores none; legacy tags win, locked, until migrated (.1–.7, .14–.17 changed, .8, .21 removed, ADR 0032) |
| 2026-11-19 | ADR 0040: no legacy tags, tags written through in shared folders, failed writes taken back (.1, .3, .6, .12 withdrawn; .22, .23 gaps) |
| 2026-11-19 | M8 PR 3: tags are written through in a shared folder without asking (.12 removed; .22 implemented) |
| 2026-11-19 | M8 PR 4: the migration is gone, so stored tags lock nothing; their read goes with the table in M8 PR 5 (.1, .3, .6) |
| 2026-11-19 | M8 PR 5: no stored tags are read (.1, .3, .6 removed; .14 reads only the sidecars) |
