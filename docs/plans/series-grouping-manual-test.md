<!--
SPDX-FileCopyrightText: 2026 honeycomb contributors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Manual test of the series grouping on nc-test

Read at `origin/main` 434c690 (2026-11-13).

## Question

> How do I manually test, on nc-test (<https://nc-test.1-0.io/apps/honeycomb>, Nextcloud test
> instance with test photos), the feature that groups several photos by fingerprint
> (series/burst/duplicate grouping)? Answer as a short step-by-step test guide: which feature/UI
> it is, what preconditions the photos must meet (fingerprint source, time gap, EXIF, preview
> generation, cron/background jobs), which test folder or data on nc-test already qualifies or
> how to prepare such photos, what the owner should see, and known limitations or open TODO
> items. Do not touch the production Nextcloud or the photo library.

## Answer

The feature is the **series** (SERIES-001, SERIES-002, ADR 0021): *Compare series*, the tile
badge "⧉ N" and the series viewer. Shots of one camera group when their EXIF capture times are
close **and** their "visual hash" (a 64-bit dHash of the 256 px grid preview, computed in the
browser) looks alike. The repository cannot say which folder on nc-test qualifies, so the
guide below has you prepare a small throw-away folder; nothing on the server needs a cron job.

## Evidence

- Rule: `src/logic/series.ts:11-17` (3 s without hashes, 30 s and at most 10 of 64 bits with
  hashes), `:49-54` `linked`; at most 4 per series (`:22`), runs split evenly.
- Spec: `docs/specs/series/SERIES-001-series-compare.md` (criteria .1–.20),
  `SERIES-002-series-viewer.md` (badge, viewer); decision: `docs/adr/0021-series-by-capture-time-and-visual-hash.md`.
- Fingerprint source: `src/visual-hashes.ts:28-41` draws the small grid preview onto a 9 × 8
  canvas; hashes only pictures with a same-camera shot within 30 s (`hashablePictures`,
  `src/logic/series.ts:41-44`), one at a time, cached in browser storage
  `honeycomb.visualHashes` per `fileId:etag` (`src/visual-hashes.ts:15-25`). Nothing is stored on
  the server.
- EXIF source: `lib/Service/EntryFactory.php:16-21` reads Nextcloud file metadata written by the
  **Photos app's** metadata providers (`photos-original_date_time`, `photos-ifd0` for make and
  model). Missing values are `null` (LISTING-001.3); a picture without capture time is never in a
  series (SERIES-001.3). The RAW member's time and camera win over the JPEG's
  (`src/logic/series.ts:70-75`).
- Unit-tested only: no Playwright test, the e2e fixtures have no capture times
  (`docs/decisions.md:461`), so this guide is the only end-to-end check on a real server.

## Preconditions

1. **A user with the Photos app enabled** on nc-test. Without it no `photos-*` metadata exists
   and *Compare series* stays at 0. Check by opening a photo's details in Files, or the Photos app
   timeline showing the pictures sorted by their shot date.
2. **EXIF in the files**: `DateTimeOriginal` plus camera Make/Model (a real camera's JPEGs, or a
   copy of burst frames; a screenshot or a re-saved file without EXIF will not group).
   Metadata is extracted when the file is uploaded or scanned, by Nextcloud's own metadata job;
   for files put on disk run `occ files:scan <user>` and, if the Photos timeline lacks them,
   `occ files:scan` again later or wait for the background jobs (cron) to process the queue.
   **Verify the metadata is there before testing** (step 1 below); this is the usual failure.
3. **Previews**: the hash uses the 256 px preview of the *shown member* (the JPEG of a pair).
   Nextcloud generates it on first request; the grid requests it anyway, so no
   `preview:pre-generate` is needed. Previews that fail to load (error tile) mean no hash and the
   3 s rule applies, which is itself a valid test (case C).
4. Use a **fresh browser profile or clear `honeycomb.visualHashes`** (DevTools → Application →
   Local Storage) to see hashing from scratch.
5. Photos where the same camera shot at most 30 s apart. Different cameras never group.

## Preparing the photos

Make a folder `honeycomb-series-test` in a **test user's** files on nc-test only (not the
production Nextcloud, not your photo library). Copy in a few JPEG frames with EXIF (about 12
files is enough), from any burst you have, or build them by editing EXIF on copies of two
different photos, with `exiftool` (the capture times below are examples):

