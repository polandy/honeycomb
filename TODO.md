<!-- markdownlint-disable MD013 -- one line per item, as the /todo skill writes them -->

# Open work

One line per item. A finished item is deleted in the pull request that finishes it; Git keeps
the history. `## Milestones` is ordered — take the first open item that is not in progress and
has no open `needs-owner` issue. Details and open questions: [`docs/plan.md`](docs/plan.md).
Add items with `/todo`.

## Milestones

- [ ] M0: Owner signs off the mockup — owner; the open questions are answered, what remains is listed in `docs/plan.md` M0 (ADR 0003) (2026-11-09)
- [ ] M1.1: App skeleton — `appinfo/info.xml` (Nextcloud 35 only, PHP 8.3+), `composer.json` with php-cs-fixer, psalm, PHPUnit; `Application`; empty page; `package.json` with TypeScript, eslint, Vitest and the coverage gate (logic 95 % lines / 90 % branches); PHP jobs on PHP 8.3 and 8.5 against Nextcloud 35 and TypeScript jobs in CI and `scripts/verify.sh`; `info.xml` and `package.json` in release-please extra files; `.tx/config`, `l10n/.gitkeep`, `.l10nignore` (ADR 0007); composer and npm in Dependabot (2026-11-09)
- [ ] M1.2: Listing backend — one file-cache query by path prefix and mime type, flat entries (file id, path, size, mtime, ETag, mime type, EXIF basics) of the user's folder set — `?subfolders=1` skips hidden, trash and preview folders, cap 20,000 (`docs/plan.md` Multiple folders) — no pairing on the server; PHPUnit incl. foreign path, vanished folder, no permission; 2,000+ pairs without stalls (ADR 0006) (2026-11-09)
- [ ] M1.3: Pairing module in TypeScript — case, several dots, singles, sidecars, ambiguity (Q14), separate subfolders (Q16), extension lists (Q15); Vitest on test vectors shared with Framehive (LIBRARY-001) (2026-11-09)
- [ ] M2.1: Frontend skeleton — Vue, `@nextcloud/vue`, `@nextcloud/vite-config` build; `@nextcloud/l10n` and the checks that no user-visible string bypasses `t()` (ADR 0007); Playwright e2e against a real Nextcloud container (no timing waits); build and e2e jobs in CI and `scripts/verify.sh` (2026-11-09)
- [ ] M2.2: Image endpoint and background previews — immutable URLs keyed by file id + mtime (`Cache-Control`, `ETag`), size tiers 256/512/2048 px, embedded-JPEG preview of RAW-only pictures extracted and cached, Preview Generator or own background job on upload and folder open; ADR first (new endpoint shape, Imaginary optional); budgets measured with real 24 MP files (`docs/plan.md` Image delivery) (2026-11-09)
- [ ] M2.3: Folder picker (a checkbox per folder, *Include subfolders*, photo count) and virtual-scrolling grid (*Group by folder* headers) — srcset by tile size × devicePixelRatio, small preview first and sharp swapped in after `img.decode()`, stepless size (slider, Ctrl+wheel, pinch) remembered per device, pair badges; grid scrolls without jank at 2,000+ items (2026-11-09)
- [ ] M2.4: Decision storage — tables and API for rating, colour label and flag per picture and user (Q2, Q20), plus the resume position per folder set and user so culling continues on another device; ADR first (2026-11-09)
- [ ] M2.5: Filter bar — rating, colour label, flag, pairing, folder and sort as pure TypeScript modules (Q8, Q9, Q18; sort by file name or capture time with the fallback in `docs/plan.md` Sort order); scope not rejected (default) / undecided / all and "x of y decided" progress (2026-11-09)
- [ ] M2.6: Selection mode and bulk rate, label and flag (Q10) (2026-11-09)
- [ ] M3.1: Loupe — full screen, swipe, pinch zoom to 100 %, prefetch 2–3 neighbours each way (next image <100 ms), chrome-free mode (F, double-tap), collapsible info panel with draggable divider, collapsible sidebar (2026-11-09)
- [ ] M3.2: Decisions in the loupe — pick/reject buttons, vertical swipe (Q6), rating and label controls, auto-advance to the next undecided picture, "Rejected IMG_0001 · Undo" toast; built from the shared components (`docs/plan.md` Shared UI components) (2026-11-09)
- [ ] M3.3: Keyboard shortcuts per the shared key map (`docs/plan.md` Keyboard shortcuts), undo and redo, shortcut sheet (Q5) (2026-11-09)
- [ ] M4.1: Delete service — members and sidecars into the trash bin through `OCP\Files`, per-file failure report; ADR on pair atomicity first; tests for every failure path (2026-11-09)
- [ ] M4.2: Reject review (grid of rejects, rescue single pictures) and delete summary with pictures · files · bytes freed, from "delete rejected" and from the selection (Q11) (2026-11-09)
- [ ] M4.3: Per-user settings — extensions, folder mode, singles, gestures, auto-advance (2026-11-09)
- [ ] M4.4: README for users — features, installation brought up to date, screenshot placeholders, recommended apps `camerarawpreviews` and Preview Generator (2026-11-09)
- [ ] M5: XMP sidecars — read on listing, write per `docs/06-xmp-interop.md`; mapping in TypeScript, backend writes the bytes; ADR on the TypeScript XML library first (Q3) (2026-11-09)
- [ ] M6: Series compare — group pictures taken within a short interval, show 2–4 side by side, Pick / Reject / Unflag per photo and "Pick this, reject the rest" as one undo step, from the shared components (`docs/plan.md` Culling workflow) (2026-11-09)
- [ ] M7.1: Name template module in TypeScript — parse, validate with column, render, sanitise to `[A-Za-z0-9._-]`, fallbacks, collision suffix; tests from `docs/05-name-templates.md` (2026-11-09)
- [ ] M7.2: Move — ADR on the move API and pair atomicity first; backend moves the whole picture through `OCP\Files` and rechecks every path, conflicts (suffix, skip, replace into the trash bin) resolved in TypeScript, undo, per-file failure report (2026-11-09)
- [ ] M7.3: Move dialog and move summary — target picker, favourite and recent targets, conflict choices, undo toast, key `M`, from the selection, the loupe and the filter result (2026-11-09)
- [ ] M7.4: Name template setting with presets and a live preview on 5 sample pictures (2026-11-09)

## Later

- [ ] Join Nextcloud's Transifex sync — owner; steps and the ruleset question in issue #17 (ADR 0007) (2026-11-09)
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
- [ ] Publish to the Nextcloud app store: signing certificate, release workflow that builds and uploads the tarball (2026-11-09)
