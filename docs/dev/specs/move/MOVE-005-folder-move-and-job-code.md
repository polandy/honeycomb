# MOVE-005 – Folder move and the job code

- Status: accepted
- Area: move
- Origin: owner request of 2026-11-28 (folder-level move, Rapid Photo Downloader's *Job Code*),
  ADR 0063
- Depends on: MOVE-001, MOVE-002, MOVE-003, MOVE-004, SETTINGS-001

## Purpose

Moves every picture of the open folder set at once, renamed by the name template, and lets the
template name the shoot with a *job code*: a short text the user types when the move starts, as
Rapid Photo Downloader's *Job Code* does.

## Behaviour

**Opening.** *Move all…* in the *Files* group of the toolbar's More menu, below *Move picks…*,
opens the move dialog (MOVE-004) for every picture of the open folder set, whatever the filter
shows; the item shows its count and is disabled at 0. Pictures are taken in view order, those
outside the view after them in listing order.

**Job code.** The name template knows the token `{job}`, with `:lower` and `:upper` like the other
text tokens. When the template uses it, the move dialog shows a *Job code* field above the move
summary, prefilled with the last job code used. The value is sanitised like every token value
(MOVE-001.11) and may hold at most 40 characters; the summary renders it live. While the
sanitised value is empty the confirm button is disabled and the field says "Enter a job code".
The settings' template preview renders `{job}` as `Job`. A move that moved a file stores its job
code as typed first in the recent job codes (5 kept, the settings list `moveJobCodes`); the recent
job codes stand as buttons below the field, and a tap puts one into it.

**Sidecars, collisions, trash bin and undo** are those of every move: each sidecar moves with its
picture under its own form (MOVE-001.16, MOVE-001.17), conflicts offer *Add suffix* · *Skip* ·
*Replace* (MOVE-003), a replaced file goes to the Nextcloud trash bin or, after the permanent
replace warning, is deleted for good (ADR 0048), and *Undo* in the toast moves every moved file
back, over all requests of the move. Files that are not part of a picture stay in the source
folder, and the source folder stays, even when the move empties it.

**Big folders.** The move summary lists the first 200 pictures and *Show 200 more* below them;
counts, conflicts and *All conflicts:* cover every picture. The move goes out in the requests of
ADR 0029, and the dialog counts the photos sent.

## Acceptance criteria

### MOVE-005.1 – Move all opens the dialog for the whole folder set

- **Given** a cull of a folder set, with or without a filter
- **When** the user chooses *Move all* in the More menu
- **Then** the move dialog opens for every picture of the folder set, its title counting them

### MOVE-005.2 – Move all is disabled for an empty folder set

- **Given** a folder set without pictures
- **When** the More menu opens
- **Then** *Move all* shows 0 and is disabled

### MOVE-005.3 – The job code token is parsed

- **Given** a template with `{job}`, `{job:lower}` or `{job:upper}`
- **When** it is parsed
- **Then** it is accepted; `{job:N}` or another modifier is refused as a modifier problem at the
  token's `{`

### MOVE-005.4 – The job code renders sanitised and cased

- **Given** a template with `{job}` and a job code such as `Hochzeit Müller`
- **When** a picture renders
- **Then** every file of the picture shows `Hochzeit-Mueller`, case-changed by its modifier; the
  settings' template preview shows `Job`

### MOVE-005.5 – The job code field appears only when the template uses it

- **Given** a template with or without `{job}`
- **When** the move dialog opens
- **Then** the *Job code* field is shown, prefilled with the last job code, only for the template
  with `{job}`

### MOVE-005.6 – An empty job code blocks the move

- **Given** a template with `{job}` and a job code that is empty after sanitising
- **When** the dialog shows it
- **Then** the confirm button is disabled and the field says "Enter a job code"

### MOVE-005.7 – A job code is at most 40 characters

- **Given** the *Job code* field
- **When** the user types more than 40 characters
- **Then** the field keeps the first 40

### MOVE-005.8 – The used job code is remembered

- **Given** a confirmed move whose template uses `{job}`
- **When** the next move dialog opens
- **Then** its field holds that job code, and the recent job codes list it first, 5 kept

### MOVE-005.9 – The source folder and other files stay

- **Given** a folder with pictures and a file that belongs to no picture
- **When** *Move all* moves every picture
- **Then** the other file and the source folder stay

### MOVE-005.10 – A big folder's summary shows pages of 200

- **Given** a move of more than 200 pictures
- **When** the move summary shows
- **Then** it lists the first 200 pictures and *Show 200 more*, while its counts cover every
  picture

### MOVE-005.11 – One undo for the whole move

- **Given** a move sent in several requests
- **When** the user chooses *Undo* in its toast
- **Then** every moved file of every request moves back

## Out of scope

Moving from the *Folders* screen (a later step in `TODO.md`), a move into another storage
(MOVE-002.11), and moving files that are not part of a picture.

## History

| Date | Change |
|---|---|
| 2026-11-28 | Written with ADR 0063; built step by step (`TODO.md`). |
| 2026-11-28 | Step 2: .3–.8 built; the recent job codes as buttons below the field, stored in `moveJobCodes`. |
| 2026-11-28 | Step 3: .1, .2 and .9 built; *Move all…* stands below *Move picks…* in the More menu's *Files* group. |
