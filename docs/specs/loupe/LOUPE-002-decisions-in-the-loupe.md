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
off. The flag buttons can be hidden by their toggle or `B`. Each decision shows the undo toast
(e.g. "Rejected IMG_0001 · Undo").

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
  and how to show them again (the swipes that decide and the toggle, or the key `B`)

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

### LOUPE-002.11 – Flag buttons at the side edges in landscape (gap)

- **Given** the loupe is wider than tall
- **When** the flag buttons show
- **Then** *Pick* floats at the left edge and *Reject* with *Unflag* at the right, the photo
  fills the loupe; in portrait they form a row below the photo

## Out of scope

Decision keys (`P`, `X`, `U`, digits, `[`, `]`): KEYS-001. Storage of decisions: DECISIONS-001.
Delete from the loupe: DELETE-002.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged M3.2 (#49) and M4.3 settings (#54) |
