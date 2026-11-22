<!-- markdownlint-disable MD013 -- one line per item, as the /todo skill writes them -->

# Open work

One line per item. A finished item is deleted in the pull request that finishes it; Git keeps
the history. `## Milestones` is ordered — take the first open item that is not in progress and
has no open `needs-owner` issue. Details and open questions: [`docs/dev/plan.md`](docs/dev/plan.md).
Add items with `/todo`.

## Milestones

- [ ] Immich (M10, ADR 0041): PR 10c UI: the resume position (the listing's `from` and `previousCursor`, ADR 0044, the positions' `asset_id` and its removal in the connection sweep, IMMICH-003.18) and *Recent*; the filter bar with time, device and kind options and their counts (`shownTimeOptions`) and the rating filter; grid-level decisions, selection and keys; the tile pills (LIVE, duration, stack); the failed page naming the connection's state (IMMICH-002.19); each with its e2e in `tests/e2e/immich-grid.spec.ts` against the stub Immich (2026-11-21)
- [ ] Immich (M10, ADR 0041): owner: Phase 1 hand test on the test server with two real accounts and read-only keys (2026-11-19)
- [ ] Immich (M10, ADR 0041): PR 13 Phase 2: *Write to Immich* with the `updatedAt` conflict check, rejects as Immich trash bin by default, per-asset results, undo; Immich decisions enter the statistics (2026-11-19)
- [ ] Immich (M10, ADR 0041): PR 14 user docs: the connections file format and key scopes for the admin, an account without partner sharing in its timeline (ADR 0044), the guide for culling Immich uploads (2026-11-19)
- [ ] Culling aids (M11, ADR 0046): the similarity page (SERIES-004) measures the sharpness of its series members too, once it shows series; the cull measures them since PR 2 (SERIES-006) (2026-11-20)
- [ ] Folders (M12, ADR 0049): PR 2 backend folder summaries: one migration creating `honeycomb_folder_summary` and `honeycomb_folder_done`, the summary service on the walker of ADR 0025 (path cursor, library roots, skips), the burst counter with the series constant, `GET /library/folders` with the live flag counts, `POST /library/scan`, the daily sweep (no dirty marks); the library roots as the user setting `libraryRoots`, rechecked by `GET /library/folders`; PHPUnit on SQLite, MariaDB and PostgreSQL (2026-11-22)
- [ ] Folders (M12, ADR 0049): PR 3 backend done status (no migration): `PUT`/`DELETE /library/folders/{fileId}/done` with the UPDATE check and the rate limit (ADR 0031), the counter `folders_done` (ADR 0039); PHPUnit (2026-11-22)
- [ ] Folders (M12, ADR 0049): PR 5 UI list: `FoldersScreen` as the start screen with the first-run root picker, the navigation entry, the progress card, rows with the split bar, root and filter chips, sort, the ⋯ menu (bottom sheet on the phone), *Cull* into the grid and *Back* keeping the list's state; Playwright incl. axe and touch targets (2026-11-22)
- [ ] Folders (M12, ADR 0049): PR 6 UI done: *Mark done* without a dialog, the toast with *Undo* (about 8 s, dismissable by its close button or a swipe), *Reopen*, the badge *n new* and *Cull new* with the flag filter, *Mark folder done* on the *Cull finished* card; Playwright (2026-11-22)
- [ ] Folders (M12, ADR 0049): PR 7 statistics and settings: the *Folder sets* panel replaced by the progress headline with a link to *Folders*, the library roots in *Settings*, the user docs chapter "Cleaning up the library"; phase 2 items (shares and group folders, Immich albums) under Later (2026-11-22)

## Later

- [ ] Immich kinds *Screenshots* and *Messenger images* from the Phase 1 mockup: Immich cannot filter them, so the server cannot count them without paging the library (ADR 0044); needs a server-side classification first (2026-11-20)
- [ ] Make the series tab on a filmstrip thumbnail a 44 × 44 px target that does not cover the thumbnail: it is a 20 px pill over the thumbnail's corner; `tests/e2e/touch-targets.ts` and `tests/e2e/a11y.ts` exempt it (GRID-001.19, APP-001.15) (2026-11-18)
- [ ] Opt in to `viewport-fit=cover` and pad the page edges with `env(safe-area-inset-*)`, so photos run under the status bar and home indicator while controls stay clear (`docs/dev/plan.md` Reference devices rule 2) (2026-11-18)
- [ ] Fix the grid tiles that never show their 1024 px tier after their 256 px load was aborted: `tests/e2e/image-budgets.spec.ts` waited 120 s for IMG_0012 locally and `loupe-budget.spec.ts` failed on main (run 44699293878) (GRID-001.15) (2026-11-20)
- [ ] Fix `tests/js/conventions/eslint.test.ts` timing out at 30 s inside `scripts/verify.sh`: its first `lintText` builds the type-aware program cold (4 s alone) while the `eslint` and `vue-tsc` steps run in parallel; red in both local runs of PR #331 (2026-11-21)
- [ ] Fix `tests/e2e/a11y.spec.ts:40` (light theme) running past its 30 s test timeout on a loaded host: it walks every screen through axe in one test, 11 s in CI and 33 s locally at load 39 on 16 cores, red on both Nextcloud versions in the third local run of PR #331 (2026-11-21)
- [ ] Measure the grid scroll at 2,000+ items (`docs/dev/plan.md` Image delivery budgets), which `tests/e2e/image-budgets.spec.ts` leaves out (2026-11-18)
- [ ] Add a `main` ruleset (pull requests only, CI required), with a bypass for `nextcloud-bot` if issue #17 says so, and the `RELEASE_PLEASE_TOKEN` secret — owner (2026-11-09)
- [ ] Publish to the Nextcloud App Store: request the certificate, register the app and add the secrets `APP_SIGNING_KEY`, `APP_SIGNING_CERT` and `APPSTORE_TOKEN` ([`docs/dev/releasing.md`](docs/dev/releasing.md)) — owner (2026-11-09)
