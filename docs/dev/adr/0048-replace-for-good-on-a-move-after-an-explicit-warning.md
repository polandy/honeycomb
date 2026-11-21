# 0048 – Replace for good on a move after an explicit warning

- Status: accepted
- Date: 2026-11-21
- Amends: [0036](0036-delete-for-good-after-an-explicit-warning.md), [0018](0018-move-endpoint-and-pair-atomicity.md)

## Context

*Replace* on a move sends the old file to the trash bin. Since #340 the server refuses a replace
whose file the trash bin would not keep (`noTrashBin`, `tooLarge`), and the user has to move again
with *Add suffix* or *Skip*. ADR 0036 kept its exception, delete for good after a warning, to the
trash dialog. The owner decided on 2026-11-21 (issue #187, F2) that a move follows ADR 0036 too:
the warning names the files before the move, and only after the user confirms does each such
replace carry a flag that replaces the old file for good. Without the confirmation the photo
stays where it is.

## Decision

- The `replace` of a move file may carry `"permanent": true`. The server checks the file as
  before (id, ETag, permission, storage). If the trash bin would keep it, it goes to the trash bin
  as usual; otherwise it is deleted for good just before its file takes its place, the delete is
  logged without the path, and the file reports `moved` with `replaced: true`. A replace without
  the flag is refused with `noTrashBin` or `tooLarge` as before, and nothing of its picture moves.
- The client learns of such a file from that refusal, as the trash dialog does (ADR 0036): it
  shows the *permanent replace warning*, which lists the old files with their reason, focuses
  *Cancel* and has a separate destructive *Replace permanently*. Confirming sends the refused
  pictures again, the flag only on the replaces the warning named, so their ETags are checked
  again. Cancelling leaves them, and the move report lists them.
- The trash bin being off for the user still refuses every replace with `409` (MOVE-002.7).
- *Undo* of the move cannot bring a file replaced for good back; the warning says so.

## Consequences

- A move deletes for good only a file the user saw named in the warning and confirmed; a new
  refusal in the second request asks no second time.
- The wire form gains one optional field; a client that never sends it sees the old behaviour.
- The checks stay in `MoveService::check()`, one more branch; dropping the exception again means
  dropping the field and the warning.
