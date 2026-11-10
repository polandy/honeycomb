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
  Entries come in file id order; the client sorts.
- **What is listed:** files whose mime type is `image/*` or whose name ends in `.xmp`, below no
  hidden folder or hidden name (a segment starting with `.`) beneath the picked folder. Folders
  outside the user's files, such as the trash bin and the preview folders, never match.
- **Query:** without `subfolders` the folder's own listing; with it a file-cache search below the
  folder (`Folder::search`, every mount inside included) by mime type and name, paged by file id
  in pages of 5,000 by offset (Nextcloud's search takes only `eq` and `in` on `fileid`).
  honeycomb implements `ISearchQuery` and its operators in `lib/Search/`.
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
