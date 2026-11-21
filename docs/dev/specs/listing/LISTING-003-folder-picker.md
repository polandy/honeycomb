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
(from the user's files, leading `/`), `hasSubfolders`, `pictures`, `picturesBelow`,
`orphanedSidecars` and `orphanedSidecarsBelow`.
Hidden folders are included; files are not. `hasSubfolders` is false when the child holds no
folder or may not be listed. `pictures` counts the child's own pictures, hidden files and its
subfolders left out, from one listing of the child: a RAW and a rendered file of one base name in
the same folder count once, any other photo file of the types LISTING-001 lists counts once each
(pairing as LISTING-002 with its default extensions; the user's own pairing settings are not
read, so the count can differ from the grid's). `orphanedSidecars` counts the child's own
orphaned sidecars (XMP-009), also from that listing. `picturesBelow` and `orphanedSidecarsBelow`
count the same in the child and in every folder below it, hidden folders left out and the
storages mounted below it (shares, external storages) added, from the names in Nextcloud's file
cache in one query per storage, without walking the folders; pairs and orphans are told per
folder. `pictures` and `orphanedSidecars` are `null` for a hidden child or one that may not be
listed; `picturesBelow` and `orphanedSidecarsBelow` also when the file cache does not know the
child or the database fails (logged). Errors as
LISTING-001: `404` for a foreign, vanished or file path, `403` for an unreadable folder, `401`
without a user.

**Picker.** A dialog, *Choose folders*, shows the user's folders as a tree, each level sorted by
name with digits by value; the home folder's children are the top level. A checkbox ticks a
folder by click, Enter or Space; an arrow before a folder that has subfolders expands or
collapses it in place without ticking it, and its child folders are loaded the first time it is
expanded (a note says while they load, when it has none, and when they failed; expanding again
retries). The tree is one tab stop: Up and Down move between the shown folders, Home and End go
to the first and last, Right expands a folder or moves to its first child, Left collapses it or
moves to its parent (WAI-ARIA tree pattern). An arrow and a row are 44 px high on a touch
screen. A hidden folder
is shown disabled with the reason. *Include subfolders* (any depth; hidden folders, the trash bin
and preview folders skipped) is a switch above the folder list, so a long list cannot push it out
of sight.

**Excluded folders.** With *Include subfolders* on, a tap, Enter or Space on an included folder
excludes it: the folder set leaves it out with everything below it, except folders ticked inside
it, which are back in (ADR 0035). The same tap on an excluded folder includes it again. The
picker lists each ticked folder without the excluded folders below it (LISTING-001.16), so the
status line counts without them. Unticking a folder drops the exclusions no ticked folder holds
any more. Exclusions kept while the switch is off leave nothing out and are not shown.

On every tick the picker lists the ticked folders (LISTING-001), pairs them with the user's
pairing settings (LISTING-002) and shows the count, "*n* photos in *m* folders"; the button reads
"Cull <folder>" or "Cull *m* folders". Each folder is listed once per switch position; only the
latest ticks' count is shown. Opened with ticked folders, the folders above them start
expanded. Every folder above a ticked one shows a badge after its name, "*n* inside", counting
the ticked folders at any depth below it, whether it is expanded or collapsed, ticked itself or
not, and before its subfolders were ever loaded; its own checkbox still shows only its own tick.
A screen reader hears it as part of the folder, "*n* ticked folders inside"; the folder is not
announced as half ticked. The one-folder tree of the move dialog (MOVE-004) marks the folders
above the chosen one the same way. While *Include subfolders* is on, every shown folder below a
ticked one that is not ticked itself shows a dashed tick and "included" after its name, read out
as "included with <the nearest ticked folder above>"; it is not selected and a tap ticks it.
Hidden folders, and the folders inside them, stay without it, since the listing skips them.
Every folder with pictures shows their count last in its row, in the muted colour with digits
of even width. A collapsed folder with subfolders counts the pictures in it and in all folders
below it, read out as "*n* pictures with subfolders"; once expanded, and for a folder without
subfolders, it counts only its own, read out as "*n* pictures". A folder without any, a hidden
one, one that cannot be listed and a collapsed one whose count below is unknown show none. A
folder with orphaned sidecars shows a small note before the count, "*n* orphaned sidecars" (the
same scope as the count: below while collapsed, else its own), also when it has no pictures. The
count and the note come with the folder, so the row never grows when they arrive and the note
shortens with an ellipsis before the name does. The move dialog's tree shows them too.
Confirming hands the folder set and its merged entries to the grid.

| State | Picker shows |
|---|---|
| Nothing ticked | "Tick one or more folders." |
| No photos | "No photos in the ticked folders." |
| More than 20,000 pictures | a notice that the grid shows the first 20,000 by capture time |
| Listing failed | "Could not count the photos.", counted again on the next tick |
| Folders failed to load | a note under the folder expanded, or in place of the list |

The status line under the list is in regular weight and the muted colour, so the hint does not
read as an error. Every folder row is one height, whether it has an arrow or not.

Below the folders, under *Recent*, the picker lists the folder sets culled before with their
progress (DECISIONS-002.8); tapping one opens it at its resume position. At most three quiet rows
show, each with the name cut by an ellipsis and the progress whole; *Show all {count}* opens the
full list in place and *Show fewer* folds it. A row is 44 px high where the dialog is tall
enough, and the tab order is the folders first, then *Recent*. The heading and list are left out
until a folder set was culled. The navigation's *Recent* is unchanged.

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
- **When** the user expands and ticks folders
- **Then** folders are sorted with digits by value, ticked ones are selected, a click, Enter or
  Space toggles one, and the arrow expands a folder in place, loading its child folders once,
  without ticking it, and collapses it again

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
- **Then** the count covers its subfolders at any depth; the switch sits above the folder list

### LISTING-003.8 – Empty, capped and failed counts

- **Given** ticked folders without photos, with more than 20,000 pictures, or whose listing
  fails
- **When** the picker counts them
- **Then** it says there are no photos, warns that the grid shows the first 20,000, or says the
  photos could not be counted and counts again on the next tick

### LISTING-003.9 – The latest answer wins

- **Given** an older listing or folder answer that arrives after a newer one
- **When** the picker shows counts or folders
- **Then** it shows the count of the latest ticks; each folder is listed once per switch position

### LISTING-003.10 – Folders that cannot be loaded

- **Given** the folder endpoint fails
- **When** the picker loads the top level or expands a folder
- **Then** it says the folders cannot be loaded, and expanding the folder again tries again

### LISTING-003.11 – First opening and reopening

- **Given** no open cull, or an open one
- **When** the picker opens
- **Then** without a cull it introduces the app and cannot be cancelled; with one it starts from
  that folder set, with the folders above the ticked ones expanded, and cancelling returns to it

### LISTING-003.12 – Confirm opens the cull

- **Given** ticked folders with photos
- **When** the user confirms
- **Then** the grid shows the pictures of the folder set from the merged entries

### LISTING-003.13 – Recent folder sets

- **Given** folder sets the user culled before
- **When** the picker opens
- **Then** it lists them under *Recent*, each with its progress, and opens one at its resume
  position

### LISTING-003.14 – A quiet status line and even rows

- **Given** the picker with a folder that has subfolders and one that has none
- **When** it shows the folders
- **Then** the status line is in regular weight and the muted colour, and both rows are one
  height

### LISTING-003.15 – Recent below the folders, three rows

- **Given** more than three folder sets culled before
- **When** the picker opens
- **Then** *Recent* sits under the folder list, shows three rows, and *Show all {count}* opens
  the full list in place; the folders come first in the tab order

### LISTING-003.16 – Keys and touch targets of the tree

- **Given** the folder tree on a desktop, iPad or phone
- **When** the user moves through it by keyboard or by touch
- **Then** it is one tab stop, the arrow keys move, expand and collapse after the WAI-ARIA tree
  pattern, every arrow and row is at least 44 px on a touch screen, and the tree fits the width
  of every reference device

### LISTING-003.17 – Ticks below a folder

- **Given** ticked folders inside a folder, expanded or collapsed, ticked itself or not
- **When** the tree shows that folder, in the picker or in the move dialog
- **Then** a badge after its name counts the ticked folders below it, "*n* inside", read out as
  "*n* ticked folders inside" (or "chosen" for the one folder of the move dialog); its checkbox
  and selected state show only its own tick

### LISTING-003.18 – Folders included by *Include subfolders*

- **Given** *Include subfolders* is on and a ticked folder is expanded
- **When** the tree shows the folders below it
- **Then** each one not ticked itself shows a dashed tick and "included", read out as "included
  with <the nearest ticked folder above>", is not selected and is excluded on a tap
  (LISTING-003.21); hidden and excluded folders and those inside them do not, and with the switch
  off none does

### LISTING-003.19 – Pictures of each folder

- **Given** folders with and without pictures, one with a RAW and a JPEG of one shot, hidden
  ones, and one that cannot be listed
- **When** the tree shows them expanded or without subfolders, in the picker or in the move
  dialog
- **Then** each one with pictures shows the count of its own (a RAW and rendered pair once;
  subfolders, sidecars and hidden files left out) last in its row, read out as "*n* pictures";
  the others show none

### LISTING-003.20 – Pictures below a collapsed folder

- **Given** a collapsed folder with subfolders, some hidden, a pair in one of them, a RAW and a
  JPEG of one name in two different folders, and a storage mounted below it
- **When** the tree shows it, in the picker or in the move dialog
- **Then** its count adds the pictures of all folders below it and of the mounted storage,
  pairs counted once and only within one folder, hidden folders and files left out, read out as
  "*n* pictures with subfolders"; expanding it shows its own count again, and a count the file
  cache cannot give shows none
- **Given** a collapsed folder whose count may miss files: one with files not scanned yet (its
  file cache size is unknown, or a storage mounted below it is not scanned), or one on a team
  folder with advanced permissions
- **Then** the count starts with "~" ("~123") and is read out as "about *n* pictures with
  subfolders"; a folder the file cache knows completely shows no "~"

### LISTING-003.21 – Exclude an included folder

- **Given** *Include subfolders* is on and a ticked folder holds two folders with photos
- **When** the user taps, or presses Enter or Space on, one of them, and then again
- **Then** the first time it shows a minus, its name struck through and "excluded", read out as
  "excluded from <the ticked folder>", is not selected, folders inside it show no mark, and the
  status line counts without its photos; the second time it is included again; a folder ticked
  inside an excluded one is listed, and *Choose* hands the excluded folders to the cull

### LISTING-003.22 – Excluded folders inside a folder

- **Given** excluded folders below a ticked one
- **When** the tree shows the folders above them, collapsed or expanded, or the user unticks the
  ticked folder, or turns *Include subfolders* off
- **Then** each folder above shows a badge "*n* excluded", read out as "*n* excluded folders
  inside", and the tree opens down to them; unticking drops the exclusions no ticked folder holds;
  with the switch off no folder shows an exclusion or its badge

### LISTING-003.23 – Orphaned sidecars of a folder

- **Given** folders with sidecars that belong to no photo or video of their folder, one folder
  with only such sidecars, one whose sidecars all belong to a photo, and a folder below with one
- **When** the tree shows them, collapsed or expanded, in the picker or in the move dialog
- **Then** each folder with orphaned sidecars shows "*n* orphaned sidecars" before its count (its
  own while expanded or without subfolders, else those below it too), also without pictures,
  read out as "*n* orphaned sidecars"; the others show no note

## Out of scope

- The grid and its folder headers: GRID-001. The resume position: DECISIONS-002.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged code of #41 (ADR 0015) |
| 2026-11-10 | *Recent* above the folders (LISTING-003.13) |
| 2026-11-12 | .7 the switch above the folder list (owner, iPad) |
| 2026-11-13 | .14 a quiet status line and even rows (UX L2) |
| 2026-11-14 | .13/.15 *Recent* below the folders, three rows and *Show all* (owner, #180 variant C) |
| 2026-11-16 | .4/.9/.10/.11 the picker as an expandable tree, .16 its keys and touch targets (owner) |
| 2026-11-16 | .17 a badge on every folder above a ticked one (owner, E1–E4 A) |
| 2026-11-16 | .18 the folders included by *Include subfolders* (owner, E3 A) |
| 2026-11-16 | .1/.19 the photo files of each folder in the tree (owner, after digiKam) |
| 2026-11-16 | .1/.20 a collapsed folder counts its subfolders too (owner, digiKam) |
| 2026-11-18 | .20 "~" and "about" where the count may be incomplete (owner, #244) |
| 2026-11-21 | .19/.20 the tree counts pictures, a pair once; .23 a note for orphaned sidecars (owner, E9/U9, #187) |
| 2026-11-17 | .18 a tap excludes an included folder, .21/.22 excluded folders (owner, #187) |
