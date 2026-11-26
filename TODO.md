<!-- markdownlint-disable MD013 -- one line per item, as the /todo skill writes them -->

# Open work

One line per item. A finished item is deleted in the pull request that finishes it; Git keeps
the history. `## Milestones` is ordered — take the first open item that is not in progress and
has no open `needs-owner` issue. Details and open questions: [`docs/dev/plan.md`](docs/dev/plan.md).
Add items with `/todo`.

## Milestones

- [ ] Immich (M10, ADR 0041): PR 10c UI: the rating filter on the Immich filter bar; grid-level decisions, selection and keys; the tile pills (LIVE, duration, stack); the failed page naming the connection's state (IMMICH-002.19); each with its e2e in `tests/e2e/immich-grid.spec.ts` against the stub Immich (2026-11-21)
- [ ] Immich (M10, ADR 0041): owner: Phase 1 hand test on the test server with two real accounts and read-only keys (2026-11-19)
- [ ] Immich (M10, ADR 0041): PR 13 Phase 2: *Write to Immich* with the `updatedAt` conflict check, rejects as Immich trash bin by default, per-asset results, undo; Immich decisions enter the statistics (2026-11-19)
- [ ] Immich (M10, ADR 0041): PR 14 user docs (the admin page `docs/user/admin/immich.md` is done): an account without partner sharing in its timeline (ADR 0044), the guide for culling Immich uploads (2026-11-19)
- [ ] Culling aids (M11, ADR 0046): the similarity page (SERIES-004) measures the sharpness of its series members too, once it shows series; the cull measures them since PR 2 (SERIES-006) (2026-11-20)
- [ ] Series (owner, 2026-11-25, nc-test folder 'Series'): read the capture time and camera of RAW files ourselves (ADR first: header read through `OCP\Files`, own metadata key, a backfill for existing files), since Nextcloud's metadata has none for RAF, so a RAW-only shot never joins its burst's series and splits its filmstrip frame; *Pick this, reject the rest* then leaves it out (2026-11-25)

## Later

- [ ] Architecture review of 2026-11-24 (done: migration rules ADR 0055, filecache exception ADR 0049, XMP-before-rebuild note, wiring rule ADR 0028): add the canary test that runs `FileCacheLibrary`'s raw `oc_filecache` queries on every Nextcloud version CI covers (ADR 0049) (2026-11-24)
- [ ] Picture source step 2 follow-up (ADR 0058): the folder listing flows (recent, folder picker, fresh check) and the grid's image URLs through `folderPictureSource`'s `list`, `counts` and `imageUrl` instead of their seams (2026-11-25)
- [ ] Architecture review of 2026-11-24: rename the glue files in `src/` that share a name with a `src/logic` file (`cull.ts`, `series.ts`, `settings.ts` and 14 more) to `-flow` or `-run` (conventions §1) (2026-11-24)
- [ ] Folders cover (owner's phone review, 2026-11-25, nc-test `Split / RAW`): a RAW-only folder shows the folder icon, as FOLDERS-005.18 picks only rendered files; pick the RAW's embedded JPEG instead (spec change, and a migration that drops the RAW-only summaries so the next scan writes their previews) (2026-11-25)
- [ ] Modal panel follow-up (d-71, APP-001.23): move the gesture guide and the tag entry from `useModalDialog` onto `ModalPanel`, so they close by the backdrop and lock the page's scroll too, with the e2e of `tests/e2e/modal-panel.spec.ts` (2026-11-26)
- [ ] Fill colours (found with the *Folders* review, 2026-11-25): `StatisticsRead.vue`, `ImmichConnectionDialog.vue` and `PictureThumbs.vue` fill or outline with `--color-success` and `--color-error`, which Nextcloud now sets to light tints; use `--color-element-success` and `--color-element-error` with a contrast e2e as `tests/e2e/folders-layout.spec.ts` does (2026-11-25)
- [ ] Folders phase 2 (M12, ADR 0049): shares, group folders and external storage as library roots, with a done status that survives the owner's permissions; the walker of ADR 0025 and the roots check of FOLDERS-005 list only the home storage today (2026-11-22)
- [ ] Folders phase 2 (M12, ADR 0049): Immich albums as folders in the list, with their own summaries and done status (ADR 0041 keeps them out of phase 1) (2026-11-22)
- [ ] Immich kinds *Screenshots* and *Messenger images* from the Phase 1 mockup: Immich cannot filter them, so the server cannot count them without paging the library (ADR 0044); needs a server-side classification first (2026-11-20)
- [ ] Fix the grid tiles that never show their 1024 px tier after their 256 px load was aborted: `tests/e2e/image-budgets.spec.ts` waited 120 s for IMG_0012 locally and `loupe-budget.spec.ts` failed on main (run 44699293878) (GRID-001.15) (2026-11-20)
- [ ] Fix `tests/e2e/a11y.spec.ts:40` (light theme) running past its 30 s test timeout on a loaded host: it walks every screen through axe in one test, 11 s in CI and 33 s locally at load 39 on 16 cores, red on both Nextcloud versions in the third local run of PR #331 (2026-11-21)
- [ ] Measure the grid scroll at 2,000+ items (`docs/dev/plan.md` Image delivery budgets), which `tests/e2e/image-budgets.spec.ts` leaves out (2026-11-18)
- [ ] Add a `main` ruleset (pull requests only, CI required), with a bypass for `nextcloud-bot` if issue #17 says so, and the `RELEASE_PLEASE_TOKEN` secret — owner (2026-11-09)
- [ ] Publish to the Nextcloud App Store: request the certificate, register the app and add the secrets `APP_SIGNING_KEY`, `APP_SIGNING_CERT` and `APPSTORE_TOKEN` ([`docs/dev/releasing.md`](docs/dev/releasing.md)) — owner (2026-11-09)
