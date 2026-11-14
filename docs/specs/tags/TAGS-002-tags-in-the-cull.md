# TAGS-002 – Tags in the cull

- Status: implemented
- Area: tags
- Origin: `docs/07-tags.md` Model, Reading, Writing (D1, D2, D9), outline step 3; ADR 0005, ADR 0022,
  ADR 0023
- Depends on: TAGS-001, XMP-003, XMP-004, XMP-005

## Purpose

Brings the tags into the cull: a picture honeycomb has stored nothing for takes over the tags of its
sidecars, and every tag change is stored and written through to the picture's sidecars, so digiKam,
darktable and Lightroom see it.

## Behaviour

**A picture's tags** are the union of its members' stored tags, sorted. When a cull opens, and
again when the pairing settings change, the stored tags of every member are read beside the stored
decisions. A failed read is logged; the pictures show as untagged and take nothing over.

**Taking over.** A picture whose sidecars are looked up for their decision (no stored decision for
any member, XMP-003) and that has no stored tags for any member takes over the tags of its sidecars,
read as XMP-004 says: the union of every sidecar answered and not refused, and of the embedded
XMP while it counts. They are shown and stored
for every member in one save, which is not written back to the sidecars. A picture tagged meanwhile
keeps the user's tags. A tag the storage cannot hold (over 255 characters, or beyond the first 100
of a picture in sort order) is left out and logged as a warning.

**The embedded XMP** of the picture's JPEG (`image/jpeg`) is one more source (D1) while the JPEG
has no sidecar of its own, neither `<JPEG file>.xmp` nor the shared `<base name>.xmp`; one that
exists replaces it, as in digiKam. It is looked up only for pictures that take tags over and for
tag writes, and never written. A picture whose embedded XMP cannot be looked up takes no tags over
and is not written through; its sidecars fail as when they cannot be read.

**A tag change** (tags added, tags removed) applies to each chosen picture's tags; the result is
shown at once and stored for every member in one save. Saves go one at a time and wait for the
one in flight, as decisions do (DECISIONS-001.14, .15). A failed save puts back what it replaced,
except the files a later save stored, and writes no sidecar.

**Writing through.** After the save, each changed picture outside a shared folder gets the change
written to its sidecars, in the same passes as the decisions (XMP-003): every sidecar is read unless
honeycomb holds its bytes, the change is applied to the union of their tags as they are then, and
that set is written to every sidecar, and to a new `<member file>.xmp` for each member without one
while any tag is left. The JPEG gets its new sidecar also when no tag is left but its embedded XMP
held tags, so the removal lasts. Only the three tag fields change (XMP-004); the decision fields
stay as the sidecar holds them. Changes waiting for the same pass are applied in order and saved
once (XMP-003.16). A sidecar answering `changed` is read again and gets the change once more. A sidecar that cannot be written is reported like a decision's (XMP-003.13); *Retry
failed sidecars* applies the same change again.

**Files moved back.** Files put back into the cull (an undone delete) have their stored tags read.

## Acceptance criteria

### TAGS-002.1 – The stored tags are read when the cull opens

- **Given** a pair whose RAW has the stored tag `Places/Lisbon` and whose JPEG has `People/Anna`
- **When** the cull opens
- **Then** the picture's tags are `People/Anna` and `Places/Lisbon`, and the tags of every member
  of the cull were looked up in one request

### TAGS-002.2 – A picture with nothing stored takes over its sidecars' tags

- **Given** a pair without a stored decision or tags whose RAW's sidecar holds `Places/Lisbon` and
  whose JPEG's sidecar holds `People/Anna`
- **When** the cull opens
- **Then** the picture shows both tags, they are stored for both members in one save, and no
  sidecar is saved

### TAGS-002.3 – Stored tags win

- **Given** a picture without a stored decision but with stored tags, and a sidecar with other tags
- **When** the cull opens
- **Then** the picture keeps its stored tags and nothing is stored for it

### TAGS-002.4 – Tags given meanwhile win over the sidecars

- **Given** a picture whose sidecar lookup has not answered yet
- **When** the user tags it and the lookup then answers with other tags
- **Then** the picture keeps the user's tags and the sidecars' tags are not stored

