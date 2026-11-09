# Implementation plan

The plan the brief asks for ([`01-requirements.md`](01-requirements.md) §1.7): milestones,
project structure, target versions and open questions. `TODO.md` lists the milestones as
PR-sized items in this order. As of 2026-11-09.

## Milestones

Each milestone ends with a usable state on `main`. Milestones M1–M4 follow the brief's order:
backend pairing, grid, full-screen review, deleting and settings.

### M0 – Mockup sign-off

The interactive mockup [`mockup/index.html`](mockup/index.html) (ADR 0003) shows the whole flow:
folder picker, grid with pair badges, filter bar, multi-select with bulk actions, loupe with
swipe and zoom, keyboard shortcuts, undo, the culling workflow below (reject toast, reject review,
delete summary, progress and resume, series compare) and settings. The owner tries it on the
iPad, answers the open questions below, and the mockup is updated until the owner signs it off.
The answers go into ADRs and into this file; the question markers disappear from the mockup.

Brand assets (proposal B, see `TODO.md`) are made alongside, because M1 needs the app icon.

### M1 – App skeleton and backend pairing

1. **Skeleton:** `appinfo/info.xml` with the versions from Q1, `composer.json` with
   php-cs-fixer, psalm and PHPUnit, the `Application` class, an empty main page, the PHP jobs in
   CI and `scripts/verify.sh`, `info.xml` in release-please's extra files.
2. **Pairing service:** pure PHP that groups a list of file entries (path, size, mtime) into
   pictures. PHPUnit tests first, ported as test cases from Framehive's LIBRARY-001 and the
   brief: names differing only in case, several dots in a file name, singles (JPEG only, RAW
   only), sidecars, ambiguous members (Q14), separate subfolders (Q16), configurable extension
   lists (Q15).
3. **Folder API:** `GET /api/v1/folders/{path}/pictures?offset&limit&filter…` lists the
   pictures of a folder through `IRootFolder` with the user's permissions, paginated so 2,000+
   pairs load without stalls; each picture carries its file id and mtime for the cache-keyed
   image URLs. Tests with `OCP\Files` mocks.

### M2 – Grid view

1. **Frontend skeleton:** Vue, `@nextcloud/vue`, Vite through `@nextcloud/vite-config`, eslint,
   Vitest, the JS jobs in CI and `scripts/verify.sh`.
2. **Folder picker and grid:** `@nextcloud/dialogs` file picker, a virtual-scrolling grid with
   srcset thumbnails (256/512 px, stepless size) and pair badges, light and dark.
3. **Decision storage:** the table(s) and API for rating, colour label and flag per picture and
   user (Q2), and the resume position per folder and user, so culling can stop and continue on
   another device (an ADR first: new table).
4. **Filter bar:** rating, colour label, flag and pairing filters, applied on the server for
   large folders (Q8, Q9), and the scope *not rejected* / *undecided* / *all* of the culling
   workflow with the "x of y decided" progress.
5. **Selection and bulk actions:** selection mode, select all filtered, bulk rate, label and flag
   (Q10).

### M3 – Full-screen review (loupe)

