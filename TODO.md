<!-- markdownlint-disable MD013 -- one line per item, as the /todo skill writes them -->

# Open work

One line per item. A finished item is deleted in the pull request that finishes it; Git keeps
the history. `## Milestones` is ordered — take the first open item that is not in progress and
has no open `needs-owner` issue. Details and open questions: [`docs/plan.md`](docs/plan.md).
Add items with `/todo`.

## Milestones

- [ ] Flaky e2e from #147: `tests/e2e/series.spec.ts` "shows a whole burst as one series…" failed once on `[desktop]` in a full local `scripts/verify.sh` run (`cards.last()` not in viewport after five `→`), then passed 3 of 3 alone; find the cause (suspect `scroll-snap-type` with `scrollIntoView` in `SeriesCompare.vue`), no retry (2026-11-13)
- [ ] Loupe on a phone in landscape (Pixel 9 Pro, 952 × 427): keep *Unflag* at the right edge clear of the filmstrip, which covers its lower half (seen in PR #143, already on `main`) (2026-11-13)

## Later

- [ ] Series in the loupe and series parts 1–3: build the seven follow-up PRs of `docs/plans/loupe-series-concept.md` in its order once the owner signs off its mockup (2026-11-13)
- [ ] Redraw `docs/mockup/index.html` and `docs/plan.md` item 2 (app bar) for the flag filter chips that replaced the scope control (GRID-002; owner sign-off on the look) (2026-11-11)
- [ ] Measure the image budgets of `docs/plan.md` Image delivery with real 24 MP RAW+JPEG pairs (IMAGES-001.12), incl. the loupe's 4096 px tier and the six image loads in flight (GRID-001.15) — needs the owner's files (2026-11-10)
- [ ] Add a `main` ruleset (pull requests only, CI required), with a bypass for `nextcloud-bot` if issue #17 says so, and the `RELEASE_PLEASE_TOKEN` secret — owner (2026-11-09)
- [ ] Publish to the Nextcloud app store: signing certificate, release workflow that builds and uploads the tarball (2026-11-09)
