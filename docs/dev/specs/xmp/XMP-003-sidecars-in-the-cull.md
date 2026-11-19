# XMP-003 – Sidecars in the cull

- Status: implemented
- Area: xmp
- Origin: `docs/dev/plan.md` M5 and Decisions, gestures and shared folders, `docs/dev/06-xmp-interop.md`,
  ADR 0005, ADR 0017, ADR 0040
- Depends on: LISTING-001, DECISIONS-001, XMP-001, XMP-002

## Purpose

Brings the sidecars into the cull. Rating, colour label and tags are read from the picture's
sidecars and written to them at once, so digiKam, darktable and Lightroom see them. The flag and
*Keep RAW* live in the database (DECISIONS-001): a picture honeycomb sees for the first time takes
over the flag its sidecars state, once, and *Write picks/rejects to XMP* writes the flags to the
sidecars when the user asks (ADR 0040).

## Behaviour

**Concept D (ADR 0040).** There is no setting and no shared-folder rule (XMP-008); M8 PR 5 drops
the stored rows, and M8 PR 6 moves the flag and *Keep RAW* to the database: from then on a step
writes only the rating, colour label and tags through, and leaves the sidecar's flag fields and
`honeycomb:KeepRaw` as they are. **Taking over (M8 PR 6):** a picture whose members have no row in
`honeycomb_flags` takes over the flag and *Keep RAW* its sources state, by the rules of *Reading*
below, and the client sends them to the take-over endpoint (DECISIONS-001.27), as *unflagged* when
no source states one, also for a read-only picture; from then on its row holds, and a later change
in another program is not read. Rating, colour label and tags are not taken over: they are always
read from the sidecars. ***Write picks/rejects to XMP* (M8 PR 7):** the grid's ⋯ entry, shown with
the number of sidecars to write (GRID-001.21), writes the flag and *Keep RAW* of every rateable
picture of the open folder set, whatever the filters show, into each of its sidecars whose flag
fields or `honeycomb:KeepRaw` differ, as the XMP cache states them; *unflagged* removes the flag
fields except an existing digiKam `PickLabel` 2, and a member without a sidecar gets `<member
file>.xmp` only when the picture is flagged or kept. It uses the write path below, is no undo step,
and reports in one toast. Until those PRs the text below holds, and the criteria withdrawn below
hold; those from .34 on are gaps.

**Reading.** When a cull opens, and again when the pairing settings change, each picture's
sidecars (darktable duplicates excepted) and the JPEG whose embedded XMP counts (TAGS-002) are read
through the XMP cache (XMP-006): only a source without a valid row is looked up, and its new row is
stored. The embedded XMP is read as the JPEG's sidecar, at the JPEG's modification time; the
decision follows [`06-xmp-interop.md`](../../06-xmp-interop.md#reading) (newest wins as a whole, a
tie goes to the RAW member's sidecar), by the modification times the listing gives. A decision
other than undecided is shown for every member; it is neither an undo step nor written back, and
nothing is stored in the database. A picture with a stored row (until M8 PR 5 drops the table) shows
it. A picture the user decided meanwhile keeps the user's decision. A refused or unreadable sidecar,
a disagreement between sidecars and a failed lookup are logged as warnings; the picture keeps what
it shows, or takes what the sources that were read state. A failed cache lookup reads every
source; a failed cache save is logged.

**Writing through.** As soon as any attribute is set on a photo — a flag, a rating, a colour label,
*Keep RAW*, or an undo or redo of one — each picture the step touched is
written to its sidecars; a picture no step touched gets no
sidecar: every existing sidecar (darktable duplicates excepted) and, for each member without one,
a new `<member file>.xmp` (`docs/dev/06-xmp-interop.md` Sidecar
names), started from what the picture's other sidecars and embedded XMP state, the JPEG's from
what its embedded XMP states while that counts (XMP-003.23). A picture whose embedded XMP counts
has it looked up for every write; when that fails, nothing is written for the picture and its
sidecars fail as when they cannot be read. An existing sidecar is read before it
is merged, unless honeycomb saved it itself and still holds its bytes; it is saved with the ETag and
size read. A sidecar answering `changed` is read, merged and saved once more. The colour label
counts as changed for darktable's list when it differs from the one the sidecar states. Writes run
in passes, one pass at a time: the steps that come while a pass runs wait and are written together
by the next pass, so each sidecar is saved at most once per pass, with the decision fields its steps
changed, valued as the picture's decision when the pass starts, and the tag changes of its steps in
order (TAGS-002). Those fields are a delta: per sidecar it is applied to the decision that sidecar
states, so a field no step changed keeps each sidecar's own value (`06-xmp-interop.md` Writing, ADR
0032). A sidecar the pass would leave as it is, apart from `xmp:MetadataDate`, is not saved. Each
saved sidecar's row is stored in the XMP cache (XMP-006.10).

