# XMP-002 – Sidecar endpoints

- Status: implemented
- Area: xmp
- Origin: `docs/plan.md` M5, `docs/06-xmp-interop.md` Writing, ADR 0005, ADR 0017, Framehive CORE-009
- Depends on: LISTING-001, XMP-001

## Purpose

Hands the client the bytes of the sidecars it listed and saves the bytes it merged, so the pure
XMP module (XMP-001) can read and write sidecars while the backend only touches files through
`OCP\Files` and never overwrites a sidecar the client has not seen.

## Behaviour

`POST /apps/honeycomb/api/v1/sidecars/lookup` takes `{"fileIds": [9, …]}`, at most 1,000, and
answers `{"sidecars": [{"fileId": 9, "result": "read", "content": "<base64>", "etag": "…",
"size": 812, "mtime": 1700000000}, …]}` in the order sent.

`PUT /apps/honeycomb/api/v1/sidecars` takes `{"sidecars": [...]}`, at most 1,000, each either an
existing sidecar `{"fileId": 9, "etag": "…", "size": 812, "content": "<base64>"}` or a new one
`{"path": "/Photos/IMG_0001.NEF.xmp", "content": "<base64>"}`, content at most 1 MiB. Each is
saved by the checked save: target checked, bytes written to `<name>.part` beside it, target
checked again, part file renamed onto it; a failure deletes the part file. The answer is
`{"sidecars": [{"result": "saved", "fileId": 9, "etag": "…", "size": 830, "mtime": …}, …]}` in
the order sent.

| Result | Lookup | Save |
|---|---|---|
| `read` | The bytes, ETag, size and mtime | – |
| `saved` | – | Saved; the sidecar's file id, ETag, size and mtime |
| `notFound` | Vanished, foreign, a folder or not `.xmp` | An existing sidecar vanished or is not `.xmp`; a new one's image is missing |
| `changed` | – | Another ETag or size, or a new one that exists meanwhile |
| `tooLarge` | Over 1 MiB | – |
| `notPermitted` | The user may not read it | The user may not update it or create files in its folder |
| `locked` | Locked by another process | Locked by another process |
| `failed` | Any other error, logged as a warning | Any other error, logged as a warning |

| Case | Answer |
|---|---|
| A malformed body, an id or path given twice, a path with `..` or not ending in `.xmp`, content not base64 or over 1 MiB, more than 1,000 items | `400`, empty body, nothing read or written |
| No logged-in user | `401` |

## Acceptance criteria

### XMP-002.1 – Lookup answers the bytes of each sidecar

- **Given** listed sidecars
- **When** the client looks up their file ids
- **Then** each answers `read` with its bytes in base64, its ETag, size and mtime, in the order
  sent

### XMP-002.2 – Lookup reports what it cannot read

- **Given** a vanished or foreign id, an image, a sidecar over 1 MiB, an unreadable, a locked and a
  broken sidecar
- **When** the client looks them up
- **Then** they answer `notFound`, `notFound`, `tooLarge`, `notPermitted`, `locked` and `failed`
  without bytes, the broken one is logged, and the others still answer `read`

### XMP-002.3 – An existing sidecar is saved through a part file

- **Given** an existing sidecar with the ETag and size the client sends
- **When** the client saves new bytes to it
- **Then** the bytes go to `<name>.part` in its folder, the part file is renamed onto the sidecar,
  and the answer is `saved` with the new ETag, size and mtime

### XMP-002.4 – A new sidecar is created beside its image

- **Given** an image `/Photos/IMG_0001.NEF` without `/Photos/IMG_0001.NEF.xmp`
- **When** the client saves bytes to the path `/Photos/IMG_0001.NEF.xmp`
- **Then** the sidecar is created through a part file and the answer is `saved` with its new file
  id

### XMP-002.5 – A sidecar changed since it was read is not overwritten

- **Given** an existing sidecar with another ETag or size than the client sends, or a new path
  that exists, before the part file is written or before it is renamed
- **When** the client saves it
- **Then** it answers `changed`, the sidecar keeps its bytes and no part file is left

### XMP-002.6 – Save reports what it cannot write

- **Given** a vanished existing sidecar, an id of an image, a new path whose image is missing, a
  sidecar the user may not update, a folder that does not allow creating files, a lock and a
  storage error while writing or renaming
- **When** the client saves them with a valid sidecar
- **Then** they answer `notFound`, `notFound`, `notFound`, `notPermitted`, `notPermitted`,
  `locked` and `failed`, no part file is left, the storage error is logged, and the valid sidecar
  is `saved`

### XMP-002.7 – A malformed request touches nothing

- **Given** a body that is not a list, an id or path given twice, a path with `..` or not ending
  in `.xmp`, content that is not base64 or over 1 MiB, or more than 1,000 items
- **When** the client sends it to either endpoint
- **Then** the answer is `400` with an empty body and no file is read or written

### XMP-002.8 – Logged in, with the CSRF token

- **Given** no logged-in user
- **When** a client calls either endpoint
- **Then** it answers `401`; both routes are open to every user and keep the CSRF check

### XMP-002.9 – The save keeps the file id against a real Nextcloud

- **Given** a sidecar uploaded to a real Nextcloud
- **When** the client saves new bytes to it and looks it up
- **Then** the lookup answers the new bytes under the same file id

## Out of scope

- When the client reads and writes sidecars, and asking first in a shared folder:
  [XMP-003](XMP-003-sidecars-in-the-cull.md).
- Which folders are shared: LISTING-001.12.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written with the endpoints (ADR 0017) |
