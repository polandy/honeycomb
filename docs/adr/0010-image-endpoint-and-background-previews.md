# 0010 – The image endpoint and background previews

- Status: accepted
- Date: 2026-11-10, tiers amended 2026-11-11, warm-up amended 2026-11-14

## Context

Culling 2,000+ 24 MP pairs needs the grid's small and large tiles and the loupe's image
fast and cached ([`plan.md`](../plan.md#image-delivery--performance)). Nextcloud's own preview
endpoint (`/core/preview`) takes a file id and a size but answers with a revalidating cache
header, so every tile costs a round trip on a revisit. The browser never decodes RAW, and
Nextcloud has no preview provider for RAW files unless the admin installs `camerarawpreviews`.
A RAW+JPEG pair shows its JPEG; a RAW-only picture needs the JPEG preview embedded in the RAW.

## Decision

- **Shape:** `GET /apps/honeycomb/api/v1/images/{fileId}?size=<tier>&v=<mtime>`, logged in, no
  CSRF token (an `<img>` cannot send one). `size` is one of the tiers `256`, `1024`, `4096`
  (long edge, never upscaled, never cropped); another value is `400`. The client picks the file
  of a picture (its JPEG, else its RAW) and takes `fileId` and `mtime` from the listing
  (ADR 0009).
- **Caching:** the URL is immutable while `v` equals the file's current `mtime`:
  `Cache-Control: private, max-age=31536000, immutable` and `ETag: "<fileId>-<mtime>-<size>"`; a
  matching `If-None-Match` is `304`. A stale `v` gets the current image with
  `Cache-Control: private, no-cache`, so an outdated listing still shows the picture but the
  browser never keeps it under the old URL.
- **Pixels:** through `OCP\IPreview`, so Nextcloud's preview cache stores every tier once and
  Imaginary, when the admin configured it, renders them; honeycomb neither needs nor configures
  it. Nextcloud rounds a preview up to a power of four and renders its largest preview (4096 px
  by default) first, so the tiers are those sizes and each comes at the size it names, never more
  than the image has. The loupe takes 4096: 1024 px would be scaled up two- to threefold on an
  iPad's loupe, and the largest preview costs core no extra rendering, only transfer.
- **RAW:** honeycomb registers a preview provider for `image/x-dcraw` that takes the largest
  JPEG embedded in the RAW file, so the preview cache keeps it like any other preview. The JPEG's
  own orientation tag is applied.
- **Warming previews:** `POST /apps/honeycomb/api/v1/previews` with `{"fileIds": [...]}` (at most
  16) renders all three tiers of each file before it answers `200`. The client sends it after
  listing a folder set, in display order, in chunks of 4 with at most 4 requests in flight, so
  the tiers are ready at once and not after the next cron run (amended 2026-11-12). Opening
  another folder set aborts the running warm-up: it sends no further chunk and aborts the
  requests in flight. The browser keeps `fileId:mtime` of every file whose request succeeded,
  the 20,000 used last, in local storage (`honeycomb.warmedPreviews`), and a warm-up skips
  those, so reopening a warmed folder set sends next to nothing (amended 2026-11-14). honeycomb
  needs no background worker; on upload it generates nothing itself, and an admin who wants that
  installs the Preview Generator app, which needs cron.
- **Errors:** `404` for an id that is not a file below the user's files, not an image, or has no
  preview; `403` when the user may not read it; `401` without a user. The body is empty.

## Consequences

- The first view of a tile not yet warmed renders it synchronously, as `/core/preview` would.
- A file the browser counts as warmed whose previews core no longer has, such as after
  `occ preview:cleanup` or in another browser's cache only, renders once on its first view. A
  new `mtime` warms it again.
- An aborted request still renders on the server until it ends; only the requests not yet sent
  are saved.
- Until 2026-11-11 the tiers were `512` and `2048`, which core delivered as 1024 and 4096 px.
- Core renders four previews at a time; the client keeps a few image loads in flight
  (GRID-001.15), so a first view does not exhaust the server's database connections.
- If the budgets, measured with real 24 MP files, miss, honeycomb scales the tiers itself and
  needs its own cache with clean-up for deleted files; that is a new decision.
- With `camerarawpreviews` also installed, Nextcloud uses whichever provider matches first;
  both deliver the embedded JPEG.
- A file the user cannot reach, such as one in another user's files, is `404` like a missing
  one, so an id reveals nothing.
- The 100 % zoom of the loupe (M3.1) is the tier `0`, the full image: the file itself for JPEG,
  PNG, WebP and GIF, else the largest preview Nextcloud renders (for a RAW the embedded JPEG).
  It is not warmed: it is read only while zoomed in.
