# GRID-003 – Selection mode and bulk decisions

- Status: implemented
- Area: grid
- Origin: `docs/plan.md` M2.6, Grid, filters and sort item 4; Q10
- Depends on: GRID-001, DECISIONS-001

## Purpose

Selection mode lets the user rate, label, flag or mark *Keep RAW* many pictures in one step, by
touch as well as with a mouse or keyboard.

## Behaviour

- *Select* in the toolbar enters and *Done* leaves selection mode; a long-press on a tile enters
  it and selects that tile. Ctrl- or Cmd-click enters it too; Shift-click selects the range from
  the anchor.
- Dragging on after the long-press, without lifting the finger, selects the range in grid order
  from the pressed tile to the tile under the finger; dragging back removes what this drag added,
  never what was selected before it. Near the top or bottom edge the grid scrolls on by itself,
  faster the closer the finger is to the edge. While the drag lasts the grid does not scroll by
  the finger; a swipe that starts without a long-press scrolls as before.
- In selection mode a tap, Enter or Space toggles a tile. Selected tiles are marked; the selection
  check shows only in selection mode. The toolbar counts the selection and offers *Select all*
  (the shown pictures) and *Select none*.
- The action bar shows rating, colour label, flag and *Keep RAW*; a control is pressed where every
  selected picture shares the value. It is disabled while nothing is selected. *Keep RAW* acts on
  pairs only and is disabled, with a reason, without one.
- Where the action bar does not fit one row, the flags, *Move* and *Delete* take the first row and
  rating, colour label, *Keep RAW* and *Tags* follow below; on a phone in portrait they need two
  more rows, since 44 px targets leave no room for all four in one.
- A change writes the whole new decision of every member of each changed picture; a picture the
  change leaves as it is sends nothing. A save the server refuses is reverted and reported,
  unless another folder set is open by then.
- A rejected picture leaves the view (default filter) and the selection; the selection keeps only
  shown pictures.

## Acceptance criteria

### GRID-003.1 – Enter and leave

- **Given** the grid
- **When** the user presses *Select*, then *Done*
- **Then** selection mode starts with the action bar, disabled until something is selected, and
  ends

### GRID-003.2 – Long-press selects

- **Given** the grid outside selection mode
- **When** a finger stays on a tile long enough
- **Then** selection mode starts with that tile selected and the click that follows is swallowed;
  lifting the finger early, moving more than 10 px, a cancelled pointer or a secondary button
  select nothing

### GRID-003.3 – Toggle and range

- **Given** selection mode, or a Ctrl- or Cmd-click outside it
- **When** the user taps a tile or Shift-clicks another
- **Then** the tile toggles and becomes the anchor, and Shift selects the range from the anchor
  (or toggles when there is none)

### GRID-003.4 – Select all, none, done

- **Given** selection mode
- **When** the user chooses *Select all*, *Select none* or *Done*, in the toolbar or by key
- **Then** every shown picture, none, or selection mode ends

### GRID-003.5 – Bulk decision on every member

- **Given** selected pictures
- **When** the user sets a rating, colour label or flag
- **Then** every member of each picture gets the whole new decision, it is stored and shown, and
  survives a reload

### GRID-003.6 – Shared values pressed

- **Given** a selection
- **When** the action bar renders
- **Then** a control is pressed where every selected picture shares the value, and none where
  they differ; the colour palette sets a label or none and closes, Escape closes it unchanged

### GRID-003.7 – Keep RAW on pairs only

- **Given** a selection with and without pairs
- **When** the user marks *Keep RAW*
- **Then** only the pairs change; it marks unless every pair has it; without a pair it is
  disabled and says why

### GRID-003.8 – The selection follows the view

- **Given** selected pictures
- **When** one is rejected in the default filter, or another folder set opens
- **Then** it leaves the view and the selection; the selection keeps only shown pictures

### GRID-003.9 – A refused save is reverted

- **Given** a bulk change
- **When** the server does not store it
- **Then** the change is reverted and the user is told; once another folder set is open, nothing
  is said

### GRID-003.10 – No change sends nothing

- **Given** a bulk change that alters no picture
- **When** the user applies it
- **Then** nothing is sent; a change made before the stored decisions arrived is kept

### GRID-003.11 – Drag selects a range

- **Given** a long-press on a tile, inside or outside selection mode
- **When** the finger drags on across or down the grid
- **Then** every tile from the pressed one to the one under the finger in grid order is
  selected, with the pressed tile as the anchor; dragging back deselects only what this drag
  added; a point in a gap or beside a row's last tile counts as the tile before it, one on a
  folder header keeps the range as it is

### GRID-003.12 – Auto-scroll at the edge

- **Given** a drag after a long-press
- **When** the finger stays within 48 px of the grid's top or bottom edge
- **Then** the grid scrolls towards that edge every frame, up to 16 px a frame at the edge
  itself, and extends the range to the tile now under the finger; it stops at the end of the
  grid, when the finger leaves the edge or lifts

### GRID-003.13 – The drag owns the finger

- **Given** a drag after a long-press
- **When** the finger moves
- **Then** the browser does not scroll the grid, and the pressed tile stays rendered while the
  drag lasts even when it scrolls far out of view; without a long-press the finger scrolls

### GRID-003.14 – Flags, Move and Delete first when the bar wraps

- **Given** selection mode on a tablet or a phone in portrait
- **When** the action bar renders
- **Then** the flags, *Move* and *Delete* share the first row; rating, colour label, *Keep RAW*
  and *Tags* follow in the second row on a tablet, below the first on a phone

### GRID-003.15 – One flag button order

- **Given** the action bar's flag buttons
- **When** they render, in the grid, the loupe, the series viewer or a series compare card
- **Then** they run *Pick*, *Unflag*, *Reject* from left to right, so a hand learns one order
  (owner decision, 2026-11-13)

## Out of scope

Selection keys in detail (KEYS-001), deleting a selection (DELETE-002).

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged M2.6 (#44) |
| 2026-11-12 | Drag selection after a long-press, with auto-scroll at the edges (.11–.13) |
| 2026-11-13 | Flags, *Move* and *Delete* first when the action bar wraps, UX L6 (.14) |
| 2026-11-14 | One flag button order *Pick*, *Unflag*, *Reject* (.15, owner decision 2) |
