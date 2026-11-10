# XMP-003 – Sidecars in the cull

- Status: accepted
- Area: xmp
- Origin: `docs/plan.md` M5 and Decisions, gestures and shared folders, `docs/06-xmp-interop.md`, ADR 0005, ADR 0017
- Depends on: LISTING-001, DECISIONS-001, XMP-001, XMP-002

## Purpose

Brings the sidecars into the cull: a picture honeycomb has no decision for takes over the decision
its sidecars state, and every decision the user makes is written through to the picture's
sidecars, so digiKam, darktable and Lightroom see it. In a shared folder nothing is written on its
own; the user writes there explicitly, after being asked.

## Behaviour

**Taking over.** When a cull opens, and again when the pairing settings change, the stored
decisions are read first. Each picture with no stored decision for any member and with sidecars
(darktable duplicates excepted) has them looked up; their decision follows
[`06-xmp-interop.md`](../../06-xmp-interop.md#reading) (newest wins as a whole, a tie goes to the
RAW member's sidecar). A decision other than undecided is shown and stored for every member, as one
save that is neither an undo step nor written back to the sidecars. A picture the user decided
meanwhile keeps the user's decision. A refused or unreadable sidecar, a disagreement between
sidecars and a failed lookup are logged as warnings; the picture keeps what it shows.

**Writing through.** After a step (a decision, undo, redo, *Keep RAW*) is stored, each picture it
changed is written to its sidecars unless a member lies in a shared folder: every existing sidecar
(darktable duplicates excepted) and, for each member without one, a new `<member file>.xmp`
(`docs/06-xmp-interop.md` Sidecar names). An existing sidecar is read before it is merged, unless
honeycomb saved it itself and still holds its bytes; it is saved with the ETag and size read. A
sidecar answering `changed` is read, merged and saved once more. The colour label counts as changed
for darktable's list when it differs from the one the sidecar states. Writes run one after another
in the order of the steps, each with the picture's decision when it runs. A step whose save fails
writes nothing.

**Shared folders.** The listing says per folder whether it is shared (ADR 0017). When a picture of
the cull lies in a shared folder, the grid's ⋯ menu offers *Write decisions to sidecars…*. It asks
first, names the number of photos and their folders, and on *Write to sidecars* writes every
picture in a shared folder that has a stored decision, as above. Success says *Wrote the decisions
of %n photos to sidecars*.

**Failure report.** A sidecar that could not be written — refused when read (not UTF-8, malformed,
a `<!DOCTYPE>`, a property given twice), a lookup or save answer other than `read` or `saved`, or a
request that failed — is reported per file. After a write with failures a toast says *Could not
write %n sidecars* with the action *Details*, which opens a dialog listing each file and its reason
and offering *Retry failed sidecars*; a retry writes the pictures of the failed files again. A
refused sidecar is never overwritten.

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

- **Given** a pair outside a shared folder with `IMG_0001.NEF.xmp` and `IMG_0001.JPG.xmp`
- **When** the user picks it and the decision is stored
- **Then** both sidecars are read, merged with the pick and saved with the ETag and size read

### XMP-003.7 – A member without a sidecar gets `<member file>.xmp`

- **Given** a pair outside a shared folder without sidecars
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

### XMP-003.10 – A failed decision save writes nothing

- **Given** a decision whose save fails
- **When** the user makes it
- **Then** no sidecar is looked up or saved

### XMP-003.11 – Nothing is written through in a shared folder

- **Given** a picture with a member in a shared folder
- **When** the user decides it
- **Then** the decision is stored and no sidecar is looked up or saved

### XMP-003.12 – The ⋯ menu writes to sidecars in shared folders after asking

- **Given** a cull with pictures in a shared folder, some with a stored decision
- **When** the user chooses *Write decisions to sidecars…* and confirms *Write to sidecars*
- **Then** the decided pictures in shared folders are written to their sidecars and a toast says
  how many; the entry is absent when no picture lies in a shared folder, and *Cancel* writes
  nothing

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

## Out of scope

- Re-reading a sidecar that another program changed after the take-over (`06-xmp-interop.md`
  Reading).
- The *Storage* setting of the mockup (database, sidecars or both); M5.3 always writes through
  outside shared folders.
- Detecting external storage mounted for several users as shared (ADR 0017).

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written with M5.3 |