### TAGS-002.5 – A tag the storage cannot hold is left out

- **Given** sidecar tags of which one is over 255 characters, and a sidecar with 101 tags
- **When** they are taken over
- **Then** the long tag and the last tag in sort order are left out and each is logged as a warning;
  the others are stored

### TAGS-002.6 – A failed read takes nothing over

- **Given** a tag lookup that fails
- **When** the cull opens
- **Then** the error is logged, the pictures show as untagged, the decisions still load and no
  sidecar tags are stored

### TAGS-002.7 – A tag change is shown and stored for every member

- **Given** a pair whose RAW has `Places/Lisbon` and whose JPEG has none
- **When** the user adds `Events/Wedding` and removes `Places/Lisbon`
- **Then** the picture shows `Events/Wedding` at once and both members are stored with it in one
  save

### TAGS-002.8 – A failed save puts the tags back and writes nothing

- **Given** a tag change whose save fails
- **When** the user makes it
- **Then** the picture shows its tags from before, the error is logged and no sidecar is looked up
  or saved

### TAGS-002.9 – A tag change is written through

- **Given** a pair outside a shared folder with sidecars holding `Places/Lisbon` and, added by
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

### TAGS-002.12 – Nothing is written through in a shared folder

- **Given** a picture with a member in a shared folder
- **When** the user tags it
- **Then** the tags are stored and no sidecar is looked up or saved

### TAGS-002.13 – A failed sidecar is retried with the same change

- **Given** a tag change whose sidecar answers `notPermitted`
- **When** the write finishes and the user chooses *Retry failed sidecars*
- **Then** the toast and report of XMP-003.13 appear, and the retry writes the same change to that
  sidecar

### TAGS-002.14 – Files moved back have their tags read

- **Given** a deleted picture with stored tags
- **When** its files are put back into the cull
- **Then** their stored tags are read and the picture shows them

### TAGS-002.15 – The JPEG's embedded tags are taken over

- **Given** a pair without a stored decision or tags whose RAW's sidecar holds `People/Anna` and
  whose JPEG has no sidecar of its own and embeds `Places/Lisbon`
- **When** the cull opens
- **Then** the picture shows both tags and stores them for both members; only that JPEG's embedded
  XMP was looked up

### TAGS-002.16 – A sidecar of the JPEG replaces its embedded XMP

- **Given** pictures without a stored decision or tags, one with `<JPEG file>.xmp`, one with the
  shared `<base name>.xmp`, one a RAW alone, one a HEIC, and one with stored tags
- **When** the cull opens
- **Then** no embedded XMP is looked up

### TAGS-002.17 – A failed embedded lookup takes no tags over

- **Given** pictures whose JPEGs embed tags, one answering `notPermitted`, and then a lookup
  request that fails
- **When** the cull opens
- **Then** a warning is logged, the picture that failed takes no tags over while the others do,
  and after the failed request no picture takes tags over while their decisions still are

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

### TAGS-002.21 – Tag saves go one at a time

- **Given** a tag save in flight
- **When** the user changes the same picture's tags twice meanwhile and the first save then fails
- **Then** one more save follows with the newest tags of each file; once it is stored the picture
  keeps those tags, and when it fails too the picture shows the tags it had before the first

## Out of scope

- The tag entry, undo, toasts and the tag list in the UI: TAGS-003; multi-select by long-press
  (*Tags 3*); filter, tile and info panel (*Tags 4*).
- Writing tags in shared folders: the ⋯ menu's *Write decisions to sidecars…* writes decisions
  only.
- Re-reading sidecars another program changed after the take-over, as for decisions (XMP-003).

## History

| Date | Change |
|---|---|
| 2026-11-13 | Written with *Tags 1*: take-over from sidecars and write-through |
| 2026-11-13 | The JPEG's embedded XMP as one more source (*Tags 1b*, .15–.20) |
| 2026-11-14 | Tag saves go one at a time, the newest tags per file (.21) |
| 2026-11-14 | Tag changes waiting for one sidecar pass are saved once (XMP-003.16) |
