# DELETE-001 – Trash endpoint

- Status: implemented
- Area: delete
- Origin: `docs/plan.md` M4.1, ADR 0013, CLAUDE.md rule 2
- Depends on: LISTING-001

## Purpose

Moves whole pictures — every member and sidecar — into the user's Nextcloud trash bin, and reports
the result of each file, so a partial failure leaves a state the user can trace.

## Behaviour

`POST /apps/honeycomb/api/v1/trash` takes `{"pictures": [[{"fileId": 7, "etag": "…"}, …], …]}`:
a list of pictures, each the list of its files with the ETag from the listing, at most 60,000
files. The server does not pair; it checks each file and trashes through `OCP\Files`.

For each picture:

1. Every file is checked before any is trashed: it must exist in the user's files, be a file whose
   mime type is `image/*` or whose name ends in `.xmp`, carry the given ETag and be deletable.
2. The files are then trashed in order, sidecars (`.xmp`) after the members.
3. The first failure stops the picture; its remaining files are `skipped`. Files already trashed
   stay in the trash bin. One picture's failure does not stop the others.

The answer is `200` with `{"pictures": [[{"fileId": 7, "result": "trashed"}, …], …]}` in the order
sent. `result` is one of:

| Result | Meaning |
|---|---|
| `trashed` | Moved into the trash bin |
| `notFound` | Vanished, foreign, a folder or not a type the listing lists |
| `changed` | Another ETag than the listing's |
| `notPermitted` | The user may not delete it |
| `locked` | Locked by another process |
| `failed` | Any other error, logged as a warning |
| `skipped` | Not tried, because another file of the picture failed |

## Acceptance criteria

### DELETE-001.1 – Whole pictures, sidecars last

- **Given** pictures whose files all pass their check
- **When** the client posts them
- **Then** every file is trashed, each picture's sidecars after its members, and the answer lists
  `trashed` for each file in the order sent

### DELETE-001.2 – A failed check leaves the picture untouched

- **Given** a picture with a file that vanished, is a folder, is not a listed type, has another
  ETag or may not be deleted
- **When** the client posts it with another, valid picture
- **Then** no file of that picture is touched, the failing file reports `notFound`, `changed` or
  `notPermitted`, its other files `skipped`, and the other picture is trashed

### DELETE-001.3 – A failed trash stops the picture and keeps its sidecars

- **Given** a picture whose member cannot be trashed (no permission, a lock, vanished meanwhile, a
  storage error)
- **When** the client posts it with another picture
- **Then** the files before it stay trashed, it reports `notPermitted`, `locked`, `notFound` or
  `failed`, the remaining files — the sidecars among them — report `skipped`, and the other
  picture is trashed

### DELETE-001.4 – Storage errors are logged

- **Given** a file whose trashing throws an unexpected error
- **When** the client posts its picture
- **Then** the file reports `failed` and a warning with the file id and the exception is logged

### DELETE-001.5 – No trash bin, no delete

- **Given** the trash bin app is disabled for the user
- **When** the client posts pictures
- **Then** the answer is `409` and nothing is touched

### DELETE-001.6 – Malformed requests touch nothing

- **Given** a body that is no list, a picture that is no list or empty, a file that is no object,
  a file id that is no positive integer, a missing or empty ETag, a file id given twice, or more
  files than the limit
- **When** the client posts it
- **Then** the answer is `400` and nothing is touched; a request of exactly the limit is accepted

### DELETE-001.7 – Logged-in users only, with the CSRF check

- **Given** the route
- **When** it is called without a user
- **Then** the answer is `401` and nothing is trashed; the route is open to every user and keeps
  Nextcloud's CSRF check

### DELETE-001.8 – Decisions survive the trash bin

- **Given** a picture with a decision
- **When** its files are trashed and later restored from the trash bin
- **Then** the restored files keep their file ids and so their decision

## Out of scope

Choosing what to delete, the summary and the report: DELETE-002. Removing only RAWs: DELETE-003.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged M4.1 (#51) |
| 2026-11-10 | DELETE-001.8 proven by an e2e test |
