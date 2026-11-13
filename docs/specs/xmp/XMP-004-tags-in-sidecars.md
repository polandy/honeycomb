# XMP-004 – Tags in sidecars

- Status: implemented
- Area: xmp
- Origin: `docs/07-tags.md` (decisions D1, D2, D9 of 2026-11-12), `docs/06-xmp-interop.md`
- Depends on: XMP-001

## Purpose

Reads a picture's tags from its sidecars in digiKam's fields and writes a tag change back, so
digiKam, darktable and Lightroom see honeycomb's tags and honeycomb sees theirs. The module is
pure: storing tags, the endpoints and the tag entry belong to later steps of `docs/07-tags.md`.

## Behaviour

**A tag** is a path of names, `Places/Italy/Dolomites`. Typed text becomes a tag by trimming each
name; text with an empty name or a `|` is not a tag. A tag's **leaf** is its last name.

**Reading** takes the first of these fields that holds at least one tag: `digiKam:TagsList`
(names split at `/`), `lr:hierarchicalSubject` (split at `|`), `dc:subject` (each keyword one tag
without parents). A character a field cannot hold in a name (`|` in `TagsList`, `/` in
`hierarchicalSubject`, both in `dc:subject`) is read as `\`, as digiKam does; names are trimmed,
empty names dropped, and an item without a name is skipped. A field that is a single text is read
as one item. A picture's tags are the union of the tags of all its sources, sorted (D2).

**Writing** applies a change (tags added, tags removed) to the union of the sources as they are at
that moment, and writes the same set to each sidecar:

| Property | Value |
|---|---|
| `digiKam:TagsList` | `rdf:Seq` of the paths, sorted, `/` |
| `lr:hierarchicalSubject` | `rdf:Bag` of the paths with `\|` |
| `dc:subject` | `rdf:Bag`: the keywords already there that are not only the leaf of a removed tag, each once, in their order, then the leaves of the tags not yet among them |

With no tags left, `TagsList` and `hierarchicalSubject` are removed, and `dc:subject` keeps only
the foreign keywords or is removed when none is left. Every other property is kept.

## Acceptance criteria

### XMP-004.1 – Typed text becomes a tag

- **Given** ` Places / Italy /Bolzano `, `Anna`, `Places//Italy`, `a|b`, and blank text
- **When** each is made a tag
- **Then** the first two are `Places/Italy/Bolzano` and `Anna`; the others are not tags

### XMP-004.2 – The leaf

- **Given** the tags `Places/Italy/Dolomites` and `Anna`
- **When** their leaves are taken
- **Then** they are `Dolomites` and `Anna`

### XMP-004.3 – The first field with a tag wins

- **Given** sidecars with `TagsList`, `hierarchicalSubject` and `dc:subject` that disagree, with an
  empty `TagsList` before a `hierarchicalSubject`, and with only `dc:subject`
- **When** their tags are read
- **Then** `TagsList` wins over the others, an empty field is passed over, and a keyword of
  `dc:subject` is a tag without parents

### XMP-004.4 – Separators and names

- **Given** `Places/Lake | Shore` in `TagsList`, `People|AC/DC` in `hierarchicalSubject`,
  `a/b` in `dc:subject`, a name with spaces around it, `a//b`, an item of only `/`, and a field
  that is one text instead of an array
- **When** the tags are read
- **Then** they are `Places/Lake \ Shore`, `People/AC\DC`, `a\b`, the trimmed name, `a/b`; the
  item of only `/` is skipped, and the single text is one tag

### XMP-004.5 – A picture's tags are the union of its sources

- **Given** a RAW member's sidecar with `Places/Lisbon`, a JPEG's sidecar with `People/Anna`, and
  embedded XMP with `Places/Lisbon`
- **When** the picture's tags are read
- **Then** they are `People/Anna` and `Places/Lisbon`, each once, sorted

### XMP-004.6 – A change applies to the current tags

- **Given** sources holding `Places/Lisbon` and `People/Anna`, where `People/Anna` was added by
  another program after honeycomb listed the picture
- **When** the change *add `Events/Wedding`, remove `Places/Lisbon`* is written
- **Then** each sidecar gets `Events/Wedding` and `People/Anna`; the tag the other program added
  survives

### XMP-004.7 – The fields written

- **Given** a sidecar and the tags `Places/Italy/Dolomites` and `People/Anna`
- **When** they are written and the sidecar is serialized and read again
- **Then** `TagsList` is an `rdf:Seq` of the sorted paths, `hierarchicalSubject` an `rdf:Bag` of
  the paths with `|`, and `dc:subject` an `rdf:Bag` holding `Anna` and `Dolomites`; the parents are
  not written as tags of their own

### XMP-004.8 – Foreign keywords are kept

- **Given** a `dc:subject` holding `sunset` (no tag), `Anna` and `Lisbon`, and the tag
  `Places/Lisbon` removed while `People/Anna` stays
- **When** the change is written
- **Then** `dc:subject` holds `sunset` and `Anna`, in their order, and not `Lisbon` (D9)

### XMP-004.9 – No tags left

- **Given** a sidecar with one tag and a foreign keyword, and one with one tag and no other
  keyword
- **When** the tag is removed
- **Then** `TagsList` and `hierarchicalSubject` are gone; `dc:subject` holds only the foreign
  keyword in the first, and is gone in the second

### XMP-004.10 – Other properties survive

- **Given** `digikam.xmp` with its decision and a `MicrosoftPhoto:LastKeywordXMP`
- **When** a tag change is written
- **Then** every property but the three tag fields is unchanged, field 2 included

## Out of scope

- Storing tags, the tag list, the endpoints and the write-through on a change: step 3 of
  `docs/07-tags.md`. Reading the embedded XMP out of a JPEG: the same step.
- The tag entry, bulk tagging, the tag filter, the tile and the info panel: steps 4 and 5.

## History

| Date | Change |
|---|---|
| 2026-11-13 | Created and implemented with step 2 of `docs/07-tags.md` |
