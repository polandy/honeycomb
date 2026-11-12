# 0021 – Series by capture time and a visual hash of the grid preview

- Status: accepted
- Date: 2026-11-12

## Context

Until now a series was a run of shots of one camera at most 3 seconds apart (SERIES-001). The
owner decided on 2026-11-12 that photos form a series when they are close in time **and** look
alike. The 3 second rule splits a burst that pauses to reframe, and it joins two different
subjects shot in quick succession.

Comparing images needs pixels. The grid already loads every tile's small preview (256 px, ADR
0010) with an immutable URL, so the browser has it in its cache. A backend image library would be
a new heavy dependency and would read the files a second time.

## Decision

- **Hash.** A 64-bit difference hash (dHash): the preview drawn at 9 × 8 pixels, one bit per pixel
  that is brighter (luminance) than its right neighbour. It is cheap, needs no library and
  tolerates scaling, exposure shifts and JPEG noise; small reframing changes few bits. pHash would
  be more robust to rotation but needs a DCT for no gain on bursts. The pure code lives in
  `src/logic/visual-hash.ts`, the canvas drawing in `src/visual-hashes.ts` (ADR 0006).
- **Link rule.** Two neighbouring shots of one camera, in capture-time order, belong to one series
  when both have a hash, they lie at most **30 seconds** apart and their hashes differ in at most
  **10 of 64 bits**; while either has no hash, the old rule applies (at most 3 seconds). The
  numbers are named constants in `src/logic/series.ts`.
  - 30 s: with a visual check, time only has to rule out unrelated scenes. Bursts with pauses to
    reframe or to wait for a moment fit in 30 s; beyond that a photographer usually has moved on,
    and the four-per-series split keeps long runs small anyway.
  - 10 bits (about 15 %): the threshold commonly used with dHash for "near duplicate"; burst
    frames of one subject usually stay below it, different scenes well above. It is a starting
    point to tune on the owner's photos.
- **Background, no waiting.** Only pictures with a shot of the same camera within 30 s are hashed
  (`hashablePictures`), one at a time, from the small preview URL. A failed hash is logged and
  leaves that picture on the time rule. The series update as hashes arrive, except while the
  series compare is open: new hashes are held back until it closes, so a series does not regroup
  under the user's finger.
- **Cache.** Browser storage key `honeycomb.visualHashes`, a JSON object from `<fileId>:<etag>` to
  16 hex digits, the newest 10 000 entries (about 600 000 characters of the browser's 5 million). A changed etag means new pixels and a
  new hash. The cache is device-local and rebuilt from the previews when cleared; nothing is
  stored on the server.
- **No setting yet.** Window and threshold are constants. A per-user setting would need the
  settings endpoint, its validation and UI (ADR 0014); it follows if the owner's taste differs.

## Consequences

- Series are the same as before until hashes arrive, so nothing regresses or waits on hashing.
- With hashes, a burst within 3 s whose frames look different is split, and alike shots up to
  30 s apart are joined.
- The first visit of a large folder set loads the small preview of every hashable picture once;
  the grid's own loads are then cache hits.
- Another device hashes again; the hashes are cheap to recompute.
