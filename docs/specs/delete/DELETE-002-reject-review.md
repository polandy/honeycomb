# DELETE-002 – Reject review and delete

- Status: implemented
- Area: delete
- Origin: `docs/plan.md` M4.2, Q11, Q12
- Depends on: DELETE-001, DECISIONS-001

## Purpose

Lets the user check the rejected pictures once more, rescue a few, and move the rest — or any
chosen pictures — into the Nextcloud trash bin after a summary of what goes.

## Behaviour

*Review rejects* opens a grid of every rejected picture in the cull, whatever the filters show,
from the toolbar, the ⋯ menu at every width (which shows its key), `Ctrl+Backspace`, the empty
grid and after the loupe decided the last photo. Tapping a tile rescues it: its flag is cleared
like any decision. *Continue* opens the delete summary. *Delete…* on the selection and the
`Delete` key on the focused tile or the loupe's photo go straight to the summary.

The summary counts photos, files, bytes, pairs and singles, lists the folders and every file, and
says the files go to the Nextcloud trash bin, that the trash bin empties itself after its
retention time or sooner when space runs short, and to keep a backup. Confirming sends every
member and sidecar of each picture to the trash endpoint. The pictures that went leave the listing
and the loupe; a toast says what was freed. Failed files end in the delete report, with a reason
per file, *Close* and *Retry failed files*. Deleting is not undone by `Ctrl+Z`; the trash bin
restores. A delete, a *Remove RAWs* and a retry send at most 50 pictures and 500 files per
request, one request after another, and the dialog shows how many photos were sent (ADR 0029).

**Deleting by decision** (ADR 0032). Confirming the summary that came from the review first writes
the waiting sidecars (XMP-003.30), lists the pictures' folders again and reads every sidecar of each
picture, and the JPEG's embedded XMP while it counts. A picture goes only when every one of them
reads and at least one says *rejected*; the files sent are those of the fresh listing, so a sidecar
made since the folder was listed goes too. A picture is skipped, and stays, when its members
changed, a sidecar cannot be read or is not valid XMP, its sidecars disagree, or none says
*rejected*. The delete report lists the skipped photos with the reason. *Delete…* and the `Delete`
key delete what the user chose, without this check.

**honeycomb's own writes** (ADR 0032). *Delete…* and the `Delete` key also write the waiting
sidecars first. Each sidecar honeycomb saved since the folder was listed is sent with the ETag of
that save, and a sidecar honeycomb created for a member goes with its picture, so honeycomb's own
writes are no change. A sidecar another program changed since the listing, before or after
honeycomb's write, keeps the listing's ETag and holds its picture as `changed`.

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
- **When** the grid is empty under the filters, or the loupe decided the last photo
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
  file (rendered member, RAW member, every sidecar form) and the trash-bin note, which names the
  retention and space risk and advises a backup

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

### DELETE-002.12 – Not undone by Ctrl+Z

- **Given** pictures just moved to the trash bin
- **When** the user presses `Ctrl+Z`
- **Then** the pictures do not come back; the undo history holds only decisions

### DELETE-002.13 – Requests in chunks

- **Given** a delete of more pictures than one request carries
- **When** the user confirms
- **Then** each request carries at most 50 whole pictures and 500 files, a picture never spans two
  requests, the next is sent when the last is answered, and the dialog shows how many of the
  photos were sent until the last answer arrives

### DELETE-002.14 – A later request fails

- **Given** a delete whose first requests were answered
- **When** a later request fails
- **Then** what was trashed leaves the grid, the pictures not sent stay whole, the error is logged,
  the delete report lists their files as failed for *Retry failed files*, and the toast counts
  moved and failed files

### DELETE-002.15 – Only what every sidecar rejects

- **Given** the summary from the review, with a picture whose sidecar another program changed to
  *picked*, a pair whose RAW sidecar says *rejected* and JPEG sidecar *unflagged*, a picture with an
  unreadable sidecar, and a picture every sidecar of which says *rejected*
- **When** the user confirms
- **Then** the waiting sidecars are written first, the folders are listed again, and only the last
  picture is sent, with every sidecar of the fresh listing; the others stay

### DELETE-002.16 – The skipped photos are reported

- **Given** a delete by decision that skipped pictures
- **When** it ends
- **Then** the delete report lists each skipped photo with its reason, *Retry failed files* is held
  while no file failed, and the toast adds how many photos were skipped; when every picture was
  skipped, nothing is sent

### DELETE-002.17 – honeycomb's own writes are no change

- **Given** chosen pictures whose existing sidecar honeycomb saved and whose missing sidecar it
  created since the folder was listed, the last write still waiting
- **When** the user confirms *Delete…*
- **Then** the waiting write lands first, each saved sidecar is sent with the ETag of its last
  save, the created sidecar goes with its picture, and every picture moves to the trash bin

### DELETE-002.18 – Another program's change still holds the picture

- **Given** a chosen picture whose sidecar another program changed after honeycomb saved it
- **When** the user confirms *Delete…*
- **Then** the sidecar reports `changed`, no file of that picture is touched, and the other
  pictures move to the trash bin

### DELETE-002.19 – From the ⋯ menu, whatever the filters show

- **Given** a cull with rejects that the flag filter hides, at any window width
- **When** the user opens the ⋯ menu and chooses *Review rejects*, shown with its count and
  `Ctrl+Backspace`
- **Then** the review opens on every reject of the cull and leads through the same summary and
  fresh check to the trash bin; without rejects the entry is held

## Out of scope

The endpoint and its checks: DELETE-001. Removing only RAWs: DELETE-003.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged M4.2 (#52) |
| 2026-11-10 | DELETE-002.12 proven by a Vitest test |
| 2026-11-15 | Requests in chunks with progress (DELETE-002.13, DELETE-002.14, ADR 0029) |
| 2026-11-15 | The trash-bin note names the retention and space risk and advises a backup; `noTrashBin` has its reason (DELETE-002.6, DELETE-002.9) |
| 2026-11-15 | Deleting by decision checks the sidecars afresh and reports the skipped photos (DELETE-002.15, DELETE-002.16, ADR 0032 PR 8) |
| 2026-11-15 | *Review rejects* in the ⋯ menu at every width, with its key (DELETE-002.19, owner) |
| 2026-11-15 | *Delete…* sends the sidecars as honeycomb last saved or created them; only another program's change holds a picture (DELETE-002.17, DELETE-002.18) |
