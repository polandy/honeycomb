# SERIES-001 – Series and the series compare

- Status: implemented
- Area: series
- Origin: plan.md M6, Culling workflow 4, Multiple folders 5, Compact header and series viewer 4,
  Keyboard shortcuts; mockup screen *Compare series*
- Depends on: LISTING-001, DECISIONS-001, KEYS-001

## Purpose

Bursts of photos of one subject are decided together: the user sees each series side by side,
decides each photo or picks the best and rejects the rest in one step.

## Behaviour

A **series** is a run of pictures of one camera (EXIF make and model; pictures without one count
as one camera), photo to photo in capture-time order, where each neighbour **looks alike** and lies
at most 30 seconds apart: their visual hashes differ in at most 10 of 64 bits. Where either of two
neighbours has no visual hash yet, they belong together when their EXIF capture times lie at most
3 seconds apart. Series may cross folders. A picture without an EXIF capture time is never in a
series. Rejected pictures are left out before the runs are formed. A run is one series however
many pictures it holds, so a whole burst is seen together, but a series ends once a picture lies
more than 60 seconds after the series' first picture, and the next series starts there. A series
has at least two pictures and at least one undecided; the series are ordered by their first capture
time.

The **visual hash** of a picture is a difference hash of the small grid preview of its shown member
(ADR 0021). It is computed in the browser, in the background and one picture at a time, only for
pictures with a shot of the same camera within 30 seconds, and kept in browser storage per file
version (etag). A failed hash is logged and leaves the picture on the 3 second rule. The series
change as hashes arrive, except while the series compare dialog is open.

*Compare series* in the toolbar shows how many series there are and is disabled without one; it and
`N` open the series compare dialog. The dialog uses the whole screen: a title row ("Compare series
1 of 3 · photo 2 of 5" by the active picture, and the close button), a **grid of cards** and a
bottom bar with one line of instructions (hidden on a phone, held either way), *Skip* and *Pick
this, reject the rest* for the active picture.
The grid picks the column count that gives the largest photo (shown in a 3:2 frame) while every
card fits the screen, so a phone shows a series of five in two columns, an iPad and a desktop in
three. Only when a photo would drop below its minimum width (150 px on a phone, where the screen's
shorter side is at most 520 px, else 220 px) does the grid scroll, downwards and never sideways, in
as many columns as keep that width, the active card always scrolled into view.
Each card has the picture's name, stars, flag mark and the flag buttons (*Pick*, *Unflag*,
*Reject*, GRID-003.15); the flag buttons sit level across the cards, a flag mark or not. One
picture is active: its card has the honey frame. *Pick this, reject the rest* is the primary
button, *Skip* secondary. The keys are in the buttons' tooltips and the shortcut sheet. A single
tap (click) on a card's photo only makes it active, never opens anything. Every card's photo
carries a *View full screen* button (⤢) in its top right corner, always shown, 44 px (34 px with a
fine pointer) on a dark disc; it, a **double tap** (double click) on the photo and `Enter` on the
active card open the picture in the series viewer (SERIES-002), the compare's full screen. A
double tap is a second tap on the same photo within 320 ms and 40 px of the first, the loupe's
double-tap rule, timed by an injected clock; its first tap has already made the card active, so
there is no delay to wait out. Keyboard focus follows the active card while it is on a card's
photo, so `Enter` opens the active one. *Back to the series* or `Esc` in the viewer returns to the
grid with the viewed picture active. A decision goes through the undo history and the undo toast like
any other. A rejected picture leaves the series; once fewer than two are left, the series is done
and the next one shows. *Pick this, reject the rest* picks the one picture and rejects every other
picture of the series, as one undo step: "Picked IMG_0003, rejected the rest · Undo". *Skip* shows
the next series, after the last the first. Without any series left the dialog says "All series
compared". On a narrow phone *Pick this, reject the rest* wraps its label to two balanced lines
instead of cutting it.

