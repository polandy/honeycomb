<!-- markdownlint-disable MD013 -- one line per item, as the /todo skill writes them -->

# Open work

One line per item. A finished item is deleted in the pull request that finishes it; Git keeps
the history. `## Milestones` is ordered — take the first open item that is not in progress and
has no open `needs-owner` issue. Details and open questions: [`docs/dev/plan.md`](docs/dev/plan.md).
Add items with `/todo`.

## Milestones

- [ ] Statistics (M9, STATS-001): PR 8 year in review, its one-time hint from 1 December, sidecars from digiKam or darktable (2026-11-19)
- [ ] Immich (M10, ADR 0041): PR 6 backend: connection registry and status, the client with contract tests and upstream error classes, listing and preview proxy; after the sign-off (2026-11-19)
- [ ] Immich (M10, ADR 0041): PR 7 the decision table, its mapper and endpoints; the sweep of rows whose connection left the file; after the sign-off (2026-11-19)
- [ ] Immich (M10, ADR 0041): PR 8 pure TypeScript: asset to picture and the time, device, kind and flag filters; after PR 5 (2026-11-19)
- [ ] Immich (M10, ADR 0041): PR 9 refactor of the Vue shell: the opened source as a union with key and capabilities, `imageUrl` in the cull context, `cull.ts` relieved, the cull context, the grid and loupe props and `toasted-decisions` on `Picture<SourceEntry>` (their callbacks reach the Nextcloud-only writes in `cull.ts`); after statistics PR 6 (2026-11-19)
- [ ] Immich (M10, ADR 0041): PR 10 UI in two pull requests: source and connection switcher with the read-only dialog; grid and loupe with Immich data, capabilities off, decisions saved, position and *Recent* (2026-11-19)
- [ ] Immich (M10, ADR 0041): PR 11 e2e with the stub Immich from the pinned schema and a fixture of two connections, on the generic upstream-stub seam of the e2e setup (2026-11-19)
- [ ] Immich (M10, ADR 0041): owner: Phase 1 hand test on the test server with two real accounts and read-only keys (2026-11-19)
- [ ] Immich (M10, ADR 0041): PR 13 Phase 2: *Write to Immich* with the `updatedAt` conflict check, rejects as Immich trash bin by default, per-asset results, undo; Immich decisions enter the statistics (2026-11-19)
- [ ] Immich (M10, ADR 0041): PR 14 user docs: the connections file format and key scopes for the admin, the guide for culling Immich uploads (2026-11-19)

## Later

- [ ] Immich kinds *Screenshots* and *Messenger images* from the Phase 1 mockup: Immich cannot filter them, so the server cannot count them without paging the library (ADR 0044); needs a server-side classification first (2026-11-20)
- [ ] Make the series tab on a filmstrip thumbnail a 44 × 44 px target that does not cover the thumbnail: it is a 20 px pill over the thumbnail's corner; `tests/e2e/touch-targets.ts` and `tests/e2e/a11y.ts` exempt it (GRID-001.19, APP-001.15) (2026-11-18)
- [ ] Opt in to `viewport-fit=cover` and pad the page edges with `env(safe-area-inset-*)`, so photos run under the status bar and home indicator while controls stay clear (`docs/dev/plan.md` Reference devices rule 2) (2026-11-18)
- [ ] Fix the grid tiles that never show their 1024 px tier after their 256 px load was aborted: `tests/e2e/image-budgets.spec.ts` waited 120 s for IMG_0012 locally and `loupe-budget.spec.ts` failed on main (run 44699293878) (GRID-001.15) (2026-11-20)
- [ ] Measure the grid scroll at 2,000+ items (`docs/dev/plan.md` Image delivery budgets), which `tests/e2e/image-budgets.spec.ts` leaves out (2026-11-18)
- [ ] Add a `main` ruleset (pull requests only, CI required), with a bypass for `nextcloud-bot` if issue #17 says so, and the `RELEASE_PLEASE_TOKEN` secret — owner (2026-11-09)
- [ ] Publish to the Nextcloud App Store: request the certificate, register the app and add the secrets `APP_SIGNING_KEY`, `APP_SIGNING_CERT` and `APPSTORE_TOKEN` ([`docs/dev/releasing.md`](docs/dev/releasing.md)) — owner (2026-11-09)