**Bundling per picture.** The steps on one picture wait and are written together, in one pass, when
the user leaves the picture — a step on another picture, or the loupe showing another picture or
closing — or when 2 s pass without another step on it, timed by an injected scheduler (ADR 0032).
A step on several pictures at once (a selection, *Pick, reject the rest*, the migration, a retry)
writes the waiting picture and its own pictures at once. A waiting picture shows the *Not saved
yet* marker on its tile. The page going hidden (`visibilitychange`) or away (`pagehide`) writes
the waiting picture at once, best effort; a delete, *Remove RAWs* and a move write it, and wait for
every write in flight, before they send their first request. A step undone while it waits leaves
the sidecars as they state, so no sidecar is saved for it (XMP-003.17).

**Requests.** The client packs sidecar lookups into requests of at most 1,000 file ids and 8 MiB by
the sizes the listing states, and saves into requests of at most 1,000 sidecars and 8 MiB of
content; one sidecar over 8 MiB goes alone. The server keeps no byte budget of its own.

**Shared folders.** A picture in a shared folder is decided and written like any other rateable
picture, without asking (ADR 0040).

**Failure report.** A sidecar that could not be written — refused when read (not UTF-8, malformed,
a `<!DOCTYPE>`, a property given twice), a lookup or save answer other than `read` or `saved`, or a
request that failed — is reported per file. After a write with failures a toast says *Could not
write %n sidecars* and the reason of most of them in the user's words, one specific text per
reason the server or the client gives, and *More reasons in Details* when they differ; its action
*Details* which opens a dialog listing each file and its reason
and offering *Retry failed sidecars*; a retry writes the failed files again, each with its
picture's decision when it runs, for the fields its write changed. A refused sidecar is never overwritten.

## Acceptance criteria

### XMP-003.1 – A picture shows its sidecars' decision

Withdrawn by ADR 0040; M8 PR 6 marks it removed.

- **Given** a pair without legacy rows whose sidecar says three stars and rejected
- **When** the cull opens
- **Then** the picture shows three stars and rejected for both members, and no decision or tag is
  saved to the legacy tables

### XMP-003.2 – A stored row wins over the sidecar

Withdrawn by ADR 0040; M8 PR 5 marks it removed with the table.

- **Given** a picture with a stored decision and a sidecar that says otherwise
- **When** the cull opens
- **Then** it shows the stored decision, and the picture stays rateable

### XMP-003.3 – A decision made meanwhile wins over the sidecar

- **Given** a picture without a stored decision whose sidecar lookup has not answered yet
- **When** the user decides it and the lookup then answers
- **Then** the picture keeps the user's decision

### XMP-003.4 – Nothing to take over leaves the picture as it is

- **Given** pictures whose sidecars state undecided, are refused, answer other than `read`, or
  whose lookup fails
- **When** the cull opens
- **Then** they stay undecided, and refusals, failures and disagreements are logged as warnings

### XMP-003.5 – A decision read is not an undo step and is not written back

- **Given** a picture that shows its sidecar's decision
- **When** the user presses undo
- **Then** undo has nothing to take back and no sidecar is saved

### XMP-003.6 – A decision is written through to every existing sidecar

Withdrawn by ADR 0040; M8 PR 6 marks it removed.

- **Given** a rateable pair with `IMG_0001.NEF.xmp` and `IMG_0001.JPG.xmp`
- **When** the user picks it
- **Then** both sidecars are read, merged with the pick and saved with the ETag and size read

### XMP-003.7 – A member without a sidecar gets `<member file>.xmp`

- **Given** a rateable pair without sidecars
- **When** the user rates it
- **Then** `IMG_0001.NEF.xmp` and `IMG_0001.JPG.xmp` are created with the rating, and the next
  write to them saves over the created files without looking them up

### XMP-003.8 – A sidecar changed meanwhile is read and merged again

