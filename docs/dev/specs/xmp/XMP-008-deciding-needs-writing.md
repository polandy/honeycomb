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
sidecars (not UTF-8, malformed, a `<!DOCTYPE>`, a property given twice, not XMP); `legacy` while
a member has a legacy decision or tag (XMP-007) that the ⋯ entry has not written to its sidecars
yet. Otherwise it is `writable`. A folder the listing does not name counts as writable; the
server checks every save again (XMP-002).

**Confirming a shared folder.** The listing names the opened folder by its file id. A
confirmation is kept per user under the file id of the nearest opened folder that holds the shared
folder, and covers its subfolders. The settings keep at most the 200 latest confirmations.

**A locked step.** A rating, flag, colour label, *Keep RAW*, *Pick this, reject the rest* or tag
change over pictures of which some are locked first asks for the locks the user can lift: for
`off` or `shared` a dialog asks *Write decisions to XMP sidecars?* while writing is *Off* (with the
shared folders too, in one dialog), *Write to a shared folder?* otherwise. *Write to sidecars*
saves *On* and the confirmed folders in one settings save and takes the step; *Cancel* takes
nothing. Without the Versions app *Write to sidecars* is disabled and the dialog says why. The
step then decides the writable pictures as one undo step and leaves the pictures locked
`readOnly`, `noVersions`, `refused` or `legacy` as they are: nothing of them is shown, stored or
written. Its toast says what changed and how many photos were not changed, naming the first
reason in the order `readOnly`, `noVersions`, `refused`, `legacy`, with *Details* that unfold each
such photo and its reason. A step whose pictures are all locked takes nothing; its toast names
the reason, for one photo as *Not changed: …*. *Pick this, reject the rest* takes nothing when the
picked picture is locked. Undo and redo are not held back; the server refuses what it may not
write (XMP-003.13).
The loupe's info panel says per picture why nothing is written.

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

### XMP-008.7 – A lock the user can lift is asked first

- **Given** a step on two pictures, one of them `off` or `shared`
- **When** the user takes it
- **Then** the dialog asks before anything is decided; *Write to sidecars* takes the step, *Cancel*
  takes nothing; the info panel says *Not written, …* with the picture's reason

### XMP-008.9 – A step decides the writable pictures and reports the locked ones

- **Given** a step on three pictures, two of them in a read-only folder
- **When** the user takes it
- **Then** the writable one is decided, stored and written; the locked two are not; the toast says
  *Rejected 1 photo; 2 photos not changed: you may only read the folder* with *Undo* and
  *Details*, which unfold each locked photo's name and reason; with every picture locked nothing is
  taken and the toast names the first reason in the order `readOnly`, `noVersions`, `refused`,
  `legacy`

### XMP-008.10 – Undo takes back the partial step as one step

- **Given** a step that decided the writable part of its pictures
- **When** the user chooses *Undo*
- **Then** the writable pictures get back their decisions in one step; the locked ones stay as
  they were

### XMP-008.8 – Deciding does not wait for the sidecars

- **Given** a cull whose sidecar lookup has not answered yet
- **When** the user picks a picture
- **Then** the pick is taken at once and wins over the sidecar's decision when it arrives

### XMP-008.11 – A picture with legacy rows is locked until they are written

- **Given** writing *On*, a picture with a legacy decision and one with legacy tags only
- **When** the user rates both, then the ⋯ entry writes them to their sidecars
- **Then** neither is rated, the toast says *2 photos not changed: stored decisions are not yet in
  the sidecars* and the info panel says *Not written, stored decisions not yet in its sidecars*;
  once they are acknowledged both show what they showed before and are writable

## Out of scope

- Taking a change back when the server answers `notPermitted` (ADR 0032 Writability 9).

## History

| Date | Change |
|---|---|
| 2026-11-15 | Written with sidecar PR 6 (ADR 0032) |
| 2026-11-18 | A step decides the writable pictures and reports the locked ones (.7 changed, .9, .10; owner decision on #221 (a)) |
| 2026-11-18 | A picture with legacy rows is locked until the ⋯ entry writes them (`legacy`, .11; ADR 0032 App state and migration 2) |
