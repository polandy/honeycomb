# 0009 – The listing endpoint: flat entries by query parameters

- Status: accepted
- Date: 2026-11-10

## Context

The client lists a folder set before it pairs, filters and sorts in TypeScript (ADR 0006).
[`plan.md`](../plan.md) M1.2 sketched `GET /api/v1/folders/{path}/entries`. A path segment in
the URL needs its own route pattern for slashes, cannot name the root folder (an empty segment)
and must survive `#`, `?` and `%` in folder names. `OCP` has no public implementation of the
file-cache search classes, and the client cannot know in advance how many files a folder set
holds.

## Decision

- **Shape:** `GET /apps/honeycomb/api/v1/entries?path=<folder>&subfolders=1`, logged in, with
  the usual CSRF token. `path` is relative to the user's files; an empty `path` is the root.
- **Response:** `{"entries": [...], "truncated": false}`. An entry is `fileId`, `path` (from the
  user's files, with a leading `/`), `size`, `mtime`, `etag`, `mime`, and `captureTime`,
  `orientation`, `width`, `height`, `camera` (EXIF make and model) from Nextcloud's file
  metadata, each `null` where it has none.
  Entries come in listing order (amended 2026-11-14); the client sorts.
- **What is listed:** files whose mime type is `image/*` or whose name ends in `.xmp`, below no
  hidden folder or hidden name (a segment starting with `.`) beneath the picked folder. Folders
  outside the user's files, such as the trash bin and the preview folders, never match.
- **Query:** without `subfolders` the folder's own listing; with it a walk of the folders below
  (amended 2026-11-14, see the amendment).
- **Limit:** 60,000 entries, 20,000 pictures of a RAW, a JPEG and a sidecar each. Beyond it the
  response sets `truncated`; the client caps at 20,000 pictures after pairing.
- **Errors:** `404` for a path with `..`, a vanished folder, a file or a folder outside the user's
  files, so a foreign path reveals nothing; `403` when the user may not read the folder; `401`
  without a user. The body is empty; the client words the message.

## Consequences

- One request per picked folder; a folder set of several folders sends several.
- The EXIF basics come from the keys the Photos app writes (`photos-original_date_time`,
  `photos-size`, `photos-ifd0`). Without the Photos app, or before metadata is generated, they
  are `null` and the client sorts by `mtime` ([`plan.md`](../plan.md#sort-order)).
- A new field is added, never renamed or removed, without a new version in the path.

## Amendment 2026-11-14: a folder walk instead of a paged search

The subfolder listing was a file-cache search below the folder (`Folder::search`) by mime type
and name, paged by offset in pages of 5,000. Each page re-filtered the whole subtree, and keyset
paging (`fileid >` the last id) is not possible: Nextcloud 35's `SearchBuilder` takes only `eq`
and `in` on `fileid`. The listing now walks the folders below, depth first, with one
`getDirectoryListing()` per folder:

- each file-cache row is read once, and memory holds one folder's listing at a time;
- hidden folders and folders the user may not read are never opened;
- names match in PHP and ignore case on every database, so `IMG_1.XMP` is a sidecar on PostgreSQL;
- the walk stops at the entry limit, so a truncated answer holds whole folders in walk order.

It costs one query per folder instead of one per 5,000 entries, and reads the rows of files
that are not photos too. One unpaged search with a limit of 60,001 was rejected: it holds
60,001 nodes in memory at once. Entries come in walk order; the client sorts.
