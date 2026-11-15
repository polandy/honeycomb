# XMP-008 – Deciding needs writing

- Status: implemented
- Area: xmp
- Origin: ADR 0032 (Writability and permissions), sidecar PR 6
- Depends on: LISTING-001, SETTINGS-001, XMP-003

## Purpose

The sidecar is the source of truth (ADR 0032), so a rating, flag, colour label, *Keep RAW* mark or
tag that cannot be written to the picture's sidecars is not made at all. The cull says why, and
lets the user lift what the user can lift: turn writing *On*, confirm a shared folder.

## Behaviour

**Writability.** Each picture of the cull has one writability, the first of these that holds for
any member's folder: `off` while *Write decisions to XMP sidecars* is *Off*; `readOnly` when the
folder's permissions (LISTING-001) lack UPDATE (2) or CREATE (4); `shared` when the folder is
shared and the user has not confirmed the opened folder that holds it; `noVersions` when the
folder keeps no versions; `refused` when a write of this visit refused one of the picture's
sidecars (not UTF-8, malformed, a `<!DOCTYPE>`, a property given twice, not XMP). Otherwise it is
`writable`. A folder the listing does not name counts as writable; the server checks every save
again (XMP-002).

**Confirming a shared folder.** The listing names the opened folder by its file id. A
confirmation is kept per user under the file id of the nearest opened folder that holds the shared
folder, and covers its subfolders. The settings keep at most the 200 latest confirmations.

**A locked step.** A rating, flag, colour label, *Keep RAW*, *Pick this, reject the rest* or tag
change whose pictures are not all writable decides none of them: nothing is shown, stored or
written. For `off` or `shared` a dialog asks first: *Write decisions to XMP sidecars?* while
writing is *Off* (with the shared folders too, in one dialog), *Write to a shared folder?*
otherwise. *Write to sidecars* saves *On* and the confirmed folders in one settings save and takes
the step; *Cancel* takes nothing. Without the Versions app *Write to sidecars* is disabled and the
dialog says why. For `readOnly`, `noVersions` and `refused` a toast names the reason. Undo and redo
are not held back; the server refuses what it may not write (XMP-003.13). The loupe's info panel
says per picture why nothing is written.

**Before the sidecars are read.** A step is taken while the sidecars are still looked up; a
decision made meanwhile wins (XMP-003.3).

## Acceptance criteria

### XMP-008.1 – A picture whose folders allow it is writable

- **Given** writing *On*, a picture whose member folders grant UPDATE and CREATE, keep versions and
  are not shared, or are not named by the listing at all
- **When** its writability is read
- **Then** it is `writable`; a listing item of another shape is dropped and counts as not named

### XMP-008.2 – *Off* comes first

- **Given** writing *Off* and a read-only, shared folder without versions
- **When** the writability of a picture there is read
- **Then** it is `off`

### XMP-008.3 – A folder without UPDATE or CREATE is read-only

- **Given** writing *On* and a member folder with permissions 1 (READ only)
- **When** the user decides or tags the picture
- **Then** nothing is decided and a toast says *Not changed: you may only read this folder*

### XMP-008.4 – A shared folder is confirmed once per opened folder

- **Given** writing *On* and a shared member folder below the opened folder `/Trip` (file id 7)
- **When** the user decides the picture and confirms *Write to a shared folder?*
- **Then** the settings keep 7 in `confirmedSharedFolders`, the step is taken, and further steps
  in `/Trip` and its subfolders ask no more; the listing answers the opened folder's `fileId`

### XMP-008.5 – A folder without versions is locked

- **Given** writing *On* and a member folder whose `versions` is false
- **When** the user decides the picture
- **Then** nothing is decided and a toast says *Not changed: this folder keeps no versions*

### XMP-008.6 – A refused sidecar locks its picture for the visit

- **Given** a write that refused a sidecar of one picture as malformed and could not save one of
  another (`notPermitted`)
- **When** the writabilities are read, and again after a folder set is opened
- **Then** the first picture is `refused` and the second `writable`; after opening both are
  `writable`

### XMP-008.7 – A locked step decides none of its pictures and says why

- **Given** a step on two pictures, one of them locked
- **When** the user takes it
- **Then** neither is decided, stored or written; for `off` and `shared` the dialog asks and
  *Write to sidecars* takes the step, *Cancel* takes nothing; for the other reasons a toast names
  the first reason in the order `off`, `readOnly`, `shared`, `noVersions`, `refused`; the info
  panel says *Not written, …* with the picture's reason

### XMP-008.8 – Deciding does not wait for the sidecars

- **Given** a cull whose sidecar lookup has not answered yet
- **When** the user picks a picture
- **Then** the pick is taken at once and wins over the sidecar's decision when it arrives

## Out of scope

- Reading the decisions through the XMP cache (XMP-006.7); the cull still takes over from the
  sidecars on opening (XMP-003), a later PR of ADR 0032.
- Taking a change back when the server answers `notPermitted` (ADR 0032 Writability 9).

## History

| Date | Change |
|---|---|
| 2026-11-15 | Written with sidecar PR 6 (ADR 0032) |
