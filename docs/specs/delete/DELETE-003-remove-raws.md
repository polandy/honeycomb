# DELETE-003 – Remove RAWs

- Status: implemented
- Area: delete
- Origin: `docs/plan.md` M4.3, Keep RAW and Remove RAWs (owner, 2026-11-09)
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
  lists their files in a collapsed section and shows both thumbnail groups with their counts

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

## Out of scope

Marking *Keep RAW* elsewhere and its filter: DECISIONS-001, GRID-002, GRID-003. Writing the marker
to XMP: M5.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged M4.3 (#53) |
