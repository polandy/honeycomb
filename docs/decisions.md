# Decisions

Smaller decisions made during implementation, one dated line each, newest last. Architectural
choices get an ADR in [`adr/`](adr/) instead.

- 2026-11-10 (M1.1): TypeScript 6.0, not 7, because typescript-eslint, which
  `@nextcloud/eslint-config` uses, supports TypeScript below 6.1 only.
- 2026-11-10 (M1.1): PHPUnit 12.5, not 13, because PHPUnit 13 needs PHP 8.4 and the floor is 8.3.
- 2026-11-10 (M1.1): Composer resolves for PHP 8.3.16 (`config.platform`), the lowest 8.3 that
  psalm 7 installs on; the app itself still requires PHP 8.3 in `info.xml`.
- 2026-11-10 (M1.1): "Against Nextcloud 35" means psalm and PHPUnit run on the `nextcloud/ocp`
  stubs of `stable35`; a PHPUnit job inside a Nextcloud 35 server joins with M1.2, whose listing
  test is the first that needs the file cache.
- 2026-11-10 (M1.1): Vitest passes with no tests until M1.3 brings the first logic module; the
  80 % gate for Vue components joins with M2.1, which brings the first component.
- 2026-11-10 (M1.1): No ADR for the PHP and TypeScript dev tools: `03-coding-standards.md` and
  `plan.md` M1 already name them, and none runs at request time.
- 2026-11-10 (M1.1): `scripts/php.sh` runs PHP tools in the pinned `composer` Docker image when
  PHP is not installed, so `scripts/verify.sh` runs on machines without PHP.
- 2026-11-10 (M1.1): The ESLint config is `eslint.config.mjs`, because a TypeScript config needs
  an extra loader.
- 2026-11-10 (M1.1): Dependabot groups composer and npm updates into one monthly pull request
  each, with the commit prefix `build`.
- 2026-11-10 (M1.1): The moderate `minimatch` advisory in ESLint's dependency tree is accepted:
  it is a dev tool on our own files, and the only fix npm offers is a downgrade to ESLint 9.
- 2026-11-10 (M1.1): The empty main page loads no script yet; the Vue build and its script tag
  come with M2.1.
- 2026-11-10 (pr-review): The skill adopts what the review skills of Stella, JIT-Pack and
  framehive share — tier first, diff before files, the test table against the diff, findings as
  ✅ ⚠️ 🔧, merge `main` in rather than rebase, one `## 🤖 PR quality review` comment replaced with
  `--edit-last` — because three projects converged on it.
- 2026-11-10 (pr-review): Three tiers, Light, Standard and Full, with the Full depth in
  `references/full-tier.md` (Stella), so a contained change does not pay for the deep checks.
  Stella's *None* tier for docs-only changes is dropped: the orchestrator's merge gate needs a
  verdict on every pull request.
- 2026-11-10 (pr-review): The review runs in a forked context (JIT-Pack), so it does not grade
  the author's intentions and does not pay for the author's context.
- 2026-11-10 (pr-review): The verdict lists four gates — CI, e2e, test first, failure paths —
  before *Merge readiness*, and `ready` needs each green or `n/a`, because the owner's merge rule
  names them. e2e is `n/a` until `tests/e2e/` exists; from then on a spec CI does not run blocks.
- 2026-11-10 (pr-review): Test-first evidence is the commit order in Standard and Full, plus a
  mutation proof of the headline case in Full (JIT-Pack, Stella): the order shows intent, only a
  red run proves the test can fail.
- 2026-11-10 (pr-review): Stella's delivery loop (e2e only after the owner's manual check) is not
  adopted: the signed-off mockup is the UX spec, the owner reviews by screenshots, and the merge
  rule wants e2e in CI as soon as it exists.
- 2026-11-10 (pr-review): JIT-Pack's breaking-change check stays, aimed at what honeycomb leaves
  behind: stored rows (additive migrations) and XMP sidecars that other programs read.
- 2026-11-10 (pr-review): Dropped as specific to the source projects: Stella's access layer,
  Drizzle and journal rules; JIT-Pack's package-boundary test, run modes, sync API and autoformat
  job; framehive's spec markers and `xtask`. No `ci-failures` script yet: `gh run view
  --log-failed` through a subagent until reading red logs repeats often enough to earn one.
