# Apps and commands

What honeycomb needs from the server and what an admin can run. Installation: the
[README](../../../README.md#installation).

**Changing in the next release** ([ADR 0040](../../dev/adr/0040-flags-per-picture-in-the-database.md)).
The Versions app is no longer needed for writing sidecars. A new command `occ honeycomb:cleanup`
removes the flags of files that no longer exist or lie in a trash bin and prints how many.

## Nextcloud apps

honeycomb declares no app dependency and runs on Nextcloud 35 with PHP 8.3 or newer. Two of
Nextcloud's own apps switch features on:

| App | Needed for | Without it |
|---|---|---|
| Versions (`files_versions`) | Undoing a sidecar write from the file's versions | Sidecars are written all the same; an earlier state cannot be restored from the Files app. |
| Deleted files (`files_trashbin`) | Deleting, *Remove RAWs* and a move that replaces a file | Nothing is deleted or replaced: *The Nextcloud trash bin is off, so nothing was deleted.* |

Versions count per folder: external storage never keeps versions, but honeycomb writes its
sidecars there too. The trash bin size (`trashbin_size`) decides which files are too large
for the trash bin; such a file is deleted for good only after the user confirms a warning, else its
photo stays whole. Each file deleted for good leaves a warning in the Nextcloud log, *A file was
deleted permanently*, with its file id and the user, never its path. Recommended apps for RAW
previews and faster first visits: the [README](../../../README.md#installation).

## occ commands

honeycomb has one command:

| Command | Does |
|---|---|
| `occ honeycomb:cache:clear [<user>]` | Clears what honeycomb read from sidecars and photos, for one user or every user ([cache](../cache.md)) |

Database migrations run with Nextcloud's own `occ app:update` or `occ upgrade`
([updating](updating.md)).

## Background job

A daily background job removes honeycomb's rows of files that were deleted for good. Deleting a
user removes all of their honeycomb data at once. Nextcloud's background jobs must run (cron is
recommended).
