# Apps and commands

What honeycomb needs from the server and what an admin can run. Installation: the
[README](../../../README.md#installation).

## Nextcloud apps

honeycomb declares no app dependency and runs on Nextcloud 35 with PHP 8.3 or newer. Two of
Nextcloud's own apps switch features on:

| App | Needed for | Without it |
|---|---|---|
| Versions (`files_versions`) | Writing decisions to XMP sidecars, so every write can be undone | *Write decisions to XMP sidecars* cannot be turned on, so users cannot rate; they see *On needs the Versions app … ask your administrator to enable it.* |
| Deleted files (`files_trashbin`) | Deleting, *Remove RAWs* and a move that replaces a file | Nothing is deleted or replaced: *The Nextcloud trash bin is off, so nothing was deleted.* |

Versions count per folder: external storage never keeps versions, so honeycomb does not replace
an existing sidecar there. The trash bin size (`trashbin_size`) decides which files are too large
for the trash bin; such a file is deleted for good only after the user confirms a warning, else its
photo stays whole. Recommended apps for RAW previews and faster first visits:
the [README](../../../README.md#installation).

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
