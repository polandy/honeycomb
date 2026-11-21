# DECISIONS-002 – Resume position

- Status: implemented
- Area: decisions
- Origin: `docs/dev/plan.md` M2.4, Culling workflow item 6, Multiple folders item 8; ADR 0012
- Depends on: DECISIONS-001

## Purpose

The last position per folder set and user is kept on the server, so a cull stopped on one device
continues on another, and *Recent* can list the last folder sets with their progress.

## Behaviour

- `PUT /apps/honeycomb/api/v1/positions` stores `folderSet` (`paths`, `subfolders`), `fileId`,
  `decided` and `total`; the answer repeats it with `updatedAt` (Unix seconds).
  `GET /apps/honeycomb/api/v1/positions` lists the user's positions, newest first.
- A folder set is its sorted paths and the subfolders switch: the same paths in another order are
  the same set, without subfolders another one. The root folder is the path `""`. With
  subfolders, a ticked folder inside another ticked folder adds nothing, so it does not count
  (ADR 0034): `/Trip` and `/Trip/Day 2` with subfolders is the same set as `/Trip` with
  subfolders. The stored `paths` keep every tick, so switching subfolders off loses none.
  Positions stored under the older key, which counted every tick, take the new key when the
  list is read; when two of them become one set, the newer position stays.
- With subfolders, a folder set may name `excluded` folders it leaves out (LISTING-003.21,
  ADR 0035). The key names them after the paths only when they leave something out: one with no
  ticked folder above it, one inside another excluded folder, one ticked itself and any without
  subfolders do not count. A tick inside an excluded folder counts again. A position stored
  without `excluded` keeps its key and shape; *Recent* lists a set without its excluded folders.
- Only the 20 most recent positions per user are kept; each user's positions are their own.
  Deleting a user removes their positions. A position whose picture is deleted for good stays,
  so *Recent* still lists its folder set.
- `400` for a malformed position, `401` without a user.
- While culling, the client saves the picture the loupe shows, named by its rendered member (a
  RAW alone by itself), with the progress of the cull; it saves again when the progress changes.
  Nothing is saved before the loupe has shown a picture of the open cull. One save is sent at a
  time; of the saves that waited, only the latest is sent.
- Opening a folder set whose position names a picture still in it shows the toast *Continue where
  you left off* with *Resume*, and the More menu shows *Resume at <name>*. Either opens the loupe
  at that picture, at the first undecided picture of the view when filters hide it, or at the
  first picture of the view. Once the loupe has shown a picture, the toast is no longer offered.
  The toast closes when the user opens a photo, decides or scrolls the grid; a scroll the grid
  makes itself, such as keeping the focused tile in view, leaves it.
- A failed read or save is logged; the cull goes on without the offer.
- *Recent* in the app navigation and the folder picker lists the stored positions, newest first,
  each folder set by its name ("Trip", "Trip + subfolders", "3 folders") with "x / y decided"; the
  open folder set is marked and shows the progress of its cull. A position the cull saves moves
  its folder set to the top without reading the list again. Tapping a folder set lists it and
  opens the loupe at its position, without the toast; tapping the open one resumes it in place.
  A folder set that cannot be listed, or whose listing does not answer within 30 s, is reported
  by a message with *Try again* and the cull stays as it is.

## Acceptance criteria

### DECISIONS-002.1 – Save and list

- **Given** a user
- **When** they save a position
- **Then** the answer repeats it with the time of saving, and the list holds it

### DECISIONS-002.2 – One position per folder set

- **Given** a saved position
- **When** the same paths are saved in another order
- **Then** the position is replaced; the same paths without subfolders are another folder set

### DECISIONS-002.3 – The 20 most recent, newest first

- **Given** more than 20 saved folder sets
- **When** the user lists positions
- **Then** the 20 most recent come back, newest first, the latest of the same second first

### DECISIONS-002.4 – Each user apart

- **Given** a position saved by one user
- **When** another user lists positions
- **Then** they see none of it

### DECISIONS-002.5 – A malformed position

- **Given** no paths, a path that is not text or holds `..` or NUL, too many paths, a missing
  switch, a file id below 1 or `decided` outside 0 to `total`
- **When** it is saved
- **Then** the answer is `400` and nothing is stored

### DECISIONS-002.6 – Without a user

- **Given** no logged-in user
- **When** a position is read or saved
- **Then** the answer is `401`

### DECISIONS-002.7 – The client saves and offers the position

- **Given** a cull on one device
- **When** the user moves through it and later opens the same folder set on another device
- **Then** the position was saved and the app offers to continue there

