# Clearing the cache

For Nextcloud admins; users clear their own cache in the
[settings](settings.md#cache).

honeycomb keeps, per user, what it read from the XMP sidecars and the JPEGs' embedded XMP (table
`oc_honeycomb_xmp_cache`), and for every user who reaches a photo its visual hash (table
`oc_honeycomb_hashes`) and its sharpness (table `oc_honeycomb_quality`). All are read or measured
again from the files when they are gone, so clearing them loses no decision, tag or sidecar; the
next visit of a folder is only slower. Clearing one user's cache leaves the visual hashes and
sharpness values, which other users share; clearing every user's cache removes them too.

```sh
# One user's cache
sudo -u www-data php /var/www/nextcloud/occ honeycomb:cache:clear alice
# Every user's cache
sudo -u www-data php /var/www/nextcloud/occ honeycomb:cache:clear
```

The command prints how many rows it removed, for example `Removed 3 cache rows of alice.` An
unknown user fails with `Unknown user: <user>` and removes nothing.
