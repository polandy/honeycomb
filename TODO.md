<!-- markdownlint-disable MD013 -- one line per item, as the /todo skill writes them -->

# Open work

One line per item. A finished item is deleted in the pull request that finishes it; Git keeps
the history. `## Milestones` is ordered — take the first open item that is not in progress and
has no open `needs-owner` issue. Details and open questions: [`docs/plan.md`](docs/plan.md).
Add items with `/todo`.

## Milestones

- [ ] M4.4: Per-user settings — extensions, folder mode, singles, gestures, auto-advance, show flag buttons, vi keys (2026-11-09)
- [ ] M4.5: README for users — features, installation brought up to date, screenshot placeholders, recommended apps `camerarawpreviews` and Preview Generator (2026-11-09)
- [ ] M5: XMP sidecars — read on listing, write per `docs/06-xmp-interop.md` incl. `honeycomb:KeepRaw` (ADR 0008); the listing says per folder whether it is shared, deferred from M1.2 (`docs/plan.md` Decisions, gestures and shared folders); mapping in TypeScript, backend writes the bytes; ADR on the TypeScript XML library first (Q3) (2026-11-09)
- [ ] M6: Series compare — group pictures taken within a short interval, show 2–4 side by side, Pick / Reject / Unflag per photo and "Pick this, reject the rest" as one undo step, from the shared components (`docs/plan.md` Culling workflow) (2026-11-09)
- [ ] M7.1: Name template module in TypeScript — parse, validate with column, render, sanitise to `[A-Za-z0-9._-]`, fallbacks, collision suffix; tests from `docs/05-name-templates.md` (2026-11-09)
- [ ] M7.2: Move — ADR on the move API and pair atomicity first; backend moves the whole picture through `OCP\Files` and rechecks every path, conflicts (suffix, skip, replace into the trash bin) resolved in TypeScript, undo, per-file failure report (2026-11-09)
- [ ] M7.3: Move dialog and move summary — target picker, favourite and recent targets, conflict choices, undo toast, key `M`, from the selection, the loupe and the filter result (2026-11-09)
- [ ] M7.4: Name template setting with presets and a live preview on 5 sample pictures (2026-11-09)

## Later

- [ ] Clean-up job for `honeycomb_decisions` and `honeycomb_positions` rows whose files are deleted for good (ADR 0012 Consequences) (2026-11-10)
- [ ] Grid: list RAW files whose type Nextcloud does not know (`.CR3` uploads get `application/octet-stream` and are skipped by the listing) — a mimetype mapping or a listing by RAW extension; decide before M4.3 (2026-11-10)
- [ ] Grid: arrow-key focus moves between tiles (Tab only for now) and the phone bottom sheet of `ConfirmDialog` (2026-11-10)
- [ ] Shared `Tooltip` component (`docs/plan.md` Tooltip) for the icon-only controls built so far: Home, More, Open {name} (2026-11-10)
- [ ] Measure the image budgets of `docs/plan.md` Image delivery with real 24 MP RAW+JPEG pairs, incl. the `512` and `2048` tiers that Nextcloud delivers at up to 1024 and 4096 px (ADR 0010) — needs the owner's files (2026-11-10)
- [ ] Unused-export gate for TypeScript once `src/` has modules (glissando `unused-exports.sh`, or knip with an ADR) and a gate that no component shows raw error text (`docs/conventions.md` §1, §3) (2026-11-10)
- [ ] Mockup: specify the grid's loading state (skeleton tiles while the listing and thumbnails arrive) — UX review L1 (`docs/ux-review.md`) (2026-11-09)
- [ ] Mockup: give the scope switch a readable label at phone width, where it stays icon-only — UX review L2 (2026-11-09)
- [ ] Mockup: shorten or widen *Pick this, reject the rest* in the phone series compare, where it wraps to three lines — UX review L3 (2026-11-09)
- [ ] Mockup: pause the undo toast's timer while it has focus or is pressed (WCAG 2.2.1) — UX review L4 (2026-11-09)
- [ ] Mockup: mark filmstrip and tile states without dimming the photo (filmstrip opacity .6, the tile's bottom gradient without stars or flag) — UX review L5 (2026-11-09)
- [ ] Mockup: settings entry to show the loupe gesture guide again — UX review L6 (2026-11-09)
- [ ] Mockup: quieter toolbar count badges (neutral, honey only for the active state) — UX review L7 (2026-11-09)
- [ ] Mockup: a light app bar for the light theme instead of the near-black bar — UX review L8 (2026-11-09)
- [ ] Create the public repository `polandy/honeycomb-assets` for PR screenshots — owner (`docs/02-workflow.md` §2.7) (2026-11-09)
- [ ] Add a `main` ruleset (pull requests only, CI required), with a bypass for `nextcloud-bot` if issue #17 says so, and the `RELEASE_PLEASE_TOKEN` secret — owner (2026-11-09)
- [ ] Set up Nextcloud's Transifex sync before the first App Store release: `.tx/config`, `l10n/.gitkeep`, `.l10nignore`, `REUSE.toml` for `l10n/**`; owner's steps and the `main` ruleset question in issue #17 (ADR 0007) (2026-11-09)
- [ ] Publish to the Nextcloud app store: signing certificate, release workflow that builds and uploads the tarball (2026-11-09)
