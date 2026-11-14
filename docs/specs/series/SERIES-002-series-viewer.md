# SERIES-002 – Series viewer and series badge

- Status: implemented
- Area: series
- Origin: plan.md M6, Compact header and series viewer 4 and 5, Loupe layout, Tap zones,
  Keyboard shortcuts; mockup screens *Compare series* and *Series viewer*
- Depends on: SERIES-001, LOUPE-001, DECISIONS-001, KEYS-001

## Purpose

Photos of a series differ in small details such as focus or a blink. The series viewer shows one
series fullscreen, one photo at a time, at the same zoom and spot on every photo, so paging
compares the same detail; the series badge shows in the grid which photos form a series.

## Behaviour

The **series viewer** is the series compare's full screen: a card's *View full screen* button (⤢),
a double tap (double click) on its photo or `Enter` on the active card opens it on that photo
(SERIES-001.23); a single tap only makes the card active. The viewer preloads the loupe's
window around the shown photo, 3 ahead and 2 behind (LOUPE-001.12), not the whole series. The
viewer shows the series without its rejected pictures, one photo at a time, with the loupe's
controls: *Back to the series* (a back arrow, with the words except on a phone, where the
screen's shorter side is at most 520 px), the name and "Series 1 of 2 · photo 2 of
3", the flag button toggle and the *Fit* / 100 % button at the top, the previous and next
buttons, and the loupe's action bar (flag buttons *Pick*, *Unflag*, *Reject* placed as in
LOUPE-002.11, rating, colour label, *Keep RAW*) with *Pick this, reject the rest*. It has no info
panel, filmstrip or gesture guide, so in landscape *Unflag* sits just above the action bar.

Paging works as in the loupe: a horizontal swipe, the previous and next buttons, `←` `→`, and a
tap on the left or right 30 % of the photo area; the outer zone does nothing on the first or last
photo. The zoom is **synchronised**: zooming to 100 % (button, `Z`, a double-tap in the middle,
a pinch) and panning carry over to every photo of the series while paging, and a polite live text
says "Zoom synced on all 3 photos". While zoomed a swipe pans and a tap does not page. The
controls fade after 2.5 seconds without a touch; a tap in the middle brings them back or hides
them.

A decision acts on the shown photo through the undo history and the undo toast, without moving
on, so the view stays steady; `Shift` with a decision key moves on as in the loupe. A swipe up or
down follows the swipe settings. A rejected photo leaves the series and the next photo shows
(the previous one after the last), at the same zoom; an undo that puts it back shows it again.
*Pick this, reject the rest* is one undo step and closes the viewer as the compare's own button
does: the compare shows the next series. Once fewer than two photos
are left, the viewer closes and the compare shows the next series; an undo after that restores
the flag only. *Back to the series* or `Esc` returns to the compare's grid with the viewed photo active.

| Key in the viewer | Action |
|---|---|
| `←` `→` | The previous or next photo |
| `P` `X` `U` `` ` `` `0`–`5` `6`–`9` `[` `]` `R` | Decide the shown photo |
| `Shift+P` `Shift+X` `Shift+U` `Shift+0`–`5` | Decide it and show the next photo |
| `Shift+K` | *Pick this, reject the rest* for the shown photo |
| `Z`, `Space` | Fit or 100 % |
| `B` | Show or hide the flag buttons |
| `Ctrl+Z`, `Ctrl+Shift+Z` | Undo, redo |
| `Esc` | Back to the series |

A tile in the grid whose picture is in a series offered by the compare shows a read-only badge
"⧉ 3", labelled "Series of 3".

## Acceptance criteria

### SERIES-002.1 – A card opens the viewer on its photo

- **Given** the series compare dialog shows a series
- **When** the user presses a card's *View full screen* button, double-taps its photo or presses
  `Enter` on the active card
- **Then** the series viewer opens on that photo, its title row says the name and "Series 1 of 2
  · photo 2 of 3", and the photo with 3 photos ahead and 2 behind is preloaded; the window follows
  paging and a photo that leaves the series

### SERIES-002.2 – Paging

- **Given** the series viewer shows a photo
- **When** the user swipes sideways, presses a previous or next button or `←` `→`, or taps the
  left or right of the photo area
- **Then** the previous or next photo of the series shows; nothing happens beyond the first or
  last photo

### SERIES-002.3 – Synchronised zoom

- **Given** the series viewer shows a photo
- **When** the user zooms it to 100 % by the button, `Z` or a double-tap, and then pages
- **Then** the next photo shows at the same zoom and spot, and a live text says "Zoom synced on
  all 3 photos" while zoomed

### SERIES-002.4 – Fading controls

- **Given** the series viewer is open
- **When** 2.5 seconds pass without a touch, or the user taps the middle of the photo
- **Then** the controls fade out, and a tap in the middle brings them back

### SERIES-002.5 – Deciding the shown photo

- **Given** the series viewer shows a photo
- **When** the user picks, unflags, rates or labels it by the action bar, a key or a swipe
- **Then** that photo gets the decision with the undo toast and stays shown; with `Shift` the
  next photo shows

### SERIES-002.6 – A rejected photo leaves, undo shows it again

- **Given** the series viewer shows a photo of a series of three or more
- **When** the user rejects it
- **Then** it leaves the series and the next photo shows at the same zoom, the previous one after
  the last; an undo puts it back and shows it

### SERIES-002.7 – Pick this, reject the rest closes the viewer

- **Given** the series viewer shows a photo
- **When** the user presses *Pick this, reject the rest* or `Shift+K`
- **Then** that photo is picked and every other one rejected as one undo step, the viewer
  closes and the compare shows the next series, as after its own *Pick this, reject the rest*

### SERIES-002.8 – Fewer than two left closes the viewer

- **Given** the series viewer shows a series of two
- **When** one of them is rejected
- **Then** the viewer closes and the compare shows the next series; an undo restores the flag only

### SERIES-002.9 – Back to the series

- **Given** the series viewer is open
- **When** the user presses *Back to the series* (tooltip with `Esc`) or `Esc`
- **Then** the series compare's grid shows again with the viewed photo active

### SERIES-002.10 – The series badge

- **Given** an open cull
- **When** a picture is in a series the compare offers
- **Then** its tile shows "⧉ 3" labelled "Series of 3"; a tile of any other picture has no badge

## Out of scope

Zooming with the mouse wheel and a separate zoom level for the viewer: the viewer zooms like the
loupe, fit or 100 %.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Created with the series viewer and the series badge (M6.2). |
| 2026-11-14 | .1 preloads the loupe's window, not the whole series (series concept step 3). |
| 2026-11-14 | The flag buttons run *Pick*, *Unflag*, *Reject*, *Unflag* bottom centre in landscape (series concept step 4). |
| 2026-11-14 | Opened by *View full screen*, a double tap or `Enter` instead of a single tap; the close button becomes *Back to the series*; *Pick this, reject the rest* leaves the compare on the next series (series concept step 6, owner point 4). |
