<!-- markdownlint-disable MD013 -- one line per item, as the /todo skill writes them -->

# Open work

One line per item. A finished item is deleted in the pull request that finishes it; Git keeps
the history. `## Milestones` is ordered — take the first open item that is not in progress and
has no open `needs-owner` issue. Details and open questions: [`docs/dev/plan.md`](docs/dev/plan.md).
Add items with `/todo`.

## Milestones

- [ ] Immich (M10, ADR 0041): owner: Phase 1 hand test on the test server with two real accounts and read-only keys (2026-11-19)
- [ ] Immich (M10, ADR 0041): PR 13 Phase 2 (done: the write plan `src/logic/immich-write-plan.ts`): *Write to Immich*, the write-back endpoint and the dialog, with the `updatedAt` conflict check, rejects as Immich trash bin by default, per-asset results, undo; Immich decisions enter the statistics (2026-11-19)
- [ ] Immich (M10, ADR 0041): PR 14 user docs (the admin page `docs/user/admin/immich.md` is done): an account without partner sharing in its timeline (ADR 0044), the guide for culling Immich uploads (2026-11-19)
- [ ] Culling aids (M11, ADR 0046): the similarity page (SERIES-004) measures the sharpness of its series members too, once it shows series; the cull measures them since PR 2 (SERIES-006) (2026-11-20)
- [ ] Series (ADR 0061): PR 4, the backfill: the listing and the library scan queue `ReadRawHeaders` for RAW files without the key; the job drops the folder summaries it touched (2026-11-26)

## Later

- [ ] Red e2e on #433 (CI run 45878288778, newest Nextcloud, webkit): `tests/e2e/move.spec.ts:10` saw the `POST /api/v1/move` unanswered after 5 s with no server log line; a move emits no write or metadata event, find why the request stalls (2026-11-26). Not reproduced in 24 local runs (move.spec alone, in CI order, shard 2/3 on 35.0.3; the move takes 130 ms); the next red run shows the request's arrival and duration as a `[request]` line (`docs/dev/02-workflow.md` §2.3) (2026-11-27)
- [ ] Architecture review of 2026-11-24 (done: migration rules ADR 0055, filecache exception ADR 0049, XMP-before-rebuild note, wiring rule ADR 0028): add the canary test that runs `FileCacheLibrary`'s raw `oc_filecache` queries on every Nextcloud version CI covers (ADR 0049) (2026-11-24)
- [ ] Picture source step 2 follow-up (ADR 0058): the folder listing flows (recent, folder picker, fresh check) and the grid's image URLs through `folderPictureSource`'s `list`, `counts` and `imageUrl` instead of their seams (2026-11-25)
- [ ] Architecture review of 2026-11-24: rename the glue files in `src/` that share a name with a `src/logic` file (`cull.ts`, `series.ts`, `settings.ts` and 14 more) to `-flow` or `-run` (conventions §1) (2026-11-24)
- [ ] Folders cover (owner's phone review, 2026-11-25, nc-test `Split / RAW`): a RAW-only folder shows the folder icon, as FOLDERS-005.18 picks only rendered files; pick the RAW's embedded JPEG instead (spec change, and a migration that drops the RAW-only summaries so the next scan writes their previews) (2026-11-25)
- [ ] Modal panel follow-up (d-71, APP-001.23): move the gesture guide and the tag entry from `useModalDialog` onto `ModalPanel`, so they close by the backdrop and lock the page's scroll too, with the e2e of `tests/e2e/modal-panel.spec.ts` (2026-11-26)
- [ ] Fill colours (found with the *Folders* review, 2026-11-25): `StatisticsRead.vue`, `ImmichConnectionDialog.vue` and `PictureThumbs.vue` fill or outline with `--color-success` and `--color-error`, which Nextcloud now sets to light tints; use `--color-element-success` and `--color-element-error` with a contrast e2e as `tests/e2e/folders-layout.spec.ts` does (2026-11-25)
- [ ] Statistics chart on a phone (found with layout variant A task 5): a month's day ticks are cut to one character at 390 px (*15* shows *1*, *22* shows *2*), as each tick is clipped to its bar's width; let a tick overflow into the empty neighbours, as the UX mockup does, with an e2e that no tick is cut (2026-11-27)
- [ ] Pages of their own after the statistics layout (STATS-001.73): *Similarity* and *Orphaned sidecars* still run a 640 px column left-aligned under a 960 px centred title row, with *Back to the cull* on its own line; give them one shared centred column and *Back to the cull* in the title row through `PageLayout`'s `actions` slot (2026-11-27)
- [ ] Folders phase 2 (M12, ADR 0049): shares, group folders and external storage as library roots, with a done status that survives the owner's permissions; the walker of ADR 0025 and the roots check of FOLDERS-005 list only the home storage today (2026-11-22)
- [ ] Folders phase 2 (M12, ADR 0049): Immich albums as folders in the list, with their own summaries and done status (ADR 0041 keeps them out of phase 1) (2026-11-22)
- [ ] Immich kinds *Screenshots* and *Messenger images* from the Phase 1 mockup: Immich cannot filter them, so the server cannot count them without paging the library (ADR 0044); needs a server-side classification first (2026-11-20)
- [ ] Fix the grid tiles that never show their 1024 px tier after their 256 px load was aborted: `tests/e2e/image-budgets.spec.ts` waited 120 s for IMG_0012 locally and `loupe-budget.spec.ts` failed on main (run 44699293878) (GRID-001.15) (2026-11-20)
- [ ] Fix `tests/e2e/a11y.spec.ts:40` (light theme) running past its 30 s test timeout on a loaded host: it walks every screen through axe in one test, 11 s in CI and 33 s locally at load 39 on 16 cores, red on both Nextcloud versions in the third local run of PR #331 (2026-11-21)
- [ ] Measure the grid scroll at 2,000+ items (`docs/dev/plan.md` Image delivery budgets), which `tests/e2e/image-budgets.spec.ts` leaves out (2026-11-18)
- [ ] Add a `main` ruleset (pull requests only, CI required), with a bypass for `nextcloud-bot` if issue #17 says so, and the `RELEASE_PLEASE_TOKEN` secret — owner (2026-11-09)
- [ ] Publish to the Nextcloud App Store: request the certificate, register the app and add the secrets `APP_SIGNING_KEY`, `APP_SIGNING_CERT` and `APPSTORE_TOKEN` ([`docs/dev/releasing.md`](docs/dev/releasing.md)) — owner (2026-11-09)
