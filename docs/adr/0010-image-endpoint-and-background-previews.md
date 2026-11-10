# 0010 – The image endpoint and background previews

- Status: accepted
- Date: 2026-11-10

## Context

Culling 2,000+ 24 MP pairs needs the grid's 256 and 512 px tiles and the loupe's 2048 px image
fast and cached ([`plan.md`](../plan.md#image-delivery--performance)). Nextcloud's own preview
endpoint (`/core/preview`) takes a file id and a size but answers with a revalidating cache
header, so every tile costs a round trip on a revisit. The browser never decodes RAW, and
Nextcloud has no preview provider for RAW files unless the admin installs `camerarawpreviews`.
A RAW+JPEG pair shows its JPEG; a RAW-only picture needs the JPEG preview embedded in the RAW.

## Decision

- **Shape:** `GET /apps/honeycomb/api/v1/images/{fileId}?size=<tier>&v=<mtime>`, logged in, no
  CSRF token (an `<img>` cannot send one). `size` is one of the tiers `256`, `512`, `2048`
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
  it.
- **RAW:** honeycomb registers a preview provider for `image/x-dcraw` that takes the largest
  JPEG embedded in the RAW file, so the preview cache keeps it like any other preview. The JPEG's
  own orientation tag is applied.
- **Background previews:** `POST /apps/honeycomb/api/v1/previews` with `{"fileIds": [...]}` (at
  most 60,000, the listing's limit) queues background jobs of 200 ids each that render all three
  tiers. The client sends it after listing a folder set, in display order. On upload honeycomb
  generates nothing itself: an admin who wants that installs the Preview Generator app.
- **Errors:** `404` for an id that is not a file below the user's files, not an image, or has no
  preview; `403` when the user may not read it; `401` without a user. The body is empty.

## Consequences

- The first view of a tile not yet warmed renders it synchronously, as `/core/preview` would.
- With `camerarawpreviews` also installed, Nextcloud uses whichever provider matches first;
  both deliver the embedded JPEG.
- The job's argument stays below the 4,000 characters of the job table's `argument` column.
- A file the user cannot reach, such as one in another user's files, is `404` like a missing
  one, so an id reveals nothing.
- The 100 % zoom of the loupe (M3.1) needs the original or the full embedded JPEG; it is added
  to this endpoint then, as a new tier.
