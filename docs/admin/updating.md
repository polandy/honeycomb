# Updating honeycomb

For Nextcloud admins. Installation: the [README](../../README.md#installation).

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

## Installed before tags (#119)

Tag storage (pull request #119) added the tables `honeycomb_file_tags` and
`honeycomb_tag_list` without raising the app version, so an instance installed from a Git
checkout before it never created them, and the commands above do not either. Run this once:

```sh
sudo -u www-data php /var/www/nextcloud/occ migrations:migrate honeycomb
```

It only creates what is missing and is safe to repeat. `occ migrations:status honeycomb` lists
the migrations and which of them have run.

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
