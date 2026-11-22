# FOLDERS-007 – The *Folders* screen and the library setup

- Status: accepted
- Area: folders
- Origin: ADR 0049 Library roots, Navigation (V1), `docs/dev/mockup/folders/index.html`
- Depends on: FOLDERS-002, FOLDERS-003, FOLDERS-004, FOLDERS-005, DECISIONS-002, LISTING-003

## Purpose

*Folders* is the start screen of the Nextcloud source: it lists the folders below the library
roots worth culling and the library's progress, and opens a folder's cull and returns to the list.

## Behaviour

- **Start.** Once the settings are read, the app shows *Folders*; the folder picker does not open
  by itself. While the user has no library root, *Folders* shows the library setup instead of the
  list.
- **Library setup** (*Where is your library?*): a folder tree that chooses one folder, *Add as
  root*, the chosen roots each with *Remove*, and *Show folders*, disabled without a root. A root is
  added only when FOLDERS-004 accepts it and `GET /library/folders` accepts it as `root` (the home
  storage, FOLDERS-005); a refusal is said in a line of its own. *Show folders* saves the roots as
  the setting `libraryRoots` and shows the list.
- **The list's data.** For each root the screen reads every page of `GET /library/folders`. While
  a root answers `scanning`, it calls `POST /library/scan` for that root until every folder is
  fresh or a call brings no progress, shows *Updating n folders* (n: the folders not yet fresh)
  with a bar of the fresh share, and then reads the root's pages again. A failed read says *Could
  not load the folders.* with *Try again*; a failed scan keeps the rows and says so in an error
  toast.
- **The progress card:** the chosen root's name or *Library*, its summary line (FOLDERS-003.6),
  the headline share with its bar, the folders done, done this month and the decided share; with
  *All roots* and several roots, one bar per root.
- **Chips and sort.** With several roots a chip row offers *All roots* and each root; it chooses
  the rows of the list and the progress. The filter chips *Suggested*, *New photos* and *All*
  carry their counts; the *Sort* menu offers the sorts of FOLDERS-002. Year and root headings as
  FOLDERS-002.
- **A row:** the folder's name and its parent path, its photos and undecided photos, a bar split
  into picked, undecided and rejected, and one state line: the reason (FOLDERS-001), *Complete ·
  not marked done*, the done line with the badge *n new*, or *Read-only* before the reason. An open
  rateable folder with undecided photos offers *Cull*; every row has *More for ⟨name⟩*, a dialog
  (a bottom sheet on a phone) with *Cull*, *Cull with subfolders* and *Open in Files*; *Cull* and
  *Cull with subfolders* are disabled for a read-only folder.
- **Cull and Back.** *Cull* opens the folder set `{paths: [path], subfolders: false}`, *Cull with
  subfolders* the same with subfolders, at its stored resume position as *Recent* does
  (DECISIONS-002.8), else at its start. The grid's toolbar then shows *Back to folders* in place of
  *Change folders*; it shows the list again with its root, filter, sort and scroll as they were and
  reads the rows again. A cull opened from the folder picker or *Recent* keeps *Change folders*.
- **Navigation.** The navigation lists *Folders* first, then *Folder* (the folder picker) and the
  pages; *Recent* stays. *Folders* shows the list from any screen of the Nextcloud source.

## Acceptance criteria

### FOLDERS-007.1 – Folders is the start screen

- **Given** a user with library roots
- **When** the app page opens
- **Then** it shows *Folders* with the rows of every root, and the folder picker stays closed

### FOLDERS-007.2 – The first run shows the library setup

- **Given** a user without a library root
- **When** the app page opens
- **Then** it shows *Where is your library?* with the folder tree and *Show folders* disabled; the
  list is not read

### FOLDERS-007.3 – Adding and removing roots

- **Given** the library setup
- **When** the user chooses a folder and presses *Add as root*, then *Remove* on it
- **Then** the root is listed with *Remove* and *Show folders* is enabled; after *Remove* it is gone
  and *Show folders* is disabled again

### FOLDERS-007.4 – A refused root

