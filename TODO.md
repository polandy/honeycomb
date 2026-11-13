<!-- markdownlint-disable MD013 -- one line per item, as the /todo skill writes them -->

# Open work

One line per item. A finished item is deleted in the pull request that finishes it; Git keeps
the history. `## Milestones` is ordered — take the first open item that is not in progress and
has no open `needs-owner` issue. Details and open questions: [`docs/plan.md`](docs/plan.md).
Add items with `/todo`.

## Milestones

- [ ] Tags 1: ADR and backend: a per-user table of picture tags and the tag list (D6), endpoints to list and change tags, read the JPEG's embedded XMP as a source (D1), and write each change through to every sidecar with `tagWrite`/`mergeTags` (XMP-004) (`docs/07-tags.md` outline steps 1 and 3) (2026-11-13)
- [ ] Tags 2: Tag entry: `T` in the key map (KEYS-001) for the loupe, series viewer and grid selection, *Tags* icon button in the `ActionBar` (D8), substring autocomplete, `/` creates levels, one undo step and toast per change (`docs/07-tags.md` Tag entry, `docs/mockup/tag-entry.html`) (2026-11-13)
- [ ] Tags 3: Multi-select and bulk tagging: visible *Select* / *Done* button with long-press as shortcut (D8), partial chips (dashed) for tags only some targets have (GRID-003) (2026-11-13)
- [ ] Tags 4: Tag filter on `F`: chips AND (D4), a parent matches its descendants (D5), count badge (GRID-002); tile tag icon and count (D3); tags in the loupe's info panel (2026-11-13)
- [ ] Tags 5: Merge `docs/mockup/tag-entry.html` into `docs/mockup/index.html`, user doc `docs/user/tags.md` (`docs/07-tags.md` outline step 6) (2026-11-13)
- [ ] UX M1: Slim the grid toolbar: drop the funnel before the flag chips, move *Delete rejects* and *Compare* into *More* below 900 px, at most two rows on a phone (`docs/ux-review-2026-11.md`) (2026-11-12)
- [ ] UX M2: Name the toolbar progress's scope when a flag filter hides photos ("4 / 20 shown decided"), so it no longer contradicts the navigation's count (owner decided 2026-11-12) (`docs/ux-review-2026-11.md`) (2026-11-12)
- [ ] UX M3: Drop the pair badge on a complete pair; only singles keep "JPG only" or "NEF only" (owner decided 2026-11-12) (`docs/ux-review-2026-11.md`) (2026-11-12)
- [ ] UX M4: Close the resume toast when the user opens a photo, decides or scrolls the grid (`docs/ux-review-2026-11.md`) (2026-11-12)
- [ ] UX M5: Series compare: *Pick this, reject the rest* primary only on the active card, cards fill the dialog height, one line of instructions, equal flag-button heights (`docs/ux-review-2026-11.md`) (2026-11-12)
- [ ] UX M6: Compact the loupe info panel: 32 px rows, left-aligned muted labels, sidecars by file name once each, "—" when empty, no *Preloading* section (`docs/ux-review-2026-11.md`) (2026-11-12)
- [ ] UX M7: Grid *More* menu: a separator between view options and actions; an item that opens a dialog closes the menu (`docs/ux-review-2026-11.md`) (2026-11-12)
- [ ] UX M8: Order the gesture guide by pointer type: keys first as a two-column list with a mouse, gestures first on touch; align the tap-zone figure (`docs/ux-review-2026-11.md`) (2026-11-12)
- [ ] UX M9: Change "honey" to "primary" in the glossary and `docs/plan.md`, since the app uses Nextcloud's primary colour (owner decided 2026-11-12) (`docs/ux-review-2026-11.md`) (2026-11-12)
- [ ] UX L1: Lay out the keyboard shortcuts sheet as one grid with a shared key column (`docs/ux-review-2026-11.md`) (2026-11-12)
- [ ] UX L2: Folder picker: status line in regular weight and muted colour; one folder row height (`docs/ux-review-2026-11.md`) (2026-11-12)
- [ ] UX L3: Start the Nextcloud navigation closed below 1280 px and remember the user's choice (`docs/ux-review-2026-11.md`) (2026-11-12)
- [ ] UX L4: Settings: one section heading style (*File types* sits 8 px left of the others) (`docs/ux-review-2026-11.md`) (2026-11-12)
- [ ] UX L5: Give *Unflag* at the loupe's right edge its word, like *Pick* and *Reject* (`docs/ux-review-2026-11.md`) (2026-11-12)
- [ ] UX L6: Grid selection on a phone: two action bar rows, flags, *Move* and *Delete* first (`docs/ux-review-2026-11.md`) (2026-11-12)
- [ ] UX L7: Start the loupe filmstrip at the left edge until the current photo reaches the middle (`docs/ux-review-2026-11.md`) (2026-11-12)

## Later

- [ ] Redraw `docs/mockup/index.html` and `docs/plan.md` item 2 (app bar) for the flag filter chips that replaced the scope control (GRID-002; owner sign-off on the look) (2026-11-11)
- [ ] Measure the image budgets of `docs/plan.md` Image delivery with real 24 MP RAW+JPEG pairs (IMAGES-001.12), incl. the loupe's 4096 px tier and the six image loads in flight (GRID-001.15) — needs the owner's files (2026-11-10)
- [ ] Add a `main` ruleset (pull requests only, CI required), with a bypass for `nextcloud-bot` if issue #17 says so, and the `RELEASE_PLEASE_TOKEN` secret — owner (2026-11-09)
- [ ] Publish to the Nextcloud app store: signing certificate, release workflow that builds and uploads the tarball (2026-11-09)
