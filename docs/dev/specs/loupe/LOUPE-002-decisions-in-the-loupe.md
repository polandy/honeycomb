# LOUPE-002 – Decisions in the loupe

- Status: implemented
- Area: loupe
- Origin: plan.md M3.2, Culling workflow 1 and 5, Loupe layout, Flag buttons and vi keys, Q6, Q7
- Depends on: LOUPE-001, DECISIONS-001, KEYS-001, SETTINGS-001

## Purpose

The user picks, rejects, rates and labels the shown picture without leaving the loupe, and moves
on to the next undecided picture, with an undo for every decision.

## Behaviour

The large flag buttons *Pick*, *Reject* and *Unflag* decide the shown picture. A pick or reject
moves on to the next undecided picture after the shown one (auto-advance); a rating, a colour
label, *Keep RAW* or *Unflag* stays. A swipe up picks and a swipe down rejects by default;
*Settings › Loupe gestures* sets each direction to Pick, Reject or Nothing and turns auto-advance
off. While the photo lifts, a hint over it names the flag the release sets, fading in with the
distance and filled once the release decides. The flag buttons can be hidden by their toggle or
`B`. Each decision shows the undo toast (e.g. "Rejected IMG_0001 · Undo"). While the shown photo
is in a series, the rating row ends with *Pick this, reject the rest* (`Shift+K`), which picks it,
rejects the rest of its series as one undo step and moves on to the first photo after the series.

## Acceptance criteria

### LOUPE-002.1 – Flag buttons decide and move on

- **Given** auto-advance is on and an undecided picture follows the shown one
- **When** the user presses *Pick* or *Reject*
- **Then** the shown picture gets that flag and the loupe shows the next undecided picture

### LOUPE-002.2 – Other decisions stay

- **Given** the loupe shows a picture
- **When** the user sets a rating, a colour label, *Keep RAW* or *Unflag*
- **Then** the picture gets it and the loupe stays on it

### LOUPE-002.3 – No undecided picture follows

- **Given** no undecided picture follows the shown one
- **When** the user picks or rejects it
- **Then** the loupe stays, and says so when this decided the last undecided picture

### LOUPE-002.4 – Swipe to decide

- **Given** the default gesture setting and a fitted photo
- **When** the user drags up or down far enough, or flicks vertically
- **Then** the photo lifts with the finger, a swipe up picks and a swipe down rejects; a slow
  short drag or a cancelled one settles back without a decision

### LOUPE-002.5 – Settings for swipes and auto-advance

- **Given** the gesture setting maps a direction to another flag or to nothing, or auto-advance
  is off
- **When** the user swipes or flags
- **Then** the swipe sets the flag the setting gives, or nothing; with auto-advance off the loupe
  stays on the picture

### LOUPE-002.6 – Hide the flag buttons

- **Given** the flag buttons are shown
- **When** the user presses their toggle or `B`
- **Then** they hide, the choice is kept for the next visit, and a message says how to decide
  and how to show them again (the swipes that decide and the toggle, or the key `B`); the
  decision keys keep working

### LOUPE-002.7 – Chrome-free mode hides the decision controls

- **Given** the loupe shows its decision controls
- **When** the chrome-free mode is on
- **Then** the flag buttons and the rating row are hidden

### LOUPE-002.8 – Undo toast

- **Given** a decision in the loupe changed a picture
- **When** it is stored
- **Then** a toast says what changed and offers *Undo*, at the top in the loupe, without taking
  the focus; *Undo* puts the earlier state back and says so, then the toast goes away

### LOUPE-002.9 – Undo only the latest, once

- **Given** two decisions were made
- **When** the user presses *Undo* on the toast
- **Then** only the latest is undone, once; a decision that changes nothing shows no toast

### LOUPE-002.10 – Undo the server refuses

- **Given** a decision was undone
- **When** the server does not store the undo
- **Then** the decision is put back and the toast says the undo failed

### LOUPE-002.11 – Flag buttons at the side edges in landscape

- **Given** the loupe is wider than tall
- **When** the flag buttons show
- **Then** *Pick* floats at the left edge and *Reject* at the right, each with its word below its
  icon, and *Unflag* centred at the bottom of the photo just above the filmstrip, its word beside
  its icon; the photo fills the loupe and no flag button overlaps the filmstrip, on a phone too;
  in portrait they form a row below the photo, *Pick* at the left, *Unflag* in the middle and
  *Reject* at the right (owner decision, 2026-11-13)

