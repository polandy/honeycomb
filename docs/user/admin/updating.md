# Updating honeycomb

For Nextcloud admins. Installation: the [README](../../../README.md#installation).

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

## Supported Nextcloud versions

Each release names the Nextcloud versions it runs on in `appinfo/info.xml`, today Nextcloud 35
only. Its tests run on the first release of that range and a recent one, and an update from the
first honeycomb release with saved decisions, tags and settings. When Nextcloud updates to a major
the installed honeycomb does not list, Nextcloud disables honeycomb; the saved data stays in its
tables and is used again once a honeycomb release for that major is installed.

## Downgrade not supported

Going back to an older honeycomb release is not supported. Updates mostly add tables and
columns; the update that added `honeycomb_quality` also dropped every stored visual hash, which
the next cull computes again. The older code does not know what a newer release wrote, and
Nextcloud does not undo a migration. To go back, restore the database and the
`custom_apps/honeycomb` folder from the backup taken before the update.

## Installed from a Git checkout

Tag storage (pull request #119) added the tables `honeycomb_file_tags` and
`honeycomb_tag_list`, visual hash storage added `honeycomb_hashes` and stored series added
`honeycomb_series` and `honeycomb_series_files`, and sharpness storage added `honeycomb_quality`,
without raising the app version, so an
instance installed from a Git checkout before them never created them, and the commands above
do not either. Without `honeycomb_hashes` or `honeycomb_quality` no folder opens. The `migrations:`
commands exist only in debug mode, so turn it on for this one run:

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
page once without the cache (`Ctrl+Shift+R`, on the iPad clear the website data).

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