- **Given** a sidecar whose save answers `changed`
- **When** the decision is written through
- **Then** the sidecar is read again, merged again and saved once more

### XMP-003.9 – Writes run in order with the current decision

- **Given** two decisions on one picture in a row, the first still being written
- **When** the first write finishes
- **Then** the second write starts only then, and writes the picture's decision of that moment

### XMP-003.16 – The steps waiting behind a pass are written together

- **Given** a pass still being written, and meanwhile three decisions and a tag change on one
  picture
- **When** the pass finishes
- **Then** one more pass saves each sidecar of the picture once, with its decision of that moment
  and the tag change; each step's write answers with the failures of its own pictures

### XMP-003.17 – A sidecar the write would not change is not saved

- **Given** a sidecar that already states the picture's decision, or the tags a change leaves
- **When** the decision or the tag change is written through
- **Then** that sidecar is not saved and counts as written; a sidecar that differs is saved

### XMP-003.10 – A failed decision save writes nothing (removed)

The cull saves no decision to the database any more (ADR 0032, XMP-006.7); a failed sidecar write
is reported (XMP-003.13).

### XMP-003.11 – Nothing is written in an unconfirmed shared folder (removed)

Withdrawn by ADR 0040 (M8 PR 3); there is no switch and no shared-folder rule (XMP-008.12).

### XMP-003.12 – The ⋯ menu writes to sidecars in shared folders after asking (removed)

Replaced by XMP-007.5, which the removal of the migration (M8 PR 4) took away again.

### XMP-003.13 – A failed sidecar is reported per file

- **Given** a write where one sidecar is refused as malformed and another answers `notPermitted`
- **When** the write finishes
- **Then** the refused sidecar is not saved, a toast says *Could not write 2 sidecars* with the
  first reason and *More reasons in Details*, with *Details*; the dialog lists both files with
  their reasons, and *Retry failed sidecars* writes their pictures again

### XMP-003.14 – The client reads the listing's shared folders (removed)

Withdrawn by ADR 0040 (M8 PR 3); there is no switch and no shared-folder rule (XMP-008.12).

### XMP-003.15 – Every attribute writes through, and only for the touched picture

Withdrawn by ADR 0040; M8 PR 6 marks it removed.

- **Given** a cull of rateable pictures
- **When** the user flags, rates, labels or keeps the RAW of one picture
- **Then** that picture alone is written to its sidecars; the others get none

### XMP-003.18 – Off by default, nothing is decided or written (removed)

Withdrawn by ADR 0040 (M8 PR 3); there is no switch and no shared-folder rule (XMP-008.12).

### XMP-003.19 – *Only existing sidecars* creates none (removed)

ADR 0032 leaves *Off* and *On*; *On* creates every missing sidecar, and a stored *Only existing
sidecars* reads as *Off* (SETTINGS-001.26).

### XMP-003.20 – A step writes only the fields it changed

- **Given** a picture whose sidecar states green while honeycomb shows no
  colour label
- **When** the user rates it, then undoes the rating
- **Then** each write carries only the rating, and the sidecar keeps green

### XMP-003.21 – A new sidecar starts from what the picture's sidecars state

Withdrawn by ADR 0040; M8 PR 6 marks it removed.

- **Given** a pair whose `IMG_0001.NEF.xmp` states three stars and red,
  and no `IMG_0001.JPG.xmp`
- **When** the user rejects it
- **Then** `IMG_0001.JPG.xmp` is created with three stars, red and rejected; held bytes honeycomb
  saved count before read ones, and without any sidecar the delta applies to undecided

### XMP-003.22 – The JPEG's embedded XMP is a source of the decision taken over

- **Given** a JPEG without a sidecar whose embedded XMP states three stars and red, and a pair
  whose `IMG_0001.NEF.xmp` states one star and whose JPEG, modified later, embeds four stars and
  picked
- **When** the cull opens
- **Then** the JPEG shows three stars and red and the pair four stars and picked, also while the
  legacy tags are unknown; with the sidecar modified later the pair shows one star; an embedded
  XMP that is refused or not read is logged as a warning, and the picture takes over what its
  sidecars state

### XMP-003.23 – A new JPEG sidecar takes over the embedded decision

Withdrawn by ADR 0040; M8 PR 6 marks it removed.

