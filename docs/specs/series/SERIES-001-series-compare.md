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
3 seconds apart. Series may cross folders.

The **visual hash** of a picture is a difference hash of the small grid preview of its shown member
(ADR 0021). It is computed in the browser, in the background and one picture at a time, only for
pictures with a shot of the same camera within 30 seconds, and kept in browser storage per file
version (etag). A failed hash is logged and leaves the picture on the 3 second rule. The series
change as hashes arrive, except while the series compare dialog is open. A picture without an EXIF capture time is never in a series. Rejected pictures are
left out before the runs are formed. A run of more than four is split into series of at most four,
as even as possible (5 → 3 + 2). A series has at least two pictures and at least one undecided;
the series are ordered by their first capture time.

*Compare series* in the toolbar shows how many series there are and is disabled without one; it and
`N` open the series compare dialog. The dialog, titled "Compare series 1 of 3", shows the series'
pictures side by side, each with its name, stars, flag mark, the flag buttons and *Pick this, reject
the rest*; one picture is active (outlined). Tapping a picture's photo opens it in the series viewer
(SERIES-002); closing the viewer makes the viewed picture active. A decision goes through the undo
history and the undo toast like any other. A rejected picture leaves the series; once fewer than two
are left, the series is done and the next one shows. *Pick this, reject the rest* picks the one
picture and rejects every other picture of the series, as one undo step: "Picked IMG_0003, rejected
the rest · Undo". *Skip* shows the next series, after the last the first. Without any series left
the dialog says "All series compared". In a card narrower than 200 px, as on a phone, *Pick this,
reject the rest* drops its icon and wraps its label to two balanced lines instead of cutting it.

| Key in the dialog | Action |
|---|---|
| `←` `→` | Make the previous or next picture active |
| `P` `X` `U` `` ` `` `0`–`5` `6`–`9` `[` `]` `R` | Decide the active picture, as in the grid |
| `Shift+P` `Shift+X` `Shift+U` `Shift+0`–`5` | Decide it and make the next picture active |
| `Shift+K` | *Pick this, reject the rest* for the active picture |
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

### SERIES-001.4 – At most four per series

- **Given** a run of more than four pictures
- **When** the series are formed
- **Then** it is split into series of at most four, as even as possible

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

### SERIES-001.7 – The dialog shows the series side by side

- **Given** the series compare dialog is open
- **When** it shows a series
- **Then** its title says which series of how many, and each picture shows its image, name, stars,
  flag mark, the flag buttons and *Pick this, reject the rest*; the first picture is active

### SERIES-001.8 – Deciding a picture of the series

- **Given** the series compare dialog shows a series
- **When** the user picks, rejects or unflags one of its pictures
- **Then** that picture gets the flag with the undo toast; a rejected picture leaves the series,
  and a series with fewer than two pictures left gives way to the next

### SERIES-001.9 – Pick this, reject the rest is one undo step

- **Given** the series compare dialog shows a series
- **When** the user presses *Pick this, reject the rest* on one picture
- **Then** that picture is picked and every other one rejected, the toast says "Picked <name>,
  rejected the rest", and one undo puts back every picture's flag

### SERIES-001.10 – Keys in the dialog

- **Given** the series compare dialog shows a series
- **When** the user presses `←`, `→`, a decision key, a decision key with Shift, or `Shift+K`
- **Then** the active picture changes, is decided, is decided and the next becomes active, or is
  picked with the rest rejected

### SERIES-001.11 – Skip

- **Given** the series compare dialog shows a series
- **When** the user presses *Skip*
- **Then** the next series shows, after the last the first

### SERIES-001.12 – All series compared

- **Given** no series is left
- **When** the series compare dialog is open
- **Then** it says "All series compared" and *Close* closes it

### SERIES-001.13 – Pick this, reject the rest fits a phone

- **Given** the series compare dialog shows a series on a 320 px wide phone
- **When** a card shows *Pick this, reject the rest*
- **Then** the button shows its whole label on two lines, without its icon

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
