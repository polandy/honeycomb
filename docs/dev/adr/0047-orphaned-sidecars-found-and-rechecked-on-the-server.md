# 0047 – Orphaned sidecars found and rechecked on the server

- Status: accepted
- Date: 2026-11-21
- Leaves unchanged: [0006](0006-thin-php-backend-logic-in-typescript.md), [0013](0013-trash-endpoint-and-pair-atomicity.md),
  [0025](0025-missing-visual-hashes-by-path-cursor.md), [0037](0037-trash-files-of-one-name-in-different-seconds.md)

## Context

The owner asked on 2026-11-21 for a clean-up of orphaned sidecars: `.xmp` files whose photo is
gone from their folder. A scan lists them per folder or for the whole library without changing
anything; only after the user confirms do they move to the Nextcloud trash bin; a sidecar whose
photo shows up between the scan and the confirmation is skipped.

The listing (LISTING-001) knows photos and sidecars only, not videos, and lists one folder set
of at most 60,000 entries. The skip rule needs a check at the moment of the delete, which only the
server can make.

## Decision

- **The rule lives in PHP, once.** `OrphanedSidecarRule` decides from the names of a folder's
  files whether a sidecar belongs to a media file. The scan and the delete use it, so the rule
  that lists a sidecar is the rule that rechecks it. ADR 0006 keeps logic in TypeScript; this is a
  safety check on the path of a delete, the kind of check ADR 0006 leaves to PHP.
- **Two endpoints of their own**, not the trash endpoint of DELETE-001: a paged
  `GET /api/v1/sidecars/orphaned` that walks folder by folder from a path cursor, as the similarity
  page walks photos (ADR 0025), and `POST /api/v1/sidecars/orphaned/trash`, which rechecks each
  sidecar and reuses DELETE-001's results, trash bin guard and name spacing, plus one result
  `notOrphaned`. An orphaned sidecar is no picture, and the picture endpoint's checks (flags,
  members first) do not apply.
- **Own storage only**, as the similarity page: shares, group folders and external storage are
  not walked, so a clean-up never reaches into another user's files.
- **A page of its own**, *Orphaned sidecars*, beside *Similarity* and *Statistics*: it chooses a
  folder in the same folder tree or the whole library and needs no open cull.

## Consequences

- A media file in another folder does not keep a sidecar; the preview shows it before anything
  moves, and the trash bin restores it.
- The statistics do not count the moved sidecars.
- Changing the rule is one PHP class and its tests (XMP-009).
