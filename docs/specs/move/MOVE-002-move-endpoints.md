# MOVE-002 – Move endpoints

- Status: implemented
- Area: move
- Origin: `docs/plan.md` Moving pictures, M7.2, ADR 0018
- Depends on: LISTING-001, DELETE-001

## Purpose

Tells the client which names its target folders already hold, and moves whole pictures — every
member and sidecar — to the paths the client rendered, each picture all or nothing, and reports
the result of each file.

## Behaviour

**Probe.** `POST /apps/honeycomb/api/v1/move/targets` takes `{"folders": ["/Sorted/2026", …]}`,
paths from the user's files with a leading `/`, at most 60,000. The answer is `200` with
`{"folders": [{"path": "/Sorted/2026", "children": [{"name": "a.RAF", "fileId": 9, "etag": "…"},
…]}, …]}` in the order sent: every child file and folder. A folder that does not exist yet, is a
file or may not be read has no children.

**Move.** `POST /apps/honeycomb/api/v1/move` takes `{"pictures": [[{"fileId": 7, "etag": "…",
"path": "/Sorted/2026/a.RAF", "replace": {"fileId": 9, "etag": "…"}}, …], …]}`: a list of
pictures, each the list of its files with the ETag from the listing and its new path; `replace` is
optional. At most 60,000 files. For each picture:

1. Every file is checked before any moves. The source must exist in the user's files, be a file the
   listing lists, carry the given ETag and be deletable. The target path must be free, hold the
   source itself, or hold the file `replace` names with its ETag, deletable. The deepest existing
   folder on the target path must be a folder the user may create in.
2. The files then move in order, sidecars (`.xmp`) after the members. Missing folders are created;
   a replaced file goes to the trash bin just before its file takes its place.
3. If a move fails, the picture's files already moved go back to their old paths, last first, and
   its remaining files are `skipped`. One picture's failure does not stop the others.

The answer is `200` with `{"pictures": [[{"fileId": 7, "result": "moved", "replaced": false, "path":
"/Sorted/2026/a.RAF", "newFileId": 7, "etag": "…"}, …], …]}` in the order sent; `path`,
`newFileId` and `etag` come with `moved` only, `replaced` with every file. `result` is one of:

| Result | Meaning |
|---|---|
| `moved` | At its new path, which may have a new file id across storages |
| `notFound` | Vanished, foreign, a folder or not a type the listing lists |
| `changed` | Another ETag than the listing's |
| `notPermitted` | The user may not move it or create in the target folder |
| `locked` | Locked by another process |
| `exists` | The target path is taken, and not by the file `replace` names with its ETag |
| `failed` | Any other error, logged as a warning |
| `skipped` | Not tried, because another file of the picture failed |
| `movedBack` | Moved, then moved back because another file of the picture failed |

## Acceptance criteria

### MOVE-002.1 – The probe lists every child of each target folder

- **Given** target folders that exist, one that does not, one that is a file and one the user may
  not read
- **When** the client posts them to the probe
- **Then** each existing folder lists every child file and folder with name, file id and ETag, the
  others list no children, in the order sent

### MOVE-002.2 – Whole pictures move, sidecars last, into created folders

- **Given** pictures whose files all pass their check, with target folders that do not exist yet
- **When** the client posts them
- **Then** the folders are created, every file moves to its path, each picture's sidecars after its
  members, and the answer lists `moved` with the new path, file id and ETag in the order sent

### MOVE-002.3 – A failed check leaves the picture untouched

- **Given** a picture with one file that vanished, is not listed, changed, may not be deleted, or
  whose target is taken, lies below a file or in a folder the user may not create in
- **When** the client posts it with another picture
- **Then** that file is reported as `notFound`, `changed`, `notPermitted` or `exists`, the
  picture's other files are `skipped` and stay, and the other picture moves

### MOVE-002.4 – A failed move moves the picture back

- **Given** a picture whose second file fails to move
- **When** the client posts it
- **Then** that file is reported as `notPermitted`, `locked`, `notFound`, `exists` or `failed`, the
  first file is moved back and reported `movedBack`, the rest are `skipped`; a file that cannot be
  moved back stays `moved` at its new path, and storage errors are logged

### MOVE-002.5 – Replace sends the target to the trash bin

- **Given** a file whose target holds the file its `replace` names, with that file's ETag
- **When** the client posts it
- **Then** that file goes to the trash bin, the file moves to its path and is reported with
  `replaced: true`; a `replace` whose file has another ETag or id is reported `exists`

### MOVE-002.6 – A file already at its path stays

- **Given** a file whose target path is its own path
- **When** the client posts it
- **Then** nothing moves and it is reported `moved` at that path

### MOVE-002.7 – No trash bin, no replace

- **Given** the trash bin app is disabled for the user
- **When** the client posts a request in which a file names a `replace`
- **Then** the answer is `409` and nothing is touched; a request without `replace` moves as usual

### MOVE-002.8 – Malformed requests touch nothing

- **Given** a body that is not a list of non-empty pictures of files with a positive file id, an
  ETag and a path; a path that is not absolute or holds an empty, `.` or `..` segment, a backslash
  or a NUL; a file id or a target path (case-insensitively) given twice; a `replace` that names a
  file of the request; more than 60,000 files; or a probe that is not a list of such paths or holds
  more than 60,000
- **When** the client posts it
- **Then** the answer is `400` with an empty body and nothing is touched

### MOVE-002.9 – Logged-in users only, with the CSRF check

- **Given** a request without a logged-in user, or the routes' attributes
- **When** it reaches either endpoint
- **Then** the answer is `401`, and both routes are `POST`, need no admin and keep the CSRF check

## Out of scope

The name template is MOVE-001; the move plan, conflict choices, report and undo are MOVE-003; the
move dialog and move summary are M7.3. Carrying decision rows over to new file ids after a move
across storages is a `TODO.md` item.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written and implemented with M7.2 (ADR 0018). |
