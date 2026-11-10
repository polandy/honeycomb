# DELETE-002 – Reject review and delete

- Status: implemented
- Area: delete
- Origin: `docs/plan.md` M4.2, Q11, Q12
- Depends on: DELETE-001, DECISIONS-001

## Purpose

Lets the user check the rejected pictures once more, rescue a few, and move the rest — or any
chosen pictures — into the Nextcloud trash bin after a summary of what goes.

## Behaviour

*Review rejects* opens a grid of every rejected picture in the cull, from the toolbar,
`Ctrl+Backspace`, the empty grid and after the loupe decided the last photo. Tapping a tile
rescues it: its flag is cleared like any decision. *Continue* opens the delete summary. *Delete…*
on the selection and the `Delete` key on the focused tile or the loupe's photo go straight to the
summary.

The summary counts photos, files, bytes, pairs and singles, lists the folders and every file, and
says the files go to the Nextcloud trash bin. Confirming sends every member and sidecar of each
picture to the trash endpoint. The pictures that went leave the listing and the loupe; a toast
says what was freed. Failed files end in the delete report, with a reason per file, *Close* and
*Retry failed files*. Deleting is not undone by `Ctrl+Z`; the trash bin restores.

## Acceptance criteria

### DELETE-002.1 – Review and rescue

- **Given** a cull with rejected pictures
- **When** the user opens *Review rejects* from the toolbar and taps one reject
- **Then** the review shows a tile per reject with its folder and files, the tapped one is no
  longer rejected and leaves the review, and *Continue* leads to the summary of the rest

### DELETE-002.2 – Ctrl+Backspace

- **Given** the loupe is open on a cull with rejects
- **When** the user presses `Ctrl+Backspace`
- **Then** the loupe closes, the review opens, and the cull keys do nothing while a dialog is open

### DELETE-002.3 – Offered where culling ends

- **Given** a cull with rejects
- **When** the grid is empty under the scope, or the loupe decided the last photo
- **Then** the review is offered there; without rejects it is never offered

### DELETE-002.4 – Nothing to review

- **Given** a cull without rejected pictures, or a review whose last reject was rescued
- **When** the user asks for the review, or looks at the emptied review
- **Then** a toast says *No rejected photos* and no empty review opens, or the review says nothing
  is left to delete and cannot continue

### DELETE-002.5 – Delete… and the Delete key

- **Given** a focused tile, a selection, or the loupe on a photo
- **When** the user presses `Delete` or chooses *Delete…* in the action bar
- **Then** the summary opens for those pictures, without the review

### DELETE-002.6 – The summary

- **Given** pictures to delete
- **When** the summary opens
- **Then** it shows photos, files, bytes, pairs and singles, the folders in first-seen order, every
  file (rendered member, RAW member, every sidecar form) and the trash-bin note

### DELETE-002.7 – Back, and one request at a time

- **Given** the summary
- **When** it came from the review, or a delete is running
- **Then** *Back* returns to the review, and the confirm button is held so nothing is sent twice

### DELETE-002.8 – Moving whole pictures

- **Given** the summary of pictures whose files all pass
- **When** the user confirms
- **Then** every file is sent with its listing ETag, the pictures leave the grid and the loupe
  (which shows the next photo, the previous at the end, or closes when none is left), and a toast
  says *Moved N photos · M files · X freed to the Nextcloud trash bin*

### DELETE-002.9 – The delete report

- **Given** a delete in which some files failed
- **When** the answer arrives
- **Then** the report lists each failed file with its reason, a picture that lost a member stays
  as what is left of it (a pair becomes a single with its sidecars, a picture left with only
  sidecars goes), and a toast says how many moved and how many failed

### DELETE-002.10 – Retry failed files

- **Given** the delete report
- **When** the user taps *Retry failed files*
- **Then** only the failed and skipped files are sent again, grouped by their picture

### DELETE-002.11 – A failed request changes nothing

- **Given** the trash bin is off, or the request fails
- **When** the user confirms
- **Then** the grid is unchanged, the dialog closes and a toast says why

### DELETE-002.12 – Not undone by Ctrl+Z (gap)

- **Given** pictures just moved to the trash bin
- **When** the user presses `Ctrl+Z`
- **Then** the pictures do not come back; the undo history holds only decisions

## Out of scope

The endpoint and its checks: DELETE-001. Removing only RAWs: DELETE-003.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged M4.2 (#52) |
