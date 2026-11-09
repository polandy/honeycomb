<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/logo-horizontal-dark.svg">
    <img src="assets/brand/logo-horizontal-light.svg" alt="honeycomb" width="360">
  </picture>
</p>

# honeycomb

Cull RAW+JPEG photo pairs in Nextcloud, touch-first for the iPad.

honeycomb is a Nextcloud app for sorting out photos the way digiKam does it, in the browser and
by touch. A photo shot as RAW+JPEG is two files with the same base name; honeycomb treats them as
one picture: look at it once, rate, label, pick or reject it once, and delete both files (and
their XMP sidecars) together into the Nextcloud trash bin. Filters, star ratings, colour labels,
pick/reject flags, fast image loading and bulk actions on a multi-selection make large shoots
quick to go through on an iPad.

**Status:** planning. Nothing is installable yet. The interactive mockup in
[`docs/mockup/index.html`](docs/mockup/index.html) shows how the app is meant to work; the plan,
milestones and open questions are in [`docs/plan.md`](docs/plan.md). How ratings, flags and
colour labels appear in digiKam, darktable and Lightroom:
[`docs/user/ratings-flags-colours.md`](docs/user/ratings-flags-colours.md).

## Installation

Nothing is released yet; this is how honeycomb will be installed. It needs a Nextcloud version
from [`docs/plan.md`](docs/plan.md#target-versions) (Q1). The apps `camerarawpreviews` (RAW
previews) and Preview Generator (pre-generated previews) are recommended.

**From the App Store.** As an admin, open *Apps*, search for honeycomb and click *Download and
enable*, or run `occ app:install honeycomb`. Updates arrive the same way.

**Manually.** Download the release tarball `honeycomb-<version>.tar.gz` from the [GitHub
releases](https://github.com/polandy/honeycomb/releases), unpack it into the server's
`custom_apps/` folder (or another app folder listed in `apps_paths` in `config.php`), make it
owned by the web server user and enable it:

```sh
tar -xzf honeycomb-<version>.tar.gz -C /var/www/nextcloud/custom_apps/
chown -R www-data:www-data /var/www/nextcloud/custom_apps/honeycomb
sudo -u www-data php /var/www/nextcloud/occ app:enable honeycomb
```

A Git checkout needs a build first (`composer install --no-dev`, `npm ci`, `npm run build`).

**Signing.** Release tarballs carry `appinfo/signature.json`, made with the app's App Store
certificate (`occ integrity:sign-app`). Nextcloud's code integrity check verifies it and warns
in *Administration settings → Overview* when a file was changed, added or removed; do not edit
an installed release. A Git checkout has no signature and is not checked.

## Sister project

[Framehive](https://github.com/polandy/framehive) is a desktop photo library written in Rust by
the same owner. honeycomb reuses its RAW+JPEG pairing rules, RAW extension list and XMP sidecar
handling as a reference — concepts and test cases, not code — and shares its brand: Honey
`#F4A51C`, Ink `#17150F`, Paper `#FBF8F1`.

## Development

The project is developed by AI agents under the rules in [`CLAUDE.md`](CLAUDE.md); the workflow is
[`docs/02-workflow.md`](docs/02-workflow.md). `scripts/verify.sh` runs the same checks as CI.

## Licence

honeycomb is free software under the [GNU Affero General Public License v3.0 or
later](LICENSE) (`AGPL-3.0-or-later`). The project follows the [REUSE](https://reuse.software)
specification; every file states its licence.
