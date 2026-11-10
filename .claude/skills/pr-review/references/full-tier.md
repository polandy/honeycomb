# PR review — Full tier, §1–§5 in depth

Opened by `SKILL.md` only when its tier is **Full**. Work through §1–§5 in order, then return to
`SKILL.md` for §6–§9. The §4.0 table lives in `SKILL.md`; build it before §4.

## 1. Docs move with the change

Every behaviour change is reflected in its doc **in the same pull request**, never as a follow-up
(`docs/02-workflow.md` §2.4). Open the section the change owns, not the file.

| Change | Doc that moves with it |
|---|---|
| Any observable behaviour | its spec in `docs/specs/` and the `// spec:` markers (ADR 0015) |
| Culling behaviour, filters, sort, series, gestures, keys | its section of `docs/plan.md` |
| A word, an icon, a colour or an order in the UI | `docs/04-glossary.md` |
| XMP fields, precedence, write rules | `docs/06-xmp-interop.md`, and its test vectors |
| Name templates | `docs/05-name-templates.md` |
| Something a user does or sees differently | `docs/user/`, and `README.md` if it is on the front page |
| Tools, test layers, procedure | `docs/conventions.md`, `docs/03-coding-standards.md`, `docs/02-workflow.md`, `CLAUDE.md` |
| An architectural choice | a new ADR in `docs/adr/` |
| A smaller decision taken on the way | one dated line in `docs/decisions.md` |
| A finished item | its line deleted from `TODO.md` |

- Check the reverse too: no doc still describes behaviour the pull request removed or changed. A
  stale sentence is a finding.
- **User docs are promises.** `docs/user/` and the README are read by someone deciding whether to
  trust the app with their only copy of a photo. A changed key, default or screen that leaves them
  describing the old behaviour has published something untrue.

## 2. Decisions

- An architectural choice — storage format, new dependency, new table, public API shape — needs an
  ADR (CLAUDE.md rule 6) with its options and the reason for the one taken. Its decision section
  matches what the code does.