| Case | Files | Capture times (same camera) | Expect |
|---|---|---|---|
| A burst | 3 frames of one subject | 0 s, 1 s, 2 s | one series of 3 |
| B pause | 3 alike frames | 0 s, 12 s, 25 s | one series of 3 (30 s window, needs hashes) |
| C different scenes | 2 unrelated photos | 0 s, 1 s | one series while hashing has not finished (3 s rule), **two singles** once hashes arrive |
| D too far | 2 alike frames | 0 s, 45 s | no series |
| E other camera | 2 alike frames, Make/Model differ | 0 s, 1 s | no series |
| F five frames | 5 alike frames | 0–4 s | series of 3 and 2 |
| G no EXIF | 2 alike frames, EXIF stripped | – | no series |

```sh
exiftool -DateTimeOriginal='2026:11:13 10:00:00' -Make=Test -Model=Cam1 frame1.jpg
```

Keep the cases at least a minute apart (separate times of day) so they do not join each other.
Optional: RAW+JPEG pairs (same base name) must group as one picture, with the RAW's EXIF winning.

## Steps

1. In Files, confirm the test files' metadata arrived (Photos timeline orders them by shot date).
   Fix this first (`occ files:scan`, wait for cron), not the app.
2. Open `https://nc-test.1-0.io/apps/honeycomb`, pick `honeycomb-series-test` (tick
   *subfolders* if nested) and start the cull.
3. Wait a few seconds for the tiles' previews. Tiles of picture in an offered series get a
   read-only badge "⧉ N" (label "Series of N"). Hashes arrive one at a time, so badges and the
   *Compare series* count may change for a short while (case C).
4. Find *Compare series* with its count: in the toolbar, in the ⋯ menu below 900 px window
   width. Check the count against the table (A, B, F with its two series, C once hashes ran).
5. Open it (button or `N`). The title reads "Compare series 1 of N"; the cards sit side by side
   in capture-time order, one outlined (active), the active card's *Pick this, reject the rest*
   is the only primary button.
6. Decide: `Shift+K` picks the active photo and rejects the others in one undo step, toast
   "Picked IMG_xxxx, rejected the rest · Undo"; press Undo and all flags return. Flag a single
   photo with `P`/`X`; a rejected card leaves the series, below two left the next series shows.
   *Skip* wraps from the last to the first. When nothing is left: "All series compared".
7. Tap a card's photo to open the series viewer: swipe/`←` `→`, zoom with `Z` — the zoom
   carries over to every photo ("Zoom synced on all 3 photos"). `Esc` returns with that photo
   active.
8. Hash hold-still (SERIES-001.18): with a fresh storage, open the compare while hashing runs;
   the series must not regroup until you close it.
9. Reload: hashes come from the cache, series are immediate (no hashing visible). Replace a
   file (new etag) and only that file is hashed again.
10. Clean up: delete the test folder (it goes to the trash bin) and the test decisions.
    Honeycomb stores decisions on the server (DECISIONS-001), keyed by file id; deleting
    the folder leaves orphan rows only, harmless on a test user.

## Known limitations and open items

- The 30 s window and 10-bit threshold are constants "to tune on the owner's photos" (ADR 0021);
  no setting. Report false joins and misses with the capture gap and, if possible, the bit
  distance (no UI shows it).
- Hashes are browser-local; another device or a cleared storage hashes again (the first
  visit of a big folder loads every hashable small preview once).
- A picture without EXIF time is never grouped, however alike; **exact duplicates without EXIF
  or with identical time and different cameras are not detected**. There is no duplicate
  finder that works across time (not in scope of SERIES-001).
- Series cross folders only for the folders in the cull; rejected pictures are left out and a
  series needs one unflagged picture, so a decided series disappears.
- A series is at most 4 pictures; a longer burst is several series.
- No e2e test (fixtures lack capture times); no TODO.md item is open for series. Suggested
  follow-up below.

## Follow-ups

- Add EXIF-carrying fixtures so Playwright covers series (needs a decision on the test photos;
  see `docs/decisions.md:461`).
- Optional: a debug readout of the hash distance to ease tuning ADR 0021's numbers on real
  photos, if the manual test shows misgrouping.
