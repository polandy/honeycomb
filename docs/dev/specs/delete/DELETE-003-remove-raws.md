# DELETE-003 – Remove RAWs

- Status: implemented
- Area: delete
- Origin: `docs/dev/plan.md` M4.3, Keep RAW and Remove RAWs (owner, 2026-11-09);
  ADR 0040
- Depends on: DELETE-001, DELETE-002, DECISIONS-001

## Purpose

Once a cull is done, frees the space of the RAWs the user does not want to keep: only the RAW
member and its own sidecars of each pair go to the trash bin, the JPEG and every decision stay.

## Behaviour

*Remove RAWs…* in the grid's ⋯ menu, with a count, acts on the current view (flag filter and filters).
It takes every pair that is not marked *Keep RAW* and not rejected; singles, marked and rejected
pictures are skipped and counted by reason. The summary shows pictures · files · bytes freed,
what was skipped and why, two thumbnail groups — *RAW will be removed* and *RAW stays (Keep RAW)* —
and the files in a collapsed section. Tapping a thumbnail toggles *Keep RAW* on that picture, an
undoable decision with its toast, and moves it to the other group.

Confirming sends each RAW with its own sidecars (`<raw>.xmp` and darktable duplicates) as one
picture to the trash endpoint, RAW first. The JPEG, its sidecar and a shared `<base>.xmp` stay; the
picture becomes a *JPEG only* single. Like deleting, it is not undone by `Ctrl+Z` (DELETE-002.12).

**Under ADR 0040 (M8 PR 8)** confirming reads no sidecar to check: it sends each pair still
neither *Keep RAW* nor rejected in the cull with `"expect": "rawRemovable"`, and the server keeps
a pair whose rows say otherwise (DELETE-001.17). Before a RAW sidecar that states a rating, colour
label or tags goes, a JPEG without a sidecar of its own nor a shared one gets `<jpeg>.xmp` with
the picture's rating, colour label and tags, without the flag fields; where it cannot be written
the pair is skipped. The JPEG keeps its row in `honeycomb_flags`, the RAW's goes with it
(DELETE-001.15). When the fresh listing or the request fails, nothing of it is removed. Until then
the following holds.

Confirming checks the sidecars afresh like deleting by decision (DELETE-002.15): a pair goes only
when every sidecar reads and none says *Keep RAW* or *rejected*. Before a RAW sidecar that states a
decision or tags goes, a pair whose JPEG has no sidecar of its own nor a shared one gets
`<jpeg>.xmp` with the picture's decision and tags, so the JPEG keeps its values in digiKam. Where
that sidecar cannot be written (the picture is not writable, XMP-008, or the save fails), the pair
is skipped. The delete report lists the skipped photos (DELETE-002.16). When the fresh listing or
lookup fails, the RAWs go as honeycomb knows them once the user confirms *Delete anyway*
(DELETE-002.23, DELETE-002.25), except a pair whose JPEG has no sidecar of its own nor a shared one
while the RAW has one: its values cannot be read to copy, so it is skipped as *A sidecar could not
be read*.

## Acceptance criteria

### DELETE-003.1 – The action and its count

- **Given** a view with pairs not marked *Keep RAW* and not rejected
- **When** the user opens the ⋯ menu
- **Then** *Remove RAWs…* shows how many pictures it would take, and opens the summary on the view

### DELETE-003.2 – What is taken and what is skipped

- **Given** a view of pairs, singles, marked and rejected pictures
- **When** the removal is worked out
- **Then** it takes the unmarked, unrejected pairs and counts the skipped ones as marked Keep RAW,
  rejected or singles; an empty view takes nothing

### DELETE-003.3 – The summary

- **Given** the summary is open
- **When** the user reads it
- **Then** it sums up the RAWs that go (pictures, files, bytes), says what was skipped and why,
  lists their files in a collapsed section, shows both thumbnail groups with their counts and the
  trash-bin note of DELETE-002.6

### DELETE-003.4 – Keep RAW from the summary

- **Given** the summary is open
- **When** the user taps a thumbnail
- **Then** *Keep RAW* toggles on that picture with its undo toast, the picture moves to the other
  group, and the numbers, the button and the menu's count follow

