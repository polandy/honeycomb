# Implementation plan

The plan the brief asks for ([`01-requirements.md`](01-requirements.md) §1.7): milestones,
project structure, target versions and open questions. `TODO.md` lists the milestones as
PR-sized items in this order. As of 2026-11-09.

## Milestones

Each milestone ends with a usable state on `main`. Milestones M1–M4 follow the brief's order:
pairing, grid, full-screen review, deleting and settings. The split between the thin PHP backend
and the TypeScript logic is in [Backend and frontend](#backend-and-frontend) (ADR 0006).

### M0 – Mockup sign-off

The interactive mockup [`mockup/index.html`](mockup/index.html) (ADR 0003) shows the whole flow:
folder picker, grid with pair badges, filter bar, multi-select with bulk actions, loupe with
swipe and zoom, keyboard shortcuts, undo, the culling workflow below (reject toast, reject review,
delete summary, progress and resume, series compare) and settings. The owner tries it on the
iPad, answers the open questions below, and the mockup is updated until the owner signs it off.
The answers go into ADRs and into this file; the question markers disappear from the mockup.

**Done (signed off by the owner, 2026-11-10).** All twenty open questions were answered on
2026-11-09, the last two (the phone app bar and the Lightroom Mobile gesture split) on
2026-11-10, and the mockup follows the answers. From here the mockup is frozen (ADR 0003); a UI
change that departs from it needs an owner decision.

Brand assets (proposal B, see `TODO.md`) are made alongside, because M1 needs the app icon.

### M1 – App skeleton, thin listing backend, pairing in TypeScript

1. **Skeleton:** `appinfo/info.xml` for Nextcloud 35 only (`min-version` and `max-version`
   35) and PHP 8.3+ ([Target versions](#target-versions)), `composer.json` with
   php-cs-fixer, psalm and PHPUnit, the `Application` class, an empty main page;
   `package.json` with TypeScript, eslint and Vitest with the coverage gate
   ([`02-workflow.md`](02-workflow.md) §2.3); the PHP jobs on PHP 8.3 and 8.5 against
   Nextcloud 35 and the TypeScript jobs in CI and `scripts/verify.sh`; `info.xml` and
   `package.json` in release-please's extra files.
2. **Listing backend:** `GET /api/v1/folders/{path}/entries` returns the folder's files as flat
   entries — file id, path, size, mtime, ETag, mime type and EXIF basics (capture time,
   orientation, dimensions) where Nextcloud's file metadata has them ([Sort order](#sort-order))
   — from one file-cache query
   by path prefix and mime type, for the user's folder only. No pairing on the server. With
   `?subfolders=1` the same query covers every folder below, minus the skipped ones
   ([Multiple folders](#multiple-folders)), capped at 20,000 pictures. PHPUnit first, with the
   failure paths: a foreign path, a vanished folder, no permission; 2,000+ pairs in one response
   without stalls.
3. **Pairing module:** pure TypeScript that groups the entries into pictures. Vitest first, on
   test vectors shared with Framehive (LIBRARY-001) and the brief's cases: names differing only
   in case, several dots in a file name, singles (JPEG only, RAW only), sidecars, ambiguous
   members (Q14), separate subfolders (Q16), configurable extension lists (Q15).

### M2 – Grid view

1. **Frontend skeleton:** Vue, `@nextcloud/vue`, Vite through `@nextcloud/vite-config`,
   `@nextcloud/l10n` and the checks that no user-visible string bypasses `t()`
   ([Translations](#translations)), the build and the Playwright job against a Nextcloud
   container in CI and `scripts/verify.sh`.
2. **Image endpoint:** serves Nextcloud previews under immutable URLs keyed by file id and mtime
   (see [Image delivery & performance](#image-delivery--performance)).
3. **Folder picker and grid:** a folder picker with a checkbox per folder and the *Include
   subfolders* switch, a virtual-scrolling grid with srcset thumbnails (256/512 px, stepless
   size), pair badges and folder headers, light and dark ([Multiple folders](#multiple-folders)).
4. **Decision storage:** the table(s) and API for rating, colour label, flag and *Keep RAW* per
   picture and user (Q2, [Keep RAW and Remove RAWs](#keep-raw-and-remove-raws)), and the resume
   position per folder set and user, so culling can stop and continue on another device (an ADR
   first: new table).
5. **Filter bar:** rating, colour label, flag, pairing, *Keep RAW* and folder filters and the
   sort, as pure TypeScript modules over the listed pictures (Q8, Q9, Q18), and the scope *not
   rejected* / *undecided* / *all* of the culling workflow with the "x of y decided" progress.
6. **Selection and bulk actions:** selection mode, select all filtered, bulk rate, label, flag
   and *Keep RAW* (Q10).

### M3 – Full-screen review (loupe)

1. **Loupe:** the JPEG (or the RAW's embedded preview) full screen, swipe to page, pinch zoom,
   100 % zoom, [tap zones](#tap-zones), prefetching of the neighbours, chrome-free mode,
   resizable info panel (see
   [Image delivery & performance](#image-delivery--performance)).
2. **Decisions in the loupe:** large pick and reject buttons (at the side edges in landscape,
   [Loupe layout](#loupe-layout)), vertical swipe (Q6), rating, colour
   label and *Keep RAW* controls, auto-advance to the next undecided picture, the "Rejected
   IMG_0001 · Undo" toast.
3. **Keyboard shortcuts and undo:** the one shared key map ([Keyboard
   shortcuts](#keyboard-shortcuts)), undo and redo (Q12), the shortcut sheet.

### M4 – Deleting and settings

1. **Delete service:** deletes the members and sidecars of each picture through `OCP\Files` into
   the trash bin; a failure is reported per file and leaves a traceable state. An ADR first on
   what "atomic" means for a pair. Tests for every failure path.
2. **Reject review and delete summary:** the review grid of all rejected pictures with rescue,
   then the summary with pictures, files and bytes freed and the trash-bin note; also reachable
   from the selection (Q11).
3. **Remove RAWs:** the bulk action and its summary ([Keep RAW and Remove
   RAWs](#keep-raw-and-remove-raws)), built on the delete service of M4.1 and its ADR on pair
   atomicity, with tests for every failure path.
4. **Settings:** per user — RAW and rendered extensions, folder mode, show singles, gesture
   mapping, auto-advance, show flag buttons ([Flag buttons and vi keys](#flag-buttons-and-vi-keys))
   and vi keys.
5. **README:** features, screenshot placeholders, the installation section brought up to date;
   `camerarawpreviews` and Preview Generator as recommended apps.

### M5 – XMP sidecars

Read existing sidecars when a folder is listed and write ratings, colour labels, flags and
*Keep RAW* to them, so digiKam, darktable and Lightroom Classic on the desktop see the
decisions. Fields, precedence, write rules and test vectors:
[`06-xmp-interop.md`](06-xmp-interop.md). The mapping and the serialized form are a TypeScript
module; the backend writes the bytes it gets with the checked save (ADR 0006).

### M6 – Series compare

Groups pictures taken within a short interval and lets the owner pick the best of each (see
[Culling workflow](#culling-workflow), point 4). Own milestone after the core flow works; the
mockup already shows it.

### M7 – Moving pictures

Moves one picture, the selection or a filter result into another Nextcloud folder, renamed by a
name template (see [Moving pictures](#moving-pictures)). Decided by the owner on 2026-11-09; the
mockup shows it.

### Release – first App Store release

Before it: Transifex setup ([Translations](#translations)), the signing certificate and the
release workflow that uploads the tarball.

## Culling workflow

Decided by the owner on 2026-11-09 (answers Q7, Q11 and Q12). It is the owner's Lightroom Mobile
routine on the iPad, adopted as the default *Cull* mode: filter to *not rejected*, go through all
pictures, a rejected picture disappears from view, and at the end delete all rejects. A picture is
*undecided* while its flag is unflagged; picked and rejected are decided.

1. **Reject and review.** Each reject shows the toast "Rejected IMG_0001 · Undo". Before anything is
   deleted, a review step shows a grid of all rejects; a single picture can be rescued (it
   becomes undecided), then the owner confirms.
2. **Delete is the trash bin.** Deleting moves files to the Nextcloud trash bin, restorable;
   there is no hard delete. Space returns only when the trash bin is emptied.
3. **Whole pair.** Reject and delete always act on the whole picture: every member and every
   sidecar form, `<file>.xmp` of each member and a shared `<base>.xmp` alike. The delete summary
   shows pictures · files · bytes freed. *Remove RAWs* is the one action that takes a member
   away from a picture ([Keep RAW and Remove RAWs](#keep-raw-and-remove-raws)).
4. **Series compare** (milestone M6). Pictures taken within a short interval (mockup: 3 seconds by
   capture time, at most 4 per series) form a series, shown 2–4 side by side. Tapping the best one
   means *Pick this, reject the rest*: it is picked, the others rejected, as one undo step. The
   owner's 2026-11-09 feedback changes how: see [Compact header and series
   viewer](#compact-header-and-series-viewer).
5. **Auto-advance.** After each pick or reject the view moves to the next undecided picture
   (the setting stays, Q7 is answered). Rating and colour label do not advance.
6. **Progress and resume.** The toolbar shows "x of y decided" per folder set. The last position
   per folder set and user is stored on the server (with the decisions, M2.4), so another device
   offers to continue there. *Recent* in the navigation lists the last folder sets with their
   progress.
7. **Multi-pass.** The scope filter has *not rejected* (default), *undecided* and *all*, so a
   second pass over the picks or a pass over what is left is one tap. An explicit flag filter
   overrides the scope.

Where the work lands: M2.4 (resume position), M2.5 (scope, progress), M3.2 (auto-advance, toast),
M4.1 and M4.2 (delete, review, summary), M6 (series).

## Keep RAW and Remove RAWs

Decided by the owner on 2026-11-09. The owner keeps the RAW for a few pictures and only the JPEG
for most, so the RAWs of the rest can go once a cull is done.

1. **Keep RAW.** A marker per picture and user, its own toggle, independent of rating, colour
   label and flag. Only a pair can carry it; for a single the toggle is disabled ("Keep RAW: only
   for pairs"). It is stored like the other decisions: in the database (M2.4) and in the XMP
   sidecars as `honeycomb:KeepRaw` (M5, [`06-xmp-interop.md`](06-xmp-interop.md), ADR 0008).
   Changing it is one undoable change with a toast: "Marked IMG_0001 Keep RAW · Undo",
   "Removed Keep RAW from IMG_0001 · Undo". It does not advance.
2. **Where the toggle sits.** In the shared action bar, after the colour label, so it is the same
   control in the loupe (the small row below the flag buttons), the series viewer and the
   selection bar; pressed, it is honey like the other pressed controls. On a grid tile a marked
   pair's badge turns honey with a check, `JPG+NEF ✓`, and the tile's label says "Keep RAW".
   Key `R` toggles it ([Keyboard shortcuts](#keyboard-shortcuts)).
3. **Filter.** The filter bar has a *Keep RAW* group after *Pairing*, with the chips *Marked* and
   *Not marked*; like the other chip groups it selects several, none selected means no filter.
4. **Remove RAWs.** A bulk action in the ⋯ menu, "Remove RAWs…" with a count, that acts on the
   current view (scope and filters). It takes every picture in the view that is a pair, is not
   marked *Keep RAW* and is not rejected; singles (JPEG only or RAW only), marked and rejected
   pictures are skipped. For each it moves **only the RAW member and its own `<raw>.xmp`
   sidecar** to the Nextcloud trash bin. The JPEG, its `<jpeg>.xmp` and a shared `<base>.xmp`
   stay, and the picture keeps every decision; it becomes a *JPEG only* single.
5. **Summary.** Before anything moves, a summary like the delete summary: pictures · files · bytes
   freed, how many pictures were skipped and why ("Skipped: 7 marked Keep RAW · 6 rejected · 30
   singles") and the trash-bin note. Below the numbers are two thumbnail groups of the view, each
   heading with its count: "RAW will be removed" (every picture whose RAW goes) and "RAW stays
   (Keep RAW)" (the marked pairs). Each group scrolls, so a large selection stays usable. Tapping
   a thumbnail toggles *Keep RAW* on that picture, one undoable change as elsewhere, and moves it
   to the other group before anything is confirmed; the numbers and the button follow. The list
   of files sits in a collapsed section. The confirming button reads "Move 88 files
   to trash", red. No single-key shortcut. Like deleting, it is not undone by `Ctrl+Z`; the trash
   bin restores.
6. **Failures.** The RAW and its own sidecar are one unit: when the RAW fails, its sidecar is not
   touched and the picture stays a pair. The report lists each failed file, as for deleting.
7. **Deleting a whole picture** stays as it was: every member and every sidecar form goes. A
   shared `<base>.xmp` is removed only when no member of the picture remains, so *Remove RAWs*
   never removes it.

Where the work lands: M2.4 (storage), M2.5 (filter), M2.6 (bulk toggle), M3.2 (loupe toggle),
M3.3 (`R`), M4.3 (Remove RAWs and its summary, extending the M4.1 delete service under its ADR on
pair atomicity), M5 (sidecar property).

## Multiple folders

Decided by the owner on 2026-11-09 (answers Q17): one cull can cover several folders, or a
folder with all its subfolders. That set of folders is the *folder set*.

1. **Picker.** The folder picker has a checkbox per folder and an *Include subfolders* switch
   (any depth). Before opening it shows the count, e.g. "1,840 photos in 23 folders"; the button
   reads "Cull 23 folders".
2. **Skipped folders.** Hidden folders (name starts with `.`), the trash bin and Nextcloud's
   preview folders are never part of a folder set.
3. **Grid.** Sorted by capture time across folders by default; one folder starts by file
   name, and the user can switch either ([Sort order](#sort-order)). The
   *More* menu offers *Group by folder*, with a sticky header per folder; the filter bar gets a
   *Folder* filter. The loupe's info panel shows the folder.
4. **Pairing stays within one folder.** RAW and rendered members pair only within one folder; the
   `RAW/` + `JPG/` layout of the separate-subfolders mode (Q16) counts as one folder.
5. **Series may cross folders**, but only within one camera (EXIF make and model).
6. **Review and delete** work across the folder set; the review tiles and the delete summary
   show each picture's folder.
7. **Moving.** Moving pictures into a folder of the folder set still removes them from the view.
8. **Recent.** A folder set is listed under *Recent* with its own resume position and progress.
9. **Performance.** The server lists the whole folder set with one file-cache query by path
   prefix and mime type, never a WebDAV walk. The grid is virtualised. Above 20,000 pictures the
   picker shows a notice and the grid shows the first 20,000 by capture time.

Where the work lands: M1.2 (listing with subfolders), M2.3 (picker, grid headers), M2.4 (resume
per folder set), M2.5 (folder filter), M6 (series per camera).

## Image delivery & performance

Decided by the owner on 2026-11-09 (answers Q19). Culling 2,000+ 24 MP pairs lives or dies by how
fast the right pixels reach the screen.

**Size tiers.** Grid tiles 256 px and 512 px, loupe 2048 px on the long edge, 100 % zoom the
original file. The browser picks the tier through `srcset` from tile size × `devicePixelRatio`;
the thumbnail size is stepless (mockup: slider, Ctrl + wheel, pinch).

**Progressive display.** The small preview shows first; the sharp one is swapped in after
`img.decode()` resolves, so the tile never blanks or jumps.

**Prefetch.** The loupe prefetches 2–3 neighbours in each direction. The mockup shows the
preload state in the loupe's info panel, not over the photo.

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

Where the work lands: M1.2 (file id and mtime per entry), M2.2 (cache-keyed URLs), M2.3
(tiers, virtualised grid), M3.1 (prefetch, `decode()` swap), M4.5 (README recommendation), and
a new item for the background generation and the RAW preview extraction.

## Compact header and series viewer

Decided by the owner on 2026-11-09 (phone screenshot of the mockup); shown in
`docs/mockup/index.html`. Goal on a phone: the photo grid starts in the upper ~20 % of the screen.

1. **One bar, one slim row.** The bar is ~56 px. The breadcrumb shows only the root and the
   current folder when the toolbar is at most 720 px wide (container query); a tap on the folder
   shows the full path. *Select*, *Review rejects*, *Compare series* and *Filters* are icon
   buttons with count badges; their labels appear beside the icons only when the toolbar is at
   least 1000 px wide. Sort, the tile size slider, *Move picks*, *Resume*, hiding the header,
   settings and the mockup's language switch live in a **⋯ more menu** (arrow keys,
   one separator per group). The scope (*Not rejected* / *Undecided* / *All*) and the progress
   share one slim row below (it moves into the app bar while scrolling, item 2). The active
   scope shows its name beside the icon when the app is wider than 520 px. Every control keeps
   a 44 px hit target.
2. **The key actions move into the app bar while scrolling** (owner, 2026-11-09, correcting the
   slim-row version). Nothing stays below the app bar: when the toolbar hides, all of it, the
   slim row included, slides away, and the most used actions appear in the top app bar
   (`.hdr`, where *Undo* and *Redo* are), between the logo and *Undo*: the scope as three icon
   buttons, the *decided* count with a thin progress line on the bar's bottom edge, *Review
   rejects* with its badge and the ⋯ menu. When the toolbar returns they leave the app bar again;
   there are never two copies at once (the hidden toolbar is inert). Every target keeps 44 px.
   On a phone the logo shrinks to the mark, and to make room the navigation toggle and the count
   figures give way while the actions are in the app bar (the thin line stays), *Redo* moves into
   the ⋯ menu and *Undo* stays in the bar (owner, 2026-11-10; Ctrl+Shift+Z and Ctrl+Y are
   unchanged). Checked in the mockup at 360 and 412 px: the mark, the three scope icons, *Review
   rejects*, ⋯ and *Undo* fit with 44 px targets beside the reserved 60 px on the right.
   Breadcrumbs, *Select*, *Compare series* and *Filters* sit in the toolbar, which returns on
   scrolling up. The ⋯ entry *Hide header* still hides everything, leaving a small handle. The rules are ported from Stella's top bar (`followScroll`) and the
   mockup keeps the decision as a pure function of the same shape:
   - Only after 24 px of travel in one direction does the bar follow; a nudge is not a scroll.
   - Within the toolbar's height of the top, including a negative position from iOS rubber-band
     overscroll, it is always shown.
   - Within the bar's height of the bottom it keeps its state: hiding makes the scroller taller,
     the clamp pulls the scroll back, that reads as scrolling up, the bar returns, and it
     bounces forever.
   - It slides by a negative `margin-top` in the flow (not `position: fixed` or a transform),
     about 350 ms, and not at all under `prefers-reduced-motion`.
   - The shell is `100dvh` and the document never scrolls; only the grid's scroller does.
   - Focus entering the bar shows it, and selection mode keeps it shown.
   - Opening a folder starts with the bar shown.
3. **Flag icons as in Lightroom and digiKam** (owner, 2026-11-09). *Rejected* is a flag with an
   x, *Picked* a filled white flag and *Unflagged* an empty flag outline. The scope buttons use
   a crossed reject flag for *Not rejected*, the empty flag for *Undecided* and a grid for *All*.
   The same icons mark the tiles, the loupe, the bulk actions, the flag filter and the series
   viewer. The words stay as `aria-label` and a [tooltip](#tooltip); targets stay 44 px.
4. **Series viewer.** Tapping a photo of a series opens it fullscreen at once, the whole series
   preloaded. Swipe pages between the photos (arrow buttons and keys also work, also while
   zoomed). *Pick this, reject the rest* is in the viewer, one undo step. The controls fade out
   when idle; a tap on the middle of the photo brings them back or hides them, a tap on its left
   or right side pages ([Tap zones](#tap-zones)).
   - **Reject a single photo** without leaving fullscreen (owner, 2026-11-09): the *Reject*
     button in the bottom bar, the `X` key, or a swipe down
     on the photo following the *Swipe down* setting (a horizontal swipe still pages; no
     gesture while zoomed). If that setting is *Pick*, the swipe picks the photo and keeps it
     in the series.
   - It follows the *Cull* mode: the rejected photo leaves the series and the viewer moves on
     to the next photo (the previous one after the last) with the synchronised zoom kept. The
     undo toast, `Undo` or Ctrl+Z puts the photo back in its place and shows it.
   - Once one photo is left the viewer closes and the series counts as decided. Undo after
     that restores the flag only; *Compare series* finds the series again on its next opening.
   - **Same controls as the loupe** (owner, 2026-11-09: "keep/reject is not consistent with the
     normal pick/reject"). The bottom bar is the loupe's action bar — *Pick*, *Reject*, *Unflag*,
     rating and colour label for the shown photo, keys `P`, `X`, `U` — plus *Pick this, reject
     the rest* (`Shift+K`). On a phone it wraps to two rows; in landscape the flags sit at the side
     edges ([Loupe layout](#loupe-layout)). The series compare dialog shows the
     same flag buttons and *Pick this, reject the rest* under each photo.
5. **Synchronised zoom.** Zooming one photo to 100 % (button, double-tap, pinch or `Z`) zooms
   every photo of the series to the same spot, and panning moves them together, so paging
   compares the same detail for sharpness. While zoomed, a swipe pans instead of paging.

Where the work lands: M2.3 (header, bar, scroll behaviour), M6 (series viewer).

## Loupe layout

The owner on 2026-11-09, after testing the mockup on the iPad: in landscape the photo was too
small and the controls at the bottom took too much room; the photo, *Pick* and *Reject* matter
most. The rule for the loupe and the series viewer, measured on the
[reference devices](#reference-devices) in [ux-review.md](ux-review.md#landscape-loupe):

1. **Landscape (wider than tall): the photo fills the screen.** Nothing takes a strip of its
   own; the photo is fitted to the whole loupe.
2. **Pick and Reject float at the side edges**, where the hands hold a tablet: *Pick* at the
   left edge, *Reject* at the right with *Unflag* below it, so the glossary order holds from
   left to right. They are 84 px wide and 120–240 px tall (68 px wide on a phone), vertically
   centred, on a dark translucent fill, always visible, and never reach the middle half of the
   screen. *Previous* and *Next* sit just inside them.
3. **Everything else overlays the photo and hides when idle:** the title row (name, pair,
   count, *Fit*, *Move…*, *Info*, filmstrip toggle) at the top, the filmstrip and the rating
   and colour label row at the bottom (plus *Pick this, reject the rest* in the series viewer).
   They hide 2.5 s after the last touch, as the series viewer's controls already did; a tap on
   the middle of the photo shows or hides them ([Tap zones](#tap-zones)), a mouse move shows
   them, and a control with keyboard focus keeps them shown. The info panel opens beside the
   photo, inside the *Reject* edge.
4. **Portrait keeps the bottom bar:** title row, photo, filmstrip, then the large flag row and
   the rating row below, as before. The layout switches with the orientation, on rotation too.
5. **Unchanged:** every keyboard shortcut, the swipe gestures, the tooltips, double-tap or `Tab`
   for the chrome-free mode (which also hides the edge buttons), and the shared `ActionBar`:
   one component, laid out by orientation, not a second copy.
6. **The flag buttons can be hidden** for good, by a setting and the key `B`
   ([Flag buttons and vi keys](#flag-buttons-and-vi-keys)); the photo then gets their room.

Where the work lands: M3.1 and M3.2 (loupe), M6 (series viewer).

## Tap zones

The owner on 2026-11-09, on the iPad: in landscape a tap on the right or left
of the photo should go to the next or previous photo, as in an e-reader. The rule for the loupe
and the series viewer, checked on every [reference device](#reference-devices) with Playwright
touch taps (numbers in the pull request):

1. **Three zones across the photo area.** A tap on the left 30 % goes to the previous photo, on
   the right 30 % to the next, on the middle 40 % it shows or hides the overlays as before. The
   zones span the whole width and height of the photo area, not the photo (owner, same day):
   the dark margin beside a portrait photo in landscape, and above or below a landscape photo,
   counts like the photo under it. The middle 40 % stays the middle wherever the photo lies, so
   on the Pixel in landscape the inner 51 px of each 337 px margin toggle the overlays. On the
   first or last photo the outer zone does nothing. The overlays keep their state: paging by tap
   does not bring them back.
2. **Buttons win.** *Pick*, *Reject*, *Unflag* and every overlay control lie above the zones; a
   tap on one decides or acts, a tap beside one pages. The edge buttons stay as they are
   (84 × 240 px, 68 × 154 px on the Pixel), so they cover 8–9 % of an outer zone and a thumb
   has the strip above, below and inside them to page. In Chromium a tap 3 px outside a button
   still hits it (touch adjustment; re-check in Safari), so a near miss decides; the undo toast
   takes it back.
3. **Only a short, still touch is a tap:** under 8 px of movement and under 500 ms, the
   tooltip's long-press time. A longer press does nothing, so resting a thumb never pages.
   Every swipe (Q6 vertical, horizontal paging) is unchanged.
4. **Zoomed in, the zones are off.** While a photo is zoomed, a tap anywhere acts as the middle
   (overlays, double-tap) and a drag pans, so inspecting a detail never pages by accident.
5. **Double-tap only in the middle.** An outer zone pages at once, without waiting for a second
   tap, so two quick taps page twice; double-tap keeps its meaning (chrome-free mode in the
   loupe, 100 % in the series viewer) in the middle zone, and the middle's single tap is not
   delayed either, as before.
6. **Touch and pen only.** A mouse click on the photo shows or hides the overlays as before;
   the mouse has *Previous* and *Next* and the arrow keys.
7. ***Previous* and *Next* stay** for the mouse, the keyboard focus order and screen readers
   (the zones have no accessible name); on touch they sit inside the zones and do the same.
   The zones carry no tooltip, being no control; the gesture guide explains them.
8. **Portrait gets the same zones.** One rule in both orientations keeps the habit across a
   rotation, portrait has no edge buttons to conflict with (its flags are in the bottom bar),
   and a single tap on the photo had no visible effect in portrait before.
9. **Reduced motion.** Paging by tap uses the same transition as the buttons and keys, and
   none under `prefers-reduced-motion`; the series viewer then jumps instead of scrolling.
10. **Gesture guide.** It gains one line with a three-cell sketch of the zones (‹ · controls · ›)
    and now lies above the landscape overlays, which covered its *Got it* on the Pixel.

Where the work lands: M3.1 (loupe), M6 (series viewer).

## Reference devices

The owner on 2026-11-09: every screen must work on these devices, in portrait and landscape.
They are the viewports for every render check (mockup, screenshots, Playwright), replacing the
earlier ad-hoc sizes; 1440 × 900 stays as the desktop check.

| Device | CSS viewport, portrait | DPR | Display | Front camera | Safe areas portrait (top, right, bottom, left) | Safe areas landscape |
|---|---|---|---|---|---|---|
| Pixel 9 Pro | 427 × 952 [^dt] | 3 [^dt] | 1280 × 2856, 495 ppi, 6.3″ [^px] | punch hole, centre of the short edge | 68, 0, 36, 0 [^dt] [^e2e] | 0, 68, 36, 0 |
| iPad mini (A17 Pro, 2024), the smallest tablet that must fit | 744 × 1133 [^c] | 2 [^c] | 2266 × 1488, 326 ppi, 8.3″ [^m24] | in the bezel, short edge [^m24] | 24, 0, 20, 0 [^ios] | 24, 0, 20, 0 [^ios] |
| iPad mini (A20 Pro, 2026) | 756 × 1158 [^c] | 2 [^c] | 2316 × 1512, 326 ppi, 8.5″ OLED [^m26] | in the bezel, long edge (top in landscape) [^m26] | 24, 0, 20, 0 [^ios] | 24, 0, 20, 0 [^ios] |
| iPad Pro 11″ (M5) | 834 × 1210 [^c] | 2 [^c] | 2420 × 1668, 264 ppi [^pro] | in the bezel, long edge (top in landscape) [^pro] | 24, 0, 20, 0 [^ios] | 24, 0, 20, 0 [^ios] |
| Desktop | 1440 × 900 (landscape only) | 1 | – | – | none | none |
| Laptop (MacBook Air 15″) | 1470 × 956 (landscape only); also checked at 1280 × 800 | 2 | – | – | none | none |

[^dt]: Chrome DevTools device list, entry *Pixel 9 Pro*, with its cutout insets:
    <https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/models/emulation/EmulatedDevices.ts>
[^px]: Google, Pixel phone hardware tech specs: <https://support.google.com/pixelphone/answer/7158570>
[^e2e]: The bottom inset (gesture bar) is dynamic on Android; 36 px is Chrome's
    `safe-area-max-inset-bottom` fallback: <https://developer.chrome.com/docs/css-ui/edge-to-edge>
[^m24]: Apple, iPad mini (A17 Pro) tech specs: <https://support.apple.com/en-us/121456>
[^m26]: Apple, iPad mini tech specs (*Landscape 12MP Center Stage camera*):
    <https://www.apple.com/ipad-mini/specs/>
[^pro]: Apple, iPad Pro tech specs, 11-inch model: <https://www.apple.com/ipad-pro/specs/>
[^c]: Computed: Apple publishes pixels, not points; every Retina iPad renders at 2 device
    pixels per CSS pixel, so the viewport is the pixel size halved.
[^ios]: Measured empirically, no primary source: the status bar (top) and the home indicator
    (bottom) in Safari full screen. A bezel camera adds no inset. Re-measure on a device.

Rules for every screen on every reference device:

1. **Fits:** nothing clipped and no horizontal scroll, in both orientations and after a rotation.
2. **Safe areas:** the page uses `viewport-fit=cover` and pads its edges with
   `env(safe-area-inset-*)`; no control lies under the camera, the status bar or the home
   indicator. Backgrounds and the photo may run underneath.
3. **Thumbs:** *Pick* and *Reject* stay large and reachable without moving the grip
   ([Loupe layout](#loupe-layout)); every touch target is at least 44 × 44 px on a coarse
   pointer ([Control sizes](#control-sizes)).

The mockup has a device preview (*Mockup controls* → *Device frame*): it frames the page at
the chosen device's CSS viewport, portrait or landscape, sets the safe areas from this table and
marks the camera, so each device can be checked on a desktop browser. The phones and tablets
render with touch sizes, *Desktop* and *Laptop* with compact sizes, whatever the browser's pointer.

## Control sizes

The owner on 2026-11-09 (feedback on mockup v19): on a laptop the touch-sized controls look far
too large. Controls are sized by input type, not one touch size everywhere:

| Pointer | Media query | Control (`--hit`) | Icon (`--ic`) | Type | Examples |
|---|---|---|---|---|---|
| Coarse (phone, tablet, touch) | anything that is not fine | 44 px | 22 px | 15 px | app bar 52 px, *Pick* and *Reject* 64 px high, landscape rails 96 px |
| Fine (mouse, trackpad) | `(pointer: fine) and (hover: hover)` | 34 px | 18 px | 14 px | app bar 50 px, toolbar 44 px, *Pick* and *Reject* 40 px high, landscape rails 64 px |

- The fine sizes follow Nextcloud's own web UI (`--default-clickable-area` 34 px, header 50 px),
  so honeycomb sits in it without standing out.
- The primary pointer decides (`pointer` and `hover`, not `any-pointer`), so a touch screen keeps
  touch sizes while touch is its primary input. What iPadOS Safari reports with a trackpad
  attached is to be checked on a device. When the media query changes, the sizes follow at once.
- Every size comes from the two tokens or from the one fine-pointer block; a component never
  hard-codes 44 px. The Vue app maps them to Nextcloud's CSS variables.
- Coarse targets stay at least 44 × 44 px ([Reference devices](#reference-devices), rule 3).

## Keyboard shortcuts

Decided by the owner on 2026-11-09: honeycomb uses the Lightroom Classic Library keys wherever it
has the function, so the hands of a Lightroom user already know them. **One key map** (`keymap`
in the shared `hotkeys` module) serves the grid, the loupe, the series compare and the series
viewer; a screen supplies only what its keys act on. The help sheet, the tooltips and the user
doc ([`user/keyboard-shortcuts.md`](user/keyboard-shortcuts.md)) are generated from or checked
against it. `Ctrl` on Windows and Linux is `⌘` on a Mac.

| Keys | Action | Lightroom Classic |
|---|---|---|
| `P` `X` `U` | *Pick*, *Reject*, *Unflag*; pressing the flag a picture has unflags it | same keys |
| `Shift+P` `Shift+X` `Shift+U` | the same, then go to the next photo | same keys |
| `Caps Lock` | auto-advance: every decision goes to the next photo | listed as Auto Advance; not confirmed in the Adobe text read |
| `` ` `` | toggle *Picked* | differs: Lightroom cycles pick, reject, unflagged |
| `0`–`5` | set the rating | same keys |
| `Shift+0`–`Shift+5` | set the rating, then go to the next photo | same keys |
| `[` `]` | one star down, one star up | same keys |
| `6` `7` `8` `9` | colour label red, yellow, green, blue (toggle) | same keys |
| `R` | *Keep RAW* (toggle; honeycomb only) | differs: `R` is Crop in Lightroom, which honeycomb does not have |
| Arrow keys | grid: move focus; loupe, series compare, series viewer: switch photo | same idea |
| `Home` `End` | first photo, last photo | not in the Adobe text read; the browser's usual meaning |
| `G` `E` `N` | grid, loupe, series compare | `G` and `E` as in Lightroom; `N` is Survey there, series compare here |
| `Space` | loupe: fit / 100 % | differs: Lightroom's `Space` leaves the grid for the loupe; `Z` zooms there |
| `Z` | loupe and series viewer: fit / 100 % | not confirmed in the Adobe text read |
| `Ctrl+=` `Ctrl+-` | zoom in, zoom out | same keys |
| `F` | fullscreen | not confirmed in the Adobe text read |
| `Tab` | show or hide the header (loupe: the controls) | differs: Lightroom hides the side panels, `Shift+Tab` all panels |
| `I` | cycle the info overlay | same key |
| `\` | show or hide the filter bar | not confirmed in the Adobe text read |
| `Ctrl+L` | filters off / on | same keys |
| `Ctrl+A` `Ctrl+D` | select all, select none | same keys |
| `Ctrl+Z` `Ctrl+Shift+Z` | undo, redo | same keys |
| `Ctrl+Backspace` | review rejects (*Delete rejected photos* in Lightroom; here the summary opens first) | same keys; `⌘+Delete` on a Mac keyboard is `⌘+Backspace` in a browser |
| `Ctrl+/` | shortcut help (`?` also works, for a touch keyboard) | same keys |
| `Delete` | delete summary for the selection or focused picture | |
| `M` | *Move to…* (honeycomb only) | |
| `Shift+K` | *Pick this, reject the rest* in the series compare and viewer (honeycomb only; was `K`, which the vi keys need) | |
| `B` | show or hide the flag buttons in the loupe and the series viewer (honeycomb only) | differs: `B` adds to the Quick Collection in Lightroom, which honeycomb does not have |
| `1`–`9` | move dialog: choose a favourite or recent folder (honeycomb only) | |

- **Series compare and series viewer** act like Lightroom's Survey: `P`, `X`, `U` and `0`–`5`
  decide the *active* photo, and the arrow keys switch it. The keys `1`–`4` no longer choose the
  best photo; `Shift+K` does, as one undo step. The series compare dialog outlines the active photo.
- **Where a key has no function** on a screen (`Z` in the grid, `Shift+K` outside a series) it does
  nothing, and `Tab` keeps moving focus while a control has it.
- **Verification.** Each key was checked against Adobe's [Keyboard shortcuts for Lightroom
  Classic](https://helpx.adobe.com/lightroom-classic/desktop/introduction-to-lightroom-classic/keyboard-shortcuts.html)
  and [How to flag, label, and rate
  photos](https://helpx.adobe.com/lightroom-classic/help/flag-label-rate-photos.html), Windows and
  Mac. Adobe's server refused direct downloads (HTTP 403), so the check ran on search excerpts of
  those pages; keys marked *not confirmed* did not appear in them and need a look at Lightroom's own
  list (`Ctrl+/` in the Library module) before M3.3 builds them.

Where the work lands: M3.3, with the mockup (`KEYS` in `docs/mockup/index.html`) as the reference.

## Flag buttons and vi keys

The owner on 2026-11-09: someone who culls with the keyboard alone wants the photo to have the
room of *Pick* and *Reject*, and the standard vi keys should move around.

### Flag buttons

1. **Setting and toggle.** *Settings › Loupe gestures › Show flag buttons* (per user, stored with
   the other settings, on by default) shows or hides *Pick*, *Reject* and *Unflag* in the loupe
   and the series viewer. The same setting flips from the title row, with a flag icon button
   (*Flag buttons*, `aria-pressed`, a crossed flag while they are hidden), and with the key `B`.
2. **Hidden, the photo gets the room.** Portrait drops the large flag row; landscape drops the
   edge buttons, and the title row, filmstrip, rating row and *Previous* and *Next* move out to
   the screen edges. The keys, the swipes, the tap zones and every other tooltip keep working.
   The grid's selection action bar and the series compare cards keep their flag buttons: there
   they are the only way to flag by touch.
3. **A way back on touch.** The title-row toggle never hides with the flags, and a tap on the
   middle of the photo brings the title row back, so a touch screen without a keyboard is never
   stuck. Hiding them shows a toast with *Show*: with a mouse "Flag buttons hidden · `B` shows
   them"; on touch "… swipe to decide, the flag at the top shows them", or, when *Settings ›
   Loupe gestures* has both swipes on *Nothing*, "Flag buttons hidden, and no swipe decides: …".
4. **Chrome-free mode** (`Tab`, double-tap) still hides everything for a moment; this setting is
   the lasting choice.

### Vi keys

**An option, off by default** (*Settings › Keyboard › Vi keys*, per user). `h`, `j`, `k`, `l`
clash with nothing once *Pick this, reject the rest* moves to `Shift+K`, but `g g` makes `g` a
prefix, and `g` is Lightroom's key for the grid, which the owner put first. Off by default, a
Lightroom user keeps `G` as before and no prefix waits for a second key; on, a vi user gets the
whole set and leaves the loupe with `Esc`.

| Keys (vi keys on) | Grid | Loupe, series compare, series viewer |
|---|---|---|
| `h` `l` | focus left, right | previous photo, next photo |
| `j` `k` | focus one row down, up | next photo, previous photo, the order the grid reads in |
| `g g` | first photo | first photo |
| `Shift+G` | last photo | last photo |
| `/` | open the filter bar and focus its first control | — |
| `Esc` | — | back to the grid, as always |

`Home` and `End` do the same as `g g` and `Shift+G`, with the option on or off. A `g` waits for the
next key without a timeout; any other key drops it and acts as usual, so `g` `p` picks.

**Clashes, checked against the key map above:**

| vi key | vi meaning | honeycomb | Resolution |
|---|---|---|---|
| `k` | up | `K` *Pick this, reject the rest* | moved to `Shift+K` for everyone, so one key map serves both modes and a multi-photo decision needs a deliberate chord |
| `g`, `G` | prefix (`g g` first), last | `G` grid | `G` grid with the option off; with it on, `g g` first, `Shift+G` last, `Esc` the grid |
| `x` | delete a character | `X` *Reject* | unchanged; the meanings agree |
| `u`, `Ctrl+R` | undo, redo | `U` *Unflag*; `Ctrl+R` reloads the page | not mapped; undo stays `Ctrl+Z`, redo `Ctrl+Shift+Z` |
| `p` | paste | `P` *Pick* | not mapped |
| `0`, `$`, counts like `5j` | line start, line end, repeat | `0`–`5` set the rating | not mapped; the digits stay ratings |
| `n`, `N`, `?` | next, previous match, search back | `N` series compare, `?` help | not mapped; there is no text search to repeat |
| `H`, `M`, `L` | screen top, middle, bottom | `M` *Move to…* | not mapped |
| `z` prefix (`z z`) | scroll | `Z` fit / 100 % | not mapped |
| `Ctrl+D`, `Ctrl+U`, `Ctrl+F`, `Ctrl+B` | half page, page | `Ctrl+D` select none; the browser's find and bookmarks | not mapped |
| `b`, `w` | word back, forward | `B` flag buttons | not mapped |

Where the work lands: M3.2 and M6 (flag buttons), M3.3 (keys, vi keys, shortcut sheet), M4.4
(settings).

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

## Backend and frontend

honeycomb is a classic PHP Nextcloud app, not an AppAPI ExApp (ADR 0006).

| Backend (PHP, thin) | Frontend (pure TypeScript modules in `src/logic/`) |
|---|---|
| List a folder set: one file-cache query by path prefix and mime type, flat entries with EXIF basics | Pairing, series |
| Move and trash files through `OCP\Files` | Filters, sort, the culling scope and progress |
| Write the XMP bytes the client produced, with the checked save | XMP read and write mapping, serialized form |
| Store per-user decisions, resume position and settings | Name templates and move conflicts |
| Serve Nextcloud previews | Decisions (flag toggle, common values), undo, gestures, hotkeys, header scroll logic |

The backend validates every path or file id it gets — owned by the user, still there, unchanged
since the client listed it — and never trusts the client's pairing, names or counts. Vue
components wire the modules to the DOM and the API and hold no rules of their own. How tests are
written for each side: [`02-workflow.md`](02-workflow.md) §2.3.

## Shared UI components

The owner asked for consistency across the project and for reusable components (2026-11-09):
every screen builds a decision from the same parts, so a pick looks, reads and behaves the same
in the grid, the loupe, the series compare and the series viewer. The words, icons, colours,
order and keys are in the [glossary](04-glossary.md#words-and-conventions-in-the-ui). The mockup
renders each part from one function (named in brackets), and the Vue app gets one component each
under `src/components/`. A new screen composes these; a variant is a prop, not a copy. Each
takes its sizes from the pointer type ([Control sizes](#control-sizes)), not from a prop.

| Component (mockup function) | Renders | Used by | Pure modules (`src/logic/`) |
|---|---|---|---|
| `FlagButtons` (`flagButtons`) | *Pick*, *Reject*, *Unflag*, neutral until pressed: a pressed *Pick* or *Reject* fills its colour, a pressed *Unflag* gets an outline; small or large | action bar, series compare card | `decisions`: flag toggle, a selection's common value |
| `FlagMark` (`flagMark`) | the read-only flag icon | `PhotoTile`, loupe filmstrip, series compare card | — |
| `StarRating` (`starRating`, `stars`) | 0–5 buttons, or read-only stars | action bar, `PhotoTile`, series compare card | `decisions` |
| `ColourLabels` (`colourLabel`, `showPalette`) | the label button and the nine-colour palette | action bar, filter bar | `decisions`, `hotkeys` |
| `ActionBar` (`actionBar`) | rating, colour label, *Keep RAW* and flags; flags in a large row of their own (portrait) or at the side edges (landscape, [Loupe layout](#loupe-layout)), plus a slot | grid selection, loupe, series viewer | `decisions`, `hotkeys` |
| `FlagButtonsToggle` (`flagBtnsToggle`) | the title-row icon button that shows or hides the large flag buttons ([Flag buttons and vi keys](#flag-buttons-and-vi-keys)) | loupe, series viewer | — |
| `PickRestButton` (`pickRestBtn`) | *Pick this, reject the rest* | series compare card, series viewer | `series` |
| `UndoToast` (`toast`) | the change in words, *Undo*, an optional action | every undoable change | `undo`: entries and their text |
| `ConfirmDialog` (`confirmDialog`) | title, body, footer *Back* · *Cancel* · confirm; a bottom sheet on a phone | delete summary, reject review, move summary, folder picker, delete report | — |
| `PhotoTile` (`tileInner`, `updateTile`) | thumbnail, pair and series badges (a complete pair quiet, a single highlighted), stars once rated, colour dot, flag mark, selection check | grid | `pairing` |
| `Tooltip` (`tip`, `tipShow`, `bindTips`) | the bubble tooltip of a control: its label in glossary words and its key from `HOTKEY`, e.g. "Pick `P`" | every icon and icon-only control on every screen | `hotkeys` |

### Tooltip

The owner asked for a bubble tooltip on every icon (2026-11-09). One `#tip` element serves the
whole app; a control opts in with `data-tip` (and `data-tip-key`), written by `tip(label, key)`.
The key comes from the one key map `HOTKEY`, which also feeds the keyboard shortcuts sheet and
the key handlers, so a tooltip never names a key the app does not use. The native `title` is not
used.

- **Show.** Mouse: after 400 ms of hover, at once when moving on from a tooltip shown less than
  300 ms ago. Keyboard: on focus when the focus ring shows (`:focus-visible`). Touch and pen: a
  long-press of 500 ms; the release hides it and the click that follows is swallowed, so the
  long-press never triggers the action.
- **Hide.** Leaving the control (the bubble itself can be hovered, WCAG 1.4.13), blur, a click or
  tap, scrolling the control's container, the control leaving the page, the series viewer's
  controls fading out, and *Escape*.
- **Escape.** While a tooltip shows, the first *Escape* only hides it; the next one closes the
  popover, dialog, series viewer or loupe as before.
- **Placement.** The arrow points at the control. Below for a control in the top half of the
  frame, above in the bottom half, then the other side, right, left: the first side that stays
  8 px inside the frame and its safe areas and clears the middle third of the photo in the loupe
  and the series viewer wins.
- **Gestures.** The long-press timer stops when the finger moves more than 10 px, a second finger
  lands (pinch) or the browser takes the pointer (scroll in the filmstrip, the series track).
  Inside a grid tile the long-press stays selection (Q10, answered by the owner on 2026-11-09),
  and one gesture never triggers the other:
  - The tooltip's long-press does not start inside a tile: its handler ignores a target within
    a tile, so on a tile and its badges no tooltip timer runs and no click is swallowed by it.
  - The tile's own long-press (480 ms, cancelled like the tooltip's by 10 px of movement, the
    finger lifting or the browser taking the pointer) enters selection mode and adds the tile;
    a second long-press never removes it. The click that follows is swallowed by the grid, so
    the loupe does not open and the tile is not toggled again.
  - Tile badges show their tooltip on mouse hover only; keyboard focus is on the tile, whose
    `aria-label` carries the same words.

  A disabled control shows its tooltip only where the browser sends hover to it.
- **Accessibility.** While shown, the control has `aria-describedby="tip"`; the bubble
  (`role="tooltip"`) never takes focus. Every icon-only control keeps its `aria-label`. Colours
  come from `--tip-bg` and `--tip-fg`, at least 15:1 in both themes. Reduced motion shows it
  without the fade.

## Visual design and first run

The UX review of 2026-11-09 ([ux-review.md](ux-review.md)) set the visual rules the mockup now
follows; its design direction lists the tokens.

- **Neutral, photo-first colours.** Greys without a colour cast in both themes, a near-black
  stage behind the loupe and the series viewer; honey is the accent only. Pressed *Pick* and
  *Reject* use fixed dark fills, so white text keeps its contrast in both themes.
- **First run.** The folder picker opens with one sentence on what honeycomb does and that
  deleting goes to the trash bin. The first loupe opening shows a gesture guide (swipes from
  the settings, [tap zones](#tap-zones), pinch, double-tap, the main keys) until it is
  dismissed once.
- **Calm loupe chrome.** The title row shows the name and the pair; the gesture mapping and the
  preload state sit in the info panel.

## Pairing and file types

Answered by the owner on 2026-11-09 (Q14, Q15, Q16).

1. **Case.** Base names are compared ignoring case, as the brief says (Framehive compares them
   case-sensitively).
2. **Ambiguity.** When a base name has more than one RAW file or more than one rendered file,
   such as `A.JPG`, `A.jpg` and `A.NEF`, no pair is formed. Every file of that base name becomes
   a single, its tile shows a warning, and the grid shows one notice for the folder.
3. **Rendered file types.** A per-user list like the RAW extensions, default `jpg, jpeg, heic,
   heif, hif`; TIFF can be added. HEIF previews depend on the server's preview providers, which
   the README names (M4.5).
4. **Separate subfolders.** The folder mode is *Same folder* by default. In *Separate
   subfolders* the user names the RAW and the rendered subfolder (default `RAW` and `JPG`,
   matched ignoring case). Pictures pair across the two subfolders of the chosen folder, and the
   grid shows the chosen folder as one.

Where the work lands: M1.3 (pairing), M4.4 (settings).

## Grid, filters and sort

Answered by the owner on 2026-11-09 (Q8, Q9, Q10, Q13, Q18).

1. **Rating filter.** An *Any* chip ("Alle" in German) first, then the 0–5 chips, and one 44 px
   comparison button beside them. Each tap cycles the comparison
   *≥ → ≤ → = → ≥* ("at least", "at most", "exactly"); the default is *≥*, "at least N" (owner,
   2026-11-09, mockup v15). The button shows the current symbol; its label and tooltip name the
   current and the next comparison, and it is a plain button, so Enter and Space work. Every
   combination matches something, so no empty state needs a special reason. One button is
   narrower than the old three-way segment, so it fits every reference device, and the group
   still wraps inside the filter panel on the Pixel 9 Pro. The panel keeps an 8 px gap below the
   bar above it.
   *Any* is selected while no rating filter is active, so the state is always visible, and
   tapping it turns the filter off, as in any chip group (owner question on mockup v16, "how do
   I switch the ≥ → ≤ → = filter off?"). It was chosen over a small × because it needs no new
   control and reads the same in every language. The comparison button is dimmed and disabled
   while *Any* is selected, since there is nothing to compare. The other groups (colour, flag,
   pairing, folder) select several chips, none selected means no filter, and *Clear filters*
   resets all; they have no single-choice problem, so they get no *Any* chip.
2. **Combining filters.** OR within a group, AND across groups, e.g. *red or green* and *at
   least 3 stars*. The filter bar is a collapsible bar on top of the grid; a side panel would
   cost too much width in iPad portrait.
3. **Tile overlays.** Stars (once rated), colour label and flag are always visible on every
   tile. There is no setting: without hover, hiding them would hide the state on touch.
4. **Selection mode.** The *Select* button and a long-press on a tile both enter selection mode;
   the long-press also selects that tile. How this long-press and the tooltip's long-press are
   kept apart: [Tooltip](#tooltip), *Gestures*.

### Sort order

The user chooses *File name* or *Capture time* in the ⋯ menu, from the first version (M2.5). One
folder starts by file name; a folder set of several folders starts by capture time
([Multiple folders](#multiple-folders)).

- **Where capture time comes from.** The listing (M1.2) returns each file's EXIF capture time
  from Nextcloud's file metadata (`IFilesMetadataManager`), which Nextcloud extracts on upload
  and with `occ files:scan --generate-metadata`. No file is read to sort, so 2,000 pairs cost
  no more than sorting by name; the metadata key is confirmed in M1.2.
- **A picture's capture time** is the RAW member's, else the rendered member's, the same rule as
  the name templates ([`05-name-templates.md`](05-name-templates.md)).
- **Without a capture time** (no EXIF, or the metadata not extracted yet) a picture sorts by its
  file's modification time, and the loupe's info panel shows "Modified … (no capture time)".
  Such a picture never joins a series (M6), because a copy can give many files the same
  modification time.
- **Ties** are broken by file name. File names compare with `Intl.Collator` on the user's
  locale with numeric order, so `IMG_2` comes before `IMG_10`.

Where the work lands: M1.2 (capture time per entry), M2.3 (overlays), M2.5 (filters, sort),
M2.6 (selection).

## Decisions, gestures and shared folders

Answered by the owner on 2026-11-09 (Q3, Q4, Q5, Q6, Q20).

1. **Flags.** Three states: picked, rejected, unflagged, written as digiKam's Accepted,
   Rejected and None ([`06-xmp-interop.md`](06-xmp-interop.md) has the mapping).
2. **Colour labels.** digiKam's nine colours in a palette; keys `6`–`9` set red, yellow, green
   and blue ([Keyboard shortcuts](#keyboard-shortcuts)).
3. **Vertical swipe.** In the loupe, swipe up picks and swipe down rejects. *Settings › Loupe
   gestures* sets each direction to *Pick*, *Reject* or *Nothing*, so either swipe can be
   turned off; the series viewer's swipe down follows the same setting.
4. **Sidecar names.** Both `<file>.xmp` and `<base>.xmp` are read; every one that exists is
   written, else `<file>.xmp` per member; deleting a picture removes both, *Remove RAWs* only the
   RAW's own `<file>.xmp` ([`06-xmp-interop.md`](06-xmp-interop.md#sidecar-names)).
5. **Shared folders.** Decisions are per user, in the database. Sidecars are shared by every
   user of the folder, so in a shared folder nothing is written through on its own: the ⋯ menu
   offers *Write decisions to sidecars…*, which asks first (ADR 0005). The listing (M1.2) says
   per folder whether it is shared.

Where the work lands: M1.2 (shared per folder), M2.4 (per-user decisions), M3.2 (swipe), M3.3
(colour keys), M4.4 (gesture setting), M5 (sidecars).

## Translations

Decided by the owner on 2026-11-09 and revised the same day (ADR 0007). The source strings are
English and go through `@nextcloud/l10n`'s `t()` and, for every string with a count, `n()`, from
M1. The app ships English only for now. Transifex is deferred until before the first App Store
release. The language is the user's Nextcloud language. Numbers and dates use `Intl` on the
user's Nextcloud locale, and name templates stay the same in every language (ADR 0004).

- **Transifex.** Set up before the first App Store release (`.tx/config`, `l10n/.gitkeep`,
  `.l10nignore`, the owner's steps and the `main` ruleset question of issue #17); see the release
  milestone and `TODO.md`.
- **Checks.** From M2.1, eslint and a Vitest pass with a stub catalogue fail on a user-visible
  string that bypasses `t()` (ADR 0007, *Checks*).
- **Mockup.** The ⋯ menu switches the mockup between English and German, to see long German
  labels in place on the iPad. Its German strings are not a translation source.

Where the work lands: M2.1 (`@nextcloud/l10n`, checks), every UI item after that (strings
through `t()`).

## Project structure

The standard Nextcloud app layout; folders appear with the milestone that needs them.

```text
honeycomb/
├── appinfo/info.xml            app id `honeycomb`, versions (Q1), navigation entry
├── lib/
│   ├── AppInfo/Application.php
│   ├── Controller/             PageController, EntryController, DecisionController,
│   │                           FileController, SettingsController (thin)
│   ├── Service/
│   │   ├── ListingService.php  one file-cache query: flat entries of a folder
│   │   ├── PathGuard.php       rechecks every client path: owned, exists, unchanged
│   │   ├── FileService.php     move, trash, write XMP bytes through OCP\Files
│   │   ├── DecisionService.php rating, colour label, flag and resume position per user
│   │   └── SettingsService.php per-user settings (IConfig user values)
│   ├── Db/                     entities and QBMapper classes
│   └── Migration/              database migrations
├── src/
│   ├── logic/                  pure TypeScript, no DOM or network: pairing, series, filter,
│   │                           sort, name templates, conflicts, xmp, decisions, undo,
│   │                           gestures, hotkeys, header scroll
│   └── main.ts, App.vue, views/, components/, store/ (Pinia)
├── templates/main.php          mounts the Vue app
├── tests/php/, tests/js/       PHPUnit, Vitest
├── tests/e2e/                  Playwright against a Nextcloud container
├── tests/fixtures/             test vectors, shared with Framehive where they overlap
├── img/app.svg, img/app-dark.svg
├── l10n/                       translations, once Transifex is set up (ADR 0007)
├── docs/                       this documentation, the mockup, ADRs
├── assets/brand/               logo sources and generate.py
├── scripts/verify.sh           every CI check locally
├── composer.json, package.json, psalm.xml, .php-cs-fixer.dist.php, phpunit.xml,
│   tsconfig.json, vite.config.ts, playwright.config.ts
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

**Supported: Nextcloud 35 only, PHP 8.3 and later** (Q1, answered by the owner on 2026-11-09,
against the recommendation of 34 and 35). `appinfo/info.xml` sets `min-version` and `max-version`
to 35 and requires PHP 8.3. CI runs the PHP jobs on PHP 8.3, the floor, and 8.5, the version
Nextcloud recommends, against Nextcloud 35. Supporting 36 once it ships is a new decision for the
owner.

## Open questions

The questions the plan started with, each with the options it offered. The owner answered all of
them by 2026-11-09; each answer names the section or ADR that now holds the decision, and the
mockup has no question markers left. A question that comes up during a task becomes a
`needs-owner` issue ([`02-workflow.md`](02-workflow.md) §2.2).

### Q1 – Which Nextcloud versions to support

(a) only 35, PHP 8.3+; (b) 34 and 35, PHP 8.2+; (c) 33 to 35, PHP 8.2+. The recommendation was (b).
**Answered by the owner on 2026-11-09:** (a), Nextcloud 35 only, PHP 8.3+. See [Target
versions](#target-versions).

### Q2 – Where ratings, colour labels and flags are stored

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

**Answer (owner, 2026-11-09): (c)**, database first (M2), sidecars as M5, read and written in
digiKam's, darktable's and Lightroom's fields (ADR 0005). The mapping is
[`06-xmp-interop.md`](06-xmp-interop.md).

### Q3 – Sidecar file names

digiKam, darktable and Framehive write `DSC_0412.NEF.xmp` by default; digiKam writes `DSC_0412.xmp`
with its "compatible file name" option (the Adobe convention). **Recommendation:** read both; write
every one that exists, else `<file>.xmp` per member
([`06-xmp-interop.md`](06-xmp-interop.md#sidecar-names)). Deleting removes both forms. **Answered by
the owner on 2026-11-09:** as recommended. See [Decisions, gestures and shared
folders](#decisions-gestures-and-shared-folders).

### Q4 – Flag model

(a) three states: picked, rejected, unflagged, mapped to digiKam's Accepted, Rejected, None; (b)
digiKam's four states including Pending; (c) the brief's binary keep/discard. **Answered by the
owner on 2026-11-09:** (a), three states. See [Decisions, gestures and shared
folders](#decisions-gestures-and-shared-folders).

### Q5 – Colour labels and keys

(a) digiKam's nine colours in a palette, keys 6–9 for red, yellow, green, blue; (b) Lightroom's five
only. **Answered by the owner on 2026-11-09:** (a), digiKam's nine colours, keys 6–9. See
[Decisions, gestures and shared folders](#decisions-gestures-and-shared-folders).

### Q6 – Vertical swipe in the loupe

(a) up = pick, down = reject; (b) up = reject, down = pick; (c) off by default. **Answered by the
owner on 2026-11-09:** (a), up = pick, down = reject; each direction can be changed or turned off in
the settings. See [Decisions, gestures and shared folders](#decisions-gestures-and-shared-folders).
**Rejected alternative (owner, 2026-11-10):** the Lightroom Mobile split, swipe left = flag and
swipe right = stars. The vertical swipe stays.

### Q7 – Advance after a decision

Answered 2026-11-09: (a), to the next undecided picture, with a setting. See
[Culling workflow](#culling-workflow).

### Q8 – Rating filter

(a) "at least N", with a toggle to "exactly N"; (b) exactly N only. **Answered by the owner on
2026-11-09:** (a). See [Grid, filters and sort](#grid-filters-and-sort).
**Extended by the owner on 2026-11-09 (mockup v15):** one button cycles *≥ → ≤ → = → ≥*, default
*≥*. *More than* and *fewer than* were considered and dropped: ratings are whole stars, so *> N*
is *≥ N+1* and *< N* is *≤ N−1*. Leaving them out keeps the cycle at three steps and avoids
the empty cases *> 5* and *< 0*.

### Q9 – Filter combination and placement

(a) OR within a group, AND across groups, a collapsible bar on top; (b) a side panel like digiKam's
right sidebar. **Answered by the owner on 2026-11-09:** (a). See [Grid, filters and
sort](#grid-filters-and-sort).

### Q10 – Entering multi-select by touch

(a) a "Select" button and long-press on a tile; (b) the button only. **Answered by the owner on
2026-11-09:** (a); the long-press does not show a tooltip on a tile ([Tooltip](#tooltip)). See
[Grid, filters and sort](#grid-filters-and-sort).

### Q11 – What can be deleted

Answered 2026-11-09: (a). "Delete rejected" starts with the reject review, then the delete
summary; the selection goes straight to the summary. See [Culling workflow](#culling-workflow).

### Q12 – Undo scope

Answered 2026-11-09: (a). Ratings, colour labels and flags are undoable in the session (last 50
steps, the reject toast offers it); deleting is restored from the Nextcloud trash bin.

### Q13 – Grid tile overlays

(a) stars, colour label and flag always visible on every tile; (b) only on the focused tile and in
the loupe. **Answered by the owner on 2026-11-09:** (a), always visible. See [Grid, filters and
sort](#grid-filters-and-sort).

### Q14 – Pairing case and ambiguity

The brief compares base names case-insensitively (Framehive: case-sensitively). With `A.JPG`,
`A.jpg` and `A.NEF` there is no unique partner. **Recommendation:** case-insensitive as the brief
says; an ambiguous base name makes every file a single and shows a warning. **Answered by the owner
on 2026-11-09:** as recommended. See [Pairing and file types](#pairing-and-file-types).

### Q15 – Rendered file types

(a) JPEG only (`jpg`, `jpeg`); (b) also HEIF (`heic`, `heif`, `hif`) and TIFF. **Recommendation:
(b)** as a configurable list like the RAW extensions, default `jpg, jpeg, heic, heif, hif`; HEIF
previews depend on the server's preview providers. **Answered by the owner on 2026-11-09:** (b), the
configurable list with that default. See [Pairing and file types](#pairing-and-file-types).

### Q16 – Separate subfolders

**Recommendation:** off by default. When on, the user names the RAW and the rendered subfolder
(default `RAW` and `JPG`, case-insensitive); pictures pair across the two subfolders of the chosen
folder, and the grid shows the chosen folder as one. **Answered by the owner on 2026-11-09:** as
recommended. See [Pairing and file types](#pairing-and-file-types).

### Q17 – Subfolders when a folder is picked

(a) the picked folder only; (b) recursive. **Answered by the owner on 2026-11-09:** both —
several folders can be ticked, and *Include subfolders* adds every folder below. See
[Multiple folders](#multiple-folders).

### Q18 – Sort order

(a) file name; (b) capture time from EXIF; (c) both, user's choice. The recommendation was (a) first
and (b) later, for fear of reading every file's EXIF. **Answered by the owner on 2026-11-09:** (c),
both from the first version. The listing already returns the capture time from Nextcloud's file
metadata, so no file is read; see [Sort order](#sort-order) for the source and for pictures without
one.

### Q19 – Fast image loading

Answered 2026-11-09: see [Image delivery & performance](#image-delivery--performance).

### Q20 – Shared folders

When two users cull the same shared folder: (a) decisions per user; (b) shared decisions.
**Recommendation: (a)** in the database. Sidecars (Q2) are shared by nature, so writing them is an
explicit action in shared folders. **Answered by the owner on 2026-11-09:** (a). See [Decisions,
gestures and shared folders](#decisions-gestures-and-shared-folders).
