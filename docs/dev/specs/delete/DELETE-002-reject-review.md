# DELETE-002 – Reject review and delete

- Status: implemented
- Area: delete
- Origin: `docs/dev/plan.md` M4.2, Q11, Q12; ADR 0032, ADR 0040
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
request, starting with 5 and doubling, one request after another; the held confirm button names
the running step and the dialog shows how many photos were sent (ADR 0029).

**Files the trash bin would not keep** (ADR 0036). When the answer refuses files as `noTrashBin`
or `tooLarge`, a warning opens before the report or the toast: *N files will be deleted
permanently*, every such file with its reason (no trash bin on this storage, larger than the trash
bin allows), *Cancel* with the focus and a separate destructive *Delete permanently*. No key
confirms it: the key map is off while it is open, and Enter or Space act on the focused *Cancel*.
Confirming
sends those files' pictures again, those files marked `permanent`; the toast and the report then
count both requests, and the files deleted for good apart. *Cancel* goes on as before: the files
stay and the report lists them with the warning's words for their reason.

**Deleting by decision under ADR 0040 (M8 PR 8).** The fresh check reads no sidecar and no
embedded XMP any more. Confirming the summary that came from the review writes the waiting
sidecars and flags, lists the pictures' folders again and sends each picture that is still
rejected in the cull, with the files of the fresh listing, and `"expect": "rejected"`
(DELETE-001.16). A picture is skipped, and stays, when its members changed; one the server
answers `decisionChanged` stays and is reported as *No longer rejected*. When a folder's fresh
listing or the request fails, nothing of it is deleted and the toast says so; there is no dialog
*Fresh check not possible*. Until then the following holds.

**Deleting by decision** (ADR 0032). Confirming the summary that came from the review first writes
the waiting sidecars (XMP-003.30), lists the pictures' folders again and reads every sidecar of each
picture, and the JPEG's embedded XMP while it counts. A picture goes only when every one of them
reads and at least one says *rejected*; the files sent are those of the fresh listing, so a sidecar
made since the folder was listed goes too. A picture is skipped, and stays, when its members
changed, a sidecar cannot be read or is not valid XMP, its sidecars disagree, or none says
*rejected*. The delete report lists the skipped photos with the reason. When a folder's fresh
listing or a sidecar lookup fails, the pictures it would have checked are not checked afresh: they
go as honeycomb knows them, rejected in the cull, with the files and ETags of the cull's listing and
honeycomb's own saves, so the server still holds a file changed since then. The failure is logged
and, before anything is sent, a dialog *Fresh check not possible for N photos* asks *Delete anyway*
or *Cancel*, with the focus on *Cancel*: *Cancel* sends nothing, the checked pictures neither, and
*Delete anyway* sends the delete, whose toast does not repeat it; the pictures whose check succeeded
keep its verdict. *Delete…* and the `Delete` key delete what the user chose, without this check.

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
- **Then** the first request carries at most 5 whole pictures and each next one twice as many, up
  to 50 pictures and 500 files, a picture never spans two requests, and the next is sent when the
  last is answered; the confirm button is held and reads *Checking the photos…* while the waiting
  sidecars are written and the photos checked, then *Moving to trash…*, and the dialog shows how
  many of the photos that passed were sent until the last answer arrives

### DELETE-002.14 – A later request fails

- **Given** a delete whose first requests were answered
- **When** a later request fails
- **Then** what was trashed leaves the grid, the pictures not sent stay whole, the error is logged,
  the delete report lists their files as failed for *Retry failed files*, and the toast counts
  moved and failed files

### DELETE-002.15 – Only what every sidecar rejects

Withdrawn by ADR 0040; M8 PR 8 marks it removed.

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

### DELETE-002.20 – Warned before deleting for good

- **Given** a delete whose answer refuses files as `noTrashBin` or `tooLarge`
- **When** the answer arrives
- **Then** a warning *N files will be deleted permanently* lists each such file with its reason,
  the focus is on *Cancel*, and the confirm button *Delete permanently* is destructive