### DECISIONS-002.8 – Recent

- **Given** saved positions
- **When** the user opens the navigation
- **Then** *Recent* lists the last folder sets with their progress and opens one at its position

### DECISIONS-002.9 – A picture hidden by the filters

- **Given** a stored position whose picture the filters hide
- **When** the user resumes
- **Then** the loupe opens at the first undecided picture of the view, or at its first picture

### DECISIONS-002.10 – Nothing to offer

- **Given** no position for the folder set, or one whose picture is no longer in it
- **When** the folder set opens
- **Then** nothing is offered, and nothing is saved until the loupe shows a picture

### DECISIONS-002.11 – A failed read or save

- **Given** a server that cannot read or save positions
- **When** the folder set opens or the loupe pages
- **Then** the failure is logged and the cull goes on without the offer

### DECISIONS-002.12 – The navigation gets out of the way

- **Given** a narrow screen, where the navigation covers the photos
- **When** the user taps a recent folder set, *Folder* or *Settings*
- **Then** the navigation closes; on a wide screen it stays open

### DECISIONS-002.13 – A deleted user

- **Given** a user with stored positions
- **When** the user is deleted
- **Then** their positions are gone, and a new user of the same name lists none

### DECISIONS-002.14 – The offer gets out of the way

- **Given** the toast *Continue where you left off*
- **When** the user opens a photo, decides or scrolls the grid
- **Then** the toast closes; *Resume* in the More menu stays

### DECISIONS-002.15 – A ticked folder inside another

- **Given** a saved position of a folder set with subfolders
- **When** the same set is saved with a folder below one of its folders ticked as well, or the
  list holds positions stored under the older key that become one set
- **Then** it is one folder set with one position, the newest, under *Recent*; without
  subfolders the extra folder makes another set, and the saved paths keep every tick

### DECISIONS-002.16 – Excluded folders

- **Given** a saved position of a folder set with subfolders and an excluded folder, and one
  stored before folder sets had exclusions
- **When** the list is read, the same set is saved with its exclusions in another order or with
  exclusions that leave nothing out, or a *Recent* set with exclusions is opened
- **Then** both positions keep their key; the same set is one position; malformed `excluded` is
  a `400`; opening lists each ticked folder without the excluded folders below it

### DECISIONS-002.17 – A browser reload keeps the folder and the picture

- **Given** an open cull, with or without the loupe open
- **When** the user reloads the browser page
- **Then** the same folder set is listed again and opened, and with the loupe open it opens at the
  same picture; the address carries the folder set and the loupe's picture, and a closed cull
  leaves it empty; an address that names no valid folder set, or a folder set that cannot be
  listed, opens the app as usual

### DECISIONS-002.18 – Reload folder

- **Given** a move or delete that failed or skipped pictures because the folder changed since it
  was listed
- **When** the user presses *Reload folder* on the message
- **Then** the open folder set is listed again and opened, the loupe at the same picture when one
  was open and the picture is still there; a failed listing keeps the open cull

### DECISIONS-002.19 – A folder set that cannot be listed

- **Given** a folder set opened from *Recent*, by a browser reload or by *Reload folder*
- **When** its listing fails, or does not answer within 30 s and is aborted (ADR 0029)
- **Then** the open cull stays, a message that stays until closed says *Could not open {name}.*,
  after a timeout *Could not open {name}: the server did not answer within 30 s.*, and its
  *Try again* lists the folder set again and opens it

## Out of scope

The progress of the open cull (GRID-002).

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged M2.4 (#42) |
| 2026-11-10 | The client saves and offers the position (DECISIONS-002.7, .9–.11) |
| 2026-11-10 | *Recent* in the navigation and the folder picker (DECISIONS-002.8) |
| 2026-11-10 | The navigation closes after a tap on a narrow screen (DECISIONS-002.12) |
| 2026-11-10 | Positions of a deleted user are removed (DECISIONS-002.13) |
| 2026-11-13 | The toast closes when the user opens a photo, decides or scrolls (DECISIONS-002.14) |
| 2026-11-16 | A ticked folder inside another with subfolders is the same set (DECISIONS-002.15, ADR 0034) |
| 2026-11-17 | Excluded folders in the folder set and its key (DECISIONS-002.16, ADR 0035) |
| 2026-11-20 | A browser reload keeps folder and picture; *Reload folder* on the stale-state messages (DECISIONS-002.17, .18) |
| 2026-11-21 | A listing that fails or does not answer within 30 s offers *Try again* (DECISIONS-002.19, E23/U7) |
