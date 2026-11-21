# SERIES-008 – The series reduction over all series

- Status: implemented
- Area: series
- Origin: owner decisions 2026-11-20 (culling aids, milestone M11); ADR 0046; mockup
  `docs/dev/mockup/quality/index.html`, scene *Series reduction*
- Depends on: SERIES-001, SERIES-005, SERIES-006, SERIES-007, GRID-001

## Purpose

*Pick this, reject the rest* decides one series at a time. Once the quality values mark the
sharpest photo of most series, the user can take that step over all of them at once, after
reviewing it. honeycomb still only suggests: nothing is flagged before the user confirms, and a
series without a clear sharpest stays for the user to compare.

## Behaviour

- **The plan** takes the series the series compare offers (open, not done, with an unflagged
  picture, SERIES-005.14), each with its members as the compare shows them, without rejected
  pictures. A series is **reduced** when it has a *sharpest* (SERIES-006.5): the sharpest is
  picked, every other member rejected. It is **left out** when it has no sharpest, when one of
  its other members is already picked (the user's decision stands) or when a member's sidecar
  is locked (XMP-008). The plan writes nothing.
- **The ⋯ menu** has the action *Reduce series to the sharpest…* below *Compare series*, with
  the count of series the plan reduces, disabled at 0 (GRID-001.18).
- **The dialog** *Reduce series to the sharpest* shows three counts: series, to pick, to reject;
  the line *Each series keeps its sharpest photo as picked and rejects the rest. Nothing is
  deleted; one undo takes it all back. Tap a photo to leave its series out.*; the thumbnails of the
  sharpest photos with the honey frame and the caption *Sharpest of 4*; and, when series are left
  out, *2 series are left out, for you to compare.* counting every series
  the plan or a tap leaves out. A tap on a thumbnail leaves its series out. *Cancel* closes it
  without a change; the primary *Pick 3, reject 9* takes the plan as it stands, disabled when no
  series is left.
  A plan without a reduced series shows *No series to reduce* instead of the counts; the menu
  action is disabled then, so this guards only a plan that changed while the menu opened.
- **The confirm** flags every reduced series as one undo step, with the toast *Picked the
  sharpest of 3 series, rejected 9 · Undo*; flags only, never the trash bin. The flags are
  written as any other decision, sidecars included; the plan, the mark and the counts are not.

## Acceptance criteria

### SERIES-008.1 – The plan reduces a series with a sharpest

- **Given** open series, one with a sharpest member and one each without a sharpest, with
  another member picked, with a locked member, and a series marked done
- **When** the plan is made
- **Then** only the first is reduced, its sharpest kept and its other members rejected; the
  other three open ones are left out, and the done series is not counted

### SERIES-008.2 – The menu offers the reduction

- **Given** the ⋯ menu while the plan reduces 3 series, and while it reduces none
- **When** it opens
- **Then** *Reduce series to the sharpest…* shows 3 and opens the dialog; with none it is disabled

### SERIES-008.3 – The dialog lists the plan

- **Given** a plan reducing 2 series of 3 and of 4 photos and leaving 1 out
- **When** the dialog opens
- **Then** it counts 2 series, 2 to pick, 5 to reject, shows the two sharpest photos with
  *Sharpest of 3* and *Sharpest of 4*, notes *1 series is left out, for you to compare.*,
  and its confirm reads *Pick 2, reject 5*

### SERIES-008.4 – A tap leaves a series out

- **Given** the dialog on a plan of 2 series
- **When** the user taps the first thumbnail, then the second
- **Then** the counts and the confirm drop the first series, then the confirm is disabled

### SERIES-008.5 – The confirm is one undo step

- **Given** the dialog on a plan of 2 series
- **When** the user confirms, then undoes
- **Then** each sharpest is picked and the rest rejected with the toast *Picked the sharpest of 2
  series, rejected 5*; the undo brings every flag back as it was

### SERIES-008.6 – Cancel changes nothing

- **Given** the open dialog
- **When** the user cancels
- **Then** it closes and no flag changes

### SERIES-008.7 – End to end

- **Given** a series of a soft and a sharp photo, measured by the cull
- **When** the user chooses *Reduce series to the sharpest…* and confirms
- **Then** the sharp photo is picked and the soft one rejected

## Out of scope

- Keeping the best 2 of a series: only as feedback asks.
- A key for the reduction: the ⋯ menu reaches it; the review dialog is the point of the step.
- The similarity page: it does not show series yet (SERIES-004).

## History

| Date | Change |
|---|---|
| 2026-11-21 | Written with the plan, the review dialog and one undo step (M11 PR 4, ADR 0046) |
