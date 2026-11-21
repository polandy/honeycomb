# Apps and commands

What honeycomb needs from the server and what an admin can run. Installation:
[installing](installing.md).

**Changing in the next release** ([ADR 0040](../../dev/adr/0040-flags-per-picture-in-the-database.md)).
The Versions app is no longer needed for writing sidecars.

## Nextcloud apps

honeycomb declares no app dependency and runs on Nextcloud 35 with PHP 8.3 or newer. Two of
Nextcloud's own apps switch features on:

| App | Needed for | Without it |
|---|---|---|
| Versions (`files_versions`) | Undoing a sidecar write from the file's versions | Sidecars are written all the same; an earlier state cannot be restored from the Files app. |
| Deleted files (`files_trashbin`) | Deleting, *Remove RAWs* and a move that replaces a file | Nothing is deleted or replaced: *The Nextcloud trash bin is off, so nothing was deleted.* |

The PHP extension `sysvsem` locks a file's preview renders (IMAGES-001.18). Without it honeycomb
renders without the lock, as Nextcloud itself does, and renders that run at the same time can
leave broken tiles.

Versions count per folder: external storage never keeps versions, but honeycomb writes its
sidecars there too. The trash bin size (`trashbin_size`) decides which files are too large
for the trash bin; such a file is deleted for good only after the user confirms a warning, else its
photo stays whole. Each file deleted for good leaves a warning in the Nextcloud log, *A file was
deleted permanently* (or *A file was replaced permanently*, when a move replaced it), with its file
id and the user, never its path. Recommended apps for RAW
previews and faster first visits: [installing](installing.md#recommended-apps).

## occ commands

honeycomb has three commands:

| Command | Does |
|---|---|
| `occ honeycomb:cache:clear [<user>]` | Clears what honeycomb read from sidecars and photos, for one user or every user ([cache](../cache.md)) |
| `occ honeycomb:jobs` | Shows, for each background job (sweep, warm-up), its status, the time of its last run and its last error; changes nothing |
| `occ honeycomb:cleanup` | Removes the picks and rejects of files that no longer exist or lie in a trash bin, for every user, and prints how many rows went |
| `occ honeycomb:cleanup --all [--dry-run]` | Deletes every honeycomb row of every user and their honeycomb settings; with `--dry-run` only prints the row counts ([removing](removing.md#deleting-the-data-on-purpose)) |

Database migrations run with Nextcloud's own `occ app:update` or `occ upgrade`
([updating](updating.md)).

## Background job

`occ honeycomb:jobs` shows whether the jobs ran and the class of their last error;
the Nextcloud log has the details.

A daily background job removes honeycomb's rows of files that were deleted for good. Deleting a
user removes all of their honeycomb data at once. Nextcloud's background jobs must run (cron is
recommended). The picks and rejects of files in a trash bin stay until an admin runs
`occ honeycomb:cleanup` or *Clean up orphaned data* in honeycomb's settings. A file in a group
folder's trash bin keeps its row until it is deleted for good.
