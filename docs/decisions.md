# Decisions

Smaller decisions made during implementation, one dated line each; larger ones become an
[ADR](adr/).

- 2026-11-10: CI skips a job whose paths a pull request does not touch. `scripts/ci-changes.sh`
  maps the changed files (GitHub API, no deep checkout) to the groups `markdown`, `php`, `ts` and
  `app`; an unknown path or a push to `main` turns everything on, so a skip is never a guess.
- 2026-11-10: The single required check is `CI gate`. It always runs and fails only when a job
  failed or was cancelled, so a skipped job counts as passed and the merge gate keeps every check.
  Each new CI job (PHP, TypeScript, build, e2e) joins the gate's `needs` and takes its group's
  `if:` from `changes`.
- 2026-11-10: REUSE lint always runs, because any new file can lack a header; it takes seconds.
- 2026-11-10: Superseded runs of the same pull request are cancelled (`concurrency` in `ci.yml`,
  never on `main`).
- 2026-11-10: One setup per toolchain instead of one per tool: a `PHP` job per version runs
  php-cs-fixer (8.3 only, formatting does not depend on the version), psalm and PHPUnit after a
  single `composer install`, and one `TypeScript` job runs eslint, tsc and Vitest after a single
  `npm ci`. Ten jobs become five, and a failing step still names the tool.
- 2026-11-10: Composer's download cache is kept with `actions/cache` keyed on `composer.lock`; npm
  uses `setup-node`'s `cache: npm`. The first run after a lock change refills them.
- 2026-11-10: Build and e2e (M2.1) take the `app` group and join the gate's `needs`.
- 2026-11-10: Conventions from Stella, JIT-Pack and glissando are consolidated in
  `conventions.md` (every language) beside `03-coding-standards.md` (stack idioms), so neither
  repeats the other.
- 2026-11-10: Source files have at most 300 lines (glissando) rather than 800 with a ratchet
  (JIT-Pack) or no limit (Stella). One script covers PHP, TypeScript, Vue and shell alike,
  which ESLint's `max-lines` cannot.
- 2026-11-10: No Prettier, which all three use: `@nextcloud/eslint-config` already formats
  TypeScript and Vue with its stylistic rules, and the two would fight.
- 2026-11-10: No `no-magic-numbers` lint rule (JIT-Pack rejected it for firing on one-off
  geometry); the named-constant rule is checked in review.
- 2026-11-10: Doc comments on exports are required (Stella, JIT-Pack; glissando has no rule), one
  line each; `jsdoc/require-param` is off because the types carry the parameters.
- 2026-11-10: Type-aware linting through `typescript-eslint` as a direct dev dependency, pinned to
  the version `@nextcloud/eslint-config` already pulls in; it adds `no-floating-promises` and
  `no-misused-promises` (glissando).
- 2026-11-10: `tsconfig.json` adds glissando's `noImplicitOverride` and
  `noFallthroughCasesInSwitch`, plus `noImplicitReturns`.
- 2026-11-10: Hand-written fakes in TypeScript (all three), but PHPUnit test doubles for `OCP`
  interfaces: they are Nextcloud's convention and the interfaces too wide to fake by hand.
- 2026-11-10: The coverage gate stays at 95 % lines and 90 % branches for `src/logic/`, stricter
  than JIT-Pack's 75 % and the others' none; no mutation tool, a fix is reverted once by hand.
- 2026-11-10: PHPUnit runs in random order and prints the seed; Vitest restores mocks, globals
  and env after each test instead of shuffling, so a failure stays reproducible.
- 2026-11-10: psalm checks `tests/php/` too and forbids file-system, shell, clock, randomness and
  debug-output functions, so CLAUDE.md rule 1 and the injected seams are checked, not only read.
- 2026-11-10: `scripts/pins.sh` checks exact versions, Action SHAs and image digests (glissando
  `pins.sh`); the composer image in `scripts/php.sh` is pinned by digest. `nextcloud/ocp` stays on
  `dev-stable35`, the branch Nextcloud publishes, locked by `composer.lock`.
- 2026-11-10: The convention gates run in their own always-on CI job; they need no setup and take
  seconds.
