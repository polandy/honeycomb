# MOVE-002 – Move endpoints

- Status: implemented
- Area: move
- Origin: `docs/dev/plan.md` Moving pictures, M7.2, ADR 0018
- Depends on: LISTING-001, DELETE-001

## Purpose

Tells the client which names its target folders already hold, and moves whole pictures — every
member and sidecar — to the paths the client rendered, each picture all or nothing, and reports
the result of each file.

## Behaviour

**Probe.** `POST /apps/honeycomb/api/v1/move/targets` takes `{"folders": ["/Sorted/2026", …],
"sources": ["/Trip", …]}`, paths from the user's files with a leading `/`, at most 60,000 each;
`sources` is optional. The answer is `200` with `{"folders": [{"path": "/Sorted/2026", "storage":
"/", "children": [{"name": "a.RAF", "fileId": 9, "etag": "…"}, …]}, …], "sources": [{"path":
"/Trip", "storage": "/"}, …]}` in the order sent: every child file and folder. A folder that does
not exist yet, is a file or may not be read has no children. `storage` is where the storage of the
deepest folder on the path that exists and may be read is mounted, as a path of the user's files:
`/` for the user's own storage, else the folder of the share, group folder or external storage.

**Move.** `POST /apps/honeycomb/api/v1/move` takes `{"pictures": [[{"fileId": 7, "etag": "…",
"path": "/Sorted/2026/a.RAF", "replace": {"fileId": 9, "etag": "…"}}, …], …]}`: a list of
pictures, each the list of its files with the ETag from the listing and its new path; `replace` is
optional and may carry `"permanent": true` once the user confirmed replacing its file for good
(ADR 0048). At most 500 files, so one request ends well inside a proxy or PHP timeout (ADR 0029).
For each picture:

1. Every file is checked before any moves. The source must exist in the user's files, be a file the
   listing lists, carry the given ETag and be deletable. The target path must be free, hold the
   source itself, or hold the file `replace` names with its ETag, deletable. The deepest existing
   folder on the target path must be a folder the user may create in, on the source's storage, as
   must the file `replace` names, and the trash bin must keep that file (ADR 0036): its storage
   has a trash bin and it is smaller than the trash bin size. A `replace` marked `permanent` passes
   this last check (ADR 0048).
2. The files then move in order, sidecars (`.xmp`) after the members. Missing folders are created;
   a replaced file goes to the trash bin just before its file takes its place, or, marked
   `permanent` and not kept by the trash bin, is deleted for good, logged without its path.
3. If a move fails, the picture's files already moved go back to their old paths, last first, and
   its remaining files are `skipped`. One picture's failure does not stop the others.
4. A file that gets a new file id anyway takes its flag row (DECISIONS-001) and every other row of
   the file along to the new id, every user's, also when it moves back: in a shared folder the file
   id is the same for all its users. The rows move in one transaction: when one cannot be carried
   over, none is, the failure is logged as an error and the file stays where it moved.

The answer is `200` with `{"pictures": [[{"fileId": 7, "result": "moved", "replaced": false, "path":
"/Sorted/2026/a.RAF", "newFileId": 7, "etag": "…"}, …], …]}` in the order sent; `path`,
`newFileId` and `etag` come with `moved` only, `replaced` with every file. `result` is one of:

| Result | Meaning |
|---|---|
| `moved` | At its new path, possibly under a new file id; its decision follows it |
| `notFound` | Vanished, foreign, a folder or not a type the listing lists |
| `changed` | Another ETag than the listing's |
| `notPermitted` | The user may not move it or create in the target folder |
| `locked` | Locked by another process |
| `exists` | The target path is taken, and not by the file `replace` names with its ETag |
| `failed` | Any other storage error (`OCP\Files`), logged as a warning |
| `skipped` | Not tried, because another file of the picture failed |
| `movedBack` | Moved, then moved back because another file of the picture failed |
| `otherStorage` | The target is on another storage than the file, see MOVE-002.11 |
| `noTrashBin` | The file `replace` names lies on a storage without a trash bin and is not marked `permanent`, see MOVE-002.5 |
| `tooLarge` | The file `replace` names is at least as large as the trash bin size and is not marked `permanent`, see MOVE-002.5 |

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
  `replaced: true`; a `replace` whose file has another ETag or id is reported `exists`; a
  `replace` whose file the trash bin would not keep, on a storage without one or at least as large
  as the owner's or the server's trash bin size, and not marked `permanent`, is reported
  `noTrashBin` or `tooLarge`, the picture's other files are `skipped`, and nothing is deleted

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
  file of the request; more than 500 files; or a probe whose `folders` or `sources` is not a list
  of such paths or holds more than 60,000
- **When** the client posts it
- **Then** the answer is `400` with `{"error": "request"}` and nothing is touched

### MOVE-002.9 – Logged-in users only, with the CSRF check

- **Given** a request without a logged-in user, or the routes' attributes
- **When** it reaches either endpoint
- **Then** the answer is `401`, and both routes are `POST`, need no admin and keep the CSRF check

### MOVE-002.10 – Rows follow a new file id

- **Given** a file with a flag row that gets a new file id when it moves, or when it moves back
- **When** the client posts it
- **Then** the row is stored under the new file id and none is left under the old, whoever set
  it; every user's other rows of the file follow it, series members and XMP cache rows too; when
  one row cannot be carried over, every row stays under the old file id, the failure is logged as
  an error and the file is still reported `moved`

### MOVE-002.11 – A move stays on its storage

- **Given** a picture in an incoming share, a group folder or external storage whose target lies
  outside it, a picture whose target lies in one (also in a folder still to be created there), or
  a `replace` that names a file mounted from another storage
- **When** the client posts it with a picture that moves within its share
- **Then** the files of the first are reported `otherStorage` and stay, nothing goes to the trash
  bin, and the other picture moves

### MOVE-002.12 – The probe names each folder's storage

- **Given** target folders in and below a share, one in the user's own storage, and source folders
  in both
- **When** the client probes them
- **Then** each target and source folder is answered with its `storage`, the share's folder or
  `/`, in the order sent; a malformed `sources` list is a `400`

### MOVE-002.13 – A replace marked permanent deletes for good

- **Given** a file whose `replace` is marked `permanent` and names a file the trash bin would not
  keep, on a storage without one or at least as large as the trash bin size, and another whose
  marked `replace` the trash bin would keep
- **When** the client posts them
- **Then** the first replaced file is deleted for good, the second goes to the trash bin, both
  files move and report `replaced: true`, and each delete for good is logged as a warning with the
  file id and without its path; a `permanent` that is not a boolean is a `400`

## Out of scope

The name template is MOVE-001; the move plan, conflict choices, report and undo are MOVE-003; the
move dialog and move summary are M7.3. Rows of resume positions (DECISIONS-002) are not carried
over.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written and implemented with M7.2 (ADR 0018). |
| 2026-11-10 | Decision rows follow a new file id (MOVE-002.10). |
| 2026-11-15 | At most 500 files per move request instead of 60,000 (ADR 0029). |
| 2026-11-15 | A move stays on its storage (MOVE-002.11); the probe names storages (MOVE-002.12). |
| 2026-11-19 | M8 PR 5: the flag row follows a new file id, whoever set it (MOVE-002.10, ADR 0040). |
| 2026-11-21 | A replace whose file the trash bin would not keep is refused (MOVE-002.5, ADR 0036). |
| 2026-11-21 | A replace marked `permanent` deletes such a file for good (MOVE-002.13, ADR 0048). |
| 2026-11-24 | Every user's rows follow a new file id, all in one transaction (MOVE-002.10, #187). |