### DELETE-002.21 – Confirmed, the files go for good

- **Given** that warning
- **When** the user taps *Delete permanently*
- **Then** the refused files' pictures are sent again with `permanent` on exactly those files, the
  files that went leave the grid, and the toast counts the files moved to the trash bin and those
  deleted permanently across both requests; a file refused again is reported without a second
  warning

### DELETE-002.22 – Cancelled, nothing more goes

- **Given** that warning
- **When** the user taps *Cancel* or closes it
- **Then** nothing more is sent, the files stay, and the report lists them with the warning's words
  for their reason (*No trash bin on this storage*, *Larger than the trash bin allows*)

### DELETE-002.23 – A failed fresh check deletes what honeycomb knows, once confirmed

Withdrawn by ADR 0040; M8 PR 8 marks it removed.

- **Given** the summary from the review with rejected pictures in two folders, the fresh listing
  of one folder failing, and in the other a picture whose sidecar now says *picked* and one whose
  sidecar lookup fails
- **When** the user confirms, and then taps *Delete anyway* in the dialog *Fresh check not possible
  for 2 photos*
- **Then** the pictures of the failed folder and the one whose lookup failed go with the files and
  ETags honeycomb knows, the *picked* one is skipped, a file changed since the listing is held by
  the server as `changed`, and the toast does not repeat the dialog

### DELETE-002.24 – No key deletes for good

- **Given** that warning
- **When** the user presses a key of the key map, e.g. Delete, Ctrl+Backspace or P, or Enter
- **Then** nothing is deleted for good: the key map's keys do nothing, and Enter acts on the
  focused *Cancel*, which closes the warning and leaves the files

### DELETE-002.25 – Cancelled before an unchecked delete, nothing goes

Withdrawn by ADR 0040; M8 PR 8 marks it removed.

- **Given** the summary from the review and a fresh check that fails for some pictures
- **When** the user confirms
- **Then** nothing is sent yet, and the dialog *Fresh check not possible for N photos* opens with
  *Delete anyway* and *Cancel*, the focus on *Cancel*
- **When** the user taps *Cancel* or closes it
- **Then** nothing is sent, neither the unchecked pictures nor the checked ones, and no toast shows

### DELETE-002.26 – The server decides what is still rejected (gap)

- **Given** the summary from the review with two rejected pictures, of which another user picks
  one after the summary opened, and a sidecar another program changed to *picked*
- **When** the user confirms
- **Then** no sidecar is looked up, both pictures are sent with `"expect": "rejected"`, the one
  picked by the other user stays and the report lists it as *No longer rejected*, and the other
  goes although its sidecar says *picked*

### DELETE-002.27 – A failed fresh listing deletes nothing of its folder (gap)

- **Given** the summary from the review with rejected pictures in two folders, the fresh listing
  of one failing
- **When** the user confirms
- **Then** no dialog asks, the pictures of the other folder go, those of the failed folder stay
  and are reported as skipped, and the failure is logged

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
| 2026-11-16 | The confirm button names the running step, and requests start at 5 pictures and double, so the count moves early (DELETE-002.13, ADR 0029) |
| 2026-11-18 | A warning before deleting for good what the trash bin would not keep (DELETE-002.20 to DELETE-002.22, ADR 0036, owner) |
| 2026-11-18 | No key confirms the warning, and the report words the reasons as the warning does (DELETE-002.22, DELETE-002.24, ADR 0036, owner) |
| 2026-11-18 | A failed fresh listing or lookup deletes the rejects honeycomb knows instead of aborting (DELETE-002.15, DELETE-002.23, ADR 0032, owner) |
| 2026-11-18 | A failed fresh check asks before deleting, instead of saying so in the toast after (DELETE-002.15, DELETE-002.23, DELETE-002.25, owner) |
| 2026-11-19 | ADR 0040: the server checks the rejects, the fresh check reads no sidecar, no dialog on a failed check (.15, .23, .25 withdrawn; .26, .27 gaps) |
