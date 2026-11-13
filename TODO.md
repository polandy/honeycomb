<!-- markdownlint-disable MD013 -- one line per item, as the /todo skill writes them -->

# Open work

One line per item. A finished item is deleted in the pull request that finishes it; Git keeps
the history. `## Milestones` is ordered — take the first open item that is not in progress and
has no open `needs-owner` issue. Details and open questions: [`docs/plan.md`](docs/plan.md).
Add items with `/todo`.

## Milestones

- [ ] UX L5: Give *Unflag* at the loupe's right edge its word, like *Pick* and *Reject* (`docs/ux-review-2026-11.md`) (2026-11-12)
- [ ] UX L6: Grid selection on a phone: two action bar rows, flags, *Move* and *Delete* first (`docs/ux-review-2026-11.md`) (2026-11-12)
- [ ] UX L7: Start the loupe filmstrip at the left edge until the current photo reaches the middle (`docs/ux-review-2026-11.md`) (2026-11-12)

## Later

- [ ] Redraw `docs/mockup/index.html` and `docs/plan.md` item 2 (app bar) for the flag filter chips that replaced the scope control (GRID-002; owner sign-off on the look) (2026-11-11)
- [ ] Measure the image budgets of `docs/plan.md` Image delivery with real 24 MP RAW+JPEG pairs (IMAGES-001.12), incl. the loupe's 4096 px tier and the six image loads in flight (GRID-001.15) — needs the owner's files (2026-11-10)
- [ ] Add a `main` ruleset (pull requests only, CI required), with a bypass for `nextcloud-bot` if issue #17 says so, and the `RELEASE_PLEASE_TOKEN` secret — owner (2026-11-09)
- [ ] Publish to the Nextcloud app store: signing certificate, release workflow that builds and uploads the tarball (2026-11-09)
