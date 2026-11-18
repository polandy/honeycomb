<!-- markdownlint-disable MD013 -- one line per item, as the /todo skill writes them -->

# Open work

One line per item. A finished item is deleted in the pull request that finishes it; Git keeps
the history. `## Milestones` is ordered — take the first open item that is not in progress and
has no open `needs-owner` issue. Details and open questions: [`docs/dev/plan.md`](docs/dev/plan.md).
Add items with `/todo`.

## Milestones

- [ ] Sidecar is the source of truth (M8, ADR 0032, #187): PR 9 drop the legacy tables a release after PR 6 (2026-11-15)

## Later

- [ ] Make the series tab on a filmstrip thumbnail a 44 × 44 px target that does not cover the thumbnail: it is a 20 px pill over the thumbnail's corner; `tests/e2e/touch-targets.ts` exempts it (GRID-001.19) (2026-11-18)
- [ ] Opt in to `viewport-fit=cover` and pad the page edges with `env(safe-area-inset-*)`, so photos run under the status bar and home indicator while controls stay clear (`docs/dev/plan.md` Reference devices rule 2) (2026-11-18)
- [ ] Bring the first sharp image of a newly opened folder from about 2.1 s to under 500 ms (IMAGES-001.12): the first 24 MP preview renders on the request, about 1 s each; measured in `docs/dev/plan.md` Image delivery (2026-11-18)
- [ ] Measure the grid scroll at 2,000+ items (`docs/dev/plan.md` Image delivery budgets), which `tests/e2e/image-budgets.spec.ts` leaves out (2026-11-18)
- [ ] Add a `main` ruleset (pull requests only, CI required), with a bypass for `nextcloud-bot` if issue #17 says so, and the `RELEASE_PLEASE_TOKEN` secret — owner (2026-11-09)
- [ ] Publish to the Nextcloud App Store: request the certificate, register the app and add the secrets `APP_SIGNING_KEY`, `APP_SIGNING_CERT` and `APPSTORE_TOKEN` ([`docs/dev/releasing.md`](docs/dev/releasing.md)) — owner (2026-11-09)
