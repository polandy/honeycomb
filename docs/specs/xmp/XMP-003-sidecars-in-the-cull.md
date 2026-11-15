# XMP-003 – Sidecars in the cull

- Status: implemented
- Area: xmp
- Origin: `docs/plan.md` M5 and Decisions, gestures and shared folders, `docs/06-xmp-interop.md`,
  ADR 0005, ADR 0017
- Depends on: LISTING-001, DECISIONS-001, XMP-001, XMP-002

## Purpose

Brings the sidecars into the cull: a picture honeycomb has no decision for takes over the decision
its sidecars state, and, once the user opts in, every decision the user makes is written through
to the picture's sidecars, so digiKam, darktable and Lightroom see it. By default nothing is
written. In a shared folder nothing is written on its own; the user writes there explicitly, after
being asked.

## Behaviour

**Taking over.** When a cull opens, and again when the pairing settings change, the stored
decisions are read first. Each picture with no stored decision for any member and with sidecars
(darktable duplicates excepted) or a JPEG whose embedded XMP counts (TAGS-002) has them looked up;
the embedded XMP is read as the JPEG's sidecar, at the JPEG's modification time; their decision follows
[`06-xmp-interop.md`](../../06-xmp-interop.md#reading) (newest wins as a whole, a tie goes to the
RAW member's sidecar). A decision other than undecided is shown and stored for every member, as one
save that is neither an undo step nor written back to the sidecars. A picture the user decided
meanwhile keeps the user's decision. A refused or unreadable sidecar, a disagreement between
sidecars and a failed lookup are logged as warnings; the picture keeps what it shows, or takes over
what the sources that were read state.

**The setting.** *Write decisions to XMP sidecars* (SETTINGS-001.24) is *Off* by default, for
every user, also one who culled before it existed. Off, no decision or tag is made: the first
attempt asks to turn it *On* (XMP-008); taking over still reads the sidecars. *On* writes through
as below.

**Writing through.** As soon as any attribute is set on a photo — a flag, a rating, a colour label,
*Keep RAW*, or an undo or redo of one — and the step is stored, each picture the step touched is
written to its sidecars; a picture no step touched gets no
sidecar: every existing sidecar (darktable duplicates excepted) and, for each member without one,
a new `<member file>.xmp` (`docs/06-xmp-interop.md` Sidecar
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
0032). A sidecar the pass would leave as it is, apart from `xmp:MetadataDate`, is not saved. A step
whose save fails writes nothing.

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

**Shared folders.** The listing says per folder whether it is shared (ADR 0017). A picture of the
cull in a shared folder is decided only once the user confirmed the opened folder (XMP-008.4).
The grid's ⋯ menu
entry *Write decisions to sidecars…* writes every picture with legacy rows after asking, in shared
folders too (XMP-007).

**Failure report.** A sidecar that could not be written — refused when read (not UTF-8, malformed,
a `<!DOCTYPE>`, a property given twice), a lookup or save answer other than `read` or `saved`, or a
request that failed — is reported per file. After a write with failures a toast says *Could not
write %n sidecars* with the action *Details*, which opens a dialog listing each file and its reason
and offering *Retry failed sidecars*; a retry writes the failed files again, each with its
picture's decision when it runs, for the fields its write changed. A refused sidecar is never overwritten.

## Acceptance criteria

### XMP-003.1 – A picture without a stored decision takes over its sidecars' decision

- **Given** a pair without a stored decision whose sidecar says three stars and rejected
- **When** the cull opens
- **Then** the picture shows three stars and rejected, and that decision is stored for both
  members in one save

### XMP-003.2 – A stored decision wins

- **Given** a picture with a stored decision and a sidecar that says otherwise
- **When** the cull opens
- **Then** its sidecars are not looked up and it shows the stored decision

### XMP-003.3 – A decision made meanwhile wins over the sidecar

- **Given** a picture without a stored decision whose sidecar lookup has not answered yet
- **When** the user decides it and the lookup then answers
- **Then** the picture keeps the user's decision

### XMP-003.4 – Nothing to take over leaves the picture as it is

- **Given** pictures whose sidecars state undecided, are refused, answer other than `read`, or
  whose lookup fails
- **When** the cull opens
- **Then** they stay undecided, nothing is stored for them, and refusals, failures and
  disagreements are logged as warnings

### XMP-003.5 – A taken-over decision is not an undo step and is not written back

- **Given** a picture that took over its sidecar's decision
- **When** the user presses undo, and when the take-over is stored
- **Then** undo has nothing to take back and no sidecar is saved

### XMP-003.6 – A decision is written through to every existing sidecar

- **Given** writing to sidecars on, a pair outside a shared folder with `IMG_0001.NEF.xmp` and `IMG_0001.JPG.xmp`
- **When** the user picks it and the decision is stored
- **Then** both sidecars are read, merged with the pick and saved with the ETag and size read

### XMP-003.7 – A member without a sidecar gets `<member file>.xmp`

- **Given** writing *On*, a pair outside a shared folder without sidecars
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

### XMP-003.10 – A failed decision save writes nothing

- **Given** a decision whose save fails
- **When** the user makes it
- **Then** no sidecar is looked up or saved

### XMP-003.11 – Nothing is written in an unconfirmed shared folder

- **Given** a picture with a member in a shared folder the user has not confirmed
- **When** the user decides it
- **Then** nothing is stored and no sidecar is looked up or saved until the user confirms the
  folder (XMP-008.4); then the decision is written through

### XMP-003.12 – The ⋯ menu writes to sidecars in shared folders after asking (removed)

Replaced by XMP-007.5: the ⋯ entry now writes every picture with legacy rows, in shared folders
and elsewhere.

### XMP-003.13 – A failed sidecar is reported per file

- **Given** a write where one sidecar is refused as malformed and another answers `notPermitted`
- **When** the write finishes
- **Then** the refused sidecar is not saved, a toast says *Could not write 2 sidecars* with
  *Details*, the dialog lists both files with their reasons, and *Retry failed sidecars* writes
  their pictures again

### XMP-003.14 – The client reads the listing's shared folders

- **Given** a listing answer with `folders` marking `/Photos/Team` shared
- **When** the cull opens on it
- **Then** pictures in `/Photos/Team` count as in a shared folder; a listing without `folders`
  counts no folder as shared

### XMP-003.15 – Every attribute writes through, and only for the touched picture

- **Given** writing to sidecars on, a cull outside a shared folder
- **When** the user flags, rates, labels or keeps the RAW of one picture
- **Then** that picture alone is written to its sidecars; the others get none

### XMP-003.18 – Off by default, nothing is decided or written

- **Given** a user without the setting stored, or with *Off*
- **When** the user decides a picture outside a shared folder or changes its tags
- **Then** nothing is stored and no sidecar is looked up or saved until the user turns writing
  *On* (XMP-008.7); a picture without a stored decision still takes over its sidecars' decision

### XMP-003.19 – *Only existing sidecars* creates none (removed)

ADR 0032 leaves *Off* and *On*; *On* creates every missing sidecar, and a stored *Only existing
sidecars* reads as *Off* (SETTINGS-001.26).

### XMP-003.20 – A step writes only the fields it changed

- **Given** writing to sidecars on, a picture whose sidecar states green while honeycomb stores no
  colour label
- **When** the user rates it, then undoes the rating
- **Then** each write carries only the rating, and the sidecar keeps green

### XMP-003.21 – A new sidecar starts from what the picture's sidecars state

- **Given** writing *On*, a pair whose `IMG_0001.NEF.xmp` states three stars and red,
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
  stored tags are unknown; with the sidecar modified later the pair shows one star; an embedded
  XMP that is refused or not read is logged as a warning, and the picture takes over what its
  sidecars state

### XMP-003.23 – A new JPEG sidecar takes over the embedded decision

- **Given** writing *On*, a pair whose `IMG_0001.NEF.xmp` states one star and whose
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

- **Given** writing *On*, the loupe on a picture
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
- **Then** its tile shows the *Not saved yet* marker, also in its label, until its write starts

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

## Out of scope

- Re-reading a sidecar that another program changed after the take-over (`06-xmp-interop.md`
  Reading); ADR 0032 replaces the take-over with the XMP cache (XMP-006) in its PR 6.
- The *Storage* setting of the mockup (database, sidecars or both); the database always holds the
  decisions, and *Write decisions to XMP sidecars* says whether they also go to the sidecars.

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
