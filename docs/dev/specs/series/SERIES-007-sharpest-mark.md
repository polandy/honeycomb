# SERIES-007 – The *Sharpest* mark and the zoom onto the focus tile

- Status: implemented
- Area: series
- Origin: owner decisions 2026-11-20 (culling aids, milestone M11); ADR 0046; mockup
  `docs/dev/mockup/quality/index.html`, scenes *Series compare*, *No clear sharpest*, *Series
  viewer* and *Info panel*
- Depends on: SERIES-001, SERIES-002, SERIES-006, LOUPE-001

## Purpose

The quality values of SERIES-006 point at the photo of a series a person would most likely keep.
honeycomb only marks it: it never picks, never makes it the active card and never writes the mark
anywhere, so the user's decision stays theirs. The zoom to 100 % lands on the photo's sharpest
spot, which is mostly the subject, instead of its middle.

## Behaviour

- **The members counted** are those the view shows of the series: the series compare's cards, the
  series viewer's photos (both without rejected pictures, SERIES-001, SERIES-002), and in the
  loupe the series' members as its position *photo 2 of 4* counts them (LOUPE-001.19). Among them
  the *sharpest* is chosen as SERIES-006.5 says: at least 5 % above every other, else none.
- **The series compare** shows *Sharpest* with the focus icon at the bottom left of the sharpest
  card's photo. The active card stays the first photo, as without the mark.
- **The series viewer** shows *Sharpest* in its title row, beside the position, while the sharpest
  photo is shown.
- **The loupe's filmstrip** shows the focus icon at the bottom left of the thumbnail of each
  series' sharpest photo, with the tooltip *Sharpest*.
- **The loupe's info panel** has a section *Quality* with the row *Sharpness*: *Sharpest of 4*
  for the sharpest photo, else *Rank 2 of 4* (1 for the sharpest value, a tie sharing the better
  rank), with the note *Compared within its series only*; never the raw value. The section is left
  out for a picture outside a series and while a member of its series has no quality value.
- **Zoom onto the focus tile:** `Z`, `Space` in the series viewer, the *Fit* / 100 % button,
  `Ctrl+=` and in the series viewer a double-tap in the middle zoom a fitted photo with a quality
  value to 100 % centred on the middle of its focus tile, as far as the photo's edges let the
  stage show it (LOUPE-001.7); a photo without a quality value zooms on its middle, a pinch on the
  fingers as before. In the series viewer the zoom and spot then carry over to the other photos
  (SERIES-002.3), so every photo shows the spot of the photo it was zoomed on.
- The mark, the rank and the zoom write nothing: no flag, no sidecar, no request.

## Acceptance criteria

### SERIES-007.1 – The compare marks the sharpest card

- **Given** a series of three whose second member is more than 5 % sharper than the others
- **When** the series compare shows it
- **Then** the second card's photo carries *Sharpest*, no other card does, and the first card is
  active

### SERIES-007.2 – No clear sharpest, no mark

- **Given** a series whose two sharpest members lie within 5 %, or one with a member without a
  quality value
- **When** the series compare shows it
- **Then** no card carries *Sharpest*

### SERIES-007.3 – The series viewer marks the sharpest photo

- **Given** the series viewer on a series with a sharpest photo
- **When** it shows the sharpest photo, and then another one
- **Then** the title row says *Sharpest* for the first, and not for the other

### SERIES-007.4 – The filmstrip marks the sharpest thumbnail

- **Given** the loupe on a folder with a series that has a sharpest photo, and a series without one
- **When** the filmstrip shows them
- **Then** only the thumbnail of the sharpest photo carries the mark *Sharpest*

### SERIES-007.5 – The rank in the info panel

- **Given** the loupe's info panel on the sharpest photo of a series of four, on its second, on a
  member of a series whose member lacks a value, and on a picture outside a series
- **When** each is shown
- **Then** *Sharpness* reads *Sharpest of 4*, then *Rank 2 of 4*; the last two have no section
  *Quality*

### SERIES-007.6 – The rank of each member

- **Given** the quality values of a series' members
- **When** a member's rank is asked
- **Then** it is one more than the number of members sharper than it, with the count of members
  and whether it is the sharpest; none for a non-member, fewer than two members or a member
  without a value

### SERIES-007.7 – The zoom lands on the focus tile

- **Given** a fitted photo with a quality value whose focus tile is in its top left corner, and
  one without a value
- **When** the user presses `Z`, or double-taps the middle in the series viewer
- **Then** the first zooms to 100 % with the middle of its focus tile as near the stage's middle as
  its edges allow, the second on its middle

### SERIES-007.8 – A sharp and a soft photo, end to end

- **Given** a series of a soft photo and then a sharp one of the same scene, measured by the cull
- **When** the user opens the series compare, views the sharp photo full screen and presses `Z`
- **Then** the sharp card carries *Sharpest*, the soft card stays active and both stay unflagged;
  the viewer's title row says *Sharpest* and the zoom moves the photo towards its sharp top left
  corner

## Out of scope

- The series reduction over all series from the marks: milestone M11, PR 4.
- Shake risk and clipping hints: milestone M11, PR 5.
- A mark on the loupe's photo itself: the filmstrip and the info panel name it there.

## History

| Date | Change |
|---|---|
| 2026-11-20 | Written with the mark, the rank and the zoom onto the focus tile (M11 PR 3, ADR 0046) |
