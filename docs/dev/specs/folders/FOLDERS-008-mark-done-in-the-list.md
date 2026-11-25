# FOLDERS-008 – *Mark done*, *Reopen* and *Cull new* in the list

- Status: accepted
- Area: folders
- Origin: ADR 0049 The done status, New photos (N1); `docs/dev/mockup/folders/index.html`
- Depends on: FOLDERS-006, FOLDERS-007, APP-001, STATS-001

## Purpose

The user marks a folder done where they see it, in the list or on the *Cull finished* card, without
a dialog; a toast offers *Undo* for a while. A done folder with new photos offers to cull just those.

## Behaviour

- **Where.** A rateable folder that is not done offers *Mark done* in its ⋯ menu; a complete one
  (photos, none undecided) also in its row, in place of *Cull*. A done rateable folder offers
  *Reopen* in its ⋯ menu. A read-only folder offers neither.
- **Mark done** sends `PUT …/library/folders/{fileId}/done` with the row's photos (FOLDERS-006),
  closes the menu and, once the server answers, shows the row done with the answer's `done`. No
  dialog asks first. A toast says *Marked ⟨folder⟩ done* with *Undo* for 8 s; *Undo* sends
  `DELETE …/done` and shows the row open again.
- **Reopen** sends `DELETE …/done`, closes the menu, shows the row open and says *Reopened
  ⟨folder⟩* in a toast without *Undo*. No dialog asks first.
- **Focus.** After *Mark done*, *Reopen* and *Undo* the focus is on the row's *More for ⟨name⟩*
  when the list still shows the row, else on the list.
- **A failed write** leaves the row as it was and shows an error toast: *Could not mark ⟨folder⟩
  done.* or *Could not reopen ⟨folder⟩.*; the server's text is only logged.
- **Mark all done and Reopen all.** A row with subfolders offers both in its ⋯ menu (FOLDERS-009);
  *Reopen all* is disabled when no rateable folder below is done. *Undo* after *Mark all done*
  reopens the folders just marked; *Undo* after *Reopen all* marks the folders again, each with the
  photos of its earlier status, so *n new* stays. A failed *Undo* leaves the rows as they are and
  shows the error toast of its write. More than 500 folders go in calls of 500 each.
- **New photos.** A done folder with *n new* > 0 shows the badge *n new* (n: photos now − photos at
  *Mark done*) and *Cull new* in its row; *Cull new* opens the folder as *Cull* does, with the flag
  filter set to *Unflagged* only.
- **Cull finished.** The card offers *Mark folder done* when the open folder set is exactly one
  folder without subfolders, that folder is a row of the list (below a library root), rateable and
  not done. It marks the folder as *Mark done* does, closes the card, shows the toast and, for a
  cull opened from *Folders*, shows the list again.

## Acceptance criteria

### FOLDERS-008.1 – Mark done in the row of a complete folder

- **Given** a rateable complete folder with 412 photos that is not done
- **When** the user presses *Mark done* in its row
- **Then** `PUT …/done` carries `{"photos": 412}`, no dialog opens, the row shows the done line of
  the answer and a toast says *Marked ⟨folder⟩ done* with *Undo*

### FOLDERS-008.2 – Mark done in the menu

- **Given** a rateable open folder with undecided photos
- **When** the user opens *More for ⟨name⟩* and presses *Mark done*
- **Then** the menu closes and the folder is marked as in FOLDERS-008.1

### FOLDERS-008.3 – Undo within 8 s

- **Given** the toast after *Mark done*
- **When** the user presses *Undo* before 8 s have passed
- **Then** `DELETE …/done` is sent, the row is open again and the focus is on its *More for
  ⟨name⟩*; without *Undo* the toast goes after 8 s

### FOLDERS-008.4 – Reopen in the menu

- **Given** a rateable done folder
- **When** the user opens its menu and presses *Reopen*
- **Then** `DELETE …/done` is sent without a dialog, the row is open and a toast says *Reopened
  ⟨folder⟩* without *Undo*

### FOLDERS-008.5 – Read-only folders offer neither

- **Given** a read-only folder, open or done
- **When** its row and its menu show
- **Then** neither *Mark done* nor *Reopen* is offered

### FOLDERS-008.6 – A failed write

- **Given** a server that refuses the `PUT` or the `DELETE`
- **When** the user marks the folder done, reopens it or presses *Undo*
- **Then** the row stays as it was and an error toast says *Could not mark ⟨folder⟩ done.* or
  *Could not reopen ⟨folder⟩.*, never the server's text

### FOLDERS-008.7 – Cull new

- **Given** a done folder marked with 400 photos that now has 412
- **When** the list shows it and the user presses *Cull new*
- **Then** the row shows *12 new* and *Cull new*, and the folder opens in the grid with the flag
  filter *Unflagged* only

### FOLDERS-008.8 – Mark folder done on the Cull finished card

- **Given** *Cull finished* for the folder set `{paths: [path], subfolders: false}` of a rateable
  row that is not done
- **When** the user presses *Mark folder done*
- **Then** the folder is marked with the row's photos, the card closes and the toast shows

### FOLDERS-008.9 – No Mark folder done elsewhere

- **Given** *Cull finished* for two folders, for a folder with subfolders, for a folder outside the
  library roots, for a read-only folder or for a done one
- **When** the card shows
- **Then** it offers no *Mark folder done*

### FOLDERS-008.10 – The menu on a phone

- **Given** a phone, light and dark
- **When** a row's menu is open
- **Then** it is a bottom sheet, axe finds no serious fault and every control is at least 44 px

### FOLDERS-008.11 – Undo of Reopen all

- **Given** three done folders below a row, marked with 400, 20 and 7 photos
- **When** the user presses *Reopen all* in the row's menu and *Undo* in its toast
- **Then** one `PUT /library/done` carries the three with 400, 20 and 7 photos, and the rows are
  done again

### FOLDERS-008.12 – A failed Undo of a batch

- **Given** a server that refuses the write of *Undo* after *Mark all done* or *Reopen all*
- **When** the user presses *Undo*
- **Then** the rows stay as they are and the error toast *Could not reopen the folders.* or *Could
  not mark the folders done.* shows

### FOLDERS-008.13 – The menu of a row with subfolders

- **Given** a row with subfolders whose rateable folders are all open, and one with a done folder
- **When** the user opens their ⋯ menus
- **Then** both offer *Mark all done*; *Reopen all* is disabled in the first and enabled in the
  second

## Out of scope

The done endpoints: FOLDERS-006. The list, its filters and texts: FOLDERS-002, FOLDERS-003,
FOLDERS-007. The toast's timing, close button and swipe: APP-001.

## History

| Date | Change |
|---|---|
| 2026-11-25 | *Mark all done*, *Reopen all* and their *Undo* (FOLDERS-008.11 to .13, ADR 0060, PR 4) |
| 2026-11-22 | Written with M12 PR 6 |
