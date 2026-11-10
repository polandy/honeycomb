# 0018 – The move endpoints: target folders probed, pictures moved whole or moved back

- Status: accepted
- Date: 2026-11-10

## Context

A move takes whole pictures — every member and every sidecar — into a target folder, each renamed
by the name template ([`plan.md`](../plan.md#moving-pictures), MOVE-001). Pictures and names exist
only on the client (ADR 0006): it pairs the listing and renders each file's new path. Before
anything moves, the move summary shows every new path and its conflicts, so the client must know
which names the target folders already hold — any file, not only those the listing lists, since a
`.CR3` of an unknown type still blocks its name. `OCP\Files` has no transaction across files, but
unlike a trash, a move can be undone through public API: `Node::move()` back. On the same storage
`Node::move()` is a rename and keeps the file id; across storages it is copy and delete with a new
file id. Restoring a file from the trash bin is not public API (ADR 0013).

## Decision

- **Probe:** `POST /apps/honeycomb/api/v1/move/targets` with `{"folders": ["/Sorted/2026", …]}`,
  at most 60,000 folders. The answer is `{"folders": [{"path": "/Sorted/2026", "children":
  [{"name": "a.RAF", "fileId": 9, "etag": "…"}, …]}, …]}` in the order sent, every child file and
  folder. A folder that does not exist yet, is a file or may not be read has no children.
- **Move:** `POST /apps/honeycomb/api/v1/move` with `{"pictures": [[{"fileId": 7, "etag": "…",
  "path": "/Sorted/2026/a.RAF", "replace": {"fileId": 9, "etag": "…"}}, …], …]}`: each file with
  the ETag from the listing and its new path; `replace` (optional) names the file at that path that
  goes to the trash bin. Paths are from the user's files with a leading `/`, as in ADR 0011.
  Conflicts are resolved by the client: it sends a suffixed path, leaves a skipped picture out, or
  sends `replace`.
- **The server checks, it does not name.** A source must be a listed file (ADR 0013) with its ETag
  and deletable. A target must not exist, except as the file itself (nothing to do) or as the file
  `replace` names, with its ETag and deletable. Its deepest existing folder must be a folder the
  user may create in. The server keeps the new name as sent: renaming is the user's right in
  Nextcloud anyway, and the user's folder and its permissions are the boundary.
- **Atomic means: checked whole, moved in order, moved back on a failure.**
  1. Every file of a picture is checked before any moves; if one fails, no file of it is touched.
  2. Then the files move one by one, members before sidecars; missing folders are created, a
     replaced file goes to the trash bin just before its file takes its place.
  3. If a move fails, the picture's files already moved are moved back, last first, and its
     remaining files are not tried. A file that cannot be moved back stays moved and is reported
     there. One picture's failure does not stop the others.
- **Response:** `200` with `{"pictures": [[{"fileId": 7, "result": "moved", "replaced": false,
  "path": "/Sorted/2026/a.RAF", "newFileId": 7, "etag": "…"}, …], …]}` in the order sent;
  `path`, `newFileId` and `etag` come with `moved` only. `result` is `moved`, `notFound`,
  `changed`, `notPermitted`, `locked`, `exists` (the target is taken), `failed` (logged), `skipped`
  (not tried) or `movedBack` (moved, then moved back after another file of the picture failed).
  `replaced` is true when a file went to the trash bin for this file, even if the picture moved
  back.
- **Undo is a move back:** the client sends the moved files, by their new id and ETag, to their old
  paths through the same endpoint. Replaced files stay in the trash bin, restorable there; folders
  the move created stay.
- **Errors:** `400` for a malformed body, an empty picture, a path that is not absolute or holds an
  empty, `.` or `..` segment, a backslash or a NUL, a file id or target path given twice
  (case-insensitively), a `replace` that names a file of the request, or more than 60,000 files or
  folders; nothing is touched. `409` when a file is to be replaced and the trash bin app is off for
  the user, since replacing would delete for good; nothing is touched. `401` without a user.

## Consequences

- A partial failure leaves the picture where it was, or reports the one file that could not go
  back; nothing is lost but a replaced file, which waits in the trash bin.
- The probe is a snapshot: a name taken between probe and move answers `exists`, and the client
  lists again.
- A move across storages gives the files new ids; their decision rows stay with the old ids until
  a follow-up carries them over (`TODO.md`). The move summary warns about it (M7.3).
- A new result or field is added, never renamed or removed, without a new version in the path.
