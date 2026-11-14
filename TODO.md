<!-- markdownlint-disable MD013 -- one line per item, as the /todo skill writes them -->

# Open work

One line per item. A finished item is deleted in the pull request that finishes it; Git keeps
the history. `## Milestones` is ordered — take the first open item that is not in progress and
has no open `needs-owner` issue. Details and open questions: [`docs/plan.md`](docs/plan.md).
Add items with `/todo`.

## Milestones

## Later

- [ ] Series in the loupe and series parts 1–3: build follow-up PR 11 of `docs/plans/loupe-series-concept.md` in its order once the owner signs off its revised mockup (2026-11-13)
- [ ] Undo toast: Nextcloud's global `button:hover` paints the toast's buttons (*Undo*, *Reject the other N*) light under their light text, so they turn unreadable on hover; keep them transparent as in the mockup, with a visible hover and focus (2026-11-14)
- [ ] Redraw `docs/mockup/index.html` and `docs/plan.md` item 2 (app bar) for the flag filter chips that replaced the scope control (GRID-002; owner sign-off on the look) (2026-11-11)
- [ ] Measure the image budgets of `docs/plan.md` Image delivery with real 24 MP RAW+JPEG pairs (IMAGES-001.12), incl. the loupe's 4096 px tier and the six image loads in flight (GRID-001.15) — needs the owner's files (2026-11-10)
- [ ] Add a `main` ruleset (pull requests only, CI required), with a bypass for `nextcloud-bot` if issue #17 says so, and the `RELEASE_PLEASE_TOKEN` secret — owner (2026-11-09)
- [ ] Publish to the Nextcloud app store: signing certificate, release workflow that builds and uploads the tarball (2026-11-09)