- A smaller tradeoff the author decided alone (the owner's overnight rule) is one dated line in
  `docs/decisions.md` and in the PR body. Additive fields, a route following an existing pattern
  and mechanical refactors need neither.
- A pull request that contradicts an ADR or a logged decision changes it explicitly, or changes
  itself.

## 3. Implementation quality

Apply `CLAUDE.md`, `docs/conventions.md` and `docs/03-coding-standards.md` to the diff rather than
re-deriving them. Flag freshly introduced violations.

- **Files only through `OCP\Files`** (rule 1): no `fopen`, `file_put_contents`, `unlink`, `rename`,
  `scandir` or `\OC\` class on user data. One direct file-system call is a **blocker**.
- **Deleting moves to the trash bin and acts on a whole pair** (rule 2): JPEG, RAW and sidecars
  together through `Node::delete()`; a partial failure is reported per file and leaves a traceable
  state. A pair split by a half-done delete is a blocker.
- **Thin backend, every path rechecked** (ADR 0006): the controller maps, the service acts; every
  path or file id from the client is checked — owned by the user, still exists, unchanged since the
  client read it (ETag, size) — in `PathGuard` and nowhere else. A rule that branches on photo
  content in PHP (pairing, series, filters) belongs in `src/logic/`.
- **`src/logic/` is pure**: no DOM, no network, no `@nextcloud/*`, no `Date.now()`, `new Date()` or
  `Math.random()` — the clock and randomness are injected. One such import destroys the testability
  the folder exists for.
- **Single responsibility and a clear cut**: one module, one job, its name says which. A component
  that decides (sorting, pairing, which picture is next) instead of calling a `src/logic/` function
  is a finding even when a component test covers it.
- **Encapsulation — small public surfaces**: a module exports only what its consumers use; nothing
  is exported only for a test (test through the public function). Components talk through props,
  events and store actions, never by reaching into another component's or store's internals. PHP
  services keep helpers private and take collaborators by constructor injection, no setters, no
  static state.
- **DRY — shared components and one key map**: the grid, the loupe and the series viewer build a
  decision from the shared components (`docs/plan.md` Shared UI components) and one key map
  (`hotkeys`); a near-copy of a component with a tweak, a second key table, or one rule
  re-implemented per screen is a finding. A variant is a prop, not a copy.
- **Breaking changes and the upgrade path.** Ask every time: does an existing installation, a
  stored row, or a sidecar on the user's disk break against this change? XMP bytes are read by
  digiKam, darktable and Lightroom: a change to what or how honeycomb writes keeps every property
  it does not own (`docs/06-xmp-interop.md` Writing) and is shown by a fixture. A migration is
  additive (`lib/Migration/`); a change in a stored column's meaning needs a written upgrade step.
  The verdict says which case applies.
- Strict types (`declare(strict_types=1);`, TypeScript strict, no `any`); domain exceptions
  mapped to HTTP status codes in the controller; no swallowed error on a path that writes, moves
  or trashes.
- No magic string or number, no dead code kept "for later", no global mutable state.
- **Comments**: one line, the *why*; flag comments that narrate the change, restate the code,
  carry history, or duplicate an ADR's rationale.
- **New dependency**: a one-line justification, an ADR when it is large or runs at request time,
  an exact version, the lock file committed and never edited by hand (rule 5).

## 4. Tests

Test first is non-negotiable (rule 4): every new behaviour has a driving test, every fix a test
that fails without it.

- **Proof of red.** Beyond the commit order in §4.0, mutation-prove the case that owns the pull
  request's headline behaviour: revert the production lines (or check out the `test:` commit), run
  that case alone, watch it fail, restore. A case that stays green is not a test, whatever its name
  says. Playwright drives a built bundle: rebuild between the two runs.
- **Naming as specification**: the name says which rule would break
  (`keeps the pair together when the RAW is missing`, not `test pairing 2`).
- **The right layer** (ADR 0006, `docs/02-workflow.md` §2.3): Vitest for `src/logic/` and, with
  `@vue/test-utils`, for components; PHPUnit for every endpoint and service; Playwright for flows
  across both. Shared vectors (pairing, XMP, name templates) are read from `tests/fixtures/`, never
  copied into a test.
- **Failure paths** wherever the code enforces a rule. The minimum per area:
  - a backend endpoint: a foreign path, a vanished file, a changed file (conflict), no permission;
  - deleting: one file of the pair fails or has vanished, the report per file;
  - pairing: case, several dots, a single, ambiguity, separate subfolders;
  - XMP: an unparseable sidecar, a conflicting one (`conflict.xmp`), unknown fields surviving;
  - moving: a name collision, the target folder gone.
- **A "did not happen" needs a positive control**: asserting a file was not trashed is worthless
  unless the same test proves its partner was.
- **Deterministic**: no sleep, no timing waits, no wall clock, no network, no shared state; a
  Playwright case waits on a visible state, never on `waitForTimeout`. The fix for a flaky case is
  a seam in the production code, never a longer wait or a retry.
- **Coverage**: the gate (`src/logic/` 95 % lines and 90 % branches, components 80 % lines) holds,
  and the touched modules do not drop against `main`; report the delta.

## 5. UI

If the pull request touches `src/components/`, `src/views/` or another Vue file:

- **The mockup is the UX spec.** The change matches `docs/mockup/` as signed off (ADR 0003) and
  `docs/plan.md`. A UI decision neither of them makes is logged in `docs/decisions.md` with its
  reason, or, when the owner must make it, has an answered `needs-owner` issue. The UI ships with
  the feature; "UI in a follow-up" is a blocker.
- **Shared components and words**: built from the shared components, glossary words and order,
  every string through `t('honeycomb', …)`, counts through `n()`, numbers and dates through `Intl`.
- **Touch-first**: works by touch alone, nothing reachable only by hover, hit targets per
  `docs/03-coding-standards.md` §3.3, every action also by keyboard; no re-render between
  `touchstart` and `click`.
- **Theming**: colours, spacing and radii from Nextcloud CSS variables; checked in light and dark.
- **Never judge layout from the source.** Render it on the reference devices (`docs/plan.md`
  Reference devices), portrait and landscape, and measure where a claim is about pixels; the
  `## Screenshots` comment shows it.
- **e2e** (once `tests/e2e/` exists): a new flow adds or extends a Playwright case in
  `tests/e2e/`, runs in CI, and does not depend on another case's data. Read the spec's promises
  against the test body, sentence by sentence: a `docs/plan.md` sentence such as "picks the
  picture and advances" is two promises, and each must be an assertion. Where a promise cannot be
  asserted through the UI, the sentence changes. Check the claim against the screen too: a doc
  promising a path the built screen does not offer is a wrong doc sentence.
