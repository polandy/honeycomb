# IMAGES-001 – Preview tiers and background previews

- Status: implemented
- Area: images
- Origin: plan.md M2.2, Image delivery & performance (Q19); ADR 0010
- Depends on: LISTING-001, LISTING-002

## Purpose

Culling 2,000+ pairs needs the right pixels fast. The server serves each picture in fixed size
tiers under URLs the browser may cache for good, shows a RAW-only picture by its embedded JPEG,
and renders the tiers in the background before they are asked for.

## Behaviour

`GET /apps/honeycomb/api/v1/images/{fileId}?size=<tier>&v=<mtime>`, logged in, no CSRF token (an
`<img>` sends none). Tiers are `256`, `1024` and `4096` px on the long edge, core's preview sizes,
never upscaled or cropped; `0` is the full image (the file itself when the browser shows its
type, else the largest preview). Another or a missing size is `400`.

| Request | Answer |
|---|---|
| `v` equals the file's mtime | the tier with `Cache-Control: private, max-age=31536000, immutable` and `ETag: "<fileId>-<mtime>-<size>"` |
| `v` is stale | the current tier with `Cache-Control: private, no-cache` |
| `If-None-Match` matches | `304`, no body |
| Not a file below the user's files, not an image, no preview | `404` |
| An image the user may not read | `403` |
| No user | `401` |

A picture shows its rendered member, else its RAW. For a RAW (`image/x-dcraw`, or a `.cr3` or
`.srw` file that Nextcloud types `application/octet-stream`) honeycomb's preview provider takes
the largest complete JPEG embedded in the file.

`POST /apps/honeycomb/api/v1/previews` with `{"fileIds": [...]}` (at most 60,000 integers),
with the CSRF token, queues background jobs of at most 200 files that render all three tiers and
skip what they cannot render. The client sends it after listing a folder set, in display order;
a failed request is logged and the grid stays.

## Acceptance criteria

### IMAGES-001.1 – A tier under an immutable URL

- **Given** a JPEG or a RAW-only picture and the current mtime
- **When** the browser asks for a tier
- **Then** it gets the image with the immutable `Cache-Control` and the tier's `ETag`

### IMAGES-001.2 – A stale version is not kept

- **Given** a `v` that is not the file's mtime
- **When** the browser asks for a tier
- **Then** it gets the current image with `Cache-Control: private, no-cache`

### IMAGES-001.3 – Revalidation

- **Given** an `If-None-Match` that matches the tier's `ETag`
- **When** the browser asks again
- **Then** the answer is `304` and nothing is rendered; an outdated `ETag` gets the image

### IMAGES-001.4 – Tiers keep the shape

- **Given** a tier of 256, 1024 or 4096, or 0
- **When** the image is rendered
- **Then** the tier is the long edge without cropping; 0 is the file itself, or the largest
  preview of a RAW

### IMAGES-001.5 – Only tiers are served

- **Given** a size that is no tier, or none
- **When** the image is asked for
- **Then** the answer is `400`

### IMAGES-001.6 – A RAW shows its embedded JPEG

- **Given** a RAW file with one or more embedded JPEGs
- **When** its preview is rendered
- **Then** the largest complete JPEG is taken, not an EXIF thumbnail or the sensor data, and
  scaled to the tier

### IMAGES-001.7 – A RAW without a usable JPEG has no preview

- **Given** a RAW without a complete JPEG, whose JPEG does not decode, or that cannot be read
- **When** its preview is asked for
- **Then** there is none and the image endpoint answers `404`

### IMAGES-001.8 – Foreign and unreadable images

- **Given** an id outside the user's files, a folder, a file that is no image, an unreadable
  image, or no user
- **When** it is asked for
- **Then** the answer is `404`, `403` or `401`; the route is a `GET` an `<img>` can load without a
  token

### IMAGES-001.9 – The picture's image

- **Given** a pair, a JPEG single or a RAW single
- **When** the client picks the file to show
- **Then** it shows the rendered member, else the RAW

### IMAGES-001.10 – Previews are rendered in the background

- **Given** a listed folder set
- **When** the client sends its file ids in display order
- **Then** jobs of at most 200 files render every tier of each and skip what they cannot render

### IMAGES-001.11 – Background request failures

- **Given** file ids that are not a list of at most 60,000 integers, no user, a job whose user is
  gone or whose argument is malformed, or a failed request
- **When** the previews are queued or the job runs
- **Then** the answer is `400` or `401` and nothing is queued; the job does nothing; the client
  logs the failure and keeps the grid

### IMAGES-001.12 – First sharp image within 500 ms (gap)

- **Given** a newly opened folder of real 24 MP files
- **When** the grid shows
- **Then** the first sharp image shows within 500 ms

### IMAGES-001.13 – RAW files Nextcloud does not type are served

- **Given** a `.CR3` or `.SRW` file typed `application/octet-stream`, and another file of that type
- **When** a tier of each is requested
- **Then** the RAW is served by its embedded JPEG like any RAW; the other file is `404`

## Out of scope

- Which tier a tile or the loupe loads, and prefetch: GRID-001, LOUPE-001.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged code of #40 (ADR 0015) |
| 2026-11-11 | `.cr3` and `.srw` files are served and previewed by name (`TODO.md`, owner 2026-11-10) |
| 2026-11-11 | Tiers 256, 1024 and 4096, core's preview sizes, in place of 512 and 2048 (owner, nc-test analysis) |
