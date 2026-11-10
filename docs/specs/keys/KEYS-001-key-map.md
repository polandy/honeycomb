# KEYS-001 – Key map, undo, redo and the shortcut sheet

- Status: implemented
- Area: keys
- Origin: plan.md M3.3, Keyboard shortcuts, Flag buttons and vi keys, Q5, Q12
  docs/user/keyboard-shortcuts.md
- Depends on: GRID-001, GRID-003, LOUPE-001, DECISIONS-001, SETTINGS-001

## Purpose

One key map drives the grid and the loupe, so every key means the same everywhere; every
decision can be undone and redone, and the shortcut sheet lists every key.

## Behaviour

The key map holds only keys that work. The screen that is open owns the keys: the loupe while it
is open, otherwise the grid; the folder picker and open dialogs take them all. Decision keys act
on the loupe's picture, the grid's focused picture, or the selection in selection mode.

| Keys | Action |
|---|---|
| `P` (`` ` ``), `X`, `U` | pick, reject, unflag |
| `0`–`5`, `[` `]` | rating, step the rating |
| `6`–`9` | red, yellow, green, blue label |
| `R` | Keep RAW |
| `Shift` + a decision key, or `Caps Lock` on | decide and go to the next picture |
| `Ctrl+Z`, `Ctrl+Shift+Z` | undo, redo |
| `?`, `Ctrl+/` | open, close the shortcut sheet |
| `h` `j` `k` `l`, `g g`, `G`, `/` | with *Vi keys* on: move, first, last, filter bar |

## Acceptance criteria

### KEYS-001.1 – One key map

- **Given** the key map
- **When** the shortcut sheet or the user doc lists it
- **Then** every action appears once, every key of the key map is in the sheet under its group
  and in `docs/user/keyboard-shortcuts.md`

### KEYS-001.2 – Flag keys

- **Given** a picture is shown or focused
- **When** the user presses `P`, `` ` ``, `X` or `U`
- **Then** it is picked, rejected or unflagged without advancing, except where auto-advance in
  the loupe moves on as a flag button does

### KEYS-001.3 – Rating, label and Keep RAW keys

- **Given** a picture is shown or focused
- **When** the user presses a digit, `Shift` and a digit key whatever the layout prints, `[` or
  `]`, or `R`
- **Then** `0`–`5` set the rating, `[` `]` step it within 0 to 5 (a mixed rating starts at 0),
  `6`–`9` set the colour label, and `R` toggles Keep RAW and never advances

### KEYS-001.4 – Advance by Shift or Caps Lock

- **Given** a decision key is pressed with `Shift`, or `Caps Lock` is on
- **When** the decision is made
- **Then** the view goes to the next picture, unless the decision already moved it or, in the
  grid, the picture left the view; on the last picture it stays

### KEYS-001.5 – Keys in the grid

- **Given** the grid is open
- **When** the user presses a decision key, the arrows, `Home`, `End`, `E`, `Tab`, `\`,
  `Ctrl+L`, `Ctrl+D`, `Esc` or `F`
- **Then** the focused picture is decided and the toast says so, the focus moves, `E` opens the
  loupe, `Tab` hides the toolbar and filter bar, `\` toggles the filter bar, `Ctrl+L` turns the
  filters off and on again, `Ctrl+D` selects none, `Esc` leaves selection mode, `F` toggles
  browser fullscreen

### KEYS-001.6 – Keys on a selection

- **Given** selection mode is on
- **When** the user presses a decision key
- **Then** every selected picture is decided, a rating step starts from the rating they share;
  with nothing selected nothing happens

### KEYS-001.7 – Vi keys

- **Given** *Settings › Keyboard › Vi keys* is on
- **When** the user presses `h` `j` `k` `l`, `g g`, `G` or `/`
- **Then** they move like the arrows, go to the first and last picture, and open the filter bar
  with its first control focused; the first `g` waits without a timeout, any other key drops it
  and acts as usual; the plain arrows keep working

### KEYS-001.8 – Keys that are not the app's

- **Given** a key event
- **When** it is typed into a field, already handled, has a modifier the map does not name, is a
  lone modifier, or is `Tab` or `Space` on a focused control
- **Then** the app does nothing and leaves the default; it prevents the default only for a key
  it handled

### KEYS-001.9 – The open screen owns the keys

- **Given** the loupe, the folder picker or the shortcut sheet is open
- **When** the user presses a key
- **Then** the loupe takes the keys but undo, and keeps the grid's selection keys away; the
  folder picker takes every key; the shortcut sheet keeps the other keys away

### KEYS-001.10 – Undo and redo

- **Given** decisions were made
- **When** the user presses `Ctrl+Z` or `Ctrl+Shift+Z`
- **Then** the latest step is undone or redone, stored on the server, and the toast says so;
  with nothing to undo or redo nothing happens

### KEYS-001.11 – Undo history

- **Given** the undo history
- **When** a decision changes pictures
- **Then** the step names the pictures it changed (only pairs for Keep RAW), a change that alters
  nothing adds no step, the history keeps the 50 most recent steps, and a new decision or a new
  cull clears redo

### KEYS-001.12 – Shortcut sheet

- **Given** the grid, the loupe or the empty screen before a cull
- **When** the user presses `?`
- **Then** the sheet opens (inside the loupe while it is open) and lists every key, a range as
  "from – to" and `Ctrl` as `⌘` on a Mac; `Ctrl+/`, *Close* or the dialog's close closes it

## Out of scope

What each decision does to the loupe: LOUPE-002. Delete keys: DELETE-002. Selection keys
(`Ctrl+A`): GRID-003.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged M3.3 (#50) and M4.3 vi keys setting (#54) |
