<!-- markdownlint-disable MD013 -- one line per item, as the /todo skill writes them -->

# Open work

One line per item. A finished item is deleted in the pull request that finishes it; Git keeps
the history. `## Milestones` is ordered — take the first open item that is not in progress and
has no open `needs-owner` issue. Details and open questions: [`docs/plan.md`](docs/plan.md).
Add items with `/todo`.

## Milestones

## Later

- [ ] Measure the image budgets of `docs/plan.md` Image delivery with real 24 MP RAW+JPEG pairs (IMAGES-001.12), incl. the `512` and `2048` tiers that Nextcloud delivers at up to 1024 and 4096 px (ADR 0010) — needs the owner's files (2026-11-10)
- [ ] Create the public repository `polandy/honeycomb-assets` for PR screenshots — owner (`docs/02-workflow.md` §2.7) (2026-11-09)
- [ ] Add a `main` ruleset (pull requests only, CI required), with a bypass for `nextcloud-bot` if issue #17 says so, and the `RELEASE_PLEASE_TOKEN` secret — owner (2026-11-09)
- [ ] Publish to the Nextcloud app store: signing certificate, release workflow that builds and uploads the tarball (2026-11-09)
