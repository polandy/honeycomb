<!-- markdownlint-disable MD013 -- one line per item, as the /todo skill writes them -->

# Open work

One line per item. A finished item is deleted in the pull request that finishes it; Git keeps
the history. `## Milestones` is ordered — take the first open item that is not in progress and
has no open `needs-owner` issue. Details and open questions: [`docs/plan.md`](docs/plan.md).
Add items with `/todo`.

## Milestones

- [ ] M0: Owner signs off the mockup and answers the open questions — owner; record each answer as an ADR or in `docs/plan.md`, remove its marker from `docs/mockup/index.html` (ADR 0003) (2026-11-09)
- [ ] M1.1: App skeleton — `appinfo/info.xml` (versions per Q1), `composer.json` with php-cs-fixer, psalm, PHPUnit; `Application`; empty page; PHP jobs in CI and `scripts/verify.sh`; `info.xml` in release-please extra files; composer in Dependabot (2026-11-09)
- [ ] M1.2: Pairing service with PHPUnit tests — case, several dots, singles, sidecars, ambiguity (Q14), separate subfolders (Q16), extension lists (Q15); Framehive LIBRARY-001 as test-case reference (2026-11-09)
- [ ] M1.3: Folder API — paginated picture list of a folder through `IRootFolder`, user permissions respected, 2,000+ pairs without stalls (2026-11-09)
- [ ] M1.4: Image endpoint and background previews — immutable URLs keyed by file id + mtime (`Cache-Control`, `ETag`), size tiers 256/512/2048 px, embedded-JPEG preview of RAW-only pictures extracted and cached, Preview Generator or own background job on upload and folder open; ADR first (new endpoint shape, Imaginary optional); budgets measured with real 24 MP files (`docs/plan.md` Image delivery) (2026-11-09)
- [ ] M2.1: Frontend skeleton — Vue, `@nextcloud/vue`, `@nextcloud/vite-config`, eslint, Vitest; JS jobs in CI and `scripts/verify.sh`; npm in Dependabot (2026-11-09)
- [ ] M2.2: Folder picker and virtual-scrolling grid — srcset by tile size × devicePixelRatio, small preview first and sharp swapped in after `img.decode()`, stepless size (slider, Ctrl+wheel, pinch) remembered per device, pair badges; grid scrolls without jank at 2,000+ items (2026-11-09)
- [ ] M2.3: Decision storage — tables and API for rating, colour label and flag per picture and user (Q2, Q20), plus the resume position per folder and user so culling continues on another device; ADR first (2026-11-09)
- [ ] M2.4: Filter bar — rating, colour label, flag, pairing; server-side for large folders (Q8, Q9); scope not rejected (default) / undecided / all and "x of y decided" progress (2026-11-09)
- [ ] M2.5: Selection mode and bulk rate, label and flag (Q10) (2026-11-09)
- [ ] M3.1: Loupe — full screen, swipe, pinch zoom to 100 %, prefetch 2–3 neighbours each way (next image <100 ms), chrome-free mode (F, double-tap), collapsible info panel with draggable divider, collapsible sidebar (2026-11-09)
- [ ] M3.2: Decisions in the loupe — pick/reject buttons, vertical swipe (Q6), rating and label controls, auto-advance to the next undecided picture, "Rejected · Undo" toast (2026-11-09)
- [ ] M3.3: Keyboard shortcuts, undo and redo, shortcut sheet (Q5) (2026-11-09)
- [ ] M4.1: Delete service — members and sidecars into the trash bin through `OCP\Files`, per-file failure report; ADR on pair atomicity first; tests for every failure path (2026-11-09)
- [ ] M4.2: Reject review (grid of rejects, rescue single pictures) and delete summary with pictures · files · bytes freed, from "delete rejected" and from the selection (Q11) (2026-11-09)
- [ ] M4.3: Per-user settings — extensions, folder mode, singles, gestures, auto-advance (2026-11-09)
- [ ] M4.4: README for users — installation, features, screenshot placeholders, recommended apps `camerarawpreviews` and Preview Generator (2026-11-09)
- [ ] M5: XMP sidecars — read on listing, write digiKam's fields (Q2, Q3) (2026-11-09)
- [ ] M6: Series compare — group pictures taken within a short interval, show 2–4 side by side, "keep this, reject the rest" as one undo step (`docs/plan.md` Culling workflow) (2026-11-09)
- [ ] M7.1: Name template service — parse, validate with column, render, sanitise to `[A-Za-z0-9._-]`, fallbacks, collision suffix; tests from `docs/05-name-templates.md` (2026-11-09)
- [ ] M7.2: Move service — ADR on the move API and pair atomicity first; whole picture through `OCP\Files`, conflicts (suffix, skip, replace into the trash bin), undo, per-file failure report (2026-11-09)
- [ ] M7.3: Move dialog and move summary — target picker, favourite and recent targets, conflict choices, undo toast, key `M`, from the selection, the loupe and the filter result (2026-11-09)
- [ ] M7.4: Name template setting with presets and a live preview on 5 sample pictures (2026-11-09)

## Later

- [ ] Create the public repository `polandy/honeycomb-assets` for PR screenshots — owner (`docs/02-workflow.md` §2.7) (2026-11-09)
- [ ] Add a `main` ruleset (pull requests only, CI required) and the `RELEASE_PLEASE_TOKEN` secret — owner (2026-11-09)
- [ ] Publish to the Nextcloud app store: signing certificate, release workflow that builds and uploads the tarball (2026-11-09)
