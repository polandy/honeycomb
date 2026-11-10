# APP-002 – Tooltip

- Status: implemented
- Area: app
- Origin: plan.md Shared UI components, Tooltip; glossary *tooltip*; mockup `tip`, `bindTips`
- Depends on: KEYS-001, GRID-003

## Purpose

Icon-only controls name themselves only to screen readers. The tooltip shows every user what an
icon does and which key does the same, in one bubble shared by the whole app.

## Behaviour

One bubble (`role="tooltip"`) serves the app. A control opts in with `data-tip`, its label in the
glossary's words, and `data-tip-key`, a key cap taken from the key map (KEYS-001), so a tooltip
never names a key the app does not use; `tip(label, key)` writes both. The native `title` is not
used. The bubble shows the label and the key, and an arrow that points at the control.

Mouse: it shows after 400 ms of hover, at once when moving on from a shown tooltip or from one
hidden less than 300 ms ago; the bubble itself can be hovered. Keyboard: on focus when the focus
ring shows. Touch and pen: a long-press of 500 ms; the release hides it and swallows the click
that follows. It hides on leaving, blur, a click or tap, scrolling the control's container, the
control leaving the page, the loupe's and the series viewer's controls fading out, and *Escape*,
which then goes no further. Its colours are Nextcloud's main text and background colours,
swapped, so it follows the theme. While the loupe or the series viewer is open the bubble lives
inside it, since the browser shows nothing outside a full-screen element. It shows and hides
without a fade, so reduced motion needs no exception.

Controls with a tooltip:

| Where | Controls (key) |
|---|---|
| Grid toolbar | *Change folders*, *Filter* (`\`), *Select*, *Review rejects* (Ctrl+Backspace), *Compare series* (`N`), *More* |
| Folder picker | *Open {name}* |
| Loupe and series viewer title row | *Close* (Esc), *Flag buttons* (`B`), *Filmstrip*, *Nextcloud navigation* |
| Loupe and series viewer | *Previous* (`←`), *Next* (`→`) |
| Action bar, series compare | *Pick* (`P`), *Reject* (`X`), *Unflag* (`U`), the stars (`0`–`5`), the colour swatches (`6`–`9` for the first four), *Pick this, reject the rest* (Shift+K) |
| Series compare | the photo, *Open in the series viewer* |
| Grid tile | the series badge, on mouse hover only |
| Filter bar | the comparison, the colour swatches |
| Settings, move settings | *Remove {name}*, *Remove favourite {path}* |

## Acceptance criteria

### APP-002.1 – Hover shows it after a delay

- **Given** a control with a tooltip
- **When** the mouse rests on it for 400 ms
- **Then** its tooltip shows, and hides when the mouse leaves for a place that is neither the
  control nor the bubble; moving on to another control while one shows, or within 300 ms after
  one hid, shows the next one at once; leaving before 400 ms shows nothing

### APP-002.2 – Keyboard focus shows it

- **Given** a control with a tooltip
- **When** it gets focus and the focus ring shows
- **Then** its tooltip shows, and hides on blur; focus by a mouse click shows none

### APP-002.3 – A long-press shows it without acting

- **Given** a control with a tooltip on a touch screen
- **When** a finger stays on it for 500 ms
- **Then** the tooltip shows, the release hides it and the click that follows does not reach the
  control; a shorter tap acts as before, and moving more than 10 px or a second finger cancels it

### APP-002.4 – It hides when its control goes away

- **Given** a shown tooltip
- **When** the user presses anywhere, scrolls the control's container, the control leaves the page
  or the loupe's or series viewer's controls fade out
- **Then** the tooltip hides

### APP-002.5 – The first Escape only hides it

- **Given** a shown tooltip in the loupe
- **When** the user presses *Escape*
- **Then** the tooltip hides and the loupe stays open; the next *Escape* closes the loupe

### APP-002.6 – It stays on screen and off the photo

- **Given** a shown tooltip
- **When** it is placed
- **Then** it sits below a control in the top half of the screen and above one in the bottom
  half, else on the other side, right or left: the first side that stays 8 px inside the screen
  and its safe areas and clears the middle third of the photo in the loupe and series viewer; if
  none does, the preferred side, pushed inside the screen; the arrow points at the control

### APP-002.7 – Screen readers hear it

- **Given** a shown tooltip
- **When** a screen reader reads its control
- **Then** the control has `aria-describedby` pointing at the bubble, which has `role="tooltip"`
  and never takes focus; once hidden the control loses `aria-describedby` and keeps its
  `aria-label`

### APP-002.8 – A tile's long-press stays selection

- **Given** the grid on a touch screen
- **When** a finger stays on a tile or its badges
- **Then** no tooltip shows and its click is not swallowed by the tooltip; the series badge shows
  its tooltip on mouse hover only

### APP-002.9 – Every icon-only control has one

- **Given** the controls in the table above
- **When** they render
- **Then** each carries its tooltip, with its key cap from the key map where it has a key, and
  none uses the native `title`

## Out of scope

- Dialog close buttons drawn by Nextcloud's own components.
- The scope switch's "The flag filter overrides this", visible text until the scope switch gets
  its readable label at phone width (GRID-002, `TODO.md`).

## History

| Date | Change |
|---|---|
| 2026-11-10 | The shared tooltip for the icon-only controls built so far |
