# Release notes

For Nextcloud admins: what to do when updating to a release. The full list of changes is in
`CHANGELOG.md`.

## 0.2.0

An instance installed before 0.2.0 cannot update and has to install honeycomb again, which
empties its tables: run `occ config:app:set honeycomb reinstall --value=yes`, then update, as
[updating](updating.md#installed-before-020-install-again) describes.
