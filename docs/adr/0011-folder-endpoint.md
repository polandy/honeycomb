# 0011 – The folder endpoint for the folder picker

- Status: accepted
- Date: 2026-11-10

## Context

The folder picker ([`plan.md`](../plan.md#multiple-folders)) browses the user's folders, one
level at a time, with a checkbox per folder and an arrow into folders that have subfolders. The
listing endpoint (ADR 0009) returns files, not folders. The client could browse through WebDAV,
but that needs a WebDAV client library (a new dependency) and an XML parser in the browser, and
`@nextcloud/dialogs`' file picker cannot tick several folders across levels or show the count of
the ticked folders.

## Decision

- **Shape:** `GET /apps/honeycomb/api/v1/folders?path=<folder>`, logged in, with the usual CSRF
  token. `path` is relative to the user's files, as in ADR 0009; an empty `path` is the root.
- **Response:** `{"folders": [...]}`, one item per direct child folder: `name`, `path` (from the
  user's files, with a leading `/`) and `hasSubfolders`. Hidden folders (a name starting with
  `.`) are included, so the picker can show them as skipped; the client sorts.
- **Query:** `Folder::getDirectoryListing()` of the folder and of each child folder through
  `OCP\Files`, so shared folders and other mounts appear like in the Files app.
- **Errors:** as ADR 0009: `404` for a path with `..`, a vanished folder, a file or a folder
  outside the user's files; `403` when the user may not read the folder; `401` without a user.
  The body is empty.
- **Counts:** the endpoint counts nothing. The picker lists the ticked folders through the
  listing endpoint and pairs them in TypeScript, so the count it shows is the one the grid will
  show, and the listing is reused when the cull opens.

## Consequences

- One request per folder level the user opens, plus one listing per ticked folder.
- `hasSubfolders` reads one directory listing per child folder; a folder with thousands of child
  folders answers slower, which the picker shows as loading.
- A new field is added, never renamed or removed, without a new version in the path.
