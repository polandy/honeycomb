<!-- markdownlint-disable MD013 -- one line per item, as the /todo skill writes them -->

# Open work

One line per item. A finished item is deleted in the pull request that finishes it; Git keeps
the history. `## Milestones` is ordered — take the first open item that is not in progress and
has no open `needs-owner` issue. Details and open questions: [`docs/plan.md`](docs/plan.md).
Add items with `/todo`.

## Milestones

## Later

- [ ] Redraw `docs/mockup/index.html` and `docs/plan.md` item 2 (app bar) for the flag filter chips that replaced the scope control (GRID-002; owner sign-off on the look) (2026-11-11)
- [ ] Measure the image budgets of `docs/plan.md` Image delivery with real 24 MP RAW+JPEG pairs (IMAGES-001.12), incl. the loupe's 4096 px tier and the six image loads in flight (GRID-001.15) — needs the owner's files (2026-11-10)
- [ ] Add a `main` ruleset (pull requests only, CI required), with a bypass for `nextcloud-bot` if issue #17 says so, and the `RELEASE_PLEASE_TOKEN` secret — owner (2026-11-09)
- [ ] Publish to the Nextcloud app store: signing certificate, release workflow that builds and uploads the tarball (2026-11-09)
- [ ] Cut the share lookups of the subfolder listing (4 of its 5 queries per folder, `SharedFolders::isShared`, `docs/plan.md` Multiple folders item 9), e.g. once per mount instead of per folder (2026-11-14)
- [ ] Fix the flaky e2e `delete.spec.ts` "a picture restored from the trash bin keeps its file id and its decision": failed once in a full `scripts/verify.sh` run (restore `201`, then the file not at its path), passed alone; suspect two `IMG_0001.jpg` trashed in the same second by the spec's first test (2026-11-14)
