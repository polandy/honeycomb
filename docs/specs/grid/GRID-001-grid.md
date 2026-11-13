# GRID-001 – Grid

- Status: implemented
- Area: grid
- Origin: `docs/plan.md` M2.3, Grid, filters and sort, Multiple folders,
  Image delivery & performance; ADR 0010
- Depends on: LISTING-002, LISTING-003, IMAGES-001

## Purpose

The grid shows every picture of the open cull as a tile, so the user sees the whole folder set at
a glance, at any size, without waiting for a sharp image of every tile.

## Behaviour

- The grid is virtual: only the rows near the viewport exist, so 20,000 pictures scroll as
  smoothly as 20. A new cull starts at the top.
- A tile shows the image member's 256 px preview once it has arrived, then requests the sharp
  tier (1024 px, when tile size × device pixel ratio exceeds 256) and swaps it in once it has
  decoded; a failed decode keeps the small one.
- The grid loads at most six images at a time: the tiles in the viewport first, then the ones
  around it, each tile's small preview before its sharp one. A tile that leaves the rendered rows
  drops its waiting load.
- Until its small preview has loaded, a tile is a skeleton tile: its empty face pulses (still with
  reduced motion); a preview that fails to load stops the pulse.
- While a folder set from *Recent* is listed, skeleton tiles fill the content area and a status
  tells screen readers *Loading photos…*.
- A complete pair carries no badge; a single carries a highlighted one (`JPG only`, `NEF only`).
  A pair marked *Keep RAW* shows both extensions with a check (`JPG+CR3 ✓`). The tile's
  accessible name still says `JPG+CR3`. A picture with an ambiguous name shows `!`.
- Rating (once rated), colour label, flag and *Keep RAW* are always visible on a tile; an
  undecided tile shows none of them.
- The tile size is stepless from 90 to 340 px, 160 px by default. Ctrl + wheel, a two-finger
  pinch and the size control in the ⋯ menu change it; the browser keeps it per device.
- *Group by folder* in the ⋯ menu is offered when the cull spans more than one folder (off by
  default): a header names each folder relative to the picked folder with its count and sticks at
  the top while its tiles scroll.
- A click, Enter or Space on a tile outside selection mode opens the loupe on it.
- Above 20,000 pictures the grid shows the first 20,000 by capture time.
- The toolbar's count badges (*Filters*, *Select*, *Review rejects*, *Compare series*) are
  neutral; a badge takes the primary colour only while its button is pressed.
- The toolbar stays slim: one filter icon, the one of *Filters*. Below 900 px window width
  *Review rejects* and *Compare series* move from the toolbar into the ⋯ menu, with their counts,
  and below 600 px the flag chips show their icons only, so the toolbar takes at most two rows on
  a phone; selection mode adds its own row.
- The ⋯ menu holds view options (thumbnail size, *Group by folder*, sort) above one separator and
  actions below it. Choosing an action closes the menu; changing a view option keeps it open.

## Acceptance criteria

### GRID-001.1 – Only the rows near the viewport exist

- **Given** a cull with more rows than fit the viewport
- **When** the grid renders or scrolls
- **Then** it renders the rows the viewport crosses and one viewport around them, and a new cull
  starts at the top

### GRID-001.2 – Small preview first, sharp after decoding

- **Given** a tile
- **When** it appears
- **Then** it shows the small preview of its image member once it arrived, requests the sharp
  tier only then, and the sharp tier replaces it only after it decoded; no sharp image is loaded
  while the small one is sharp enough

### GRID-001.3 – A failed sharp image keeps the small one

- **Given** a tile whose sharp image fails to decode
- **When** the decode fails
- **Then** the tile keeps showing the small preview

### GRID-001.4 – Pair badge

- **Given** a pair, a rendered-only and a RAW-only picture
- **When** their tiles render
- **Then** the pair shows no badge, and its accessible name still names both extensions
  (`JPG+NEF`); each single shows its extension and "only", highlighted (`JPG only`, `NEF only`);
  a pair marked *Keep RAW* shows both extensions with a check (`JPG+NEF ✓`)

### GRID-001.5 – Ambiguous name

- **Given** a picture whose base name matches several files ambiguously
- **When** its tile renders
- **Then** it shows `!` and its accessible name says "ambiguous name"

### GRID-001.6 – Decisions always on the tile

- **Given** a picture with a rating, colour label, flag or *Keep RAW*
- **When** its tile renders
- **Then** each is visible on the tile and named in its accessible label; an undecided picture
  shows no overlay

### GRID-001.7 – Stepless tile size

