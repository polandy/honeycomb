# 3. Coding standards

Read the section you touch. Tools named here join `scripts/verify.sh` and CI in the milestone
that brings the first file of their kind ([`plan.md`](plan.md#milestones)).

## 3.1 General

- Small units; each function does one thing and its name says what.
- Comments say *why*, one line at most, only where something non-obvious would be missed.
  Rationale and cross-references go into this folder or an ADR.
- Comments describe the current state, never history ("used to", "no longer", dates).
- No magic strings or numbers; constants with names.
- Use the words of the [glossary](04-glossary.md).
- New dependency: a one-line justification in the pull request and an ADR when it is large or
  runs at request time. Exact versions, lock files committed (`composer.lock`,
  `package-lock.json`), frozen installs (`composer install`, `npm ci`).

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
- Errors: domain exceptions per service; controllers map them to HTTP status codes.
- Tools: `nextcloud/coding-standard` through php-cs-fixer, psalm (with `nextcloud/ocp` stubs) at
  the level set in `psalm.xml`, PHPUnit for tests under `tests/php/`.

## 3.3 TypeScript and Vue

- TypeScript in strict mode; no plain `.js` sources.
- The rules live in pure modules under `src/logic/`: no DOM, no network, no `@nextcloud/*`
  imports, time and randomness injected. Components and stores call them and only wire the
  result to the DOM and the API (ADR 0006).
- Vue with `@nextcloud/vue` components, `@nextcloud/axios` for requests, `@nextcloud/router` for
  URLs, `@nextcloud/l10n` (`t('honeycomb', …)`) for every user-visible string,
  `@nextcloud/dialogs` for the file picker.
- Build with `@nextcloud/vite-config`; output in `js/` (not committed).
- Colours, spacing and radii from Nextcloud's CSS variables (`--color-primary-element`,
  `--color-main-background`, …), so light, dark and custom themes work. The brand colours appear
  only in the app icon and logo.
- Touch-first: hit targets at least 44 × 44 px, nothing reachable only by hover, pointer events
  for gestures, every action also reachable by keyboard.
- Tools: `@nextcloud/eslint-config` through eslint, `tsc --noEmit`, Vitest with coverage and
  `@vue/test-utils` for tests under `tests/js/`, Playwright under `tests/e2e/`.

## 3.4 Formatting

The PostToolUse hook `.claude/hooks/format-file.sh` formats each file an agent edits: PHP with
php-cs-fixer, JS/TS/Vue with `eslint --fix`. It is silent until `composer.json` or `package.json`
exists, reports a missing tool once per session, and skips `vendor/`, `node_modules/`, `js/` and
the mockup. Markdown is written by hand and checked by markdownlint (`.markdownlint-cli2.jsonc`).

## 3.5 Licensing

Every file carries an SPDX header (`AGPL-3.0-or-later`, `2026 honeycomb contributors`) or is
listed in `REUSE.toml`. `reuse lint` in `scripts/verify.sh` checks it.
