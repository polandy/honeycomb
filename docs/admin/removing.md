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
| Ratings, flags, colour labels, *Keep RAW* | table `oc_honeycomb_decisions` |
| Resume positions | table `oc_honeycomb_positions` |
| Tags | tables `oc_honeycomb_file_tags`, `oc_honeycomb_tag_list` |
| Applied migrations | rows with `app = 'honeycomb'` in `oc_migrations` |
| App state (`enabled = no`, `installed_version`) | rows with `appid = 'honeycomb'` in `oc_appconfig` |
| Each user's settings and view state | rows with `appid = 'honeycomb'` in `oc_preferences` |
| Background job `RemoveVanishedDecisions` | one row in `oc_jobs`, until the next cron run |

The next cron run logs the warning `failed to create instance of background job:
OCA\Honeycomb\BackgroundJob\RemoveVanishedDecisions` once and deletes the job row itself.
The pictures and the XMP sidecars honeycomb wrote are ordinary files in the users' folders and
are not touched. `occ app:remove --keep-data honeycomb` leaves the same data and also keeps
`enabled = yes`.

## Installing again

Installing honeycomb again finds the tables and the `oc_migrations` rows, skips the migrations
that already ran and shows every user's decisions, tags and settings as they were.

## Deleting the data by hand

honeycomb never deletes this data itself. To remove it for good, back up the database first,
then, with honeycomb removed, drop the four tables and delete the rows listed above, for
example on MySQL or MariaDB:

```sql
DROP TABLE oc_honeycomb_decisions, oc_honeycomb_positions, oc_honeycomb_file_tags,
  oc_honeycomb_tag_list;
DELETE FROM oc_migrations WHERE app = 'honeycomb';
DELETE FROM oc_appconfig WHERE appid = 'honeycomb';
DELETE FROM oc_preferences WHERE appid = 'honeycomb';
```

Drop the tables and the `oc_migrations` rows together: without the rows a new install creates
the tables again, without the tables it would skip creating them.
