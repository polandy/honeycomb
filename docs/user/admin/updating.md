# Updating honeycomb

For Nextcloud admins. Installation: [installing](installing.md).

## Every release

honeycomb keeps its data in its own database tables. A release can add or change them, and
Nextcloud only runs the app's migrations when it updates the app. After every new release, run
one of these as the web server user:

```sh
# Update from the App Store and migrate honeycomb only
sudo -u www-data php /var/www/nextcloud/occ app:update honeycomb

# After unpacking a release tarball by hand: migrate every app whose version changed
sudo -u www-data php /var/www/nextcloud/occ upgrade
```

Clicking *Update* in *Apps* does the same as `occ app:update`. Until the update has run, the
new code may read tables that do not exist yet, and saving a flag, a rating or a tag fails.

## Installed before 0.2.0: install again

0.2.0 replaces the migrations of 0.1.0 and of every Git checkout before 2026-11-23 with one
migration that creates all tables at once. Such an instance cannot update: the migration stops
before it creates a table, names the honeycomb tables
that exist already and points to this section. Install honeycomb again instead. This deletes what
the tables hold: the flags and *Keep RAW*, the tag lists, series, resume positions, statistics,
folder summaries, done statuses and Immich decisions. The photos, the XMP sidecars with their
ratings, colour labels and tags, the users' honeycomb settings and the app config, such as the
Immich `connections_file` path, stay.

Back up the database, put the new release into `custom_apps/honeycomb`, then allow the reinstall
and update as usual, or run `occ upgrade` again after a failed one:

```sh
sudo -u www-data php /var/www/nextcloud/occ config:app:set honeycomb reinstall --value=yes
sudo -u www-data php /var/www/nextcloud/occ upgrade
```

Before the migrations, a repair step drops the honeycomb tables, also those of older releases,
and honeycomb's rows in `oc_migrations`, so the update creates the tables empty. It then deletes
the `reinstall` value; on 0.2.0 or later the value drops nothing. After a failed update Nextcloud
keeps the maintenance mode on; turn it off with `occ maintenance:mode --off`.

A test server that ran a Git checkout of the first form of the baseline, from 2026-11-23, keeps its
data: the update adds the columns and indexes the baseline gained before 0.2.0. A schema of any
other checkout cannot use the `reinstall` value, since it is already at 0.2.0. Drop everything
with `occ honeycomb:cleanup --all --drop` and install honeycomb fresh with
`occ app:enable honeycomb`.

## Supported Nextcloud versions

Each release names the Nextcloud versions it runs on in `appinfo/info.xml`, today Nextcloud 35
only. Its tests run on the first release of that range and a recent one. When Nextcloud updates to a
major the installed honeycomb does not list, Nextcloud disables honeycomb; the saved data stays in its
tables and is used again once a honeycomb release for that major is installed.

## Downgrade not supported

Going back to an older honeycomb release is not supported. Updates mostly add tables and
columns. The older code does not know what a newer release wrote, and
Nextcloud does not undo a migration. To go back, restore the database and the
`custom_apps/honeycomb` folder from the backup taken before the update.

## Installed from a Git checkout

A migration merged without raising the app version does not run on the commands above, since
Nextcloud only migrates an app whose version changed. After pulling such a change, run the
app's missing migrations; the `migrations:` commands exist only in debug mode, so turn it on
for this one run:

```sh
sudo -u www-data php /var/www/nextcloud/occ config:system:set debug --value=true --type=boolean
sudo -u www-data php /var/www/nextcloud/occ migrations:migrate honeycomb
sudo -u www-data php /var/www/nextcloud/occ config:system:set debug --value=false --type=boolean
```

It only creates what is missing and is safe to repeat. `occ migrations:status honeycomb`, also
in debug mode, lists the migrations and which of them have run.

A new build reaches the browser on the next page load even without a version change, since its
script names carry a hash of their content. Builds before 2026-11-16 had fixed names that
Nextcloud lets the browser cache for six months: after updating from one of them, reload the
page once without the cache (`Ctrl+Shift+R`, on a tablet clear the website data).

## File locking

Moving, renaming and trashing a picture takes Nextcloud's file locks, one per file. Without a
memory cache for locks they live in the database, which adds queries to every bulk action and
can make it wait on other users' locks. Configure Redis for file locking in `config.php`, as
the [Nextcloud admin manual](https://docs.nextcloud.com/server/latest/admin_manual/configuration_files/files_locking_transactional.html)
describes:

```php
'memcache.locking' => '\OC\Memcache\Redis',
'redis' => [
    'host' => '/run/redis/redis-server.sock',
    'port' => 0,
],
```

## Before changing the storage or rebuilding the file cache

Before you move the data directory, change the primary storage or rebuild the file cache, have
each user run *Write picks/rejects to XMP* in the ⋯ menu. honeycomb keeps picks and rejects in
its database, and its daily sweep deletes a row whose file has no entry in the file cache at
once, without a grace period; the XMP sidecars are then the only copy
([Sidecars](../sidecars.md)).
