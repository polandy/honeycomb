# Removing honeycomb

For Nextcloud admins. Checked on Nextcloud 35.0.2.

## What `occ app:remove` leaves behind

```sh
sudo -u www-data php /var/www/nextcloud/occ app:remove honeycomb
```

This disables honeycomb and deletes its app folder. honeycomb has no uninstall steps, so
everything it stored stays in the database:

| What | Where (default table prefix `oc_`) |
|---|---|
| Ratings, flags, colour labels, *Keep RAW* | table `oc_honeycomb_flags` |
| Resume positions | table `oc_honeycomb_positions` |
| Tags | table `oc_honeycomb_tag_list` |
| Daily statistics counters | table `oc_honeycomb_stats` |
| Immich decisions | table `oc_honeycomb_immich_assets` |
| Visual hashes of the pictures | table `oc_honeycomb_hashes` |
| Sharpness of the pictures in a series | table `oc_honeycomb_quality` |
| Stored series and kept-out photos | tables `oc_honeycomb_series`, `oc_honeycomb_series_files` |
| What honeycomb read from the XMP sidecars and JPEGs (the XMP cache) | table `oc_honeycomb_xmp_cache` |
| Folder summaries and the folders marked done | tables `oc_honeycomb_folder_summary`, `oc_honeycomb_folder_done` |
| Applied migrations | rows with `app = 'honeycomb'` in `oc_migrations` |
| App state (`enabled = no`, `installed_version`), the Immich `connections_file` path, the clean-up job's `vanished_after_*` and `empty_series_after` row ids and the background jobs' `job_*` run records | rows with `appid = 'honeycomb'` in `oc_appconfig` |
| Each user's settings and view state | rows with `appid = 'honeycomb'` in `oc_preferences` |
| Background jobs `RemoveVanishedDecisions` and `RenderPhotoTiers` (one per written photo, until it ran) | rows in `oc_jobs` |
| Locks that keep a file's previews from rendering twice at once | System V semaphores with keys `0x48594300` to `0x485943ff`, in the server's kernel |
| Previews of RAW files | the preview cache of Nextcloud's core, in the appdata folder `appdata_<instance id>/preview` |

Outside the server's database and kernel, these also stay:

- **The Immich connections file and the key files** it names. They are yours, not honeycomb's, and
  honeycomb never writes them. Delete them if you made them only for honeycomb.
- **Each browser's local storage**, on every device that opened honeycomb: the keys
  `honeycomb.infoWidth`, `honeycomb.loupeNavigationShown` and `honeycomb.immichConnection`. They
  hold a panel width, a hint flag and the last Immich connection; they do no harm and a user
  clears them with the browser's site data.

`occ honeycomb:cleanup --all` empties the data first ([below](#deleting-the-data-on-purpose)).

The next cron run logs the warning `failed to create instance of background job:
OCA\Honeycomb\BackgroundJob\<job name>` once for each job row and deletes the row itself.
The pictures and the XMP sidecars honeycomb wrote are ordinary files in the users' folders and
are not touched. `occ app:remove --keep-data honeycomb` leaves the same data and also keeps
`enabled = yes`.

## What stays on purpose

- **The XMP sidecars** honeycomb wrote next to the pictures, with their versions. They are the
  users' ratings and flags in a format other programs read. Delete them like any file if wanted.
- **Moved files.** A move into another folder is not undone.
- **The trash bin.** Deleted pairs stay there until the users empty it or Nextcloud expires them.
- **The log lines** honeycomb wrote to `nextcloud.log`.

## RAW previews after removing

honeycomb registers its RAW preview provider with Nextcloud itself, not per user: while the app
is enabled, it serves the previews of RAW files (`image/x-dcraw`) for Files, Photos and every
other app of every user, not only inside honeycomb. This is deliberate. Disabling or removing
honeycomb unregisters the provider at once.

- Previews already in the preview cache stay and keep showing, until they are deleted.
- A RAW file whose preview was never rendered shows Nextcloud's generic file icon again in Files
  and Photos, as it did before honeycomb, unless
  [`camerarawpreviews`](https://apps.nextcloud.com/apps/camerarawpreviews) or another provider
  handles RAW.
- To delete the cached previews of RAW files too, delete their preview folders in the appdata
  folder; core renders them again from whatever provider is installed.

## Installing again

Installing honeycomb again finds the tables and the `oc_migrations` rows, skips the migrations
that already ran and shows every user's decisions, tags, visual hashes, series and settings as
they were.

## Deleting the data on purpose

honeycomb has no uninstall step and never deletes this data on its own. To empty it, run
`occ honeycomb:cleanup --all` while honeycomb is installed. Back up the database first: this
deletes the ratings, flags, tags, visual hashes, quality values, series, resume positions, XMP
cache, statistics and Immich decisions of every user, and each user's honeycomb settings. It
cannot be undone.

```sh
sudo -u www-data php /var/www/nextcloud/occ honeycomb:cleanup --all --dry-run
sudo -u www-data php /var/www/nextcloud/occ honeycomb:cleanup --all
```

`--dry-run` prints how many rows each table holds and deletes nothing; `--dry-run` needs
`--all`. The real run prints how many rows went from each table, in one transaction: if the
database fails, nothing is deleted and the command exits non-zero. The tables, the
`oc_migrations` rows and the app's state stay, so honeycomb keeps working, empty. Run it before
`occ app:remove honeycomb`; the pictures and sidecars in the users' folders are not touched.

## Deleting the data by hand

To remove everything, back up the database first, then, with honeycomb removed, drop the tables
and delete the rows listed above, for example on MySQL or MariaDB. The two tables
`oc_honeycomb_decisions` and `oc_honeycomb_file_tags` only exist on installs from before
[ADR 0040](../../dev/adr/0040-flags-per-picture-in-the-database.md); `IF EXISTS` skips them.

```sql
DROP TABLE IF EXISTS oc_honeycomb_flags, oc_honeycomb_decisions, oc_honeycomb_positions,
  oc_honeycomb_file_tags, oc_honeycomb_tag_list, oc_honeycomb_hashes, oc_honeycomb_series,
  oc_honeycomb_series_files, oc_honeycomb_xmp_cache, oc_honeycomb_quality, oc_honeycomb_stats,
  oc_honeycomb_immich_assets, oc_honeycomb_folder_summary, oc_honeycomb_folder_done;
DELETE FROM oc_migrations WHERE app = 'honeycomb';
DELETE FROM oc_appconfig WHERE appid = 'honeycomb';
DELETE FROM oc_preferences WHERE appid = 'honeycomb';
DELETE FROM oc_jobs WHERE class LIKE 'OCA\\Honeycomb\\%';
```

Drop the tables and the `oc_migrations` rows together: without the rows a new install creates
the tables again, without the tables it would skip creating them.

Free the semaphores by restarting the server, or one at a time with `ipcs -s`, which lists the
sets, and `ipcrm -S 0x48594300` for each key from `0x48594300` to `0x485943ff` that it shows.
