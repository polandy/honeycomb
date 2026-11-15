<!-- markdownlint-disable MD013 -- one line per item, as the /todo skill writes them -->

# Open work

One line per item. A finished item is deleted in the pull request that finishes it; Git keeps
the history. `## Milestones` is ordered — take the first open item that is not in progress and
has no open `needs-owner` issue. Details and open questions: [`docs/plan.md`](docs/plan.md).
Add items with `/todo`.

## Milestones

- [ ] Sidecar saving fails on Nextcloud 35.0.3: a `.part` file made with `Folder::newFile()` has no cache entry and permissions 0, so `SidecarWriter` cannot move it into place (`notPermitted`, e2e `sidecars.spec.ts` XMP-002.9). Pick a temporary name 35.0.3 caches, revise ADR 0017, then raise `NEWEST_NEXTCLOUD_IMAGE` in `scripts/nextcloud-images.sh` to 35.0.3 (2026-11-15)
- [ ] Stored series (#185, ADR 0027, SERIES-005): PR 3 remove and dissolve, PR 4 grid *Series…* menu, PR 5 merge with the next or previous series, PR 6 *Series done* (#183) (2026-11-14)
- [ ] Sidecar is the source of truth (M8, ADR 0032, #187), in this order: PR 4 XMP cache API, `occ honeycomb:cache:clear`, versions per node, `permissions` and `versions` in the listing (XMP-006); PR 5 migration through *Write decisions to sidecars…*; PR 6 the cull reads through the cache, writability, confirmation, *Off*/*On*, *Clear cache*; PR 7 bundling per picture; PR 8 fresh check before deleting by decision; PR 9 drop the legacy tables a release after PR 6 (2026-11-15)

## Later

- [ ] Redraw `docs/mockup/index.html` and `docs/plan.md` item 2 (app bar) for the flag filter chips that replaced the scope control (GRID-002; owner sign-off on the look) (2026-11-11)
- [ ] Measure the image budgets of `docs/plan.md` Image delivery with real 24 MP RAW+JPEG pairs (IMAGES-001.12), incl. the loupe's 4096 px tier and the six image loads in flight (GRID-001.15) — needs the owner's files (2026-11-10)
- [ ] Add a `main` ruleset (pull requests only, CI required), with a bypass for `nextcloud-bot` if issue #17 says so, and the `RELEASE_PLEASE_TOKEN` secret — owner (2026-11-09)
- [ ] Publish to the Nextcloud App Store: request the certificate, register the app and add the secrets `APP_SIGNING_KEY`, `APP_SIGNING_CERT` and `APPSTORE_TOKEN` ([`docs/admin/releasing.md`](docs/admin/releasing.md)) — owner (2026-11-09)
- [ ] Measure the cost of the subfolder listing (`ListingService::walkBelow`, one query per folder) and of bulk-action writes with a fixture tree of ~100k files in the e2e container and the query log (2026-11-14)
- [ ] Flaky e2e `delete.spec.ts` *restored from the trash bin* (DELETE-001.8): restore MOVE answered 201 yet the file was missing, once in two runs; the previous case trashed in the same second (trash suffix `.d<seconds>`) — find the cause (2026-11-15)
