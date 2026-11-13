# TAGS-004 – Tag filter, the tile's tags and the info panel

- Status: implemented
- Area: tags
- Origin: `docs/07-tags.md` Interaction (Tag filter, Tiles; D3, D4, D5), outline step 5;
  `docs/mockup/tag-entry.html`
- Depends on: TAGS-002, TAGS-003, GRID-001, GRID-002, LOUPE-001

## Purpose

Narrows the grid to the pictures that have chosen tags, shows on a tile that its picture is
tagged, and lists the tags in the loupe's info panel.

## Behaviour

**Tag filter.** The filter bar has a *Tags* group: the chosen tags as chips, each with ×, and
*Add tag*, which opens the tag entry to pick tags for the filter. The entry offers the known tags
(TAGS-003) except those already chosen, never *Create tag*; `Enter` takes the known tag the field
names, ignoring case, and says *Pick a known tag* for any other text. A chip's × or `Backspace`
in an empty field takes a tag out of the filter.

**Matching.** A picture passes when it has **every** chosen tag (D4), a chosen tag matching the
tag itself and every tag beneath it: `Places/Italy` matches `Places/Italy/Dolomites` (D5), not
`Places/Italyx`. A picture's tags are the union of its members' tags. With no tag chosen the
group filters nothing. Like every other group it combines with the others by AND, counts in the
filter bar's *x of y*, and *Clear filters* and a new folder set empty it.

**Count badge.** The toolbar's filter badge counts each chosen tag as one, on top of the other
active groups.

**Tile.** A tagged picture's tile shows a tag icon and the number of its tags on the marks' bottom
shade, and its label names the count; an untagged tile shows neither.

**Info panel.** The loupe's info panel has a *Tags* section below *Decision*: the picture's tags,
one per line in sort order, each as its full path, or *none*. A tagged picture's *Written to*
row names the files the tags are written through to (TAGS-002, XMP-003) by file name, each once:
its sidecars but darktable's duplicates, then the `<member file>.xmp` a write creates for each
member without one. In a shared folder nothing is written on its own, and the row says *Not
written, shared folder*. The section follows a tag change at once.

## Acceptance criteria

### TAGS-004.1 – Every chosen tag must match

- **Given** tags chosen in the tag filter
- **When** the grid filters
- **Then** only the pictures that have every chosen tag are shown; a picture whose JPEG and RAW
  together hold the tags passes

### TAGS-004.2 – A parent matches its descendants

- **Given** a parent tag chosen in the tag filter
- **When** the grid filters
- **Then** a picture with the tag or any tag beneath it passes, a picture with a tag that only
  starts with the same letters does not

### TAGS-004.3 – Picking a tag for the filter

- **Given** the filter bar
- **When** the user chooses *Add tag* and picks a match, or types a known tag in any case and
  presses `Enter`
- **Then** the tag becomes a chip of the group and the grid narrows; the entry offers no tag
  already chosen and no *Create tag*

### TAGS-004.4 – Unknown text is refused

- **Given** the filter's tag entry
- **When** the user types a tag no picture and no tag list has and presses `Enter`
- **Then** nothing is chosen and the entry says *Pick a known tag*

### TAGS-004.5 – Removing a tag from the filter

- **Given** chosen tags
- **When** the user taps a chip's ×, or presses `Backspace` in the entry's empty field
- **Then** that tag, or the last chosen, leaves the filter and the grid widens

### TAGS-004.6 – The count badge and clearing

- **Given** chosen tags
- **When** the toolbar counts the active filters, or the user chooses *Clear filters*
- **Then** each chosen tag counts as one, and clearing empties the tag filter

### TAGS-004.7 – The tile shows the tag count

- **Given** a picture with tags, and one without
- **When** the grid shows their tiles
- **Then** the tagged tile shows a tag icon and the number of its tags, its label says "2 tags";
  the untagged tile shows no tag icon

### TAGS-004.8 – The info panel lists the tags

- **Given** the loupe's info panel open on a picture with tags, and on one without
- **When** it shows the picture, and again after a tag change
- **Then** the tagged picture's *Tags* section lists each tag once by its full path in sort order
  and follows the change at once; the untagged picture's section says *none* and has no
  *Written to* row

### TAGS-004.9 – Where the tags are written

- **Given** a tagged picture with two sidecars and a darktable duplicate's, a pair with the RAW's
  sidecar only, and a picture in a shared folder
- **When** the info panel shows each
- **Then** *Written to* names the two sidecars by file name, not the duplicate's; names the RAW's
  sidecar and the JPEG's sidecar the write creates; and says *Not written, shared folder* for the
  third

## Out of scope

An *Untagged* chip and per-tag counts in the
filter (`docs/07-tags.md` Tag filter).

## History

| Date | Change |
|---|---|
| 2026-11-13 | Written with the tag filter and the tile's tags (*Tags 4*) |
| 2026-11-13 | .8, .9 the loupe's info panel lists the tags and where they are written (*Tags 4*) |
