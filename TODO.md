<!-- markdownlint-disable MD013 -- one line per item, as the /todo skill writes them -->

# Open work

One line per item. A finished item is deleted in the pull request that finishes it; Git keeps
the history. `## Milestones` is ordered — take the first open item that is not in progress and
has no open `needs-owner` issue. Details and open questions: [`docs/dev/plan.md`](docs/dev/plan.md).
Add items with `/todo`.

## Milestones

- [ ] *Move…* after a decision: sidecars honeycomb saved since the listing answer `changed` (listing ETags, as *Delete…* before DELETE-002.17) and sidecars it created stay behind; send them as `useSidecarSync().current` gives them, probing the created paths too (2026-11-15)
- [ ] Sidecar saving fails on Nextcloud 35.0.3: a `.part` file made with `Folder::newFile()` has no cache entry and permissions 0, so `SidecarWriter` cannot move it into place (`notPermitted`, e2e `sidecars.spec.ts` XMP-002.9). Pick a temporary name 35.0.3 caches, revise ADR 0017, then raise `NEWEST_NEXTCLOUD_IMAGE` in `scripts/nextcloud-images.sh` to 35.0.3 (2026-11-15)
- [ ] Stored series (#185, ADR 0027, SERIES-005): SERIES-005.17 badges with pin and check and the compare's "edited by hand" subtitle, SERIES-005.18 the "Also in other folders" subtitle (2026-11-15)
- [ ] Sidecar is the source of truth (M8, ADR 0032, #187), in this order: the cull reads through the cache (XMP-006.7, split from PR 6); PR 9 drop the legacy tables a release after PR 6 (2026-11-15)
- [ ] Folder tree, concept LISTING-003 (owner, E1–E4 A): M3 `folderSetKey` and the backend `FolderSet` drop a ticked path whose ancestor is ticked while *Include subfolders* is on, so one set has one *Recent* entry; then M2 with the switch on, the folders below a ticked one show a dashed tick and "included", still tappable (2026-11-16)

## Later

- [ ] Redraw `docs/dev/mockup/index.html` and `docs/dev/plan.md` item 2 (app bar) for the flag filter chips that replaced the scope control (GRID-002; owner sign-off on the look) (2026-11-11)
- [ ] Measure the image budgets of `docs/dev/plan.md` Image delivery with real 24 MP RAW+JPEG pairs (IMAGES-001.12), incl. the loupe's 4096 px tier and the six image loads in flight (GRID-001.15) — needs the owner's files (2026-11-10)
- [ ] Add a `main` ruleset (pull requests only, CI required), with a bypass for `nextcloud-bot` if issue #17 says so, and the `RELEASE_PLEASE_TOKEN` secret — owner (2026-11-09)
- [ ] Publish to the Nextcloud App Store: request the certificate, register the app and add the secrets `APP_SIGNING_KEY`, `APP_SIGNING_CERT` and `APPSTORE_TOKEN` ([`docs/user/admin/releasing.md`](docs/user/admin/releasing.md)) — owner (2026-11-09)
- [ ] Measure the cost of the subfolder listing (`ListingService::walkBelow`, one query per folder) and of bulk-action writes with a fixture tree of ~100k files in the e2e container and the query log (2026-11-14)
- [ ] Trash bin: Nextcloud's `Trashbin::move2trash` names a trashed file `<name>.d<seconds>` and, for a second file of the same name trashed in the same second from another folder, unlinks the first one's trash copy and adds a second `files_trash` row; restoring then picks the first row's location. A bulk delete of two `IMG_0001.jpg` from different folders of a folder set can lose the first photo — guard it (e.g. one second apart per name, or an upstream fix) with a test (2026-11-16)
