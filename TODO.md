<!-- markdownlint-disable MD013 -- one line per item, as the /todo skill writes them -->

# Open work

One line per item. A finished item is deleted in the pull request that finishes it; Git keeps
the history. `## Milestones` is ordered — take the first open item that is not in progress and
has no open `needs-owner` issue. Details and open questions: [`docs/plan.md`](docs/plan.md).
Add items with `/todo`.

## Milestones

- [ ] M0: Owner signs off the mockup and answers the open questions — owner; record each answer as an ADR or in `docs/plan.md`, remove its marker from `docs/mockup/index.html` (ADR 0003) (2026-11-09)
- [ ] Brand assets, proposal B "Gerahmtes Paar" — `assets/brand/generate.py` modelled on Framehive's: Framehive's six viewfinder corners (same path as its `logo-mark.svg`) around two pointy-top hex cells side by side, left filled Honey `#F4A51C`, right an outline in Ink/Paper; wordmark "honeycomb" in Sora SemiBold, lower case, −0.03 em, outlined; mark, horizontal logos (light/dark), app icon, a heavier favicon cut for 16 px, `img/app.svg` and `img/app-dark.svg` for Nextcloud; `assets/brand/README.md` with the brand rules (2026-11-09)
- [ ] M1.1: App skeleton — `appinfo/info.xml` (versions per Q1), `composer.json` with php-cs-fixer, psalm, PHPUnit; `Application`; empty page; PHP jobs in CI and `scripts/verify.sh`; `info.xml` in release-please extra files; composer in Dependabot (2026-11-09)
- [ ] M1.2: Pairing service with PHPUnit tests — case, several dots, singles, sidecars, ambiguity (Q14), separate subfolders (Q16), extension lists (Q15); Framehive LIBRARY-001 as test-case reference (2026-11-09)
- [ ] M1.3: Folder API — paginated picture list of a folder through `IRootFolder`, user permissions respected, 2,000+ pairs without stalls (2026-11-09)
- [ ] M2.1: Frontend skeleton — Vue, `@nextcloud/vue`, `@nextcloud/vite-config`, eslint, Vitest; JS jobs in CI and `scripts/verify.sh`; npm in Dependabot (2026-11-09)
- [ ] M2.2: Folder picker and virtual-scrolling grid with preview thumbnails and pair badges (2026-11-09)
- [ ] M2.3: Decision storage — tables and API for rating, colour label and flag per picture and user (Q2, Q20) (2026-11-09)
- [ ] M2.4: Filter bar — rating, colour label, flag, pairing; server-side for large folders (Q8, Q9) (2026-11-09)
- [ ] M2.5: Selection mode and bulk rate, label and flag (Q10) (2026-11-09)
- [ ] M3.1: Loupe — full screen, swipe, pinch, double-tap 100 %, preloading (Q19) (2026-11-09)
- [ ] M3.2: Decisions in the loupe — pick/reject buttons, vertical swipe (Q6), rating and label controls, auto-advance (Q7) (2026-11-09)
- [ ] M3.3: Keyboard shortcuts, undo and redo, shortcut sheet (Q5, Q12) (2026-11-09)
- [ ] M4.1: Delete service — members and sidecars into the trash bin through `OCP\Files`, per-file failure report; ADR on pair atomicity first; tests for every failure path (2026-11-09)
- [ ] M4.2: Delete summary dialog — from the selection and from "delete rejected" (Q11) (2026-11-09)
- [ ] M4.3: Per-user settings — extensions, folder mode, singles, gestures, auto-advance (2026-11-09)
- [ ] M4.4: README for users — installation, features, screenshot placeholders, recommended apps `camerarawpreviews` and Preview Generator (2026-11-09)
- [ ] M5: XMP sidecars — read on listing, write digiKam's fields (Q2, Q3) (2026-11-09)

## Later

- [ ] Create the public repository `polandy/honeycomb-assets` for PR screenshots — owner (`docs/02-workflow.md` §2.7) (2026-11-09)
- [ ] Add a `main` ruleset (pull requests only, CI required) and the `RELEASE_PLEASE_TOKEN` secret — owner (2026-11-09)
- [ ] Publish to the Nextcloud app store: signing certificate, release workflow that builds and uploads the tarball (2026-11-09)
