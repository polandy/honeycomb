# LISTING-003 – Folder picker

- Status: implemented
- Area: listing
- Origin: plan.md M2.3, Multiple folders (Q17); ADR 0011
- Depends on: LISTING-001, LISTING-002

## Purpose

The user chooses the folder set to cull: one or more folders, optionally with their subfolders.
The picker shows how many photos the set holds before it opens.

## Behaviour

**Folder endpoint.** `GET /apps/honeycomb/api/v1/folders?path=<folder>`, logged in, with the
CSRF token, answers `{"folders": [...]}`: one item per direct child folder with `name`, `path`
(from the user's files, leading `/`) and `hasSubfolders`. Hidden folders are included; files are
not. `hasSubfolders` is false when the child holds no folder or may not be listed. Errors as
LISTING-001: `404` for a foreign, vanished or file path, `403` for an unreadable folder, `401`
without a user.

**Picker.** A dialog, *Choose folders*, lists the child folders of the folder being browsed,
sorted by name with digits by value. A checkbox ticks a folder by click, Enter or Space; an arrow
opens a folder that has subfolders without ticking it, and breadcrumbs lead back. A hidden folder
is shown disabled with the reason. *Include subfolders* (any depth; hidden folders, the trash bin
and preview folders skipped) is a switch.

On every tick the picker lists the ticked folders (LISTING-001), pairs them with the user's
pairing settings (LISTING-002) and shows the count, "*n* photos in *m* folders"; the button reads
"Cull <folder>" or "Cull *m* folders". Each folder is listed once per switch position; only the
latest ticks' count is shown. Confirming hands the folder set and its merged entries to the
grid.

| State | Picker shows |
|---|---|
| Nothing ticked | "Tick one or more folders." |
| No photos | "No photos in the ticked folders." |
| More than 20,000 pictures | a notice that the grid shows the first 20,000 by capture time |
| Listing failed | "Could not count the photos.", counted again on the next tick |
| Folders failed to load | a message in the list |

Above the folders, under *Recent*, the picker lists the folder sets culled before with their
progress (DECISIONS-002.8); tapping one opens it at its resume position. The heading and list are
left out until a folder set was culled.

On the first opening it introduces the app and cannot be cancelled; opened from a running cull it
starts from that folder set and *Cancel* returns to it.

## Acceptance criteria

### LISTING-003.1 – The endpoint lists child folders

- **Given** a folder with child folders, hidden ones and files
- **When** the user asks for its folders
- **Then** each child folder comes with name, path and `hasSubfolders`, hidden ones included,
  files left out

### LISTING-003.2 – `hasSubfolders` only when there are some

- **Given** child folders with and without folders inside, and one that may not be listed
- **When** the folders are listed
- **Then** `hasSubfolders` is true only for a child that holds a folder

### LISTING-003.3 – Endpoint failures

- **Given** a foreign, vanished or file path, an unreadable folder, or no user
- **When** its folders are asked for
- **Then** the answer is `404`, `403` or `401` with an empty body; the route is a `GET` that
  checks the CSRF token

### LISTING-003.4 – Browse and tick

- **Given** the picker
- **When** the user browses and ticks folders
- **Then** folders are sorted with digits by value, ticked ones are selected, a click, Enter or
  Space toggles one, the arrow opens a folder without ticking it, and the breadcrumbs go back

### LISTING-003.5 – Hidden folders cannot be ticked

- **Given** a hidden folder in the list
- **When** the picker shows it
- **Then** it is disabled and says why

### LISTING-003.6 – Count before culling

- **Given** a ticked folder
- **When** its photos are listed and paired with the user's pairing settings
- **Then** the picker shows the count and offers to cull it

### LISTING-003.7 – Subfolders at any depth

- **Given** *Include subfolders* is on
- **When** a folder is ticked
- **Then** the count covers its subfolders at any depth

### LISTING-003.8 – Empty, capped and failed counts

- **Given** ticked folders without photos, with more than 20,000 pictures, or whose listing
  fails
- **When** the picker counts them
- **Then** it says there are no photos, warns that the grid shows the first 20,000, or says the
  photos could not be counted and counts again on the next tick

### LISTING-003.9 – The latest answer wins

- **Given** an older listing or folder answer that arrives after a newer one
- **When** the picker shows counts or folders
- **Then** it shows those of the latest ticks and the latest folder opened; each folder is listed
  once per switch position

### LISTING-003.10 – Folders that cannot be loaded

- **Given** the folder endpoint fails
- **When** the picker opens a folder
- **Then** it says the folders cannot be loaded

### LISTING-003.11 – First opening and reopening

- **Given** no open cull, or an open one
- **When** the picker opens
- **Then** without a cull it introduces the app and cannot be cancelled; with one it starts from
  that folder set and cancelling returns to it

### LISTING-003.12 – Confirm opens the cull

- **Given** ticked folders with photos
- **When** the user confirms
- **Then** the grid shows the pictures of the folder set from the merged entries

### LISTING-003.13 – Recent folder sets

- **Given** folder sets the user culled before
- **When** the picker opens
- **Then** it lists them under *Recent*, each with its progress, and opens one at its resume
  position

## Out of scope

- The grid and its folder headers: GRID-001. The resume position: DECISIONS-002.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged code of #41 (ADR 0015) |
| 2026-11-10 | *Recent* above the folders (LISTING-003.13) |
