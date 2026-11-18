# XMP-002 – Sidecar endpoints

- Status: implemented
- Area: xmp
- Origin: `docs/dev/plan.md` M5, `docs/dev/06-xmp-interop.md` Writing, ADR 0005, ADR 0017,
  Framehive CORE-009
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
saved by the checked save: the target is checked, then written at once, an existing sidecar in
place with `File::putContent()` and a new one with `Folder::newFile()`, so a sidecar keeps its
file id and the replaced bytes become a version; no file is written beside it. The answer is
`{"sidecars": [{"result": "saved", "fileId": 9, "etag": "…", "size": 830, "mtime": …}, …]}` in
the order sent.

An existing sidecar is overwritten only while its folder keeps versions (`versions` in
LISTING-001.15: `files_versions` enabled for the owner, a versions backend for the storage, not
external storage), so the version it replaces, possibly written by another program, can be
restored from the file's versions; a new sidecar has nothing to lose and is created either way.

| Result | Lookup | Save |
|---|---|---|
| `read` | The bytes, ETag, size and mtime | – |
| `saved` | – | Saved; the sidecar's file id, ETag, size and mtime |
| `notFound` | Vanished, foreign, a folder or not `.xmp` | An existing sidecar vanished or is not `.xmp`; a new one's image is missing |
| `changed` | – | Another ETag or size, or a new one that exists meanwhile |
| `noVersions` | – | An existing sidecar whose folder keeps no versions |
| `tooLarge` | Over 1 MiB | – |
| `notPermitted` | The user may not read it | The user may not update it; for a new one, create files in its folder |
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

### XMP-002.3 – An existing sidecar is saved in place

- **Given** an existing sidecar with the ETag and size the client sends, in a folder that allows
  updating files but not creating them
- **When** the client saves new bytes to it
- **Then** the bytes are written into the sidecar itself, no file is written beside it, and the
  answer is `saved` with the same file id and the new ETag, size and mtime

### XMP-002.4 – A new sidecar is created beside its image

- **Given** an image `/Photos/IMG_0001.NEF` without `/Photos/IMG_0001.NEF.xmp`
- **When** the client saves bytes to the path `/Photos/IMG_0001.NEF.xmp`
- **Then** the sidecar is created with the bytes, no other file is written, and the answer is
  `saved` with its new file id

### XMP-002.5 – A sidecar changed since it was read is not overwritten

- **Given** an existing sidecar with another ETag or size than the client sends, or a new path
  that exists, when the save checks it right before writing
- **When** the client saves it
- **Then** it answers `changed`, the sidecar keeps its bytes and nothing is written

### XMP-002.6 – Save reports what it cannot write

- **Given** a vanished existing sidecar, an id of an image, a new path whose image is missing, a
  sidecar the user may not update, a new sidecar in a folder that does not allow creating files,
  and a refusal, a lock, a vanished file and a storage error while writing
- **When** the client saves them with a valid sidecar
- **Then** they answer `notFound`, `notFound`, `notFound`, `notPermitted`, `notPermitted`,
  `notPermitted`, `locked`, `notFound` and `failed`, no other file is written, the storage error is
  logged, and the valid sidecar is `saved`

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

- **Given** a sidecar uploaded to a real Nextcloud, on the oldest and the newest Nextcloud e2e runs
  on
- **When** the client saves new bytes to it and looks it up
- **Then** the lookup answers the new bytes under the same file id, and the file's versions hold
  the old bytes

### XMP-002.10 – No existing sidecar is overwritten without file versions

- **Given** an existing sidecar whose folder keeps no versions (the Versions app disabled for its
  owner, no versions backend for its storage, or external storage) and a new sidecar path
- **When** the client saves both
- **Then** the existing one answers `noVersions` and keeps its bytes, nothing is written beside it,
  and the new one is `saved`; the client reports it as *File versions are off, so honeycomb does
  not overwrite an existing sidecar*

## Out of scope

- When the client reads and writes sidecars, and asking first in a shared folder:
  [XMP-003](XMP-003-sidecars-in-the-cull.md).
- Which folders are shared: LISTING-001.12.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written with the endpoints (ADR 0017) |
| 2026-11-15 | No overwrite without file versions (XMP-002.10) |
| 2026-11-15 | Versions checked per folder, by owner and storage (ADR 0032) |
| 2026-11-18 | Saved in place instead of through a part file, which Nextcloud 35.0.3 refuses to move (ADR 0017) |
