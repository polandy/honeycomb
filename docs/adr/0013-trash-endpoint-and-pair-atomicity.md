# 0013 – The trash endpoint: pictures checked whole, then trashed file by file

- Status: accepted
- Date: 2026-11-10

## Context

Deleting acts on a whole picture — every member and every sidecar — and moves its files to the
Nextcloud trash bin (CLAUDE.md rule 2, [`plan.md`](../plan.md#culling-workflow) item 3). Pictures
exist only on the client, which pairs the flat listing (ADR 0006, ADR 0009). A picture is two to
four files, and `OCP\Files` has no transaction across files: each `Node::delete()` is its own move
into the trash bin, and restoring from the trash bin is not public API (`OCA\Files_Trashbin`).
With the trash bin app disabled, `Node::delete()` deletes for good. A picture can fail half way:
a file vanished or changed since the listing, a share without delete permission, a lock held by a
sync client, a storage error.

## Decision

- **Shape:** `POST /apps/honeycomb/api/v1/trash`, logged in, with the usual CSRF token, and
  `{"pictures": [[{"fileId": 7, "etag": "…"}, …], …]}`: a list of pictures, each the list of its
  files with the ETag from the listing. At most 60,000 files (the listing's limit, ADR 0009).
- **The server checks, it does not pair.** Each file is looked up by id in the user's files and
  must be a file whose mime type is `image/*` or whose name ends in `.xmp` (what the listing
  lists), with the given ETag (unchanged since the listing) and deletable by the user.
- **Atomic means: checked whole, trashed in order, stopped at the first failure.**
  1. Every file of a picture is checked before any is trashed. If one fails its check, no file of
     that picture is touched.
  2. Then the files are trashed one by one, sidecars (`.xmp`) after the members, so a picture
     that fails half way keeps its sidecars beside the member that is left.
  3. If trashing a file fails, the picture's remaining files are not tried. Files already trashed
     stay in the trash bin, restorable there; there is no rollback, because restoring is not
     public API.
  4. One picture's failure does not stop the others.
- **Response:** `200` with `{"pictures": [[{"fileId": 7, "result": "trashed"}, …], …]}`, the
  pictures and files in the order sent. `result` is `trashed`, `notFound` (vanished, foreign or not
  a listed type), `changed` (another ETag), `notPermitted`, `locked`, `failed` (any other error,
  logged) or `skipped` (not tried, because another file of the picture failed). The client counts
  pictures, files and bytes from it and words the delete report.
- **No trash bin, no delete:** when the trash bin app is disabled for the user the request is
  refused with `409` and nothing is touched.
- **Errors:** `400` for a malformed body, an empty picture, a file id given twice or more than the
  limit; nothing is touched. `401` without a user. The body is empty.
- **Decisions stay.** The decision rows of trashed files are kept (ADR 0012); a file restored from
  the trash bin keeps its file id and so its decision.

## Consequences

- A partial failure leaves a traceable state: every file is reported, every trashed file is in the
  trash bin, and the picture's other files are where they were, with their sidecars.
- The client resends nothing on its own; after a report it lists again.
- Nextcloud's trash bin may still delete for good when the trash bin is over its quota; that is
  the server's retention setting, not this endpoint's.
- *Remove RAWs* (M4.3) and replacing on a move (M7.2) reuse the checks and the per-file results.
- A new result or field is added, never renamed or removed, without a new version in the path.
