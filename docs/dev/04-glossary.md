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
| **embedded preview** | The JPEG a camera stores inside a RAW file; the loupe shows it, also at 100 %, for a RAW-only picture, and says so (LOUPE-001.28). |
| **sidecar** | An `.xmp` file that holds metadata for a member; deleted together with its picture. |
| **orphaned sidecar** | A sidecar with no photo or video in its own folder that it belongs to; the page *Orphaned sidecars* finds them and moves them to the trash bin after the user confirms (XMP-009). |
| **XMP cache** | The values honeycomb derived from one sidecar or one JPEG's embedded XMP, kept per user and ETag so a folder visit reads only changed files; rebuilt at any time (ADR 0032). |
| **waiting picture** | The one picture whose sidecar writes honeycomb holds until the user leaves it or 2 s pass idle; its grid tile and the loupe's title row show a ring, read as *Not saved yet* (ADR 0032). |
| **base name** | The file name up to the last `.`, compared case-insensitively. |
| **folder mode** | *Same folder* (pairs side by side) or *separate subfolders* (e.g. `RAW/`, `JPG/`). |
| **rating** | 0 to 5 stars. 0 means unrated. |
| **capture time** | When a picture was taken: the RAW member's EXIF capture time, else the rendered member's, else the file's modification time. |
| **colour label** | One of digiKam's nine colours, or none (Q5). |
| **flag** | *Picked*, *rejected* or *unflagged*; digiKam calls it a pick label (Q4). Kept per picture in the database, the same for every user (ADR 0040). |
| **rateable** | A picture whose every member's folder grants the user UPDATE and CREATE, so it can be flagged, rated, labelled, marked *Keep RAW* and tagged (ADR 0040). |
| **read only** | A picture that is not rateable: it is shown with a lock, and nothing of it can be changed (ADR 0040). |
| **take-over** | Recording, once, the flag and *Keep RAW* a picture's sidecars state when honeycomb first sees it; from then on the database holds them (ADR 0040). |
| **Write picks/rejects to XMP** | The ⋯ entry that writes the flag and *Keep RAW* of every rateable picture of the open folder set into its sidecars that differ (ADR 0040); with the setting on they are written with each step too (ADR 0056). |
| **Clear picks/rejects** | The ⋯ entry that sets every rateable picture of the open folder set to *unflagged* without *Keep RAW*, as one undo step; the sidecars stay as they are (ADR 0040). |
| **Keep RAW** | A marker on a pair, independent of rating, colour label and flag: its RAW member stays when *Remove RAWs* runs. |
| **Remove RAWs** | The bulk action that moves the RAW member and its own sidecar of every unmarked, not rejected pair in the view to the trash bin; the JPEG and the decisions stay. |
| **cull** | Going through a folder set and rating, labelling, flagging and deleting pictures. |
| **folder set** | The folders one cull covers: the ticked folders and, with *Include subfolders*, every folder below them but the *excluded* ones. Not a *selection*. |
| **library root** | A folder of the user's home storage below which *Folders* lists and counts folders; one or more, none inside another, chosen on the first run (ADR 0049). The UI calls them together the *Library*. |
| **folder summary** | The counts of one folder's own photos (photos, bytes, bursts, capture times, last activity) the server caches per folder by etag; picked, rejected and undecided are counted live (ADR 0049). |
| **burst** | A photo taken at most 3 s after its predecessor, by capture time; ranks folders, unlike a *series* it needs no visual hash (ADR 0049). |
| **complete** | A folder with no undecided photo; derived, unlike *done*. |
| **folder done** | The status a user gives a folder they have been through; shared per folder like the flags, with the user who marked it (cleared when that user is deleted), and needs UPDATE. New photos leave it done and show as *n new* (ADR 0049). Not *series done*. |
| **excluded folder** | A folder below a ticked one that *Include subfolders* leaves out, with everything inside it but ticked folders (ADR 0035). |
| **level** | The folder of *Folders* that the view shows with its subfolders as rows; built in the client from the folder summaries, never stored (ADR 0060). |
| **Include subfolders** | In *Folders*, the switch (on by default, saved per user) that makes a row's numbers and *Cull* cover its whole subtree (ADR 0060); in the folder picker, the choice of the *folder set*. |
| **Photos directly in ⟨folder⟩** | The row of a level that culls only the photos of that folder, not its subfolders (FOLDERS-009). |
| **Mark all done** / **Reopen all** | *Mark done* and *Reopen* for every rateable folder with photos in a subtree, in one call; the parent's *done* is derived from them, never stored (ADR 0060). |
| **resume position** | Where a user stands in a folder set (the current picture and how many are decided), stored on the server so a cull continues on another device. |
| **undecided** | A picture whose flag is unflagged and that is not in a done series; picked and rejected pictures, and the unflagged pictures of a done series (SERIES-005.14), are *decided*. |
| **reject review** | The grid of all rejected pictures, where single ones can be rescued before the delete summary. |
| **series** | Pictures taken within a short interval that look alike, compared side by side to pick the best. |
| **automatic series** | A series computed from capture time and visual hash (SERIES-001) out of the pictures that are neither in a stored series nor kept out. |
| **stored series** | A series the user has made, changed, merged or marked done; stored on the server and never changed automatically (ADR 0027). |
| **kept out** | A picture the user removed from a series: no automatic series takes it again; by hand it can still join one. |
| **series done** | The status of a stored series the user has finished: its unflagged pictures count as decided but stay unflagged. Its opposite is *open*. |
| **visual hash** | A 64-bit fingerprint of a picture's small preview; two pictures look alike when their visual hashes differ in few bits (ADR 0024). |
| **quality value** | A measurement of a photo's preview, stored per file version: today its sharpness and focus tile (ADR 0046). Never a decision, never written to a sidecar. |
| **sharpest** | The mark on the photo of a series whose sharpness lies at least 5 % above every other member's; a mark only, never a pick or the active card. |
| **series reduction** | *Reduce series to the sharpest…*: one reviewed step that picks the sharpest photo of every open series that has one and rejects the rest; a series without a sharpest is left out (SERIES-008). |
| **quality hint** | A note that a picture may be shaken (shake risk, from EXIF) or clipped (clipping, from the preview); shown in the info panel, as a filter and as a small icon on the tile; never a suggestion to reject. |
| **grid** | The thumbnail view of a folder set. |
| **skeleton tile** | A tile drawn before its photo is there: its empty face pulses while the listing or the tile's thumbnail is on its way. |
| **loupe** | The full-screen view of one picture, with swipe, zoom and the decision buttons. |
| **chrome-free mode** | The loupe showing only the photo, every overlay and panel hidden; `Tab` or a double-tap toggles it. |
| **filmstrip** | The row of small thumbnails of the neighbouring pictures along the loupe's bottom edge. |
| **info panel** | The loupe's resizable side panel with the picture's file facts, its decision and the preload state. |
| **gesture guide** | The card on the first loupe opening that lists the swipes, tap zones, pinch, double-tap and keys. |
| **view state** | The loupe's per-user state that is not a setting: whether the info panel is open and whether the gesture guide was dismissed. Stored on the server (ADR 0019). |
| **tap zone** | The left or right 30 % of the whole photo area in the loupe and series viewer, margins beside, above and below the photo included; a tap there goes to the previous or next photo. The middle shows or hides the overlays (`plan.md`, *Tap zones*). |
| **name bar** | The strip above a grid tile that shows its picture's base name, when *Show file names* is on. |
| **tile info** | The bubble with a tile's full name, capture time, camera and rating, shown when the mouse rests on the tile. On touch the ⓘ button in the tile's name bar opens it. Not the tooltip. |
| **tooltip** | The bubble that names a control and its key, on hover, keyboard focus or long-press. One for the whole app; not the browser's `title`. |
| **filter** | A condition on rating, colour label, flag, pairing, *Keep RAW* or folder that narrows the grid and loupe. |
| **flag filter** | The toolbar chips *Picked*, *Unflagged* and *Rejected*, the same state as the *Flag* group of the filter bar. They combine; none pressed shows every picture; picked and unflagged are pressed by default. |
| **selection** | The set of pictures marked in selection mode for a bulk action. |
| **bulk action** | Rate, label, flag, move or delete applied to the whole selection at once. |
| **move** | Moving whole pictures (all members and sidecars) into a target folder, renamed by the name template. The files leave the source folder. |
| **target folder** | The Nextcloud folder pictures are moved into. |
| **favourite target** | A target folder the user starred; offered first in the move dialog. |
| **recent target** | One of the last 5 target folders, offered after the favourite targets. |
| **move summary** | The list of every file and its new path, with conflicts, shown before a move. |
| **conflict** | A new path that already exists in the target folder; resolved by suffix, skip or replace. |
| **name template** | The pattern that builds a moved picture's path, e.g. `{date:%Y}/{name}.{ext}` (`docs/dev/05-name-templates.md`). |
| **delete summary** | The dialog that lists pictures, files, bytes freed and the trash-bin note before deleting. |
| **remove RAWs summary** | The same dialog before *Remove RAWs*, which also says how many pictures were skipped and why. |
| **skipped photo** | A photo a delete by decision leaves alone because its sidecars changed, cannot be read or do not agree, or, from M8 PR 8, because its members changed or the server finds its flag changed; listed in the delete report (ADR 0032, ADR 0040). |
| **permanent delete warning** | The dialog *N files will be deleted permanently* that lists the files the trash bin would not keep, with *Cancel* focused and a destructive *Delete permanently* (ADR 0036). |
| **permanent replace warning** | The dialog *N files will be replaced permanently* that lists the files a move's *Replace* would delete for good, with *Cancel* focused and a destructive *Replace permanently* (ADR 0048). |
| **trash bin** | Nextcloud's trash bin (`files_trashbin`), where deleted files can be restored from. |
| **tag** | A path of names, `Places/Italy/Dolomites`, given to a picture; digiKam's tag. Not a *keyword* or *label* (a label is a colour label). |
| **tag list** | Every tag the user has, offered by the tag entry and the filter. |
| **tag entry** | The field `T` opens, with autocomplete, to add and remove tags. |
| **tag filter** | The filter bar's *Tags* group: a picture passes when it has every chosen tag or a tag beneath it. |
| **statistics** | The daily counters of what honeycomb did for a user (pictures decided, moved to the trash bin, sidecars created and updated, series done, active time), and the page that shows them; no file ids (ADR 0039). |
| **active time** | The seconds of a cull with an input at most 2 minutes earlier; a longer pause counts its first 2 minutes only. |
| **year in review** | The section of the statistics page with the year's totals, the calendar of active days, the busiest day and the longest streak; shown in December and January, with a one-time hint in the navigation from 1 December. |
| **period** | What the statistics page sums: a calendar week (from the locale's first day of the week), month or year, or all time since the first counted day; *Previous period*, *Next period* and *Today* step through them (STATS-001.52). |
| **streak** | Consecutive days, up to today or yesterday, with at least one counted action. Not a *series*. |
| **Immich source** | The second source beside Nextcloud folders: one connection's upload library, reached only through the Immich API, never as files (ADR 0041). |
| **capabilities** | What the opened source allows beside deciding: series, similarity, tags, delete, move, RAW removal, *Keep RAW* and XMP. Nextcloud folders allow all of them, the Immich source none in Phase 1 (ADR 0041, IMMICH-002.17). |
| **connection** | One Immich account a user culls: Nextcloud user, label, Immich URL and key file, declared by the admin in the connections file; several per user (ADR 0041, ADR 0042). |
| **connections file** | The read-only JSON file the server configuration generates with every connection; its path is app config, and no key ever enters the database or the UI (ADR 0041, format and rules in ADR 0042). |
| **asset** | One picture or video in Immich, keyed by its asset id; a live photo is one asset, a stack shows but only the chosen asset goes (ADR 0041). |
| **picture id** | What identifies a picture in the browser, `PictureId`: the Nextcloud file id as a number, the Immich asset id as a string (ADR 0041). |
| **decision table** | The table that holds an Immich asset's whole decision, rating, colour label, flag and *Keep RAW*, per (connection, asset id); a `UserRowStore`, never a `FileRowStore` (ADR 0041, columns and endpoints in ADR 0043). |
| **stub Immich** | The e2e stand-in for Immich, built from the pinned OpenAPI schema and run inside the e2e Nextcloud container; a real Immich is the owner's hand test only (ADR 0041). |
| **Write to Immich** | The explicit step (Phase 2) that sends picks, rejects and ratings of Immich assets to Immich after the `updatedAt` conflict check; a reject becomes the Immich trash bin by default (ADR 0041). |

## Words and conventions in the UI

The owner asked for one vocabulary and one look for every decision, wherever it is made (grid,
loupe, series compare, series viewer). The controls come from the shared components in
[`plan.md`](plan.md#shared-ui-components).

| Action | Resulting state | Icon | Colour | Key |
|---|---|---|---|---|
| **Pick** | *Picked* | `flagPick`, a filled flag | green | `P` |
| **Reject** | *Rejected* | `flagX`, a flag with an x | red | `X` |
| **Unflag** | *Unflagged* | `flag`, an empty flag outline | neutral | `U` |
| **Pick this, reject the rest** | one *Picked*, the rest of the series *Rejected* | `flagPick` | primary | `Shift+P` in the series compare and viewer |
| **Rating** 0–5 ★ (0 clears it) | *n stars* | ★ | primary | `0`–`5` |
| **Label** (colour label) | the colour's name | a colour dot | the label's colour | `6`–`9` |
| **Keep RAW** (toggle) | *Keep RAW* | the text "Keep RAW" | primary when pressed | `R` |

- **Primary** is Nextcloud's primary colour (`--color-primary-element`), blue by default; the
  mockup draws it in honey.
- **Order.** The flag buttons are always *Pick*, *Unflag*, *Reject*. An action bar shows rating,
  colour label and flags; where flags are the main action (loupe, series viewer) they get a row
  of large buttons of their own, or in landscape *Pick* at the left edge, *Reject* at the right
  edge and *Unflag* at the bottom centre above the filmstrip. *Show flag buttons* (setting) and
  *Flag buttons* (toggle, `B`) hide them there.
- **Toggle.** Pressing the flag a picture already has, by button or key, unflags it.
- **Photo.** The UI and the user docs say *photo* for a picture; code and specs say *picture*.
- **Retry, Close, primary frame.** The UI says *Try again* for every retry, *Close* on a
  display-only dialog (*Done* only leaves a mode), and *primary* for the emphasised frame;
  `scripts/words.sh` checks.
- **Quality.** The UI says *Sharpest*, *Shake risk* and *Clipping*, and the filter group *Hints*;
  code and specs say *quality value*, *sharpest* and *quality hint*.
- **Similarity.** The UI says *similarity* for the progress of the visual hashes, and *Comparing
  photos* and *Photos compared* in the strip over the grid; code and specs say *visual hash*.
- **Avoid** *keep*, *discard*, *accept*, *unreject* and *clear flag*: they are *Pick*, *Reject*
  and *Unflag*. *Keep RAW* is the one exception: it names the RAW marker, never a flag.
- **Toasts.** One undoable change, one toast: the change in the past tense, the photo's name or
  "n photos", then *Undo* — "Rejected IMG_0001 · Undo", "Picked IMG_0001 · rejected 2 · Undo",
  "Rated 3 photos ★★★ · Undo". Undo and redo answer "Undid: …" and "Redid: …".
- **Folders.** The UI says *Folders* for the start screen that lists the folders to cull,
  *Library* for the library roots together and their progress, *Suggested* for the default
  filter and sort, *New photos* for done folders with undecided photos, and *Mark done* and
  *Reopen* for setting and clearing the done status, *Mark all done* and *Reopen all* for a
  subtree, *Include subfolders* for its switch and *Photos directly in ⟨folder⟩*; not *Clean up*,
  *Finish* or *Archive*. Code and specs say *library root*, *folder summary* and *folder done*.
- **Series edits.** *New series from n photos*, *Add n photos to series*, *Merge n series*,
  *Merge with the next series*, *Remove from this series*, *Dissolve this series* and *Series
  done* (SERIES-005); not *group*, *split* or *ungroup*.
- **Dialogs.** The footer reads *Back*, then *Cancel* (or *Close* when the dialog only shows
  something), then the confirming action on the right: primary, or red for deleting. Its label
  says what happens, e.g. "Move 12 files to trash".
- **Touch.** Every control is at least 44 × 44 px on a touch screen, 34 px with a mouse or
  trackpad ([Control sizes](plan.md#control-sizes)), and works without hover; icons carry their word
  as `aria-label` and as a tooltip with the key, e.g. "Pick `P`" (see
  [`plan.md`](plan.md#tooltip)).