- **Given** the root `/Photos` in the setup
- **When** `/Photos/2019` is added, or a folder the server refuses as `root` (a share)
- **Then** it is not added and a line says why: inside `/Photos`, or not on the user's own storage

### FOLDERS-007.5 – Show folders saves the roots

- **Given** the setup with two roots
- **When** the user presses *Show folders*
- **Then** the setting `libraryRoots` holds both in their order and the list of both is read

### FOLDERS-007.6 – Every page is read

- **Given** a root whose folders come in two pages
- **When** the list is read
- **Then** the second page is asked with `after` set to the first page's `next`, and the rows of
  both show

### FOLDERS-007.7 – Updating folders

- **Given** a root answering `scanning {done: 7, total: 12}`
- **When** the list is read
- **Then** *Updating 5 folders* shows over the rows, `POST /library/scan` runs until `done` reaches
  `total`, the root's pages are read again and the strip goes; a scan that brings no progress
  ends it too

### FOLDERS-007.8 – A failed read or scan

- **Given** a read of the list that fails, or a scan that fails
- **When** the list is read
- **Then** the read says *Could not load the folders.* with *Try again*, which reads again; the
  failed scan keeps the rows, ends the strip and shows an error toast

### FOLDERS-007.9 – The progress card

- **Given** rows below two roots
- **When** *All roots* is chosen, then one root
- **Then** the card shows *Library*, the totals and one bar per root; for the root its own numbers
  and no root bars

### FOLDERS-007.10 – Root chips, filter chips and sort

- **Given** rows below two roots
- **When** a root chip, a filter chip and a sort are chosen
- **Then** the list shows the rows FOLDERS-002 keeps, in its order and headings, and each filter
  chip shows its count; with one root there are no root chips

### FOLDERS-007.11 – The row states

- **Given** an open folder with undecided photos, a complete one, a done one with new photos and a
  read-only one
- **When** the list shows them
- **Then** the first shows its reason and *Cull*, the second *Complete · not marked done*, the third
  `Done ⟨date⟩ · by ⟨user⟩` and *n new*, the fourth *Read-only*; only the first offers *Cull* in
  the row

### FOLDERS-007.12 – The row's menu

- **Given** a row
- **When** *More for ⟨name⟩* is pressed
- **Then** a dialog named after the folder offers *Cull*, *Cull with subfolders* and *Open in
  Files* and closes by *Cancel*; on a phone it is a bottom sheet; for a read-only folder both
  *Cull* entries are disabled

### FOLDERS-007.13 – Cull opens at the resume position

- **Given** a folder whose folder set has a stored resume position, and one without
- **When** *Cull* is pressed on each
- **Then** the first opens in the loupe at its position as from *Recent*, the second opens the grid
  of `{paths: [path], subfolders: false}`

### FOLDERS-007.14 – Back to the list

- **Given** a cull opened from *Folders* with a filter, a sort and the list scrolled
- **When** *Back to folders* is pressed
- **Then** *Folders* shows with the same root, filter, sort and scroll and its rows read again

### FOLDERS-007.15 – Change folders elsewhere

- **Given** a cull opened from the folder picker or *Recent*
- **When** the grid's toolbar shows
- **Then** it offers *Change folders* as before, not *Back to folders*

### FOLDERS-007.16 – The navigation

- **Given** the Nextcloud source
- **When** the navigation shows
- **Then** *Folders* is its first entry, *Folder* opens the folder picker and *Recent* lists the
  folder sets; *Folders* shows the list from the grid

### FOLDERS-007.17 – Accessible and touch-sized

- **Given** the setup, the list and the row's menu, light and dark, on an iPad
- **When** they are scanned and measured
- **Then** axe finds no serious fault and every control is at least 44 px on a coarse pointer

## Out of scope

*Mark done*, *Reopen*, *Cull new* and the toast with *Undo*: M12 PR 6. The roots in *Settings* and
the statistics headline: M12 PR 7. Filters, sorts and texts: FOLDERS-002, FOLDERS-003.

## History

| Date | Change |
|---|---|
| 2026-11-22 | Written with M12 PR 5 |
