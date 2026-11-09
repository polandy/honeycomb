# Conventions

The rules every change follows, in PHP, TypeScript and Vue alike. The stack's tools and idioms
are in [`03-coding-standards.md`](03-coding-standards.md); test procedure and coverage gates are
in [`02-workflow.md`](02-workflow.md) §2.3. Each rule that a tool checks names the tool; the rest
are checked in review (`pr-review`). Where Stella, JIT-Pack and glissando disagreed, the choice
is logged in [`decisions.md`](decisions.md).

## 1. Design

- **Single responsibility.** A module, class or component has one reason to exist and one to
  change. Dependencies point inward: components and controllers call logic and services, never
  the other way, and never into a sibling's internals.
- **Small public surface.** Private by default; export or make `public` on purpose. PHP classes
  are `final`, properties `private` (`readonly` where possible). A TypeScript export that nothing
  imports loses `export`; psalm's `findUnusedCode` does this for PHP.
- **Testability decides where code goes.** Decisions live in pure functions (TypeScript
  `src/logic/`, ADR 0006); I/O stays at thin edges (controllers, services over `OCP\Files`,
  stores calling `@nextcloud/axios`). Everything with a side effect — files, database, clock,
  randomness, ids — enters through the constructor or a parameter, never as a global or a static.
  Checked: ESLint bans `vue`, `pinia`, `@nextcloud/*`, `axios`, `Date.now()`, `new Date()` and
  `Math.random()` in `src/logic/`; psalm forbids `time`, `date`, `rand`, `random_int` and friends
  in PHP (use `OCP\AppFramework\Utility\ITimeFactory`, `OCP\Security\ISecureRandom`).
- **Small units.** A function does one thing; a source file has at most 300 lines (`.php`, `.ts`,
  `.vue`, `.js`, `.sh`; `scripts/source-sizes.sh`). Over the limit, split along a seam: a pure
  helper, a child component, a service, one test file per behaviour group.
