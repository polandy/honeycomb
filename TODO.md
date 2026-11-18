<!-- markdownlint-disable MD013 -- one line per item, as the /todo skill writes them -->

# Open work

One line per item. A finished item is deleted in the pull request that finishes it; Git keeps
the history. `## Milestones` is ordered — take the first open item that is not in progress and
has no open `needs-owner` issue. Details and open questions: [`docs/dev/plan.md`](docs/dev/plan.md).
Add items with `/todo`.

## Milestones

- [ ] Stored series (#185, ADR 0027, SERIES-005): SERIES-005.17 badges with pin and check and the compare's "edited by hand" subtitle, SERIES-005.18 the "Also in other folders" subtitle (2026-11-15)
- [ ] Sidecar is the source of truth (M8, ADR 0032, #187): PR 9 drop the legacy tables a release after PR 6 (2026-11-15)

## Later

- [ ] Opening the series compare logs "Unhandled error in the honeycomb UI: `fallbackFocus` was specified but was not a node" from the dialog's focus trap, from the toolbar, the `n` key and a grid series badge alike; find the cause and add an e2e check for no console error (2026-11-17)
- [ ] Redraw `docs/dev/mockup/index.html` and `docs/dev/plan.md` item 2 (app bar) for the flag filter chips that replaced the scope control (GRID-002; owner sign-off on the look) (2026-11-11)
- [ ] Measure the image budgets of `docs/dev/plan.md` Image delivery with real 24 MP RAW+JPEG pairs (IMAGES-001.12), incl. the loupe's 4096 px tier and the six image loads in flight (GRID-001.15) — needs the owner's files (2026-11-10)
- [ ] Add a `main` ruleset (pull requests only, CI required), with a bypass for `nextcloud-bot` if issue #17 says so, and the `RELEASE_PLEASE_TOKEN` secret — owner (2026-11-09)
- [ ] Publish to the Nextcloud App Store: request the certificate, register the app and add the secrets `APP_SIGNING_KEY`, `APP_SIGNING_CERT` and `APPSTORE_TOKEN` ([`docs/dev/releasing.md`](docs/dev/releasing.md)) — owner (2026-11-09)
- [ ] Cut the share lookups of the subfolder listing (4 of its 5 queries per folder, `SharedFolders::isShared`, `docs/dev/plan.md` Multiple folders item 9), e.g. once per mount instead of per folder (2026-11-14)
- [ ] Cut the per-item lookups of the bulk saves: `UserPhotos::photos` looks each file id up on its own (3 queries per item, 60,000 decisions took 180,000 queries and 19.5 s, `docs/dev/plan.md` Multiple folders item 9) (2026-11-17)
- [ ] Fix the flaky e2e `loupe.spec.ts` "puts Pick and Reject at the side edges …": failed once in a full `scripts/verify.sh` run (portrait Pick at y 745, photo bottom 813), likely measured before the layout settled after the viewport change (2026-11-14)