| Key in the dialog | Action |
|---|---|
| `←` `→` | Make the previous or next picture active, in reading order |
| `↑` `↓` | Make the picture above or below active, in the same column |
| `P` `X` `U` `` ` `` `0`–`5` `6`–`9` `[` `]` `R` | Decide the active picture, as in the grid |
| `Shift+P` `Shift+X` `Shift+U` `Shift+0`–`5` | Decide it and make the next picture active |
| `Shift+K` | *Pick this, reject the rest* for the active picture |
| `Enter` | View the active picture full screen in the series viewer |
| `Ctrl+Z`, `Ctrl+Shift+Z` | Undo, redo |
| `Esc` | Close the dialog |

## Acceptance criteria

### SERIES-001.1 – Close shots of one camera form a series

- **Given** pictures of one camera without visual hashes whose capture times lie at most 3 seconds
  apart, photo to photo
- **When** the series are formed
- **Then** they form one series in capture-time order, even across folders

### SERIES-001.2 – Another camera or a longer gap starts a new series

- **Given** pictures taken more than 3 seconds apart, or by another camera
- **When** the series are formed
- **Then** they are in different series

### SERIES-001.3 – No capture time, no series

- **Given** a picture without an EXIF capture time
- **When** the series are formed
- **Then** it is in no series, whatever its modification time

### SERIES-001.4 – A whole burst is one series

- **Given** a run of more than four pictures
- **When** the series are formed
- **Then** they form one series, however long

### SERIES-001.5 – Rejected pictures are left out, decided series are not offered

- **Given** a run with rejected pictures, or whose pictures are all picked
- **When** the series are formed
- **Then** the rejected pictures are not in it, and a series with fewer than two pictures or none
  undecided is not offered

### SERIES-001.6 – Compare series in the toolbar and N

- **Given** an open cull
- **When** the toolbar shows
- **Then** *Compare series* shows the number of series, is disabled without one, and it or `N`
  opens the series compare dialog on the first series

### SERIES-001.7 – The dialog shows the series as a full-screen grid

- **Given** the series compare dialog is open
- **When** it shows a series
- **Then** it fills the screen, its title says which series of how many and the active picture's
  place in it, each card shows its image, name, stars, flag mark and the flag buttons *Pick*,
  *Unflag*, *Reject*, the first picture is active with the honey frame, and the bottom bar holds
  one line of instructions, *Skip* and *Pick this, reject the rest* for the active picture

### SERIES-001.8 – Deciding a picture of the series

- **Given** the series compare dialog shows a series
- **When** the user picks, rejects or unflags one of its pictures
- **Then** that picture gets the flag with the undo toast; a rejected picture leaves the series,
  and a series with fewer than two pictures left gives way to the next

### SERIES-001.9 – Pick this, reject the rest is one undo step

- **Given** the series compare dialog shows a series
- **When** the user presses *Pick this, reject the rest* for one picture
- **Then** that picture is picked and every other one rejected, the toast says "Picked <name>,
  rejected the rest", and one undo puts back every picture's flag

### SERIES-001.10 – Keys in the dialog

- **Given** the series compare dialog shows a series
- **When** the user presses `←`, `→`, `↑`, `↓`, a decision key, a decision key with Shift, or
  `Shift+K`
- **Then** the active picture changes (`↑` `↓` to the card above or below, staying where there is
  none), is decided, is decided and the next becomes active, or is picked with the rest rejected

### SERIES-001.11 – Skip

- **Given** the series compare dialog shows a series
- **When** the user presses *Skip*
- **Then** the next series shows, after the last the first

### SERIES-001.12 – All series compared

- **Given** no series is left
- **When** the series compare dialog is open
- **Then** it says "All series compared" and *Close* closes it

### SERIES-001.13 – Pick this, reject the rest fits a phone

- **Given** the series compare dialog shows a series on a 320 px wide phone, or a phone held
  sideways
- **When** the bottom bar shows *Pick this, reject the rest*
- **Then** the button lies inside the screen and shows its whole label, and the line of
  instructions is hidden rather than cut off

### SERIES-001.14 – Shots that look alike form a series up to 30 seconds apart

- **Given** neighbouring pictures of one camera, both with a visual hash
- **When** the series are formed
- **Then** they are in one series when they lie at most 30 seconds apart and their hashes differ in
  at most 10 bits, and in different series otherwise

### SERIES-001.15 – Shots that look different are no series

- **Given** neighbouring pictures with visual hashes more than 10 bits apart, or of another camera
- **When** the series are formed
- **Then** they are in different series, however close their capture times

### SERIES-001.16 – Without a visual hash the time rule applies

- **Given** neighbouring pictures of one camera, one of them without a visual hash yet, or its
  hash failed
- **When** the series are formed
- **Then** they are in one series exactly when their capture times lie at most 3 seconds apart

### SERIES-001.17 – Visual hashes from the grid preview, kept per file version

- **Given** an open cull
- **When** pictures have a shot of the same camera within 30 seconds
- **Then** their small grid previews are hashed one at a time in the background, the hashes are
  kept in browser storage per file id and etag and reused on the next visit, a changed etag is
  hashed again, and a failed hash is logged and skipped

### SERIES-001.18 – Series hold still while the compare is open

- **Given** the series compare dialog is open
- **When** visual hashes arrive
- **Then** the series do not change until the dialog closes

### SERIES-001.19 – One primary button

- **Given** the series compare dialog shows a series
- **When** the bottom bar shows
- **Then** *Pick this, reject the rest* is its one primary button and *Skip* is secondary

### SERIES-001.20 – The compare fills the screen, the flag buttons sit level

- **Given** the series compare dialog shows a series of two on a desktop, one picture flagged
- **When** the cards lay out
- **Then** the dialog covers the window, each photo is at least 40 % of the window's width, and
  every card's flag buttons start at the same height

### SERIES-001.21 – The grid fits the screen, a long series scrolls down

- **Given** the series compare dialog shows a series
- **When** the cards lay out and the user makes another picture active
- **Then** the grid takes the column count that gives the largest photo with every card on the
  screen; where a photo would drop below 150 px on a phone or 220 px elsewhere, the grid scrolls
  downwards, never sideways, and the active card scrolls into view; focus starts on the active
  card's photo, so the dialog's focus trap does not scroll the grid back to the first card

### SERIES-001.22 – A series ends 60 seconds after its first picture

- **Given** a run of linked pictures of one camera that lasts longer than 60 seconds
- **When** the series are formed
- **Then** a series ends before the first picture more than 60 seconds after its first picture,
  which starts the next series; the span is measured from the first picture that is not rejected

### SERIES-001.23 – A tap makes a card active; ⤢, a double tap or Enter views it full screen

- **Given** the series compare dialog shows a series
- **When** the user taps a card's photo once, taps it twice within 320 ms, presses its *View full
  screen* button (⤢, tooltip with `Enter`) or presses `Enter` on the active card
- **Then** a single tap only makes the card active; the double tap, the button and `Enter` open
  the picture in the series viewer, the double tap's first tap having made it active; a slower,
  distant or other card's second tap is a single tap again, and focus on a card's photo follows
  the active card while focus elsewhere stays put

## Out of scope

The fullscreen series viewer and the series badge on the tiles: SERIES-002. The capture time and
camera come from LISTING-001.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Created with the series and the series compare dialog (M6.1). |
| 2026-11-10 | A tap on a picture's photo opens the series viewer instead of making it active (M6.2). |
| 2026-11-10 | *Pick this, reject the rest* wraps to two lines without its icon in a narrow card (UX review L3). |
| 2026-11-12 | Series also compare the images: a visual hash of the grid preview, 30 s for alike shots, the 3 s rule without a hash (owner decision, ADR 0021). |
| 2026-11-13 | One primary button on the active card, *Skip* secondary, one line of instructions, photos fill the dialog, flag buttons level (UX review M5). |
| 2026-11-13 | A run is one series however long, and a long series scrolls sideways in the compare (owner request after testing on nc-test). |
| 2026-11-14 | The title names the active picture's place, "· photo 7 of 26" (series concept step 3). |
| 2026-11-14 | A series ends 60 s after its first picture, so a slow run of alike shots no longer chains over minutes (series concept step 2, ADR 0021). |
| 2026-11-14 | The cards' flag buttons run *Pick*, *Unflag*, *Reject*, as everywhere (series concept step 4, owner decision 2). |
| 2026-11-14 | Focus starts on the active card's photo, so the row no longer jumps back to the first card once the dialog has opened (flaky e2e from #147). |
| 2026-11-14 | The compare uses the whole screen as a grid sized to fit, with `↑` `↓` and a bottom bar holding *Skip* and the one *Pick this, reject the rest*; the sideways-scrolling row is gone (series concept step 5, owner decision 3). |
| 2026-11-14 | A tap only makes a card active; *View full screen* (⤢), a double tap or `Enter` opens the series viewer (series concept step 6, owner point 4). |
