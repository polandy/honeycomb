# 0029 – Move and trash requests in chunks

- Status: accepted
- Date: 2026-11-15
- Extends: [0013](0013-trash-endpoint-and-pair-atomicity.md), [0018](0018-move-endpoint-and-pair-atomicity.md)

## Context

The trash endpoint (ADR 0013) and the move endpoint (ADR 0018) took up to 60,000 files a request,
the listing's limit. Across storages a move copies and deletes; trashing thousands of RAWs on
external storage takes minutes. A proxy or PHP timeout then ends the request: the client says it
failed while the server goes on, or PHP is killed in the middle of a picture, after its JPEG moved
and before its RAW did. The rollback of ADR 0018 runs only on an exception, not on a kill, so the
pair is split and the decision rows of the moved file are not carried over.

The options:

- **Keep one request, add a job queue on the server:** the work survives the request, but it needs
  a new table, a background job and polling; a large change for a rare case.
- **A move journal in the database to clean up after a kill:** also a new table, and it only
  repairs after the fact.
- **Chunks from the client:** many small requests, each well inside any timeout, so a kill hits at
  most the picture in flight of one small request. No new table, the API shape stays.

## Decision

- **Server limit:** both endpoints refuse more than 500 files a request with `400`. The probe of
  move targets keeps the listing's limit; it only reads.
- **Client chunks:** a move, its undo, a delete, *Remove RAWs* and a retry send at most 50
  pictures and 500 files a request, whole pictures only: a picture never spans two requests. A
  single picture of more than 500 files is sent alone and refused.
- **One after another:** the next request is sent when the last is answered. The dialog shows how
  many of the photos were sent.
- **A later request fails:** sending stops. What earlier requests did is kept and shown; the files
  not sent count as `failed` in the report, so *Retry failed files* and the move's *Undo* work as
  for any failed file. When the first request fails, nothing changed, as before.

## Consequences

- A timeout or kill can split at most the one picture in flight; the request around it is small.
- A large move or delete needs more round trips; 50 pictures a request keeps that to a few dozen
  for a big folder.
- A picture whose files the server never answered after a timeout may have moved anyway; the
  report says *failed*, a retry finds the file changed or gone, and reloading the folder shows it.

## Amendment 2026-11-16: small first requests

A delete of rejects on the owner's test server waited long with nothing moving: the footer read
*0 of 40 photos sent* through the fresh check and the single request of up to 50 pictures.
Measured on the e2e container (Nextcloud 35, SQLite, no Redis), `File::delete()` into the trash
bin costs 25–40 ms a file, more in deeper folders: about 100 queries of Nextcloud's own (file
locks, cache moves, size and ETag propagation to every parent, shares, activity, versions,
previews); finding the file costs 0.3 ms and honeycomb's request about 120 ms. Batching the
parents' propagation (`IPropagator::beginBatch`) saved 6 % and needs one batch per storage; one
database transaction around the loop saved two thirds but would hold file locks and roll back cache
rows of files already moved, so neither is taken.

- The first request carries at most 5 pictures, each next one twice as many, up to 50: the count
  moves within about a second, and a big delete adds only a few requests.
- The confirm button is held and names the step: *Checking the photos…* while the waiting sidecars
  are written and the photos checked afresh, then *Moving to trash…*; the count starts from the
  photos that passed the check.

## Amendment 2026-11-21: client timeouts

A request the server never answers left the move or delete dialog, the picker count or the
opening of a folder set busy for good (weakness analysis U7, owner decision E23). The client now
aborts a listing after 30 s and a move or trash request after 90 s and fails it like any failed
request; the failure message says the server did not answer and offers *Try again* for a listing,
*Reload folder* after a move or delete. A timed-out move or trash request is not sent again on its
own: the server may have finished it, so the user reloads and sees what changed.

Measured on the e2e container (Nextcloud 35, SQLite, no Redis), three runs each:

| Request | Time |
|---|---|
| Listing of 2,000 pictures (3,200 files) | 0.14–0.6 s |
| Listing of 20,000 pictures (40,000 files, 10 folders) | 0.48–0.49 s |
| Move or trash of 50 pairs (100 files) | 3.2–4.0 s |
| Move of 500 files (the request limit) in a folder of 4,000 | 18.6–26.6 s |
| Trash of 500 files in a folder of 4,000 | 21.5–21.9 s |

- A chunk gets 90 s, three times the slowest measured one; the owner's guide value of 60 s would
  leave less than that for a full 500-file request.
- A listing gets the owner's 30 s: far above three times the measured 0.5 s, which leaves room for
  a slower server and a phone network carrying the 12 MB answer of a capped listing.
- The probe of the move targets is a listing and gets 30 s too.

Measured again on 2026-11-21, on the same e2e container with its own empty photo files, three runs
each (the nc-test host was not reachable, so this is no nc-test figure):

| Request | Time | Half of its timeout |
|---|---|---|
| Listing of 20,000 pictures (40,000 files, 10 folders) | 0.49–0.58 s | 15 s |
| Listing of 2,000 pictures (4,000 files) | 0.14 s | 15 s |
| Move of 500 files (250 pairs) in a folder of 4,000 | 15.1–15.3 s | 45 s |
| Trash of 500 files (250 pairs) in a folder of 4,000 | 15.5–16.6 s | 45 s |

Every value lies below half of its timeout, so 30 s and 90 s stay. Re-measure on nc-test when it is
reachable; a value above half its timeout there would raise the timeout.