- **Given** a pair whose `IMG_0001.NEF.xmp` states one star and whose
  JPEG embeds four stars and green, without `IMG_0001.JPG.xmp`
- **When** the user picks it
- **Then** `IMG_0001.NEF.xmp` gets one star and picked, and `IMG_0001.JPG.xmp` is created with four
  stars, green and picked; a new RAW sidecar of a pair with only the embedded XMP starts from it,
  and a tag change that creates the JPEG's sidecar writes the embedded decision into it

### XMP-003.24 – A failed embedded lookup writes nothing for the picture

- **Given** a decision for a picture whose JPEG has no sidecar and whose embedded XMP lookup fails
- **When** it is written through
- **Then** no sidecar of the picture is saved, and each is reported with the lookup's reason

### XMP-003.25 – One picture's steps are written together when the user leaves it

- **Given** the loupe on a picture
- **When** the user rates, flags and labels it, then the loupe shows the next picture
- **Then** nothing is saved before the loupe moves on; then one pass saves each sidecar of the
  picture once, with all three changes

### XMP-003.26 – A picture left alone is written after 2 s

- **Given** a step on one picture
- **When** 2 s pass without another step on it
- **Then** its sidecars are written; each further step on it starts the 2 s again

### XMP-003.27 – A step on another picture or on several writes the waiting one at once

- **Given** a step waiting on one picture
- **When** the user decides another picture
- **Then** the waiting picture is written at once and the other one waits
- **When** the user decides several pictures in one step instead
- **Then** the waiting picture and the step's pictures are written at once and none waits

### XMP-003.28 – A waiting picture shows a marker

- **Given** a step waiting on one picture
- **When** the grid shows it
- **Then** its tile shows the *Not saved yet* marker, also in its label, until its write starts;
  the loupe shows it too (LOUPE-001.27)

### XMP-003.29 – Hiding the page writes the waiting picture

- **Given** a step waiting on one picture
- **When** the page turns hidden or is left
- **Then** the picture is written at once

### XMP-003.30 – Deleting and moving write first

- **Given** a step waiting on one picture, or a write in flight
- **When** the user confirms a delete, *Remove RAWs* or a move
- **Then** the waiting picture is written and every write has finished before the trash or move
  request is sent

### XMP-003.31 – A step undone while it waits saves no sidecar

- **Given** a picture whose sidecars honeycomb saved last
- **When** the user rates it and undoes the rating before it is written
- **Then** no sidecar is looked up or saved

### XMP-003.32 – Requests are packed by count and size

- **Given** sidecars to look up or save
- **When** the requests are sent
- **Then** each carries at most 1,000 sidecars and 8 MiB, by the listed size for a lookup and the
  content for a save, cut in the order given; one sidecar over 8 MiB goes alone

### XMP-003.33 – Every refusal is named in its own words

- **Given** a write that failed for one reason: a save answer (`notFound`, `changed`, `noSpace`,
  `notPermitted`, `locked`, `failed`), a lookup answer (`tooLarge` too), an XMP refusal or a failed
  request
- **When** the toast reports it
- **Then** it says *Could not write 1 sidecar.* and a text for that reason alone, never a generic
  one nor the server's raw text

### XMP-003.34 – A picture seen for the first time takes over its flag once (gap)

- **Given** a pair without rows whose `IMG_0001.NEF.xmp` states three stars and rejected, and a
  JPEG without rows and without any source
- **When** the cull opens
- **Then** the pair shows three stars and rejected and is taken over as *rejected*, the JPEG as
  *unflagged*, in one take-over request; nothing is written to a sidecar

### XMP-003.35 – After taking over the row holds (gap)

- **Given** a pair taken over as *rejected*, whose sidecar another program then changes to four
  stars and picked
- **When** the cull opens again
- **Then** the pair shows four stars and rejected, and no take-over is sent for it

### XMP-003.36 – A reader takes over too (gap)

- **Given** a read-only picture without rows whose sidecar states picked
- **When** the cull opens
- **Then** it shows picked and is taken over as *picked*; a failed take-over is logged and the
  picture shows what its sources state

### XMP-003.37 – A rating, colour label or tag leaves the flag fields alone (gap)

- **Given** a sidecar stating `digiKam:PickLabel` 3 and *Keep RAW*, of a picture whose row says
  *rejected*
- **When** the user rates it, labels it or changes its tags
- **Then** the sidecar gets the new field and keeps `digiKam:PickLabel` 3 and `honeycomb:KeepRaw`
  as they were

