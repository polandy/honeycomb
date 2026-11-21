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
- **Counts:** the picker's count of the ticked folders comes from the listing endpoint, paired
  in TypeScript, so it is the one the grid will show, and the listing is reused when the cull
  opens.
- **Excluded folders (amended 2026-11-17):** with *Include subfolders* on, a tap on an included
  folder excludes it (ADR 0035); the count then lists each ticked folder with `excluded[]` for
  the excluded folders below it. The photo-file counts of a row stay facts of the folder and do
  not drop excluded folders, so a row reads the same whatever is ticked.
- **Photo files (amended 2026-11-16):** each item also carries `photoFiles`, the count of the
  child's own photo files (the listing's photo types, no sidecars, no hidden files), or `null`
  for a hidden child or one that may not be listed. It comes from the same one listing per child
  as `hasSubfolders`, so the tree can show a count beside each folder without a request or a
  recursive walk per row. Files, not pictures: pairing stays in TypeScript (ADR 0006), and
  counting pictures would need every file name in the browser.
- **Photo files below (amended 2026-11-16):** each item also carries `photoFilesBelow`, the photo
  files in the child and in every folder below it, so a collapsed folder can count its subfolders
  (as digiKam). It is counted in Nextcloud's file cache, not by a walk: one `COUNT` per storage
  through `IDBConnection`, by storage and path prefix, image mimepart or an untyped RAW name, and
  no path with a hidden name. The child's storage and path come from its file cache row, so a
  share or group folder counts the subtree it exposes; each storage mounted below the child
  (`IMountManager::findIn`) adds its own subtree, unless it is hidden, not scanned yet or already
  counted. No cache of our own: measured with 100,000 photo files in one user's storage (NC 35),
  one count of the whole tree took 27 ms on PostgreSQL 17, 39 ms on MariaDB 11.4 and 29 ms on
  SQLite; a level of 10 to 20 child folders took up to 300 ms (PostgreSQL), 215 ms (MariaDB) and
  50 ms (SQLite). PostgreSQL has no path-prefix index in Nextcloud and filters the storage's rows
  through `fs_storage_mimepart`; MariaDB and SQLite use the storage indexes or a table scan.
- **Exactness of the count below (amended 2026-11-18, #244):** it is what Nextcloud's file cache
  knows, so each item also carries `photoFilesBelowApproximate`, true when the count may miss
  files: a subtree root with an unknown size (`size < 0` in `oc_filecache`: Nextcloud sets it on
  a folder when any child is not scanned), a storage mounted below that is not scanned yet, or a
  storage wrapped by a group folder's advanced permissions (`ACLStorageWrapper`, found with
  `IStorage::instanceOfStorage` by class name, so the app needs no dependency on Team folders; a
  hidden subfolder there can count). The tree shows "~" before the number and speaks "about". No
  extra query: the size comes from the row read to find the subtree, the storage from the mount
  already listed.
- **Pictures and orphaned sidecars (amended 2026-11-21, E9/U9):** the counts are pictures, not
  files: `photoFiles` is now `pictures`, `photoFilesBelow` is `picturesBelow` and
  `photoFilesBelowApproximate` is `picturesBelowApproximate`. A RAW and a rendered file of one
  base name count once. Each item also carries `orphanedSidecars` and `orphanedSidecarsBelow` (XMP-009
  rule). The file cache query reads `parent`, `name` and `mimepart` of the subtree's media and
  `.xmp` rows and tallies them per folder in PHP (`PictureTally`), so one query per storage
  stays. The rows now travel to PHP instead of a `COUNT`, so memory and time grow with the media
  files below a folder.
  The endpoint is not yet released, so the fields are renamed, not added.
- **The user's extensions (amended 2026-11-21, #187 M1):** the request may carry
  `rawExtensions[]` and `renderedExtensions[]`, the user's LISTING-002 lists; a list left out is
  the default, an invalid list (empty, `xmp`, not letters and digits, shared by both) answers 400.
  Only photos with an extension in either list count, as in the grid. The count stays in PHP:
  at 100,000 files below a folder (SQLite, `scripts/measure-scale.sh`) the tally takes 110–130 ms
  and 36 MB, the plain SQL `COUNT` of #244 14–16 ms but cannot pair, and a pairing `GROUP BY` on
  the lower-case base name 360–380 ms. Orphaned sidecars need the darktable duplicate pattern,
  which portable SQL cannot match.

## Consequences

- One request per folder level the user opens, plus one listing per ticked folder.
- `hasSubfolders`, `pictures` and `orphanedSidecars` read one unfiltered directory listing per
  child folder; a folder with thousands of child folders, or children with thousands of files,
  answers slower, which the picker shows as loading.
- `picturesBelow` adds one query per child and per storage mounted below it; on PostgreSQL
  each one reads the rows of the child's whole storage, so a level's cost grows with its child
  folders times the storage's files. A cache with invalidation is the next step if
  that gets slow.
- A new field is added, never renamed or removed, without a new version in the path (the
  2026-11-21 rename happened before the first release).
