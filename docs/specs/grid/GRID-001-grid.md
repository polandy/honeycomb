# GRID-001 – Grid

- Status: implemented
- Area: grid
- Origin: `docs/plan.md` M2.3, Grid, filters and sort, Multiple folders, Image delivery & performance; ADR 0010
- Depends on: LISTING-002, LISTING-003, IMAGES-001

## Purpose

The grid shows every picture of the open cull as a tile, so the user sees the whole folder set at
a glance, at any size, without waiting for a sharp image of every tile.

## Behaviour

- The grid is virtual: only the rows near the viewport exist, so 20,000 pictures scroll as
  smoothly as 20. A new cull starts at the top.
- A tile shows the image member's 256 px preview first and swaps in the sharp tier (256 or
  512 px by tile size × device pixel ratio) once it has decoded; a failed decode keeps the small
  one.
- A pair carries a quiet badge with both extensions (`JPG+CR3`); a single a highlighted one
  (`JPG only`, `NEF only`). A picture with an ambiguous name shows `!`.
- Rating (once rated), colour label, flag and *Keep RAW* are always visible on a tile; an
  undecided tile shows none of them.
- The tile size is stepless from 90 to 340 px, 160 px by default. Ctrl + wheel, a two-finger
  pinch and the size control in the ⋯ menu change it; the browser keeps it per device.
- *Group by folder* in the ⋯ menu is offered when the cull spans more than one folder (off by
  default): a header names each folder relative to the picked folder with its count and sticks at
  the top while its tiles scroll.
- A click, Enter or Space on a tile outside selection mode opens the loupe on it.
- Above 20,000 pictures the grid shows the first 20,000 by capture time.

## Acceptance criteria

### GRID-001.1 – Only the rows near the viewport exist

- **Given** a cull with more rows than fit the viewport
- **When** the grid renders or scrolls
- **Then** it renders the rows the viewport crosses and one viewport around them, and a new cull
  starts at the top

### GRID-001.2 – Small preview first, sharp after decoding

- **Given** a tile
- **When** it appears
- **Then** it shows the small preview of its image member, and the sharp tier replaces it only
  after the sharp image decoded; no sharp image is loaded while the small one is sharp enough

### GRID-001.3 – A failed sharp image keeps the small one

- **Given** a tile whose sharp image fails to decode
- **When** the decode fails
- **Then** the tile keeps showing the small preview

### GRID-001.4 – Pair badge

- **Given** a pair, a rendered-only and a RAW-only picture
- **When** their tiles render
- **Then** the pair shows both extensions quietly (`JPG+NEF`), each single its extension and
  "only", highlighted (`JPG only`, `NEF only`)

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

## Out of scope

Pairing (LISTING-002), the folder picker and its over-the-cap notice (LISTING-003), filters and
sort (GRID-002), selection (GRID-003), the image endpoint (IMAGES-001), keyboard focus moves
(KEYS-001).

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged M2.3 (#41) |