- **DRY.** One owner per rule, constant and string: the shared components and key map of
  [`plan.md`](plan.md#shared-ui-components) before a new one, one module per concept, no logic
  duplicated between grid, loupe and series compare. Docs point to each other instead of
  restating.
- **No ordering races.** "Which async thing finished first" becomes state (a settled flag, a
  latch, replay on subscribe), never a one-shot event a late listener can miss.
- **YAGNI.** No code "for later", no dead code, no commented-out code.

## 2. Names, constants and comments

- **Names say what.** A longer clear name beats a short one; use the
  [glossary](04-glossary.md)'s words. TypeScript files `kebab-case.ts`, components
  `PascalCase.vue`, types `PascalCase`, functions and variables `camelCase`, true constants
  `UPPER_SNAKE_CASE`. PHP follows PSR-4: one class per file, `PascalCase` classes, `camelCase`
  methods.
- **No magic strings or numbers.** A literal gets a named constant when it is compared or
  switched on, repeated across files, a threshold with a reason (`MAX_LISTING_ENTRIES`, not
  `20000`) or an index with meaning. The constant lives in the module that owns the concept,
  never in a `constants` grab-bag. A literal may stay when it is used once where it matters, is
  `0`, `1` or `-1` arithmetic, is a test's expected value, or is a wire or storage key.
- **Comments say why**, one line at most, describe the current state (no "used to", no dates)
  and only where something non-obvious would be missed. Rationale goes into an ADR or this
  folder; a comment points to it (`ADR 0006`) instead of repeating it.
- **Doc comments on the public surface:** every exported TypeScript function, class and type and
  every public PHP method of a service gets a one-line `/** … */` stating what it promises.
  Types carry the parameters, so no `@param` lines unless a parameter needs a why. Checked for
  TypeScript functions by `jsdoc/require-jsdoc` (`@nextcloud/eslint-config`).

## 3. Errors and logging

- **Fail loud.** Validate at the boundary (every request parameter, every path from the client,
  every XMP field read) and throw on invalid state. No empty `catch` (`no-empty`), and no catch
  that turns an unexpected error into success.
- **Typed errors.** PHP: a domain exception per service (`PictureNotFoundException`), mapped to
  an HTTP status in the controller only; never a bare `\Exception`. TypeScript: `Error`
  subclasses or a result union for expected outcomes; check by type, never by message text.
- **Actionable messages** name the file or key, the bad value and what to do instead; no
  secrets, tokens or file contents.
- **Raw error text never reaches the user.** The UI maps a failure to a translated sentence with
  a way out (`@nextcloud/dialogs`, `t()`); the raw error goes to the log.
- **Log, don't discard.** An error that is caught and handled on a path that changes files or
  stored decisions is logged. PHP logs through the injected `Psr\Log\LoggerInterface` with a
  context array (`['fileId' => $id]`), never through `error_log` or output (psalm forbids
  `var_dump`, `print_r`, `error_log`); the frontend never uses `console` (`no-console`) and logs
  through `@nextcloud/logger` from M2.1. Levels: `error` for a failed user action, `warning` for
  a recovered one, `debug` for tracing; never log a file's contents.
- **Promises are awaited or explicitly `void`ed** (`@typescript-eslint/no-floating-promises`,
  `no-misused-promises`).

## 4. Types and safety

- **No `any`** (`@typescript-eslint/no-explicit-any`): `unknown` plus narrowing at the
  boundary. Make illegal states unrepresentable (discriminated unions, `readonly`).
- TypeScript runs `strict` with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noImplicitOverride`, `noImplicitReturns` and `noFallthroughCasesInSwitch` (`tsconfig.json`);
  linting is type-aware (`typescript-eslint` project service).
- PHP: `declare(strict_types=1)`, typed properties, parameters and returns, `#[\Override]` on
  overrides, psalm at `errorLevel="1"` over `lib/`, `templates/` and `tests/php/`.
- No HTML from strings: no `innerHTML`/`outerHTML` (`no-restricted-properties`), no `v-html`
  (`vue/no-v-html`).
- PHP never touches the file system or a shell: psalm forbids `fopen`, `file_get_contents`,
  `unlink`, `rename`, `exec` and the rest (`psalm.xml`); files go through `OCP\Files` (CLAUDE.md
  rule 1).

## 5. Tests

The procedure — test first as its own commit, layers, coverage gate — is
[`02-workflow.md`](02-workflow.md) §2.3. How tests are written:

- **Names are specifications.** A failing test's name alone says which rule broke
  (`rejects a path outside the user's folder`).
- **Failure paths** are tested wherever code enforces a rule: a foreign path, a vanished file, a
  conflict, no permission, a malformed sidecar.
- **Table-driven** for logic (`it.each`, PHPUnit data providers); assert behaviour through the
  public surface, not internals.
- **Prove it can fail:** watch the new test go red once before it goes green; for a fix, revert
  it and see exactly that case fail.
- **Absence needs a positive control:** first assert what must still be there, then what is
  gone.
- **Fakes:** TypeScript tests use hand-written fakes behind the injected seams, no `vi.mock` of
  our own modules. PHPUnit uses `createStub` for `OCP` interfaces and `createMock` only to verify
  a call.
- **Deterministic:** no sleep, no timer, no wall clock, no network, no shared state. Checked:
  ESLint bans `setTimeout`, `setInterval`, `Date.now()`, `new Date()` and `waitForTimeout` in
  `tests/`; psalm forbids `sleep` and `usleep`; Vitest restores mocks, globals and env after each
  test; PHPUnit runs in random order (`phpunit.xml`, the seed is printed). Code that a test can
  only check by waiting gets a seam or a settled-state signal instead.
- **Playwright** locates by role, label or text; `data-testid` only for purely visual parts.

## 6. Dependencies

- Platform and Nextcloud APIs first; a new dependency needs a one-line reason in the pull
  request, an ADR when it is large or runs at request time (CLAUDE.md rule 6).
- Exact versions only, locked and frozen (`composer install`, `npm ci`, `save-exact` in
  `.npmrc`); Actions by full commit SHA, images by digest. Checked by `scripts/pins.sh`.

## 7. Where each gate runs

| Gate | Tool | Runs in |
|---|---|---|
| Format, style, Vue and TypeScript rules above | ESLint (`eslint.config.mjs`) | `TypeScript` job |
| Types | `tsc` | `TypeScript` job |
| Gates of `eslint.config.mjs` themselves | Vitest `tests/js/conventions/` | `TypeScript` job |
| PHP format (PSR-12 via `nextcloud/coding-standard`) | php-cs-fixer | `PHP` job |
| PHP types, unused code, forbidden functions | psalm (`psalm.xml`) | `PHP` job |
| File size, pins | `scripts/source-sizes.sh`, `scripts/pins.sh` | `Convention gates` job |

All of them run locally through `scripts/verify.sh`.
