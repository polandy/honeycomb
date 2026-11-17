# GRID-004 – File names and tile info

- Status: implemented
- Area: grid
- Origin: owner request and decisions E1–E8 of 2026-11-17 (mockup
  <https://claude.ai/artifact/PfivZsYDez8qRUzBsbWBxc>), decision log #187
- Depends on: GRID-001, APP-002, KEYS-001, SETTINGS-001

## Purpose

The user can tell photos apart by name while culling: a name bar above each tile shows the base
name on request, and resting the mouse on a tile shows its tile info with the full name, capture
time, camera and rating, without opening the loupe.

## Behaviour

*Show file names* is a per-user setting (SETTINGS-001), off by default, the same on the iPad and
the desktop. The ⋯ menu offers it as a checkbox below *Group by folder*; `Shift+J` toggles it in
the grid (Lightroom shows the grid's tile info with `J`, which the vi keys take).

With it on, each tile gets a 24 px name bar above its square photo; the bar covers nothing and
every row grows by its height. A pair's bar shows only the base name, a single's too (its badge
names its type). A name too long for the bar is shortened in the middle, keeping its start and
its trailing number. Toggling keeps the grid still: the focused tile keeps its place while it is
in view, otherwise the tile at the top of the viewport does.

The tile info is a bubble placed like the tooltip (APP-002): below the tile, above it at the
window's bottom edge, moved in sideways, 8 px from the window's edges. It shows after the mouse
rests 700 ms on a tile, with no hand-over to the next tile, and only for a mouse: touch and pen
never show it, so a long-press stays selection. It hides on the mouse leaving the tile, a press, a
scroll of the grid and `Esc`. Its lines: the base name with the members (`JPG + CR3`, or `JPG only`),
*Captured* with seconds, *Camera* and *Rating* as five stars; a missing capture time or camera
leaves its line out. Screen readers hear the tile as before; the bubble is hidden from them.

## Acceptance criteria

### GRID-004.1 – Off by default, kept per user

- **Given** a user whose settings hold no *Show file names*
- **When** the cull opens
- **Then** no tile has a name bar; turning it on saves `showFileNames: true` in the user's settings,
  and a stored invalid value reads as off

### GRID-004.2 – The ⋯ menu toggles it

- **Given** the open ⋯ menu
- **When** the user ticks or unticks *Show file names*, which stands below *Group by folder* with
  its key `Shift+J`, also for a cull of one folder
- **Then** the setting changes and the menu stays open, as for every view option (GRID-001.18)

### GRID-004.3 – `Shift+J` toggles it in the grid

- **Given** the grid, with or without *Vi keys*
- **When** the user presses `Shift+J`
- **Then** the setting toggles; `j` with Caps Lock on and without Shift does not toggle it, and the
  shortcut sheet and `docs/user/keyboard-shortcuts.md` list the key

### GRID-004.4 – A name bar above the photo

- **Given** *Show file names* on
- **When** the grid lays out its tiles
- **Then** each tile has a 24 px name bar above its square photo, every tile row is 24 px taller,
  and the bar shows the picture's base name, for a pair as for a single

### GRID-004.5 – A long name is shortened in the middle

- **Given** a base name longer than the name bar is wide
- **When** the bar shows it
- **Then** the start and the trailing number stay visible with `…` between them; a name without a
  trailing number keeps its last characters; a name that fits shows whole

### GRID-004.6 – Toggling keeps the grid still

- **Given** a grid scrolled down
- **When** the user turns *Show file names* on or off
- **Then** the focused tile keeps its place in the viewport while it is in view, otherwise the
  tile at the top of the viewport keeps its place; the scroll position is set at once, without
  waiting for a frame

### GRID-004.7 – The tile info shows after a rest with the mouse

- **Given** the grid
- **When** the mouse rests 700 ms on a tile, not on a control with its own tooltip
- **Then** the tile info shows for that tile; moving to another tile hides it and starts the
  700 ms anew; a touch or pen never shows it, and a long-press stays selection

### GRID-004.8 – The tile info hides

- **Given** a shown or waiting tile info
- **When** the mouse leaves the tile, presses, the grid scrolls or the user presses `Esc`
- **Then** it hides or never shows; an `Esc` that hid it goes no further

### GRID-004.9 – What the tile info says

- **Given** a picture
- **When** its tile info shows
- **Then** it says the base name with the members (`JPG + CR3`, or `JPG only` for a single), the
  capture time with seconds, the camera and the rating as five stars; without a capture time or
  camera the line is left out; the capture time stays on one line in every locale

### GRID-004.10 – Placed like the tooltip

- **Given** a shown tile info
- **When** it is placed
- **Then** it sits below the tile, above it when the window's bottom edge leaves no room, moved in
  sideways, 8 px from the window's edges, its arrow pointing at the tile (APP-002.6)

### GRID-004.11 – Screen readers hear the tile as before

- **Given** a tile with or without the name bar or the tile info
- **When** a screen reader reads it
- **Then** its label is unchanged, the tile info is hidden from it, and keyboard focus never shows
  the tile info

## Out of scope

The tooltip of controls (APP-002), the loupe's info panel (LOUPE-001), the tile's badges and marks
(GRID-001).

## History

| Date | Change |
|---|---|
| 2026-11-17 | Created: name bar, `Shift+J`, tile info (owner decisions E1–E8) |
