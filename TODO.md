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
- [ ] Listing with subfolders: page `ListingService::searchBelow` by `fileid >` the last id instead of `OFFSET`, which re-filters the whole subtree per page (`docs/plans/database-impact.md` §2.1) (2026-11-14)
- [ ] Check on PostgreSQL that `LIKE '%.xmp'`/`'%.cr3'`/`'%.srw'` in the subfolder search finds upper-case names such as `IMG_1.XMP`; use `COMPARE_ILIKE` if not (`docs/plans/database-impact.md` §2.1) (2026-11-14)
- [ ] `RetryOnConflict`: also retry a deadlock (and lock wait timeout) of parallel saves on MySQL (`docs/plans/database-impact.md` §5) (2026-11-14)
- [ ] `DecisionMapper`/`TagMapper::replace`: one multi-row `INSERT` per chunk instead of one per row, to shorten bulk-action transactions (`docs/plans/database-impact.md` §3, §5) (2026-11-14)
- [ ] Admin docs: every release needs `occ upgrade` or `occ app:update honeycomb`; instances installed before #119 need `occ migrations:migrate honeycomb`; recommend Redis file locking (`docs/plans/database-impact.md` §7) (2026-11-14)
- [ ] Verify what `occ app:remove honeycomb` leaves behind on Nextcloud 35 and document it; an uninstall repair step needs an ADR (`docs/plans/database-impact.md` §6) (2026-11-14)
- [ ] Measure the estimates of `docs/plans/database-impact.md` §2.1 and §3 with a fixture tree of ~100k files in the e2e container and the query log (2026-11-14)