- **Given** the grid
- **When** the user turns the wheel with Ctrl, pinches with two fingers or sets the size in the
  ⋯ menu
- **Then** the tiles take the new size, clamped to 90–340 px; a plain wheel scrolls

### GRID-001.8 – Tile size per device

- **Given** a tile size stored in the browser
- **When** a cull opens
- **Then** the grid uses it and stores every change; without site data it uses 160 px and still
  follows changes

### GRID-001.9 – Group by folder

- **Given** a cull of more than one folder
- **When** the grid groups by folder
- **Then** each folder has a header with its name relative to the picked folder and its count,
  the current folder's header sticks at the top, and a cull of one folder is never grouped

### GRID-001.10 – A tile opens the loupe

- **Given** the grid outside selection mode
- **When** the user clicks a tile or presses Enter or Space on it
- **Then** the loupe opens on that picture

### GRID-001.11 – At most 20,000 pictures

- **Given** a folder set of more than 20,000 pictures
- **When** the cull opens
- **Then** the grid shows the first 20,000 by capture time

### GRID-001.12 – A tile is a skeleton until its preview loads

- **Given** a tile whose small preview has not loaded yet
- **When** it renders
- **Then** it is a skeleton tile, and it stops being one once the preview loaded or failed to load

### GRID-001.13 – Skeleton tiles while a folder set lists

- **Given** a folder set opened from *Recent*
- **When** its listing has not arrived yet
- **Then** skeleton tiles take the place of the grid and a status says *Loading photos…*, until
  the cull opens or the listing fails

### GRID-001.14 – Count badges are neutral until pressed

- **Given** a toolbar button with a count badge
- **When** the button is not pressed
- **Then** its badge is neutral, and it takes the primary colour while the button is pressed
  (*Filters* while the filter bar is open, *Select* in selection mode)

### GRID-001.15 – A few image loads at a time, visible tiles first

- **Given** a grid whose rendered tiles need more images than the limit of six
- **When** the tiles load their images
- **Then** at most six loads are in flight; the next to start is a tile in the viewport before
  one around it, a small preview before a sharp one, then the oldest request; a tile that scrolls
  into view moves its waiting load forward, and an unmounted tile's waiting load never starts

## Out of scope

Pairing (LISTING-002), the folder picker and its over-the-cap notice (LISTING-003), filters and
sort (GRID-002), selection (GRID-003), the image endpoint (IMAGES-001), keyboard focus moves
(KEYS-001).

### GRID-001.16 – A tile's marks sit on a dark shade

- **Given** a tile of a picture with a rating, a colour label or a flag
- **When** it renders in the light or the dark theme
- **Then** the flag mark, the colour dot and the stars sit together on one dark shade along the
  tile's bottom edge, and the stars are white, the same in both themes; a tile without a mark has
  no shade

### GRID-001.17 – The toolbar takes at most two rows on a phone

- **Given** an open cull
- **When** the window is narrower than 900 px
- **Then** *Review rejects* and *Compare series* are not in the toolbar but in the ⋯ menu, with
  their counts and held while there is nothing to review or compare; no filter icon stands before
  the flag chips; and on a phone (390 px) the toolbar outside selection mode takes at most two rows

### GRID-001.18 – The ⋯ menu sets view options apart from actions

- **Given** the open ⋯ menu
- **When** the user looks at it, changes a view option or chooses an action
- **Then** one separator stands between the view options (thumbnail size, *Group by folder*, sort)
  and the actions; a changed view option leaves the menu open, and an action (*Review rejects*,
  *Compare series*, *Remove RAWs…*, *Move picks…*, *Resume at*, *Write decisions to sidecars…*,
  *Settings*) closes it, so no menu stays above the dialog or view it opens

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged M2.3 (#41) |
| 2026-11-11 | GRID-001.14: neutral toolbar count badges, primary only while pressed (UX review L7) |
| 2026-11-11 | GRID-001.15: at most six image loads, visible tiles first; sharp tier 1024 after the small one (owner, nc-test analysis) |
| 2026-11-12 | GRID-001.16: marks on one dark bottom shade, white stars in both themes (UX review H2) |
| 2026-11-13 | GRID-001.17: slim toolbar, *Review rejects* and *Compare series* in the ⋯ menu below 900 px (UX review M1) |
| 2026-11-13 | GRID-001.4: no badge on a complete pair, singles and *Keep RAW* keep theirs (UX review M3) |
| 2026-11-13 | GRID-001.18: a separator between view options and actions in the ⋯ menu; an action closes it (UX review M7) |