- 2026-11-10: The listing is `GET /api/v1/entries?path=…&subfolders=1` rather than a path
  segment in the URL, so the root folder and names with `#`, `?` or `%` need no special route
  (ADR 0009).
- 2026-11-10: The listing caps at 60,000 entries, not 20,000: the server does not pair, and
  20,000 pictures of a RAW, a JPEG and a sidecar each are 60,000 files. The client applies the
  20,000-picture cap after pairing.
- 2026-11-10: The subfolder search pages by file id in pages of 5,000 and reads metadata in
  batches of 1,000 ids, so memory stays flat and no `IN` list exceeds a database's limit.
- 2026-11-10: Hidden names are skipped too, not only hidden folders, so macOS `._IMG_0001.JPG`
  files never pose as pictures; a hidden folder the user picks on purpose is listed.
- 2026-11-10: EXIF basics come from the Photos app's metadata keys; without them the fields are
  `null` and the client falls back to `mtime`. Width and height come only as a pair.
- 2026-11-10: The listing's per-folder shared flag moves from M1.2 to M5, the first item that
  acts on it; detecting outgoing shares needs `OCP\Share\IManager` and its own tests.
- 2026-11-10: In *separate subfolders*, a file whose folder is named like the RAW or the rendered
  subfolder pairs in the parent folder, together with the parent's own files; its role still
  comes from its extension. Other folders keep pairing side by side.
- 2026-11-10: A sidecar belongs to the member whose file name it carries (exactly, else ignoring
  case when only one member matches), else to a darktable duplicate's member, else as shared
  `<base>.xmp` to the picture of that base name. An ambiguous base name shares no `<base>.xmp`,
  so deleting one of its singles never removes a sidecar the others still use.
- 2026-11-10: Pairing ignores files outside both extension lists, names without a base name
  (`.JPG`) and sidecars without an owner. An extension in both lists, `xmp` or an empty one in
  a list is a settings error, since a file's role would be undefined.
- 2026-11-10: The pairing vectors (`tests/fixtures/pairing/vectors.json`) mark each case with
  `sharedWithFramehive`; the others follow rules where honeycomb differs from LIBRARY-001
  (case-insensitive base names, separate subfolders, darktable duplicates).
- 2026-11-10: The frontend loads one script, `js/honeycomb-main.mjs`, added in
  `templates/main.php`; `@nextcloud/vite-config` inlines the CSS into it (`inlineCSS`), so no
  `Util::addStyle` is needed. `Util::addScript` is static and cannot run in PHPUnit, so the
  template calls it and the e2e case covers it.
- 2026-11-10: The skeleton shows the mockup's empty state *No folder chosen* / *Pick a folder to
  start culling.* in `NcEmptyContent`, until the folder picker arrives with M2.3.
- 2026-11-10: Vue errors reach `@nextcloud/logger` through `app.config.errorHandler`
  (`src/create-honeycomb-app.ts`, logger injected); `src/main.ts` and `src/logger.ts` are wiring
  only, left out of coverage and covered by the e2e case. `src/*.ts` and `src/**/*.vue` keep the
  80 % lines gate of `02-workflow.md` §2.3.
- 2026-11-10: The stub catalogue of ADR 0007 marks every string with a `[de]` prefix through a `Proxy`
  in `@nextcloud/l10n`'s registry, so it needs no list of strings. Components are
  shallow-mounted, so `@nextcloud/vue`'s own English stays out and the props of the stubs, which
  render as attributes, are checked with the attributes of `vue/no-bare-strings-in-template`.
- 2026-11-10: e2e runs one Playwright project, desktop Chromium at 1440 × 900; the reference
  device projects join with the grid (M2.3), when there is a layout to check on them. Nextcloud
  logs a page in only through the login form, not HTTP basic auth, so a setup project logs in
  once and stores the session.
- 2026-11-10: CI builds and runs Playwright in one job, `Build and e2e`, since the e2e case needs
  the bundle and a separate build job would repeat `npm ci`; it uploads the traces when it fails.
  An e2e spec and `playwright.config.ts` also run the `TypeScript` job, which lints them.
- 2026-11-10: e2e never reuses a running server and takes its port from `HONEYCOMB_E2E_PORT`,
  because a server left by another worktree would test the wrong checkout.
