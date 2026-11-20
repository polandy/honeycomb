# 0046 – Quality values and visual hashes per file version, computed in the browser

- Status: accepted
- Date: 2026-11-20
- Amends: [0024](0024-visual-hashes-stored-on-the-server.md), the key of `honeycomb_hashes`
- Leaves unchanged: [0006](0006-thin-php-backend-logic-in-typescript.md), [0026](0026-rate-limit-of-the-visual-hash-saves.md),
  [0040](0040-flags-per-picture-in-the-database.md)

## Context

The owner asked on 2026-11-20 how honeycomb can help with culling, for example by finding the
sharpest photo of a series, and decided the same day on the culling aids (milestone M11):

- The sharpest photo of a series is **only marked**: no preselected card, no automatic pick.
- Sharpness is measured on the **4096 px preview**, for **series members only**.
- A suggestion **never reaches a sidecar**; only the user's decision is written, as
  `digiKam:PickLabel`, as today.
- **Quality hints** (shake risk, clipping) show in the info panel, as a filter and subtly on the
  tile.
- Calibration may **browse and copy** from the owner's Photos library, never change it.
- The owner noted that a visual hash is a property of the picture, too: hashes and quality values
  follow **one rule**, per user or per file and etag. If the reason ADR 0024 had for "per user" no
  longer holds, both move to file and etag.

ADR 0024 gives no reason of its own for keeping hashes per user; it followed the decisions, which
were per user then (ADR 0012). ADR 0040 moved the flags to one row per file id, because a shared
file has the same file id for every user and two users of one folder must see one picture. A hash
or a sharpness value depends only on the file's content, which its etag marks: two users who
compute it get the same result, and a row per user only makes the second one compute it again.
The reason is gone.

The options for the quality values were:

- **A, columns in `honeycomb_hashes`:** one row per file, but two passes write it (the hash from
  the 256 px preview of every hashable picture, sharpness from the 4096 px preview of series
  members only, later), so a save would have to merge into a row another pass wrote.
- **B, a table of its own,** chosen: each pass writes whole rows of its own table, and the hash
  path keeps its endpoint and code.

## Decision

### One rule for hashes and quality values

- **Key:** one row per file id, with the etag the value was taken from; no user. The value is
  delivered only while that etag is the file's current etag. Both tables are `FileRowStore`s:
  the daily sweep removes the rows of files deleted for good, a move that gives a file a new id
  carries its row over, deleting a user leaves rows of files that still exist.
- **Who may save:** every user who reaches the file as a photo, as before; a save replaces the
  row. A value is a measurement, never a decision, so a wrong one can move a mark or a series
  boundary but never flag, move or delete a picture.
- **`honeycomb_hashes`** loses `user_id`; its unique key becomes `file_id`. The migration drops
  the old rows: hashes are derived data and the next visit computes them again (the throw-away
  rule of ADR 0040). Endpoint, item shape, batches and the rate limit of ADRs 0024 and 0026 stay.

### Quality values

- **Computed in the browser,** in the hash worker pool, as a second kind of job (ADR 0006: PHP
  stores, TypeScript measures). The pure module `src/logic/sharpness.ts` takes grey pixels and
  returns the value; Vitest proves it on synthetic vectors.
- **Sharpness:** the 3×3 Laplacian's variance in each tile of an 8×8 grid over the photo; the value
  is the mean of the best 10 % of tiles, and the focus tile is the best tile's index (0–63, row
  by row, in the photo as shown). The value compares photos of one series only, never against a
  fixed threshold.
- **Which photos:** the preview file of every picture in a series of at least two (automatic or
  stored), the same file the visual hash is taken from; no singles, no Immich assets. The worker
  fetches the 4096 px preview and draws it in bands (`createImageBitmap` with a source rectangle),
  so one band's pixels are held at a time. One photo at a time, in the background, after the
  hashes; a value that arrives late adds the mark, it never regroups a series.
- **Table** `honeycomb_quality`: `file_id` (unique), `etag`, `method` (small integer, the version
  of the measure), `sharpness` (float, ≥ 0) and `focus_tile` (0–63), all not null.
- **Delivery:** each listing entry carries `quality`, `{"method": 1, "sharpness": 812.4,
  "focusTile": 27}` while the etag matches, else `null` (one query per 1,000 entries, as the
  hashes). The browser treats a value of another method as missing and measures again, so a
  calibrated measure needs no migration.
- **Save:** `PUT /apps/honeycomb/api/v1/quality-values` with `{"values": [{"fileId": 9, "etag":
  "…", "method": 1, "sharpness": 812.4, "focusTile": 27}, ...]}`, at most 1,000 items, answers
  `{"saved": [9, ...]}`; validation, skipped items and `400` as ADR 0024 has them for hashes, and
  the rate limit of ADR 0026 (300 saves a minute per user).
- **The mark:** the series compare and the series viewer mark the sharpest photo when its value is
  at least 5 % above the second; closer than that, no photo is marked. The active card stays the
  first photo. The info panel names the rank (*Sharpest of 4*, *Rank 2 of 4*), never the raw value.
  The 5 % is a start that calibration may move.
- **Never in a sidecar.** No quality value, mark or hint is written to XMP or sent to Immich; the
  user's *Pick this, reject the rest* writes flags as before.
- **Calibration:** a script under `scripts/` runs the pure modules over a local folder of series
  copied from the owner's Photos library, which it only reads; never against a production
  Nextcloud.

### Quality hints

A hint is information, never a suggestion to reject. The shake risk from EXIF needs new listing
fields and gets its own amendment of this ADR with its pull request; clipping, measured later,
gets a column of `honeycomb_quality` the same way. The look of the mark and the hints is the
mockup [`mockup/quality/index.html`](../mockup/quality/index.html).

## Consequences

- A folder hashed or measured by one user is not hashed or measured again for another user who
  shares it, on any device, until its files change.
- Every hash is computed once more after the migration.
- A series member's first measurement loads its 4096 px preview, about 1.2 MB, and renders it on
  the server when it was not rendered before; a folder of 2,000 series photos loads about 2.4 GB
  once.
- A user who can read a shared file can save a wrong value for every user of it; the harm stops
  at a misplaced mark.
- The listing answer grows by up to 60 characters per series member.
