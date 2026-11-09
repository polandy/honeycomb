# 5. Name templates

A name template builds the path of a moved picture, relative to the target folder. The language
is Framehive's (IMPORT-001), so one template means the same in both apps (ADR 0004). These rules
are written so Framehive can adopt them; what honeycomb adds or restricts is marked.

## Syntax

- A template is literal text and `{tokens}`. `/` separates folders.
- Literal text may contain only `A–Z a–z 0–9 . _ -` and `/`. **No whitespace**, anywhere.
  *Restricts Framehive:* `{{` and `}}` (literal braces) are not allowed, because braces are not
  allowed characters.
- No leading `/`, no empty folder (`//`), no folder named `.` or `..`.
- The last folder must end with `.{ext}`, so the files of a picture keep distinct names.
- Errors name the column, e.g. `col 7: Whitespace is not allowed; use - or _`. An invalid template
  is not saved; the last valid one stays in use.

## Tokens

| Token | Value |
|---|---|
| `{date:<fmt>}` | Capture time. Codes `%Y` `%y` `%m` `%d` `%j` `%H` `%M` `%S`. A format may not contain `/`. *Restricts Framehive:* no `%%`. |
| `{name}` | The original base name, e.g. `DSCF1234`. |
| `{ext}` | Each file's own extension, e.g. `RAF`, `JPG`, `NEF.xmp`. |
| `{number}`, `{number:N}` | The trailing digits of the original name; `N` (1–6) keeps the last N digits, zero-padded. A name without trailing digits is an error for that picture. |
| `{camera}` | EXIF `Model`, e.g. `X-T5`. *Added; Framehive lacks it.* |
| `{make}` | EXIF `Make`, e.g. `FUJIFILM`. *Added; Framehive lacks it.* |

`{name}`, `{ext}`, `{camera}` and `{make}` take `:lower` or `:upper`. Framehive's import-only
tokens (`{imported}`, `{job}`, sequence tokens) are not offered.

## Values

- **Sanitising.** Every token value is reduced to `[A-Za-z0-9._-]`: `ä ö ü ß` become `ae oe ue ss`
  (`Ä Ö Ü` become `Ae Oe Ue`), other accents are stripped, whitespace and any other character
  become `-`, runs of `-` collapse to one, and leading or trailing `-` and `.` are removed.
  `iPhone 15 Pro` becomes `iPhone-15-Pro`; `Übersicht März` becomes `Uebersicht-Maerz`.
- **Fallbacks.** No EXIF capture time: the file's modification time. No camera model or make, or
  a value that is empty after sanitising: `unknown`.
- **One set of values per picture.** All files of a picture render from the same values; the
  capture time is read from the RAW member first. A sidecar keeps its suffix:
  `DSC_0815.NEF.xmp` follows `DSC_0815.NEF`.
- **Separate subfolders.** When the source folder keeps members in `RAW/` and `JPG/`, the moved
  members go into `RAW/` and `JPG/` under the rendered folder.

## Collisions

Paths are compared case-insensitively.

1. **Within one move.** When two pictures render the same path, the later one (in view order)
   gets `-2`, then `-3`, … before the final `.{ext}`: `143205_X-T5_DSCF1234-2.RAF`.
   *Differs from Framehive*, whose IMPORT-003 starts at `-1`.
2. **With the target folder.** A path that already exists is a conflict, shown in the move
   summary: *Add suffix* takes the next free number, *Skip* leaves the picture where it is,
   *Replace* sends the existing file to the trash bin.

## Default and presets

| Preset | Template | Example |
|---|---|---|
| By day (default) | `{date:%Y}/{date:%Y-%m-%d}/{date:%H%M%S}_{camera}_{name}.{ext}` | `2026/2026-11-09/143205_X-T5_DSCF1234.RAF` |
| By day, full date in the name | `{date:%Y}/{date:%Y-%m-%d}/{date:%Y%m%d-%H%M%S}_{camera}_{name}.{ext}` | `2026/2026-11-09/20261109-143205_X-T5_DSCF1234.RAF` |
| Keep names | `{name}.{ext}` | `DSCF1234.RAF` |

The default is unique within its day folder: two cameras that fire in the same second differ in
`{camera}`, and two bodies of the same model differ in `{name}`. A collision that still remains
gets a suffix.
