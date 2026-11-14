# 0024 – Visual hashes stored on the server

- Status: accepted
- Date: 2026-11-14
- Supersedes: [0021](0021-series-by-capture-time-and-visual-hash.md)

## Context

ADR 0021 decided that a series links shots that are close in time and look alike, by a visual hash
of each grid preview, and kept the hashes in browser storage only. Every device and every cleared
browser hashed a folder again, and a large folder set loads the small preview of every hashable
picture just to hash it. The owner decided on 2026-11-14: the browser keeps computing the hashes,
the server stores them per user and file, and a folder delivers its stored hashes with the
listing, so the browser computes only the missing ones.

The options for delivering the stored hashes:

- **A lookup endpoint,** as for tags (ADR 0022): one more request per folder set, and the browser
  compares etags.
- **A field of each listing entry:** no extra request; the server already holds the file's etag
  and drops a stale hash before it leaves.

## Decision

- **Hash, link rule and span** stay as ADR 0021 decided them: a 64-bit dHash of the small grid
  preview (`src/logic/visual-hash.ts`, drawn in `src/visual-hashes.ts`); two neighbouring shots of
  one camera link when both have a hash, they lie at most 30 s apart and the hashes differ in at
  most 10 of 64 bits, else when they lie at most 3 s apart; a series ends 60 s after its first
  shot. Only pictures with a shot of the same camera within 30 s are hashed, one at a time in the
  background; while the series compare is open new hashes are held back.
- **Table** `honeycomb_hashes`: `user_id`, `file_id` (unique together as
  `honeycomb_hashes_user_file`), `etag` (the file's etag when the hash was taken) and `hash` (16
  lower-case hex digits), all not null. The etag alone marks the version: it changes whenever the
  file's content does, so the mtime adds nothing. A save deletes the user's rows of its file ids,
  sorted, and inserts the new ones in one transaction, repeated on a unique key conflict.
- **Delivery:** each listing entry carries `visualHash`, the stored hash when its etag equals the
  file's current etag, else `null` (one query per 1,000 entries, beside the metadata).
- **Save:** `PUT /apps/honeycomb/api/v1/visual-hashes` with `{"hashes": [{"fileId": 9, "etag":
  "…", "hash": "…"}, ...]}`, at most 1,000 items, answers `{"saved": [9, ...]}`. A malformed item
  (no positive file id, an etag that is not a non-empty string of at most 40 characters, a hash
  that is not 16 lower-case hex digits) or a file id twice rejects the request with `400`, nothing
  written. An item whose file id the user cannot reach as a photo (unknown, another user's, a
  folder, a sidecar), or whose etag is no longer the file's, is skipped and missing from `saved`;
  the rest is saved. Unlike decisions (ADR 0012), each file id is looked up: a hash is only true of
  the version it was taken from.
- **Browser:** hashes the entries without one and saves them in batches of 100 and once a drain
  ends. A failed save is logged; the hashes still count for this visit. Browser storage is no
  longer used; the old key `honeycomb.visualHashes` is removed once.
- **Lifecycle:** the daily job removes rows of files deleted for good (`RemoveVanishedDecisions`);
  deleting a user removes their rows; a move that gives a file a new id carries its row over, like
  decisions and tags. The carried etag still has to match the file's for the hash to be delivered.

## Consequences

- A folder set hashed once is hashed on no other device or browser until its files change.
- A save looks up every file id, one query each; batches of 100 keep a request short.
- A hash taken just before a file changed is skipped, and the next listing asks for it again.
- The listing answer grows by up to 30 characters per entry.
