# Removing honeycomb

For Nextcloud admins. Checked on Nextcloud 35.0.2.

**Changing in the next release** ([ADR 0040](../../dev/adr/0040-flags-per-picture-in-the-database.md)).
The tables `oc_honeycomb_decisions` and `oc_honeycomb_file_tags` are dropped, and flags and *Keep
RAW* live in `oc_honeycomb_flags`. Each user's daily statistics counters live in `oc_honeycomb_stats`
([ADR 0039](../../dev/adr/0039-statistics-as-daily-counters.md)).

## What `occ app:remove` leaves behind

```sh
sudo -u www-data php /var/www/nextcloud/occ app:remove honeycomb
```

This disables honeycomb and deletes its app folder. honeycomb has no uninstall steps, so
everything it stored stays in the database:

| What | Where (default table prefix `oc_`) |
|---|---|
| Ratings, flags, colour labels, *Keep RAW* | table `oc_honeycomb_decisions` |
| Resume positions | table `oc_honeycomb_positions` |
| Tags | tables `oc_honeycomb_file_tags`, `oc_honeycomb_tag_list` |
| Visual hashes of the pictures | table `oc_honeycomb_hashes` |
| Sharpness of the pictures in a series | table `oc_honeycomb_quality` |
| Stored series and kept-out photos | tables `oc_honeycomb_series`, `oc_honeycomb_series_files` |
| What honeycomb read from the XMP sidecars and JPEGs (the XMP cache) | table `oc_honeycomb_xmp_cache` |
| Applied migrations | rows with `app = 'honeycomb'` in `oc_migrations` |
| App state (`enabled = no`, `installed_version`) and the clean-up job's `vanished_after_*` and `empty_series_after` row ids | rows with `appid = 'honeycomb'` in `oc_appconfig` |
| Each user's settings and view state | rows with `appid = 'honeycomb'` in `oc_preferences` |
| Background job `RemoveVanishedDecisions` | one row in `oc_jobs`, until the next cron run |

`occ honeycomb:cleanup --all` empties the data first ([below](#deleting-the-data-on-purpose)).

The next cron run logs the warning `failed to create instance of background job:
OCA\Honeycomb\BackgroundJob\RemoveVanishedDecisions` once and deletes the job row itself.
The pictures and the XMP sidecars honeycomb wrote are ordinary files in the users' folders and
are not touched. `occ app:remove --keep-data honeycomb` leaves the same data and also keeps
`enabled = yes`.

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

To drop the tables as well, back up the database first, then, with honeycomb removed, drop the
tables and delete the rows listed above, for example on MySQL or MariaDB:

```sql
DROP TABLE oc_honeycomb_decisions, oc_honeycomb_positions, oc_honeycomb_file_tags,
  oc_honeycomb_tag_list, oc_honeycomb_hashes, oc_honeycomb_series, oc_honeycomb_series_files,
  oc_honeycomb_xmp_cache, oc_honeycomb_quality;
DELETE FROM oc_migrations WHERE app = 'honeycomb';
DELETE FROM oc_appconfig WHERE appid = 'honeycomb';
DELETE FROM oc_preferences WHERE appid = 'honeycomb';
```

Drop the tables and the `oc_migrations` rows together: without the rows a new install creates
the tables again, without the tables it would skip creating them.