### XMP-003.38 – A flag goes to the database only (gap)

- **Given** a rateable pair with `IMG_0001.NEF.xmp` and without `IMG_0001.JPG.xmp`
- **When** the user picks it, marks it *Keep RAW*, or undoes either
- **Then** both members' rows are saved with the new state, and no sidecar is looked up, saved or
  created

### XMP-003.39 – *Write picks/rejects to XMP* writes what differs, in the whole folder set (gap)

- **Given** an open folder set of two folders with a filter showing picked only, a rejected
  picture whose sidecar states picked, and a picked picture whose sidecar states picked
- **When** the user chooses *Write picks/rejects to XMP*
- **Then** the first sidecar gets the reject fields, also though the filter hides it, and the
  second is not saved

### XMP-003.40 – *Unflagged* removes the flag fields (gap)

- **Given** an *unflagged* picture whose sidecar states `xmpDM:pick` 1, and one whose sidecar
  states `digiKam:PickLabel` 2
- **When** the user writes picks and rejects to XMP
- **Then** the first sidecar loses its flag fields, the second keeps `PickLabel` 2 and is not
  saved

### XMP-003.41 – A sidecar is created only for a flagged or kept picture (gap)

- **Given** a picked pair without sidecars and an *unflagged* pair without sidecars and without
  *Keep RAW*
- **When** the user writes picks and rejects to XMP
- **Then** the picked pair gets `IMG_0001.NEF.xmp` and `IMG_0001.JPG.xmp`, started from what its
  embedded XMP states; the other pair gets none

### XMP-003.42 – The export reports in one toast and is no undo step (gap)

- **Given** an export of 214 differing sidecars, 3 of them in a read-only folder, then one with
  nothing to write
- **When** each finishes
- **Then** the first toast says *211 XMP files written, 3 not written: read only* with *Details*,
  the second *All XMP files are up to date*; undo afterwards takes back the step before the
  export, and no sidecar

## Out of scope

- Re-reading a sidecar that another program changes while the cull is open; the next visit reads
  it, by its new ETag (XMP-006.7).
- The *Storage* setting of the mockup (database, sidecars or both); the sidecars hold the decisions
  (ADR 0032).

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written with M5.3 |
| 2026-11-10 | Any attribute writes through, never for an untouched picture; shared folders widened (owner review) |
| 2026-11-14 | Writes waiting behind a pass are written together; an unchanged sidecar is not saved (.16, .17) |
| 2026-11-15 | Writing through is opt-in, *Off* by default; *Only existing sidecars* creates none (.18, .19; risk review R1, R9) |
| 2026-11-15 | A step writes the fields it changed, as a delta on each sidecar's decision (.20, .21, ADR 0032) |
| 2026-11-15 | The JPEG's embedded XMP is a source of the decision; a new JPEG sidecar takes it over (.22–.24, ADR 0032 PR 3) |
| 2026-11-15 | The ⋯ entry migrates every picture with legacy rows (.12 removed, XMP-007, ADR 0032 PR 5) |
| 2026-11-15 | *Off* and *On*; a locked picture is not decided, a shared folder is confirmed (.11, .18 changed, .19 removed, XMP-008, ADR 0032 PR 6) |
| 2026-11-15 | Steps are written per picture when the user leaves it or after 2 s; requests packed by count and size (.25–.32, ADR 0032 PR 7) |
| 2026-11-16 | A delete or move also waits for the write of a step whose save has not answered (.30) |
| 2026-11-18 | The failure toast names the reason, one text per reason (.13 changed, .33; owner decision on #221 (c)) |
| 2026-11-18 | The cull reads through the XMP cache and stores no legacy rows; a legacy row wins, locked, until migrated (.1–.5, .11, .18, .30 changed, .10 removed, ADR 0032) |
| 2026-11-19 | ADR 0040: flags taken over once and written only by *Write picks/rejects to XMP*; ratings, labels and tags leave the flag fields (.1, .2, .6, .11, .14, .15, .18, .21, .23 withdrawn; .34–.42 gaps) |
| 2026-11-19 | M8 PR 3: no setting and no shared-folder confirmation (.11, .14, .18 removed) |
| 2026-11-19 | M8 PR 4: the migration is gone; a stored row no longer locks its picture (.2 changed, .12 note) |
