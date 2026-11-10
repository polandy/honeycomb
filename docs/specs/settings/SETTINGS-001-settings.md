# SETTINGS-001 – Per-user settings

- Status: implemented
- Area: settings
- Origin: `docs/plan.md` M4.4, Flag buttons and vi keys, Moving pictures, ADR 0014,
  `docs/user/settings.md`
- Depends on: LISTING-002, MOVE-001

## Purpose

Lets each user set how pictures are paired and how the loupe and keys behave, once, for every
device and browser.

## Behaviour

The settings are one JSON object per user behind `GET` and `PUT /apps/honeycomb/api/v1/settings`.
The server checks only that it is an object of at most 8 KB; the client checks each field and falls
back to its default, so an unknown, missing or invalid field never breaks the app.

| Setting | Default |
|---|---|
| RAW extensions, rendered extensions | The pairing defaults |
| Folder mode | Same folder; separate subfolders named `RAW` and `JPG` |
| Show singles | On |
| Swipe up, swipe down | Pick, reject; each can be pick, reject or nothing |
| Auto-advance to the next undecided photo | On |
| Show flag buttons | On |
| Vi keys | Off |
| Name template for moved photos | *By day* (`docs/05-name-templates.md` Default and presets) |
| Favourite targets | None |

*Settings* in the grid's ⋯ menu opens a dialog with the sections *File types*, *Folder layout*,
*Loupe gestures*, *Keyboard* and *Moving photos*. Each change applies at once and saves the whole object; there is
no OK button. What a setting does elsewhere is specified where it acts (LISTING-002, LOUPE-001,
LOUPE-002, KEYS-001, MOVE-004).

*Moving photos* holds the name template: three presets, a text field and a live preview that
renders the template on five fixed sample pictures, chosen to show the template's edge cases (two
cameras at the same second with the same original name, a phone, a sidecar, a file without EXIF).
Below it, the favourite targets the move dialog starred, each with a ✕ to remove it.

## Acceptance criteria

### SETTINGS-001.1 – Read

- **Given** a user with or without stored settings
- **When** the client reads them
- **Then** the answer is `{"settings": {...}}` with the stored object, `{}` when none is stored

### SETTINGS-001.2 – Write and read back

- **Given** a settings object
- **When** the client writes it
- **Then** it is stored whole as JSON, the answer returns it, and a later read returns it; an empty
  object stays an object

### SETTINGS-001.3 – A broken stored value reads as empty

- **Given** stored settings that are not JSON, or a JSON list
- **When** the client reads them
- **Then** the answer is `{}`

### SETTINGS-001.4 – Refused writes

- **Given** settings that are not an object, or over 8 KB encoded
- **When** the client writes them
- **Then** the answer is `400` and nothing is stored; exactly 8 KB is accepted

### SETTINGS-001.5 – Logged-in users only, with the CSRF check

- **Given** the routes
- **When** they are called without a user
- **Then** the answer is `401` and nothing is read or written; both routes are open to every user
  and keep Nextcloud's CSRF check

### SETTINGS-001.6 – Defaults and field checks

- **Given** stored settings with missing, invalid or unknown fields, or none at all
- **When** the app reads them
- **Then** each such field takes its default and the rest are kept; extensions are normalised and
  repeats dropped; an extension in both lists brings back the default lists, so pairing never
  fails

### SETTINGS-001.7 – The dialog

- **Given** the grid
- **When** the user chooses *Settings* in the ⋯ menu
- **Then** the dialog opens with the stored settings in its four sections, every string translated,
  and closes again

### SETTINGS-001.8 – Extensions

- **Given** the *File types* section
- **When** the user adds an extension or removes one with its ✕
- **Then** the normalised extension is appended and the field cleared, or removed; each list keeps
  its last extension

### SETTINGS-001.9 – Folder layout

