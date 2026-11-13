# XMP-001 – Sidecar model and decision mapping

- Status: implemented
- Area: xmp
- Origin: `docs/plan.md` M5, `docs/06-xmp-interop.md`, ADR 0005, ADR 0008, ADR 0016, Framehive CORE-009
- Depends on: LISTING-002, DECISIONS-001

## Purpose

Turns the bytes of an XMP sidecar into a picture's decision, and a decision into the bytes of the
merged sidecar, so digiKam, darktable and Lightroom see what honeycomb decided and honeycomb takes
over what they decided. The module is pure: reading the files, the backend's checked save and
when a sidecar is read or written belong to later specs.

## Behaviour

**Reading** parses a sidecar into the XMP data model of ISO 16684-1 (simple values, structs,
arrays, qualifiers, language alternatives), each property keyed by namespace URI and name. Every
RDF form gives the same model. A sidecar is refused, with the reason and, for malformed XML, the
line and column, when it is not UTF-8, not well-formed, has a `<!DOCTYPE>` or gives one property
two different values.

**One sidecar → one decision** takes each value from the first valid source, in the order of
[`06-xmp-interop.md`](../../06-xmp-interop.md#reading). **Several sidecars of one picture:** the
most recently modified wins as a whole, a tie goes to the RAW member's sidecar, and a
disagreement is reported. A refused sidecar is reported and does not count. darktable duplicates
(`IMG_0001_01.NEF.xmp`) are neither read nor written.

**Writing** merges a decision into a sidecar's model: only the properties of
[`06-xmp-interop.md`](../../06-xmp-interop.md#writing) change, every other property, qualifier and
value text stays. The result is serialized in Framehive's canonical form (CORE-009 "Writing") with
`xmp:MetadataDate` from the given time and offset. The targets of a picture are every sidecar it
has, else one new `<member file>.xmp` per member.

## Acceptance criteria

### XMP-001.1 – Every RDF form gives the same model

- **Given** sidecars stating `dc:title`, `dc:subject`, `xmp:Rating` and a struct as attributes, as
  elements, with nested `rdf:Description`, with `rdf:parseType="Resource"`, with an `rdf:value`
  qualifier form and split over two `rdf:Description` elements
- **When** each is read
- **Then** all give the same model

### XMP-001.2 – Wrapper and root forms

- **Given** one packet with an `<?xpacket?>` wrapper and padding, inside `x:xmpmeta` without a
  wrapper, and as a bare `rdf:RDF` root after a UTF-8 byte order mark
- **When** each is read
- **Then** all give the same model

### XMP-001.3 – Malformed XML is refused

- **Given** a sidecar whose `rdf:Description` is not closed
- **When** it is read
- **Then** it is refused with the line and column

### XMP-001.4 – A document type declaration is refused

- **Given** a sidecar with a `<!DOCTYPE>` that declares an entity used in a value
- **When** it is read
- **Then** it is refused naming the document type, and the entity is never expanded

### XMP-001.5 – Bytes that are not UTF-8 are refused

- **Given** a sidecar in UTF-16, and one with an invalid UTF-8 byte
- **When** each is read
- **Then** it is refused as not UTF-8

### XMP-001.6 – Conflicting values are refused

- **Given** `conflict.xmp`, whose two `rdf:Description` elements give `xmp:Rating` 2 and 4
- **When** it is read
- **Then** it is refused naming `xmp:Rating`

### XMP-001.7 – The test vectors give their decisions

- **Given** each fixture in `tests/fixtures/xmp/`
- **When** its decision is read
- **Then** rating, flag and colour label equal `expected.json`

### XMP-001.8 – Flag precedence

- **Given** sidecars with `digiKam:PickLabel` 0–3, `xmpDM:pick` 1, 0 and −1, `xmpDM:good` in any
  case, `xmp:Rating` −1, and combinations of them
- **When** the flag is read
- **Then** the first valid source in the order PickLabel, pick (0 skipped), good, rating −1 decides;
  PickLabel 2 (pending) gives *unflagged*; none gives *unflagged*

### XMP-001.9 – Rating

- **Given** `xmp:Rating` 4, 2.5, −1, 7, `abc` and none
- **When** the rating is read
- **Then** it is 4, 2, 0, 0, 0 and 0

### XMP-001.10 – Colour label precedence

- **Given** sidecars with `digiKam:ColorLabel`, `xmp:Label` with digiKam's ten texts, `NoColor`, a
  lower-case or unknown text, and `darktable:colorlabels` with one or several indexes
- **When** the colour label is read
- **Then** `digiKam:ColorLabel` wins, then a known `xmp:Label` text in exact case (`Purple` is
  magenta, `NoColor` is none), then the lowest darktable index; an unknown text is skipped

### XMP-001.11 – Keep RAW is read for a pair only

- **Given** `honeycomb:KeepRaw` `True`, `true` and `False`
- **When** it is read for a pair and for a single
- **Then** the pair is marked for `True` and `true`, not for `False`; a single is never marked

### XMP-001.12 – Several sidecars of one picture

- **Given** a pair with two sidecars that disagree
- **When** the picture's decision is read
- **Then** the more recently modified sidecar decides as a whole, a tie goes to the RAW member's
  sidecar, the disagreement is reported, and a refused sidecar is reported and skipped

### XMP-001.13 – Flags are written for digiKam, darktable and Lightroom

- **Given** a sidecar and the flags *picked*, *rejected* and *unflagged*
- **When** each is merged and written
- **Then** `digiKam:PickLabel`, `xmpDM:pick`, `xmpDM:good` and `xmp:Rating` are as in the writing
  table of `06-xmp-interop.md`: −1 rating when rejected, the three flag properties removed when
  unflagged, and an existing PickLabel 2 kept when unflagged

### XMP-001.14 – Colour labels are written

- **Given** a digiKam sidecar, a darktable sidecar without `xmp:Label`, and a darktable sidecar with
  one
- **When** each colour label and none is merged
- **Then** `digiKam:ColorLabel` is 0–9; `xmp:Label` is digiKam's text or removed, and not added to a
  darktable sidecar that lacks it; `darktable:colorlabels` becomes the one index or is removed, and
  only when the colour label changed

### XMP-001.15 – Keep RAW is written for a pair only

- **Given** a pair marked *Keep RAW*, the same pair not marked, and a single
- **When** each is merged
- **Then** `honeycomb:KeepRaw` is `True`, removed, and untouched

### XMP-001.16 – Unknown fields survive a merge

- **Given** `darktable.xmp` with its history, `lr:hierarchicalSubject` and `dc:subject`, and a
  sidecar with an unknown namespace, a struct with a qualifier and a language alternative
- **When** a decision is merged, written and read again
- **Then** every other property, qualifier and value text is unchanged

### XMP-001.17 – Canonical form

- **Given** a model and the time `2026-11-08T14:03:12+01:00`
- **When** it is serialized
- **Then** the bytes equal the checked-in `canonical.xmp`: UTF-8 without BOM, LF, a final newline,
  `x:xmpmeta` › `rdf:RDF` › one `rdf:Description rdf:about=""`, namespaces and properties by prefix
  then name, two spaces of indent, `xmp:MetadataDate` set, and no `xmp:ModifyDate` or
  `xmpMM:History` added; `xmp:CreatorTool` is kept as read

### XMP-001.18 – Serializing is deterministic

- **Given** one model built by setting the same properties in two orders
- **When** both are serialized
- **Then** the bytes are equal

### XMP-001.19 – Prefixes

- **Given** a sidecar declaring Dublin Core as `d`, an unknown namespace as `acme`, and another as
  `dc`
- **When** it is written
- **Then** Dublin Core uses `dc`, the first unknown keeps `acme`, the clashing one becomes `dc1`,
  and reading it again gives the same model

### XMP-001.20 – Write targets

- **Given** `IMG_0001.NEF` + `IMG_0001.JPG` with only `IMG_0001.NEF.xmp`, the same with only
  `IMG_0001.xmp`, and the same with `IMG_0001_01.NEF.xmp` besides
- **When** the write targets are made
- **Then** they are `IMG_0001.NEF.xmp` plus a new `IMG_0001.JPG.xmp`; just `IMG_0001.xmp`; and the
  duplicate is never a target

### XMP-001.21 – A refused sidecar is not rewritten

- **Given** a target sidecar that cannot be read
- **When** a decision is to be merged into it
- **Then** the merge fails with the reason and produces no bytes

## Out of scope

- Fetching the sidecars, the backend's checked save, when sidecars are read on listing and written
  on a decision, and *Write decisions to sidecars…* in shared folders: `TODO.md` M5.2 and M5.3.
- Tags: XMP-004. `photoshop:Urgency`, embedded XMP in JPEG or DNG.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Created and implemented with M5.1 (ADR 0016) |
