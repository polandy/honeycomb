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
milestones and open questions are in [`docs/plan.md`](docs/plan.md).

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
