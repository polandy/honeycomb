# 0025 – Missing visual hashes by path cursor

- Status: accepted
- Date: 2026-11-14
- Extends: [0024](0024-visual-hashes-stored-on-the-server.md)

## Context

The owner decided on 2026-11-14 that a strong computer should compute the visual hashes of a
whole folder tree at once, on a page of its own, so a later cull on any device finds them stored.
The browser needs the user's photos below a folder that have no hash of their current etag, page
by page, without the server reading the whole tree for each page.

The options for paging:

- **Nextcloud's file search** with a `fileid >` cursor: one query across the tree, but the search
  API allows only equality on the file id, and a hand-written query joining `filecache` breaks on
  sharded file caches.
- **An offset into a full walk:** every page walks the tree from the start.
- **A path cursor:** the tree is walked in name order, and a page ends with the path of the last
  photo it looked at; the next page skips every folder before that path without listing it.

## Decision

- **Endpoint:** `GET /apps/honeycomb/api/v1/visual-hashes/missing?path=/Photos&after=<cursor>`
  answers `{"pictures": [{"fileId", "etag", "mtime", "path"}], "next": <cursor> | null}`.
  `path` is a folder of the user, `after` a path relative to it (empty for the first page).
  `404`, `403` and `400` for a wrong folder, an unreadable one and a cursor that is no relative
  path; `401` without a user.
- **Walk:** `MissingVisualHashes` lists one folder at a time through `OCP\Files`, sorts each
  listing by name and walks depth first, so a page costs one listing per folder it enters and no
  database join. A page looks at 500 photos; `next` is the last one's path when the page is full,
  else `null`. A page may therefore hold fewer pictures, even none.
- **Own files only:** a folder whose mount type is not the home storage's (`''`), i.e. a share, a
  group folder or external storage, is skipped, as are hidden and unreadable folders.
- **Hash lookup:** one `VisualHashStore::find` per page on the unique index
  `honeycomb_hashes_user_file`; no new index or table.
- **Every photo is hashed,** a pair's RAW too: pairing is a browser setting the server does not
  know.
- **Browser:** a page `/apps/honeycomb/similarity` with its own Vite entry, so the cull's bundle
  does not grow. Its content security policy allows workers from `'self'`. The hashing runs in
  Web Workers, the cores less one, at least one, at most eight; each fetches the URL of the
  grid's small tier and draws it with the grid's drawing code (`src/hash-drawing.ts`) on an
  `OffscreenCanvas`. Hashes are saved with the endpoint of ADR 0024 in batches of 250.

## Consequences

- A stopped run resumes by starting again: the server lists only the photos still missing.
- A file renamed or added before the cursor while a run goes on is found by the next run.
- A failed photo is tried once per run; nothing about it is stored.
- The page needs `OffscreenCanvas` and `createImageBitmap` in workers, which every supported
  browser has.