- **Given** the *Folder layout* section
- **When** the user switches to separate subfolders and edits their names
- **Then** the names start as `RAW` and `JPG`, an emptied name goes back to its default, and
  switching back keeps the same-folder mode

### SETTINGS-001.10 – Switches and swipes

- **Given** the dialog
- **When** the user turns *Show singles*, *Auto-advance*, *Show flag buttons* or *Vi keys* on or
  off, or sets a swipe to pick, reject or *Nothing*
- **Then** exactly that change is applied; with *Show singles* off the singles leave the grid

### SETTINGS-001.11 – Applied at once, saved whole

- **Given** settings that were read
- **When** the user changes one
- **Then** it applies at once, the whole object is saved, and it is still set after a reload; a
  change made before the stored settings arrive is saved over them with their other values

### SETTINGS-001.12 – Saving or reading fails

- **Given** the settings could not be read, or a save fails
- **When** the user changes a setting
- **Then** the app keeps the defaults or the change for this visit, says so, and never saves over
  settings it could not read

### SETTINGS-001.13 – A pairing change re-pairs

- **Given** an open cull with a selection
- **When** the user changes the extensions or the folder mode
- **Then** the cull is paired again and the selection cleared; another change keeps the selection,
  and the folder picker counts with the new pairing settings

### SETTINGS-001.14 – The loupe uses and saves the settings

- **Given** the loupe
- **When** it opens, or the user shows or hides the flag buttons there
- **Then** it acts on the current settings, and its change is saved like one from the dialog

### SETTINGS-001.15 – Favourite and recent move targets

- **Given** stored favourite and recent move targets with repeats, items that are not paths
  starting with `/`, or a value that is not a list
- **When** the settings are read
- **Then** each list keeps its paths in order without repeats, drops the other items, and is empty
  when it is not a list; the move dialog writes them (MOVE-004)

### SETTINGS-001.16 – The stored name template

- **Given** a stored name template that is valid, invalid (MOVE-001), not a string, or missing
- **When** the settings are read
- **Then** a valid template is kept and any other value reads as the default

### SETTINGS-001.17 – Presets

- **Given** the *Moving photos* section
- **When** the user chooses *By day*, *By day, full date in the name* or *Keep names*
- **Then** the template becomes that preset's and is saved; the preset whose template is the
  current one is shown chosen, and none is when the template is the user's own

### SETTINGS-001.18 – Typing a template

- **Given** the template field
- **When** the user types a template
- **Then** a valid one is saved at once; an invalid one is not saved and the section shows it with
  a caret under the problem's column, the problem in words and that moving keeps the last valid
  template; reopening the dialog shows the saved template again

### SETTINGS-001.19 – Live preview on 5 sample pictures

- **Given** a valid template in the field
- **When** the section shows it
- **Then** the preview lists the 5 sample pictures with their files and camera (or *no EXIF*) and
  the new path of every file, suffixed as one move would; it marks a collision suffix, a time
  taken from the file, an unknown camera where the template uses `{camera}` or `{make}`, and a
  picture `{number}` cannot name; below, how many samples get a suffix, or that all names are
  unique

### SETTINGS-001.20 – Favourite targets

- **Given** favourite targets, or none
- **When** the *Moving photos* section shows them and the user taps a target's ✕
- **Then** each is listed by folder name with its path as the ✕'s label, the removed one is saved
  without it, and with none a hint says to add one in the move dialog

### SETTINGS-001.21 – The move uses the name template

- **Given** a name template set in the settings
- **When** the user opens the move dialog and chooses a target
- **Then** the move summary shows that template and names the files by it

## Out of scope

What the swipes, auto-advance and flag buttons do in the loupe: LOUPE-002. The vi keys: KEYS-001.
Pairing itself: LISTING-002.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged M4.4 (#54) |
| 2026-11-10 | .15 favourite and recent move targets (M7.3) |
| 2026-11-10 | .16–.21 name template setting, presets, preview and favourite targets (M7.4) |