1. **Loupe:** the JPEG (or the RAW's embedded preview) full screen, swipe to page, pinch zoom,
   100 % zoom, prefetching of the neighbours, chrome-free mode, resizable info panel (see
   [Image delivery & performance](#image-delivery--performance)).
2. **Decisions in the loupe:** large pick and reject buttons, vertical swipe (Q6), rating and
   colour label controls, auto-advance to the next undecided picture, the "Rejected · Undo"
   toast.
3. **Keyboard shortcuts and undo:** 0–5, P/X/U, colour keys (Q5), undo and redo (Q12), the
   shortcut sheet.

### M4 – Deleting and settings

1. **Delete service:** deletes the members and sidecars of each picture through `OCP\Files` into
   the trash bin; a failure is reported per file and leaves a traceable state. An ADR first on
   what "atomic" means for a pair. Tests for every failure path.
2. **Reject review and delete summary:** the review grid of all rejected pictures with rescue,
   then the summary with pictures, files and bytes freed and the trash-bin note; also reachable
   from the selection (Q11).
3. **Settings:** per user — RAW and rendered extensions, folder mode, show singles, gesture
   mapping, auto-advance.
4. **README:** installation, features, screenshot placeholders; `camerarawpreviews` and Preview
   Generator as recommended apps.

### M5 – XMP sidecars (if Q2 says so)

Read existing sidecars when a folder is listed and write ratings, colour labels and flags to
them in digiKam's fields, so digiKam on the desktop sees the decisions.

### M6 – Series compare

Groups pictures taken within a short interval and lets the owner pick the best of each (see
[Culling workflow](#culling-workflow), point 4). Own milestone after the core flow works; the
mockup already shows it.

### M7 – Moving pictures

Moves one picture, the selection or a filter result into another Nextcloud folder, renamed by a
name template (see [Moving pictures](#moving-pictures)). Decided by the owner on 2026-11-09; the
mockup shows it.

## Culling workflow

Decided by the owner on 2026-11-09 (answers Q7, Q11 and Q12). It is the owner's Lightroom Mobile
routine on the iPad, adopted as the default *Cull* mode: filter to *not rejected*, go through all
pictures, a rejected picture disappears from view, and at the end delete all rejects. A picture is
*undecided* while its flag is unflagged; picked and rejected are decided.

1. **Reject and review.** Each reject shows the toast "Rejected · Undo". Before anything is
   deleted, a review step shows a grid of all rejects; a single picture can be rescued (it
   becomes undecided), then the owner confirms.
2. **Delete is the trash bin.** Deleting moves files to the Nextcloud trash bin, restorable;
   there is no hard delete. Space returns only when the trash bin is emptied.
3. **Whole pair.** Reject and delete always act on the whole picture: JPEG, RAW and sidecar. The
   delete summary shows pictures · files · bytes freed.
4. **Series compare** (milestone M6). Pictures taken within a short interval (mockup: 3 seconds
   by capture time, at most 4 per series) form a series, shown 2–4 side by side. Tapping the best
   one means "keep this, reject the rest": it is picked, the others rejected, as one undo step.
   The owner's 2026-11-09 feedback changes how: see [Compact header and series viewer](#compact-header-and-series-viewer).
5. **Auto-advance.** After each pick or reject the view moves to the next undecided picture
   (the setting stays, Q7 is answered). Rating and colour label do not advance.
6. **Progress and resume.** The toolbar shows "x of y decided" per folder. The last position per
   folder and user is stored on the server (with the decisions, M2.3), so another device offers
   to continue there.
7. **Multi-pass.** The scope filter has *not rejected* (default), *undecided* and *all*, so a
   second pass over the picks or a pass over what is left is one tap. An explicit flag filter
   overrides the scope.

Where the work lands: M2.3 (resume position), M2.4 (scope, progress), M3.2 (auto-advance, toast),
M4.1 and M4.2 (delete, review, summary), M6 (series).

## Image delivery & performance

Decided by the owner on 2026-11-09 (answers Q19). Culling 2,000+ 24 MP pairs lives or dies by how
fast the right pixels reach the screen.

**Size tiers.** Grid tiles 256 px and 512 px, loupe 2048 px on the long edge, 100 % zoom the
original file. The browser picks the tier through `srcset` from tile size × `devicePixelRatio`;
the thumbnail size is stepless (mockup: slider, Ctrl + wheel, pinch).

**Progressive display.** The small preview shows first; the sharp one is swapped in after
`img.decode()` resolves, so the tile never blanks or jumps.

**Prefetch.** The loupe prefetches 2–3 neighbours in each direction.

**Virtualised grid.** Only the visible rows are rendered, images load lazily.

**Sources.** The browser never decodes RAW. A RAW+JPEG pair shows the JPEG; a RAW-only picture
shows the embedded JPEG preview, extracted and cached on the server.

**Caching.** Image URLs are immutable and keyed by file id and mtime, with a long
`Cache-Control` and an `ETag`; an edited file gets a new URL.

**Pre-generation.** Previews are generated in the background on upload and when a folder is
opened, by the Preview Generator app or an own background job. Imaginary is optional.

**Budgets**, measured with real 24 MP files:

| What | Budget |
|---|---|
| Prefetched next loupe image | < 100 ms |
| First sharp image in a newly opened folder | < 500 ms |
| Grid scroll at 2,000+ items | no jank |

Where the work lands: M1.3 (cache-keyed URLs), M2.2 (tiers, virtualised grid), M3.1 (prefetch,
`decode()` swap), M4.4 (README recommendation), and a new item for the background generation
and the RAW preview extraction.

## Compact header and series viewer

Decided by the owner on 2026-11-09 (phone screenshot of the mockup); shown in
`docs/mockup/index.html`. Goal on a phone: the photo grid starts in the upper ~20 % of the screen.

1. **One bar, one slim row.** The bar is ~56 px. The breadcrumb shows only the root and the
   current folder when the toolbar is at most 720 px wide (container query); a tap on the folder
   shows the full path. *Select*, *Review rejects*, *Compare series* and *Filters* are icon
   buttons with count badges; their labels appear beside the icons only when the toolbar is at
   least 1000 px wide. Sort, the tile size slider, *Move picks*, *Resume*, hiding the header,
   settings and the help for the open-question markers live in a **⋯ more menu** (arrow keys,
   one separator per group). The scope (*Not rejected* / *Undecided* / *All*) and the progress
   share one slim row below. Every control keeps a 44 px hit target.
2. **The header follows the scroll.** It slides away while scrolling down and returns on
   scrolling up. A menu entry collapses it completely, leaving a small handle. The rules are
   ported from Stella's top bar (`followScroll`) and the mockup keeps the decision as a pure
   function of the same shape:
   - Only after 24 px of travel in one direction does the bar follow; a nudge is not a scroll.
   - Within the bar's height of the top, including a negative position from iOS rubber-band
     overscroll, it is always shown.
   - Within the bar's height of the bottom it keeps its state: hiding makes the scroller taller,
     the clamp pulls the scroll back, that reads as scrolling up, the bar returns, and it
     bounces forever.
   - It slides by a negative `margin-top` in the flow (not `position: fixed` or a transform),
     about 350 ms, and not at all under `prefers-reduced-motion`.
   - The shell is `100dvh` and the document never scrolls; only the grid's scroller does.
   - Focus entering the bar shows it, and selection mode keeps it shown.
   - Opening a folder starts with the bar shown.
3. **Series viewer.** Tapping a photo of a series opens it fullscreen at once, the whole series
   preloaded. Swipe pages between the photos (arrow buttons and keys also work, also while
   zoomed). *Keep this, reject the rest* is in the viewer, one undo step. The controls fade out
   when idle; a tap on the photo brings them back or hides them.
   - **Reject a single photo** without leaving fullscreen (owner, 2026-11-09): the *Reject*
     button in the bottom bar next to *Keep this, reject the rest*, the `X` key, or a swipe down
     on the photo following the *Swipe down* setting (a horizontal swipe still pages; no
     gesture while zoomed). If that setting is *Pick*, the swipe picks the photo and keeps it
     in the series.
   - It follows the *Cull* mode: the rejected photo leaves the series and the viewer moves on
     to the next photo (the previous one after the last) with the synchronised zoom kept. The
     undo toast, `Undo` or Ctrl+Z puts the photo back in its place and shows it.
   - Once one photo is left the viewer closes and the series counts as decided. Undo after
     that restores the flag only; *Compare series* finds the series again on its next opening.
   - No *Pick* or *Unreject* button in the viewer: a third button crowds the bottom bar on a
     phone (44 px targets), and undo covers the unreject.
4. **Synchronised zoom.** Zooming one photo to 100 % (button, double-tap, pinch or `Z`) zooms
   every photo of the series to the same spot, and panning moves them together, so paging
   compares the same detail for sharpness. While zoomed, a swipe pans instead of paging.

Where the work lands: M2.2 (header, bar, scroll behaviour), M6 (series viewer).

## Moving pictures

Decided by the owner on 2026-11-09. A *Move to…* action in the action bar, the toolbar and the
loupe, on the key `M`.

1. **What moves.** One picture, the selection, or a filter result (the toolbar's *Move picks*, or
   *Move filtered* while a filter is on). Always the whole picture: RAW member, rendered member
   and sidecars. All files of a picture get the same new base name.
2. **Where to.** A target folder chosen with a folder picker. Favourite targets (★, set by the
   user) and the 5 most recent targets are one-tap chips, and keys `1`–`9` in the dialog.
3. **On the server.** The move runs through `OCP\Files` (`Node::move()`). On the same storage it
   is a rename, so file ids, shares, tags, comments and decisions are kept. Across storages it
   becomes copy and delete with new file ids; the move summary warns about it.
4. **Move summary.** Before anything moves, the dialog lists every file with its new path, and
   counts pictures, files and conflicts. A conflict (the target name already exists) is resolved
   per picture or for all at once: *Add suffix* (default), *Skip* or *Replace*. *Replace* sends
   the existing file to the trash bin.
5. **Undo.** One undo step moves the files back to their old names; replaced files come back from
   the trash bin.
6. **Failures.** If one file of a picture fails, the picture's files already moved go back, and
   the summary reports each file (as in M4.1). An ADR on the move API and pair atomicity comes
   before M7.2.

**Name template.** The rules are in [`05-name-templates.md`](05-name-templates.md). They use
Framehive's template language (ADR 0004), so Framehive can adopt the same default. The default
is

```text
{date:%Y}/{date:%Y-%m-%d}/{date:%H%M%S}_{camera}_{name}.{ext}
→ 2026/2026-11-09/143205_X-T5_DSCF1234.RAF
```

The day is in the folders, so the file name does not repeat it; time to the second, camera
model and original name keep it unique within its day folder. The template is a per-user
setting with a live preview on 5 sample pictures. The preset *By day, full date in the name*
(`…/{date:%Y%m%d-%H%M%S}_{camera}_{name}.{ext}`) is for people who move files out of the
folder structure later, so each name still carries its date. A third preset keeps the names.

**Follow-ups for Framehive** (not this repository): add the tokens `{camera}` and `{make}`
(today an unknown token, IMPORT-001.10), the character rule (only `[A-Za-z0-9._-]`, no
whitespace), the same default template, and one suffix numbering (honeycomb starts at `-2`,
Framehive's IMPORT-003 at `-1`).

## Project structure

The standard Nextcloud app layout; folders appear with the milestone that needs them.

```text
honeycomb/
├── appinfo/info.xml            app id `honeycomb`, versions (Q1), navigation entry
├── lib/
│   ├── AppInfo/Application.php
│   ├── Controller/             PageController, PictureController, DecisionController,
│   │                           DeleteController, SettingsController (thin)
│   ├── Service/
│   │   ├── Pairing/            pure pairing logic, no OCP dependency
│   │   ├── FolderService.php   lists a folder through IRootFolder
│   │   ├── DecisionService.php rating, colour label, flag per user
│   │   ├── DeleteService.php   members + sidecars into the trash bin
│   │   └── SettingsService.php per-user settings (IConfig user values)
│   ├── Db/                     entities and QBMapper classes
│   ├── Migration/              database migrations
│   └── Xmp/                    sidecar reader/writer (M5)
├── src/                        Vue: main.js, App.vue, views/, components/, store/ (Pinia)
├── templates/main.php          mounts the Vue app
├── tests/php/Unit/, tests/js/  PHPUnit, Vitest
├── img/app.svg, img/app-dark.svg
├── l10n/                       translations (Transifex later)
├── docs/                       this documentation, the mockup, ADRs
├── assets/brand/               logo sources and generate.py
├── scripts/verify.sh           every CI check locally
├── composer.json, package.json, psalm.xml, .php-cs-fixer.dist.php, phpunit.xml, vite.config.js
└── CLAUDE.md, TODO.md, REUSE.toml, LICENSES/
```

## Target versions

Checked on 2026-11-09 against the sources below.

| Nextcloud | Released | End of life | PHP supported | PHP recommended |
|---|---|---|---|---|
| 35 (Hub 26 Summer), latest 35.0.2 | 2026-09-16 | 2027-09 | 8.3 – 8.5 | 8.5 |
| 34 (Hub 26 Spring), latest 34.0.5 | 2026-06-09 | 2027-06 | 8.2 – 8.5 | — |
| 33 (Hub 26 Winter), latest 33.0.10 | 2026-02-18 | 2027-02 | 8.2 – 8.5 | — |
| 36 (Hub 27 Winter), in development | planned 2027-02-17 | — | 8.3 – 8.5 (master today) | — |

Sources:

- Release dates, end of life and current point releases: the [Maintenance and Release
  Schedule](https://github.com/nextcloud/server/wiki/Maintenance-and-Release-Schedule) and the
  [server releases](https://github.com/nextcloud/server/releases) (35.0.2, 34.0.5 and 33.0.10
  on 2026-10-15; 35.0.3 RC1 on 2026-11-05).
- Supported PHP range: the `PHP_VERSION_ID` checks in `lib/versioncheck.php` of
  [stable33](https://github.com/nextcloud/server/blob/stable33/lib/versioncheck.php),
  [stable34](https://github.com/nextcloud/server/blob/stable34/lib/versioncheck.php),
  [stable35](https://github.com/nextcloud/server/blob/stable35/lib/versioncheck.php) and
  [master](https://github.com/nextcloud/server/blob/master/lib/versioncheck.php): minimum
  8.2.0 (33, 34) or 8.3.0 (35, master), refused from 8.6.0.
- Recommended PHP: the [system requirements of the stable35 admin
  manual](https://github.com/nextcloud/documentation/blob/stable35/admin_manual/installation/system_requirements.rst)
  list 8.3, 8.4 and **8.5 (recommended)**.

Which of them honeycomb supports is Q1.

## Open questions

Each has a recommendation. Questions marked **(mockup)** have a numbered marker in the mockup
that shows them in place. The owner answers here or in a `needs-owner` issue; an answer becomes
an ADR or a line in this plan.

### Q1 – Which Nextcloud versions to support

(a) only 35, PHP 8.3+; (b) 34 and 35, PHP 8.2+; (c) 33 to 35, PHP 8.2+.
**Recommendation: (b)** — covers a server one major behind at no extra cost (same PHP floor as
33, which reaches end of life before a first release is likely). CI tests PHP 8.2 and 8.5;
`max-version` moves to 36 when it ships.

### Q2 – Where ratings, colour labels and flags are stored (mockup)

digiKam compatibility matters, so the options are judged by whether digiKam on the desktop sees
the decisions.

- (a) **App database only** — fast, per user, resumable; digiKam sees nothing.
- (b) **XMP sidecars only** — digiKam reads them (with "read from sidecar" enabled); every
  decision is a file write through `OCP\Files`, slow for bulk actions on 2,000 pictures, and
  shared folders share one set of decisions.
- (c) **Both:** the database is the fast working state; decisions are written through to the
  sidecars of each member in the background or on an explicit "write to sidecars", and existing
  sidecars are read when a folder is first listed.
- Nextcloud's collaborative tags are not an option: they are visible to every user and are not
  read by digiKam.

**Recommendation: (c)**, database first (M2), sidecars as M5. digiKam's fields, from its source
(`DMetadata` in `core/libs/metadataengine/dmetadata/`): rating `xmp:Rating` (0–5), colour label
`digiKam:ColorLabel` (0 none, 1 red, 2 orange, 3 yellow, 4 green, 5 blue, 6 magenta, 7 gray,
8 black, 9 white) and `xmp:Label` as text, pick label `digiKam:PickLabel` (0 none, 1 rejected,
2 pending, 3 accepted). Unknown XMP fields are kept when a sidecar is rewritten.

### Q3 – Sidecar file names

digiKam writes `DSC_0412.NEF.xmp` by default and `DSC_0412.xmp` with its "compatible file name"
option (the Adobe convention; Framehive's default). **Recommendation:** read both; write the
name that already exists, else digiKam's default `<file>.xmp` per member. Deleting removes both
forms.

### Q4 – Flag model (mockup)

(a) three states: picked, rejected, unflagged, mapped to digiKam's Accepted, Rejected, None;
(b) digiKam's four states including Pending; (c) the brief's binary keep/discard.
**Recommendation: (a).**

### Q5 – Colour labels and keys (mockup)

(a) digiKam's nine colours in a palette, keys 6–9 for red, yellow, green, blue; (b) Lightroom's
five only. **Recommendation: (a).**

### Q6 – Vertical swipe in the loupe (mockup)

(a) up = pick, down = reject; (b) up = reject, down = pick; (c) off by default.
**Recommendation: (a)**, configurable in the settings as the brief asks.

### Q7 – Advance after a decision

Answered 2026-11-09: (a), to the next undecided picture, with a setting. See
[Culling workflow](#culling-workflow).

### Q8 – Rating filter (mockup)

(a) "at least N", with a toggle to "exactly N"; (b) exactly N only. **Recommendation: (a).**

### Q9 – Filter combination and placement (mockup)

(a) OR within a group, AND across groups, a collapsible bar on top; (b) a side panel like
digiKam's right sidebar. **Recommendation: (a)** — a side panel costs too much width in iPad
portrait.

### Q10 – Entering multi-select by touch (mockup)

(a) a "Select" button and long-press on a tile; (b) the button only. **Recommendation: (a).**

### Q11 – What can be deleted

Answered 2026-11-09: (a). "Delete rejected" starts with the reject review, then the delete
summary; the selection goes straight to the summary. See [Culling workflow](#culling-workflow).

### Q12 – Undo scope

Answered 2026-11-09: (a). Ratings, colour labels and flags are undoable in the session (last 50
steps, the reject toast offers it); deleting is restored from the Nextcloud trash bin.

### Q13 – Grid tile overlays (mockup)

(a) stars, colour label and flag always visible on every tile; (b) only on the focused tile and
in the loupe. **Recommendation: (a)** — without hover, (b) hides the state on touch.

### Q14 – Pairing case and ambiguity

The brief compares base names case-insensitively (Framehive: case-sensitively). With
`A.JPG`, `A.jpg` and `A.NEF` there is no unique partner. **Recommendation:** case-insensitive as
the brief says; an ambiguous base name makes every file a single and shows a warning.

### Q15 – Rendered file types

(a) JPEG only (`jpg`, `jpeg`); (b) also HEIF (`heic`, `heif`, `hif`) and TIFF.
**Recommendation: (b)** as a configurable list like the RAW extensions, default `jpg, jpeg, heic,
heif, hif`; HEIF previews depend on the server's preview providers.

### Q16 – Separate subfolders

**Recommendation:** off by default. When on, the user names the RAW and the rendered subfolder
(default `RAW` and `JPG`, case-insensitive); pictures pair across the two subfolders of the
chosen folder, and the grid shows the chosen folder as one.

### Q17 – Subfolders when a folder is picked

(a) the picked folder only; (b) recursive. **Recommendation: (a)**; recursion only in the
separate-subfolders mode.

### Q18 – Sort order (mockup)

(a) file name; (b) capture time from EXIF; (c) both, user's choice. **Recommendation: (a)
first**, (b) later — capture time needs reading every file's EXIF, which is slow for 2,000 pairs.

### Q19 – Fast image loading

Answered 2026-11-09: see [Image delivery & performance](#image-delivery--performance).

### Q20 – Shared folders

When two users cull the same shared folder: (a) decisions per user; (b) shared decisions.
**Recommendation: (a)** in the database. Sidecars (Q2) are shared by nature, so writing them is
an explicit action in shared folders.
