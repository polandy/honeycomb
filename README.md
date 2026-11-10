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

**Status:** pre-release. The grid, the loupe, deciding, deleting and the settings work; nothing
is released yet, so see [Installation](#installation) for how it will be installed. XMP sidecars
are read and written in a later milestone ([`docs/plan.md`](docs/plan.md)).

## Features

- **One picture, two files.** A RAW and a JPEG with the same name, ignoring case, are one picture.
  Pictures without a partner are marked as singles and can be hidden.
- **Folders.** Open one or several folders, with or without their subfolders. RAWs and JPEGs may
  sit in the same folder or in separate subfolders.
- **Grid.** Thumbnails of 2,000+ pictures without stalls, sorted by name or capture time, with a
  progress bar and filters for stars, colour labels, flags and singles.
- **Loupe.** Full-screen view for one picture: swipe or tap the photo's edges to page, pinch to
  zoom, 100 % view, and a view without chrome.
- **Deciding.** Stars, colour labels, Pick and Reject by large buttons, by swipe gestures or by
  [keys](docs/user/keyboard-shortcuts.md), with undo and redo. Decisions are stored on the server
  per user, so a cull stops on one device and goes on at the same place on another.
- **Selection.** Select many pictures in the grid and rate, label or flag them in one step.
- **Deleting.** Review the rejects once more, rescue single pictures, then move every file of the
  rejected pictures (JPEG, RAW and sidecars) into the Nextcloud trash bin after a summary.
  Anything deleted can be restored from there; a partial failure is reported per file.
- **Remove RAWs.** Free the space of the RAWs you do not keep and leave the JPEGs and decisions.
- **Settings.** Per user: file types, folder layout, singles, gestures, flag buttons, vi keys and
  auto-advance ([settings](docs/user/settings.md)).

How ratings, flags and colour labels appear in digiKam, darktable and Lightroom:
[`docs/user/ratings-flags-colours.md`](docs/user/ratings-flags-colours.md). The words the app uses
(Pick, Reject, Unflag, series and more) are in the [glossary](docs/04-glossary.md). The interactive
mockup in [`docs/mockup/index.html`](docs/mockup/index.html) shows the intended design; plan,
milestones and open questions are in [`docs/plan.md`](docs/plan.md).

## Screenshots

Placeholders until the first release; the images will live in the
[`polandy/honeycomb-assets`](https://github.com/polandy/honeycomb-assets) repository.

| Screenshot | Shows |
|---|---|
| *Grid (placeholder)* | The folder set as thumbnails with filters, progress and sort |
| *Loupe (placeholder)* | One picture full screen with Pick, Reject and the rating on an iPad |
| *Delete (placeholder)* | The summary of the rejected pictures before they go to the trash bin |

## Installation

Nothing is released yet; this is how honeycomb will be installed. It needs Nextcloud 35 and PHP
8.3 or newer ([`docs/plan.md`](docs/plan.md#target-versions)).

**Recommended apps.** Both are optional, and honeycomb works without them.

- [`camerarawpreviews`](https://apps.nextcloud.com/apps/camerarawpreviews) shows the embedded
  preview of RAW files, so a picture that has no JPEG still has an image.
- [Preview Generator](https://apps.nextcloud.com/apps/previewgenerator) renders previews ahead of
  time with a cron job, so the first pass through a big folder is fast.

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
