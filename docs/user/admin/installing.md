# Installing honeycomb

For Nextcloud admins. Nothing is released yet; this is how honeycomb will be installed. It needs
Nextcloud 35 and PHP 8.3 or newer ([target versions](../../dev/plan.md#target-versions)).

## Recommended apps

Both are optional, and honeycomb works without them.

- [`camerarawpreviews`](https://apps.nextcloud.com/apps/camerarawpreviews) shows the embedded
  preview of RAW files, so a picture that has no JPEG still has an image.
- [Preview Generator](https://apps.nextcloud.com/apps/previewgenerator) renders the previews of
  photos written before a user first opened honeycomb. Once a user has opened it, honeycomb
  renders their new photos with a background job of its own, so Nextcloud's background jobs
  should run by cron; it also warms the previews of an opened folder.

## From the App Store

As an admin, open *Apps*, search for honeycomb and click *Download and enable*, or run
`occ app:install honeycomb`.

## Manually

Download the release tarball `honeycomb-<version>.tar.gz` from the [GitHub
releases](https://github.com/polandy/honeycomb/releases), unpack it into the server's
`custom_apps/` folder (or another app folder listed in `apps_paths` in `config.php`), make it
owned by the web server user and enable it:

```sh
tar -xzf honeycomb-<version>.tar.gz -C /var/www/nextcloud/custom_apps/
chown -R www-data:www-data /var/www/nextcloud/custom_apps/honeycomb
sudo -u www-data php /var/www/nextcloud/occ app:enable honeycomb
```

A Git checkout needs a build first (`composer install --no-dev`, `npm ci`, `npm run build`).

## Updating

Every release needs `occ app:update honeycomb` (App Store) or `occ upgrade` (after unpacking a
tarball), so its database migrations run. An instance installed from a Git checkout before tag
storage (#119) also needs `occ migrations:migrate honeycomb` once, in debug mode. Use Redis for
file locking. Details: [updating](updating.md).

## Removing

`occ app:remove honeycomb` keeps honeycomb's tables and settings, so a new install shows the old
decisions and tags again. What stays and how to delete it: [removing](removing.md).

## Signing

Once the app's App Store certificate exists, release tarballs carry `appinfo/signature.json`,
made with it (`occ integrity:sign-app`); until then they are unsigned and on GitHub only
([releasing](../../dev/releasing.md)). Nextcloud's code integrity check verifies it and warns in
*Administration settings → Overview* when a file was changed, added or removed; do not edit an
installed release. A Git checkout has no signature and is not checked.