### DELETE-003.5 – Nothing to remove

- **Given** a group without pictures, nothing to move, or a removal running
- **When** the summary shows
- **Then** the empty group says *None* and the confirm button is held; nothing is sent without the
  summary open

### DELETE-003.6 – Only the RAW and its own sidecars

- **Given** the summary of pairs
- **When** the user confirms
- **Then** each RAW and its own sidecars are sent as one unit, RAW first; the JPEG, its sidecar and
  a shared sidecar stay; each picture shows as a *JPEG only* single with its decisions, and a toast
  says *Removed the RAWs of N photos · M files · X freed to the Nextcloud trash bin*

### DELETE-003.7 – A failed RAW keeps its sidecar

- **Given** a RAW that cannot be trashed
- **When** the removal runs
- **Then** its sidecar is not tried, the picture stays a pair, the other RAWs go, and the delete
  report lists the failed files

### DELETE-003.8 – Only pairs every sidecar lets go

Withdrawn by ADR 0040; M8 PR 8 marks it removed.

- **Given** the summary with a pair whose RAW sidecar says *Keep RAW* since the listing, a pair
  whose sidecar cannot be read, and an undecided pair without sidecars
- **When** the user confirms
- **Then** only the RAW of the undecided pair goes; the other two are skipped and reported

### DELETE-003.9 – The JPEG keeps its values

- **Given** a pair whose only sidecar is `IMG.NEF.xmp` with a rating and tags, and a second such
  pair whose JPEG cannot get a sidecar written
- **When** the user confirms *Remove RAWs*
- **Then** `IMG.JPG.xmp` is written with the rating and tags before the first RAW goes; the second
  pair is skipped and keeps its RAW

### DELETE-003.10 – A failed fresh check removes what honeycomb knows

Withdrawn by ADR 0040; M8 PR 8 marks it removed.

- **Given** the summary with a pair without sidecars and a pair whose only sidecar is
  `IMG.NEF.xmp`, and the fresh listing failing
- **When** the user confirms, and then taps *Delete anyway* in the dialog *Fresh check not possible
  for 1 photo*
- **Then** the first RAW goes as honeycomb knows it, the second pair is skipped as unread, and the
  toast does not repeat the dialog

### DELETE-003.11 – The server decides what may go (gap)

- **Given** the summary with two pairs neither *Keep RAW* nor rejected, of which another user marks
  one *Keep RAW* after the summary opened, and a pair whose RAW sidecar says *Keep RAW* since the
  listing
- **When** the user confirms
- **Then** no sidecar is looked up to check, the pair marked by the other user keeps its RAW and
  is reported, and the other two RAWs go

### DELETE-003.12 – The JPEG's new sidecar holds no flag (gap)

- **Given** a pair, neither rejected nor *Keep RAW*, whose only sidecar is `IMG.NEF.xmp` with
  three stars, red and a tag, and whose rows say *picked*
- **When** the user confirms *Remove RAWs*
- **Then** `IMG.JPG.xmp` is written with three stars, red and the tag and no flag field, before the
  RAW goes; the JPEG's row stays *picked*, the RAW's row is gone

## Out of scope

Marking *Keep RAW* elsewhere and its filter: DECISIONS-001, GRID-002, GRID-003. Writing the marker
to XMP: M5.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged M4.3 (#53) |
| 2026-11-15 | The summary shows the trash-bin note of DELETE-002.6 |
| 2026-11-15 | Checks the sidecars afresh and writes the JPEG's sidecar first (DELETE-003.8, DELETE-003.9, ADR 0032 PR 8) |
| 2026-11-18 | A failed fresh listing or lookup removes the RAWs honeycomb knows instead of aborting (DELETE-003.10, owner) |
| 2026-11-18 | A failed fresh check asks before removing the RAWs (DELETE-003.10, owner) |
| 2026-11-19 | ADR 0040: the server checks the pairs, the JPEG sidecar holds rating, colour label and tags only (.8, .10 withdrawn; .11, .12 gaps) |
