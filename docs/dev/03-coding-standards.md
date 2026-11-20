# 3. Coding standards

Read the section you touch. Tools named here join `scripts/verify.sh` and CI in the milestone
that brings the first file of their kind ([`plan.md`](plan.md#milestones)).

## 3.1 General

The rules for every language — design, names, constants, comments, errors, logging, tests,
dependencies — are in [`conventions.md`](conventions.md). This file adds the stack's idioms.

## 3.2 PHP

- `declare(strict_types=1);` and an SPDX header in every file. Namespace `OCA\Honeycomb`.
- Nextcloud App Framework: thin controllers, logic in services, constructor injection through
  the DI container, no static state, no `\OC\` (private) classes — only `OCP\`.
- Files only through `OCP\Files\IRootFolder` and the user's folder (`CLAUDE.md` rule 1); deleting
  with `Node::delete()`, which moves to the trash bin when the `files_trashbin` app is enabled.
- The backend stays thin (ADR 0006): list, move, trash, write XMP bytes, store per-user data,
  serve previews. Every path or file id from the client is rechecked — owned by the user, still
  exists, unchanged since the client read it — before anything is touched.
- Database access through `QBMapper`/`Entity` and migrations in `lib/Migration/`.
- A new table of rows per file id is a `FileRowStore`, registered in `FileRowStores`; one of rows
  per user is a `UserRowStore`, registered in `UserRowStores`. The vanished-file sweep, the
  clean-up of a deleted user and the carry-over on a move read those lists, so nothing else changes.
- Errors: domain exceptions per service; a malformed request throws a subclass of
  `InvalidRequestException`. Every controller action answers through `ApiResponse::forUser`,
  which answers 401 without a user and maps each known exception to its status. Logging
  through the injected `Psr\Log\LoggerInterface` ([`conventions.md`](conventions.md) §3).
- Classes `final`, properties `private`, constructor property promotion, `#[\Override]` on
  overrides.
- Tools: `nextcloud/coding-standard` (PSR-12 plus Nextcloud's rules) through php-cs-fixer, psalm
  (with the `nextcloud/ocp` stubs of Nextcloud 35 and `forbiddenFunctions`) at the level set in
  `psalm.xml`, PHPUnit for tests under `tests/php/`, and under `tests/php-db/` for the mappers
  and the sidecar save against a real database and real files (`scripts/php-db-tests.sh`, Docker).
  `scripts/php.sh` runs them with the local PHP, or in the pinned composer Docker image.

## 3.3 TypeScript and Vue

- TypeScript in strict mode; no plain `.js` sources.
- The rules live in pure modules under `src/logic/`: no DOM, no network, no `@nextcloud/*`
  imports, time and randomness injected. Components and stores call them and only wire the
  result to the DOM and the API (ADR 0006).
- Vue with `@nextcloud/vue` components, `@nextcloud/axios` for requests, `@nextcloud/router` for
  URLs, `@nextcloud/l10n` (`t('honeycomb', …)`, `n()` for counts) for every user-visible string,
  `Intl` on the user's locale for numbers and dates (ADR 0007),
  `@nextcloud/dialogs` for the file picker.
- Build with `@nextcloud/vite-config`; output in `js/` (not committed).
- Colours, spacing and radii from Nextcloud's CSS variables (`--color-primary-element`,
  `--color-main-background`, …), so light, dark and custom themes work. The brand colours appear
  only in the app icon and logo.
- Touch-first: hit targets at least 44 × 44 px on a coarse pointer and compact (34 px) on a fine
  one ([Control sizes](plan.md#control-sizes)), nothing reachable only by hover, pointer events
  for gestures, every action also reachable by keyboard.
- Render checks run on the [reference devices](plan.md#reference-devices) (Pixel 9 Pro, iPad
  mini A17 Pro and A20 Pro, iPad Pro 11″, each in portrait and landscape, plus desktop
  1440 × 900 and laptop 1470 × 956), not on ad-hoc sizes. `viewport-fit=cover` with
  `env(safe-area-inset-*)` padding: no control under the camera, the status bar or the home
  indicator.
- A tap must not change the page between `touchstart` and its `click`: iOS Safari then treats the
  tap as a hover and drops the click. Re-render in the `click` handler, not in `touchend`.
- Tools: `@nextcloud/eslint-config` plus type-aware `typescript-eslint` rules and the bans of
  [`conventions.md`](conventions.md) through eslint, `vue-tsc`, Vitest with coverage and
  `@vue/test-utils` for tests under `tests/js/`, Playwright under `tests/e2e/`.
- Playwright runs against a fresh Nextcloud container (`scripts/e2e-server.sh`) with this
  checkout mounted as the app: the newest supported release, or with
  `HONEYCOMB_E2E_NEXTCLOUD=oldest` the first release of `min-version`
  (`scripts/nextcloud-images.sh`, images pinned by digest); a setup project logs in once through the
  login form and shares the session. The container runs background jobs only through `occ`
  (`backgroundjobs_mode` is `cron`, and no cron runs): a job in a page request, such as core's
  metadata scan, keeps the shared locks of the files it read until it ends, and a trash or move
  meanwhile finds them locked. Cases use `reducedMotion: 'reduce'` and wait on a visible
  state. Each run starts its own container on `HONEYCOMB_E2E_PORT` (default 8180) and the upgrade test
  on `HONEYCOMB_UPGRADE_PORT` (default 8190). `scripts/verify.sh` runs both e2e runs, the upgrade test
  and the `phpunit db` tests at once; the oldest-Nextcloud run takes `HONEYCOMB_E2E_OLDEST_PORT`
  (default the e2e port plus 1000); `scripts/verify.sh` moves each of the three to the next free
  port when it is busy ([workflow §2.4](02-workflow.md#24-before-opening)). The port names the
  container (`scripts/e2e-names.sh`) and a non-default port the output folder
  `test-results-<port>/`, so parallel runs, e.g.
  `HONEYCOMB_E2E_PORT=8380 HONEYCOMB_UPGRADE_PORT=8390 scripts/verify.sh` in a second worktree,
  share nothing and never remove each other's container.
- **WebKit smoke subset.** The iPad is the target device and every iPad browser is WebKit, so with
  `HONEYCOMB_E2E_WEBKIT=1` (set in CI, not in `scripts/verify.sh`: WebKit's system libraries are
  missing on some hosts) a `webkit` project runs the cases tagged `{ tag: WEBKIT }`
  (`tests/e2e/webkit.ts`) in Desktop Safari at 1440 × 900. The subset is one case each for the
  grid, the loupe, delete and move: the flows where Safari differs (pointer events, layout of the
  stage, dialogs, `fetch` and cookies) and a failure costs photos. Chromium keeps every other case;
  iPad widths and touch stay emulated there. Add the tag to a case that exercises a Safari-specific
  API, never to a case only to widen the subset.
- Every Vue component is checked with the marked stub catalogue of
  `tests/js/l10n/marked-catalogue.ts`: shallow-mount it with `renderStubDefaultSlot`, and expect
  `untranslatedText()` to return nothing (ADR 0007, *Checks*).

## 3.4 Formatting

The PostToolUse hook `.claude/hooks/format-file.sh` formats each file an agent edits: PHP with
php-cs-fixer, JS/TS/Vue with `eslint --fix`. It is silent until `composer.json` or `package.json`
exists, reports a missing tool once per session, and skips `vendor/`, `node_modules/`, `js/` and
the mockup. Markdown is written by hand and checked by markdownlint (`.markdownlint-cli2.jsonc`).

## 3.5 Licensing

Every file carries an SPDX header (`AGPL-3.0-or-later`, `2026 honeycomb contributors`) or is
listed in `REUSE.toml`. `reuse lint` in `scripts/verify.sh` checks it.
