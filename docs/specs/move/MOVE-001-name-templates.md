# MOVE-001 – Name templates

- Status: implemented
- Area: move
- Origin: `docs/plan.md` Moving pictures, `docs/05-name-templates.md`, ADR 0004
- Depends on: LISTING-002

## Purpose

Builds the path of a moved picture, relative to the target folder, from the user's name template
and the picture's facts, so every file of a picture lands in the same place under the same new
base name. The module is pure: the setting, the move and the target folder's files belong to
later specs.

## Behaviour

**Parsing** reads a template as in [`05-name-templates.md`](../../05-name-templates.md#syntax) and
either accepts it or names the first problem and its column (from 1). Problems in the text
(whitespace, a character outside `A–Z a–z 0–9 . _ -` and `/`, a brace outside a token, an unclosed
or unknown token, a bad modifier, a bad date format, `{number:N}` outside 1–6) are found left to
right before problems in the folder structure (a leading `/`, an empty folder, a folder named `.`
or `..`, a last folder that does not end with `.{ext}` or has nothing before it). The problem is
a code for the settings to word; the module has no user-visible text.

**Rendering** takes the picture's facts (base name, capture time, the modification time and its
UTC offset, EXIF make and model) and its files (each file's extension as written, such as
`NEF.xmp`, and its subfolder in separate-subfolders mode). The capture time is formatted as
stored, which is the camera's clock; without it, the modification time is shown in the given UTC
offset. Token values are sanitised, then `:lower` or `:upper` applies. A value that is missing or
empty after sanitising becomes `unknown`; that covers `{name}` too, whose base name may hold only
characters that sanitising drops. A picture that uses `{number}` without trailing digits in its
base name does not render.

**Collisions.** Pictures are taken in view order; each gets the lowest suffix (none, `-2`, `-3`, …)
before its final `.{ext}` at which none of its paths is a path of an earlier picture or one of the
given existing paths. Paths are compared case-insensitively.

## Acceptance criteria

### MOVE-001.1 – Valid templates are accepted

- **Given** the default, the presets of `05-name-templates.md` and templates using every token
  and modifier
- **When** they are parsed
- **Then** each is accepted

### MOVE-001.2 – Whitespace is refused with its column

- **Given** a template with a space or tab in a literal or inside a token
- **When** it is parsed
- **Then** it is refused as whitespace at the column of the first whitespace character

### MOVE-001.3 – Characters outside the set and literal braces are refused

- **Given** a template with a character such as `ä`, `:` or `\` in a literal, a `}` outside a
  token or a `{` inside one (`{{`)
- **When** it is parsed
- **Then** it is refused as a character problem at that character's column

### MOVE-001.4 – Tokens must be known and well-formed

- **Given** an unclosed token, an unknown token, a modifier other than `:lower` or `:upper`, or
  `{number:N}` with anything but a digit from 1 to 6 as N
- **When** it is parsed
- **Then** it is refused at the column of the token's `{`

### MOVE-001.5 – Date formats use only the listed codes

- **Given** a `{date}` without a format, with `%%`, an unknown code, a trailing `%` or a `/`
- **When** it is parsed
- **Then** it is refused as a date format problem; at the `%` or `/` when there is one, else at
  the token's `{`

### MOVE-001.6 – The folder structure is checked

- **Given** a template that is valid text but starts with `/`, has `//` or ends with `/`, has a
  folder `.` or `..`, does not end with `.{ext}` or has nothing before the final `.{ext}`
- **When** it is parsed
- **Then** it is refused as that problem, at the offending folder or at the end

### MOVE-001.7 – Date codes render the capture time

- **Given** a picture with a capture time
- **When** a template with `%Y %y %m %d %j %H %M %S` renders it
- **Then** they show the zero-padded year, two-digit year, month, day, day of the year, hour,
  minute and second of the capture time as stored

### MOVE-001.8 – Without a capture time the modification time is used

- **Given** a picture without capture time
- **When** it renders
- **Then** the date codes show its modification time shifted by the given UTC offset

### MOVE-001.9 – Name, extension, camera and make

- **Given** a picture and its files
- **When** `{name}`, `{ext}`, `{camera}` and `{make}` render, with and without `:lower` or
  `:upper`
- **Then** they show the base name, each file's own extension, the EXIF model and the EXIF make,
  sanitised and then case-changed

### MOVE-001.10 – Numbers come from the trailing digits

- **Given** a picture and a template with `{number}` or `{number:N}`
- **When** it renders
- **Then** `{number}` shows the base name's trailing digits and `{number:N}` the last N of them,
  zero-padded; a base name without trailing digits makes the picture fail to render

### MOVE-001.11 – Values are sanitised

- **Given** a value with umlauts, accents, whitespace or other characters
- **When** it is sanitised
- **Then** `ä ö ü ß` become `ae oe ue ss`, `Ä Ö Ü` become `Ae Oe Ue`, accents are stripped, any
  other character becomes `-`, runs of `-` collapse and leading or trailing `-` and `.` go

### MOVE-001.12 – Missing values become `unknown`

- **Given** a picture without make or model, or a base name, make or model that is empty after
  sanitising
- **When** it renders
- **Then** that token shows `unknown`

### MOVE-001.13 – All files of a picture share its values

- **Given** a pair with a RAW member, a rendered member and sidecars, in the same folder or in
  separate subfolders
- **When** it renders
- **Then** every file gets the same folders and name and keeps its own extension (`NEF.xmp`
  follows `NEF`); in separate-subfolders mode each file goes into its subfolder under the
  rendered folders

### MOVE-001.14 – Collisions within one move get a suffix

- **Given** pictures in view order whose paths are equal when compared case-insensitively
- **When** collisions are resolved
- **Then** the first keeps its paths and the later ones get `-2`, `-3`, … before the final
  `.{ext}`, on every file of the picture

### MOVE-001.15 – Existing paths take the next free number

- **Given** paths that already exist in the target folder
- **When** collisions are resolved against them
- **Then** a picture whose path exists gets the lowest suffix that is free of them and of the
  earlier pictures

## Out of scope

The name template setting, its presets and preview: M7.4. The move, conflict choices (*Skip*,
*Replace*) and which member's capture time and camera a picture uses: M7.2. Make and model come
separately from the listing in M7.2; LISTING-001 joins them today.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Created with the name template module (M7.1). |
