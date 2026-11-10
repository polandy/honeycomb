# MOVE-004 – Move dialog and move summary

- Status: implemented
- Area: move
- Origin: `docs/plan.md` Moving pictures, M7.3, mockup move dialog (`dlgMove`)
- Depends on: MOVE-001, MOVE-002, MOVE-003, SETTINGS-001, KEYS-001

## Purpose

Lets the user move one picture, the selection or a filter result into another folder: choose the
target folder, check every file's new path and each conflict in the move summary, move, and undo
the move from its toast.

## Behaviour

**Opening.** The move dialog opens on

| From | Pictures |
|---|---|
| *Move…* in the selection's action bar | the selected pictures |
| `M` in the grid | the selected pictures, else the focused tile's |
| *Move…* in the loupe's title row, `M` in the loupe | the loupe's photo |
| *Move picks* in the toolbar's More menu | every picked picture of the cull |
| *Move filtered* in the More menu, shown instead while a filter is on | the pictures of the view |

Pictures are taken in view order. The More menu item shows its count and is disabled at 0. The
cull keys do nothing while the dialog is open.

**Target folder.** The dialog title counts the photos. Chips offer the favourite targets first,
then the recent targets that are not favourites, at most 9, numbered `1`–`9`; a chip or its key
chooses that folder. *Browse…* opens the folder picker for one folder; a folder of the open folder
set cannot be chosen. Once a target is chosen, the dialog names it and offers *☆ Add to favourites*
or *★ Favourite*, which adds or removes it from the favourite targets.

**Move summary.** With a target, the client probes the target folders (MOVE-002) and plans the move
(MOVE-003) with the default name template (`docs/plan.md` Moving pictures) until the name template
setting arrives (M7.4). The summary counts photos, files and conflicts, shows the template, and
lists every file with its folder, name, new path and size. A picture that cannot be named is listed
with the reason and is not moved. A picture in conflict is headed by "*{name}*: a file with this
name is already in *{folder}*" and an *Add suffix* · *Skip* · *Replace* choice, *Add suffix* first;
with more than one conflict, *All conflicts:* sets every one. Notes per picture: the suffix added,
"replaces the existing file", "skipped". A note says the move keeps shares, tags, comments and
decisions on the same storage and that *Undo* moves the files back; with a *Replace*, that replaced
files stay in the Nextcloud trash bin. The confirm button says "Move *N* files" and is disabled
without a target or at 0 files; `Enter` confirms.

**Moving.** Confirming sends the plan's request. The files that moved leave the listing, the
selection and the loupe; the target becomes the first recent target (5 kept). The toast says
"Moved *{name}* to *{folder}*" or "Moved *N* photos to *{folder}*", with *Undo*; when a file got a
new file id, it adds that decisions did not move with the files. When a file failed, the move
report lists each failed file with its reason, and the toast counts moved and failed files.

**Undo.** *Undo* in the toast sends the undo request (MOVE-003). The files that came back return to
the listing at their old paths, with their decisions. `Ctrl+Z` does not undo a move; the undo
history holds only decisions.

**Failures.** A probe or move request that fails changes nothing and says so in a toast; a move the
trash bin refuses (`409`, a *Replace* with the trash bin off) says the trash bin is off.

## Acceptance criteria

### MOVE-004.1 – Opening from the selection, the grid and the loupe

- **Given** a selection, a focused tile without a selection, and the loupe on a photo
- **When** the user taps *Move…* in the action bar or presses `M`, in the grid and in the loupe
- **Then** the move dialog opens on the selected pictures in view order, on the focused tile's
  picture, and on the loupe's photo; the cull keys do nothing while it is open

### MOVE-004.2 – Move picks and Move filtered

- **Given** a cull with picked pictures, without and with an active filter
- **When** the user opens the More menu
- **Then** it offers *Move picks* with the number of picked pictures, or *Move filtered* with the
  number of pictures in the view, disabled at 0, and each opens the dialog on those pictures

### MOVE-004.3 – Favourite and recent targets as chips and keys

- **Given** stored favourite and recent targets, some in both lists, more than 9 together
- **When** the dialog opens and the user presses `2`
- **Then** the chips show the favourites with ★ first, then the recent targets that are not
  favourites, at most 9, numbered from 1, and the second chip's folder is the target

### MOVE-004.4 – Browse for a target

- **Given** the move dialog
- **When** the user chooses *Browse…*, opens folders and chooses one
- **Then** the dialog shows that folder as the target; the open folder set's folders cannot be
  chosen

### MOVE-004.5 – Add and remove a favourite target

- **Given** a chosen target that is not a favourite
- **When** the user taps *☆ Add to favourites* and then *★ Favourite*
- **Then** the target is added to the stored favourite targets and then removed again

### MOVE-004.6 – The move summary

- **Given** a chosen target and pictures with a RAW member, a rendered member and sidecars
- **When** the target folders have been probed
- **Then** the summary counts photos, files and conflicts, shows the template, and lists every file
  with its new path below the target folder

### MOVE-004.7 – Conflict choices

- **Given** two pictures in conflict
- **When** the user picks *Skip* on one, then *Replace* under *All conflicts:*
- **Then** the first is marked skipped and its files leave the count, then both say they replace
  the existing file and the note says replaced files stay in the trash bin

### MOVE-004.8 – Confirm button

- **Given** the dialog without a target, and with a target whose every picture is skipped
- **When** it is shown
- **Then** the confirm button is disabled; with files to move it says "Move *N* files" and `Enter`
  moves them

### MOVE-004.9 – The move and its toast

- **Given** a move the server answers with every file moved
- **When** the user confirms
- **Then** the request carries the plan, the pictures leave the grid, the selection and the loupe,
  the target is the first recent target, and the toast names the picture or counts the photos and
  names the folder, with *Undo*

### MOVE-004.10 – Recent targets keep the last 5

- **Given** 5 recent targets
- **When** a move to a sixth folder, and then to the third recent target, succeeds
- **Then** the sixth folder is first and the oldest is gone, then the third moves to the front
  without repeating

### MOVE-004.11 – Undo from the toast

- **Given** a move that succeeded
- **When** the user taps *Undo* in its toast
- **Then** the undo request sends the moved files back, they reappear in the grid with their
  decisions, and a toast says so; `Ctrl+Z` after a move undoes the latest decision instead

### MOVE-004.12 – Failed files are reported

- **Given** a move the server answers with some files failed
- **When** the user confirms
- **Then** the moved files leave the grid, the move report lists each failed file with its reason,
  and the toast counts moved and failed files

### MOVE-004.13 – A failed request changes nothing

- **Given** a probe or a move request that fails, or a move refused with `409`
- **When** the user chooses a target or confirms
- **Then** the grid is unchanged, the dialog closes and a toast says the move failed, or that the
  trash bin is off

### MOVE-004.14 – Across storages

- **Given** a move the server answers with a new file id for a file
- **When** the move ends
- **Then** the toast adds that decisions did not move with the files

### MOVE-004.15 – A picture that cannot be named

- **Given** a picture the name template cannot render
- **When** the summary is shown
- **Then** the picture is listed with the reason and is not part of the count or the request

## Out of scope

The name template setting, its presets and the favourite targets list in the settings: M7.4. The
endpoints: MOVE-002. The plan, conflicts, report and undo request: MOVE-003. Carrying decision rows
over to new file ids after a move across storages: `TODO.md` Later.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written for M7.3. |
