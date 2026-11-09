# 4. Glossary

Binding terms. Code, UI strings and docs use these words and no synonyms.

| Term | Meaning |
|---|---|
| **picture** | What the user sees and decides on: one pair or one single. In code: `Picture`. |
| **pair** | A RAW file and a rendered file with the same base name that belong together. |
| **single** | A picture with only one image file: *JPEG only* or *RAW only*. |
| **member** | One image file of a picture (the RAW member or the rendered member). |
| **rendered file** | A camera-rendered image file (JPEG or HEIF; the extensions are a setting, Q15). Shown in the app. |
| **RAW file** | A camera RAW file, recognised by its extension (configurable list). |
| **sidecar** | An `.xmp` file that holds metadata for a member; deleted together with its picture. |
| **base name** | The file name up to the last `.`, compared case-insensitively. |
| **folder mode** | *Same folder* (pairs side by side) or *separate subfolders* (e.g. `RAW/`, `JPG/`). |
| **rating** | 0 to 5 stars. 0 means unrated. |
| **capture time** | When a picture was taken: the RAW member's EXIF capture time, else the rendered member's, else the file's modification time. |
| **colour label** | One of digiKam's nine colours, or none (Q5). |
| **flag** | *Picked*, *rejected* or *unflagged*; digiKam calls it a pick label (Q4). |
| **cull** | Going through a folder set and rating, labelling, flagging and deleting pictures. |
| **folder set** | The folders one cull covers: the ticked folders and, with *Include subfolders*, every folder below them. Not a *selection*. |
| **undecided** | A picture whose flag is unflagged; picked and rejected pictures are *decided*. |
| **reject review** | The grid of all rejected pictures, where single ones can be rescued before the delete summary. |
| **series** | Pictures taken within a short interval, compared side by side to pick the best. |
| **grid** | The thumbnail view of a folder set. |
| **loupe** | The full-screen view of one picture, with swipe, zoom and the decision buttons. |
| **gesture guide** | The card on the first loupe opening that lists the swipes, pinch, double-tap and keys. |
| **tooltip** | The bubble that names a control and its key, on hover, keyboard focus or long-press. One for the whole app; not the browser's `title`. |
| **filter** | A condition on rating, colour label, flag, pairing or folder that narrows the grid and loupe. |
| **selection** | The set of pictures marked in selection mode for a bulk action. |
| **bulk action** | Rate, label, flag, move or delete applied to the whole selection at once. |
| **move** | Moving whole pictures (all members and sidecars) into a target folder, renamed by the name template. The files leave the source folder. |
| **target folder** | The Nextcloud folder pictures are moved into. |
| **favourite target** | A target folder the user starred; offered first in the move dialog. |
| **recent target** | One of the last 5 target folders, offered after the favourite targets. |
| **move summary** | The list of every file and its new path, with conflicts, shown before a move. |
| **conflict** | A new path that already exists in the target folder; resolved by suffix, skip or replace. |
| **name template** | The pattern that builds a moved picture's path, e.g. `{date:%Y}/{name}.{ext}` (`docs/05-name-templates.md`). |
| **delete summary** | The dialog that lists pictures, files, bytes freed and the trash-bin note before deleting. |
| **trash bin** | Nextcloud's trash bin (`files_trashbin`), where deleted files can be restored from. |

## Words and conventions in the UI

The owner asked for one vocabulary and one look for every decision, wherever it is made (grid,
loupe, series compare, series viewer). The controls come from the shared components in
[`plan.md`](plan.md#shared-ui-components).

| Action | Resulting state | Icon | Colour | Key |
|---|---|---|---|---|
| **Pick** | *Picked* | `flagPick`, a filled flag | green | `P` |
| **Reject** | *Rejected* | `flagX`, a flag with an x | red | `X` |
| **Unflag** | *Unflagged* | `flag`, an empty flag outline | neutral | `U` |
| **Pick this, reject the rest** | one *Picked*, the rest of the series *Rejected* | `flagPick` | honey (primary) | `K` in the series compare and viewer |
| **Rating** 0–5 ★ (0 clears it) | *n stars* | ★ | honey | `0`–`5` |
| **Label** (colour label) | the colour's name | a colour dot | the label's colour | `6`–`9` |

- **Order.** The flag buttons are always *Pick*, *Reject*, *Unflag*. An action bar shows rating,
  colour label and flags; where flags are the main action (loupe, series viewer) they get a row
  of large buttons of their own, or in landscape *Pick* at the left edge and *Reject* above
  *Unflag* at the right edge.
- **Toggle.** Pressing the flag a picture already has, by button or key, unflags it.
- **Photo.** The UI and the user docs say *photo* for a picture; code and specs say *picture*.
- **Avoid** *keep*, *discard*, *accept*, *unreject* and *clear flag*: they are *Pick*, *Reject*
  and *Unflag*.
- **Toasts.** One undoable change, one toast: the change in the past tense, the photo's name or
  "n photos", then *Undo* — "Rejected IMG_0001 · Undo", "Picked IMG_0001 · rejected 2 · Undo",
  "Rated 3 photos ★★★ · Undo". Undo and redo answer "Undid: …" and "Redid: …".
- **Dialogs.** The footer reads *Back*, then *Cancel* (or *Close* when the dialog only shows
  something), then the confirming action on the right: primary, or red for deleting. Its label
  says what happens, e.g. "Move 12 files to trash".
- **Touch.** Every control is at least 44 × 44 px and works without hover; icons carry their word
  as `aria-label` and as a tooltip with the key, e.g. "Pick `P`" (see
  [`plan.md`](plan.md#tooltip)).
