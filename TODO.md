<!-- markdownlint-disable MD013 -- one line per item, as the /todo skill writes them -->

# Open work

One line per item. A finished item is deleted in the pull request that finishes it; Git keeps
the history. `## Milestones` is ordered — take the first open item that is not in progress and
has no open `needs-owner` issue. Details and open questions: [`docs/dev/plan.md`](docs/dev/plan.md).
Add items with `/todo`.

## Milestones

- [ ] Sidecar saving fails on Nextcloud 35.0.3: a `.part` file made with `Folder::newFile()` has no cache entry and permissions 0, so `SidecarWriter` cannot move it into place (`notPermitted`, e2e `sidecars.spec.ts` XMP-002.9). Pick a temporary name 35.0.3 caches, revise ADR 0017, then raise `NEWEST_NEXTCLOUD_IMAGE` in `scripts/nextcloud-images.sh` to 35.0.3 (2026-11-15)
- [ ] Stored series (#185, ADR 0027, SERIES-005): SERIES-005.17 badges with pin and check and the compare's "edited by hand" subtitle, SERIES-005.18 the "Also in other folders" subtitle (2026-11-15)
- [ ] Sidecar is the source of truth (M8, ADR 0032, #187), in this order: the cull reads through the cache (XMP-006.7, split from PR 6); PR 9 drop the legacy tables a release after PR 6 (2026-11-15)

## Later

- [ ] The notice of stored decisions comes back after a migration: until the cull reads through the XMP cache (XMP-006.7), each decision and each sidecar take-over (`cull.ts` `takeOver` saving rows) stores legacy rows again, so the inventory counts photos whose sidecars already hold the same values; count only rows that differ from the XMP cache, or hide the notice until XMP-006.7 (2026-11-17)
- [ ] Opening the series compare logs "Unhandled error in the honeycomb UI: `fallbackFocus` was specified but was not a node" from the dialog's focus trap, from the toolbar, the `n` key and a grid series badge alike; find the cause and add an e2e check for no console error (2026-11-17)
- [ ] Redraw `docs/dev/mockup/index.html` and `docs/dev/plan.md` item 2 (app bar) for the flag filter chips that replaced the scope control (GRID-002; owner sign-off on the look) (2026-11-11)
- [ ] Measure the image budgets of `docs/dev/plan.md` Image delivery with real 24 MP RAW+JPEG pairs (IMAGES-001.12), incl. the loupe's 4096 px tier and the six image loads in flight (GRID-001.15) — needs the owner's files (2026-11-10)
- [ ] Add a `main` ruleset (pull requests only, CI required), with a bypass for `nextcloud-bot` if issue #17 says so, and the `RELEASE_PLEASE_TOKEN` secret — owner (2026-11-09)
- [ ] Publish to the Nextcloud App Store: request the certificate, register the app and add the secrets `APP_SIGNING_KEY`, `APP_SIGNING_CERT` and `APPSTORE_TOKEN` ([`docs/user/admin/releasing.md`](docs/user/admin/releasing.md)) — owner (2026-11-09)
- [ ] Trash bin: Nextcloud's `Trashbin::move2trash` names a trashed file `<name>.d<seconds>` and, for a second file of the same name trashed in the same second from another folder, unlinks the first one's trash copy and adds a second `files_trash` row; restoring then picks the first row's location. A bulk delete of two `IMG_0001.jpg` from different folders of a folder set can lose the first photo — guard it (e.g. one second apart per name, or an upstream fix) with a test (2026-11-16)
- [ ] Cut the share lookups of the subfolder listing (4 of its 5 queries per folder, `SharedFolders::isShared`, `docs/dev/plan.md` Multiple folders item 9), e.g. once per mount instead of per folder (2026-11-14)
- [ ] Cut the per-item lookups of the bulk saves: `UserPhotos::photos` looks each file id up on its own (3 queries per item, 60,000 decisions took 180,000 queries and 19.5 s, `docs/dev/plan.md` Multiple folders item 9) (2026-11-17)
- [ ] Fix the flaky e2e `loupe.spec.ts` "puts Pick and Reject at the side edges …": failed once in a full `scripts/verify.sh` run (portrait Pick at y 745, photo bottom 813), likely measured before the layout settled after the viewport change (2026-11-14)
