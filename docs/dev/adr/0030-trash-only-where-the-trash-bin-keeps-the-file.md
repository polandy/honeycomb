# 0030 – Trash only where the trash bin keeps the file

- Status: accepted, amended by [0036](0036-delete-for-good-after-an-explicit-warning.md)
- Date: 2026-11-15
- Extends: [0013](0013-trash-endpoint-and-pair-atomicity.md)

## Context

The trash endpoint refuses to delete when the trash bin app is off for the user (ADR 0013). That
check is app-wide. `files_trashbin` in Nextcloud 35 still deletes a file for good, with no error,
in two cases (`apps/files_trashbin/lib/Storage.php` `doDelete`, `lib/Trashbin.php` `move2trash`):

- the file's storage is not wrapped by the trash bin's storage wrapper;
- the file is at least as large as the trash bin size, `trashbin_size`: the owner's user setting
  if set, else the server's app setting; `-1`, the default, means the owner's free quota. Team
  folders have their own trash backend, which has no such size.

Local External Storage and Team folders (app `groupfolders`) trash normally, which the e2e tests
now prove. The trash bin's retention (`trashbin_retention_obligation`) and its clean-up when the
quota runs short expire trashed files later; that is no immediate loss and cannot be checked per
file.

The options:

- **Check after the delete** whether the file reached the trash bin: too late, it is gone.
- **Ask the trash manager** (`OCA\Files_Trashbin\Trash\ITrashManager`): not public API, and it
  answers only by moving the file.
- **Check the same rules before the delete:** the storage's wrapper by its class name, and the
  size against the same settings, read through `OCP` (`IUserConfig`, `IAppConfig`).

## Decision

- Before a picture is trashed, each file is checked against these rules in `TrashBinGuard`, next
  to the ETag and permission checks. A file that fails reports the new result `noTrashBin`; as
  with any failed check, no file of that picture is touched (DELETE-001.9).
- The storage classes of `files_trashbin` and Team folders are named as strings, because they
  are not part of `OCP`; a class that no longer exists makes the check refuse, never delete.
- The summaries' note no longer says nothing is deleted for good. It names the retention time
  and the clean-up when space runs short and advises a backup.
- The e2e image runs Team folders 23.0.1 from its GitHub release, pinned by SHA-256 and cached
  outside the checkout by `scripts/e2e-server.sh`, beside the bundled `files_external`. It is a
  test dependency only.

## Consequences

- A delete that would have been for good is refused and named in the delete report; the user can
  still delete the file in Files.
- The rules follow Nextcloud 35. A change in `files_trashbin` can open a new gap; the e2e tests
  catch the Team folder and External Storage paths, the size rule and the refusal.
- The time between the check and the delete stays open, as for the ETag (ADR 0013).