## Out of scope

Decision keys (`P`, `X`, `U`, digits, `[`, `]`): KEYS-001. Storage of decisions: DECISIONS-001.
Delete from the loupe: DELETE-002.

### LOUPE-002.12 – Focus or a press holds the toast

- **Given** the undo toast is shown
- **When** the focus is inside it or a pointer is pressed on it
- **Then** its timer stops; once both have ended it runs its full time again (WCAG 2.2.1);
  hover does not hold it

### LOUPE-002.13 – A pressed flag is readable

- **Given** a picture is picked or rejected
- **When** its flag button or flag mark shows
- **Then** it is filled with the app's *Pick* or *Reject* colour and its icon and word are white,
  at least 4.5:1 against the fill, in the light and the dark theme (UX review H1); a pressed
  *Unflag* is filled the same way in the app's neutral *Unflag* colour, its border as thin as the
  other two

### LOUPE-002.14 – Swipe hint

- **Given** a fitted photo
- **When** the user lifts it up or down
- **Then** a hint over the photo names the flag the release would set (*Pick* or *Reject* by the
  gesture setting), faint and fading in with the distance while the release would settle back,
  filled with that flag's colour once the release decides, by distance or flick, by the same rule
  as the release; no hint shows for a direction set to Nothing, at rest, or once the photo settles
  back or the swipe decided

### LOUPE-002.15 – Pick this, reject the rest

- **Given** the shown picture is in a series (SERIES-001)
- **When** the user presses *Pick this, reject the rest* at the end of the rating row, or
  `Shift+K`
- **Then** the shown picture is picked and every other picture of its series rejected, as one undo
  step with the toast "Picked IMG_0002, rejected the rest · Undo"; the loupe shows the first
  picture after the series' last in its order, the picked one when none follows; the button is
  secondary beside the large flag buttons, on a line of its own in portrait and on the rating row's
  line in landscape, so the row stays above the filmstrip; its tooltip names `Shift+K`, it stays
  while the flag buttons are hidden, and outside a series there is no button and `Shift+K` does nothing

### LOUPE-002.16 – Reject the other N in the undo toast

- **Given** the user picked the shown picture by *Pick*, `P`, `Shift+P` or a swipe, and its
  series (SERIES-001) still has another unflagged picture
- **When** the toast "Picked IMG_0002" shows
- **Then** it offers **Reject the other 2** before *Undo*, N counting the series' other pictures
  that are not rejected; a tap picks the picture and rejects them as one undo step with the toast
  "Picked IMG_0002, rejected the rest · Undo", as *Pick this, reject the rest* does, and the loupe
  lands on the first picture after the series only while it still shows a picture of that series,
  else it stays; its tooltip names `Shift+K`; a plain *Pick* never rejects the others by itself,
  and no other decision, nor a pick in the grid or on a compare card, offers it

### LOUPE-002.17 – Toast buttons stay readable

- **Given** the undo toast shows *Undo* or *Reject the other N*
- **When** the pointer rests on a button or the keyboard focuses it
- **Then** the button stays transparent with its light text, as in the mockup; the pointer
  underlines its word and the focus draws an outline in that light colour, so neither turns
  unreadable under Nextcloud's own button hover

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged M3.2 (#49) and M4.3 settings (#54) |
| 2026-11-10 | .12 focus or a press holds the toast (UX review L4) |
| 2026-11-12 | .6 the decision keys keep working with the flag buttons hidden |
| 2026-11-12 | .13 a pressed flag is readable (UX review H1) |
| 2026-11-12 | .11 *Unflag* between *Pick* and *Reject* in portrait (owner, iPad) |
| 2026-11-12 | .14 swipe hint; .13 a pressed *Unflag* is filled, not outlined (owner, iPad) |
| 2026-11-13 | .11 *Unflag* at the right edge carries its word (UX review L5) |
| 2026-11-14 | .11 *Unflag* bottom centre above the filmstrip in landscape (owner decision 2) |
| 2026-11-14 | .15 *Pick this, reject the rest* in the loupe (concept step 9) |
| 2026-11-14 | .16 *Reject the other N* in the undo toast (concept step 10) |
| 2026-11-14 | .17 toast buttons stay readable on hover and focus |
