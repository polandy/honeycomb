# honeycomb – Rules for AI agents

honeycomb is a Nextcloud app (PHP backend, Vue frontend) for culling RAW+JPEG photo pairs,
touch-first for the iPad. It is developed by AI agents; a human must still be able to read and
follow every line, so every rule that can be checked is checked by `scripts/verify.sh`.

This file is loaded in full by every session and every subagent, so it holds rules and pointers
only. **Don't grow it**: move detail into `docs/` and keep a pointer here.

## Commands

- **Before finishing:** `scripts/verify.sh`. It mirrors CI, prints one line per step and the
  failing step in full: convention gates (file size, pins), markdownlint, REUSE, php-cs-fixer,
  psalm, PHPUnit, eslint, vue-tsc, Vitest with coverage, the build and Playwright against a
  Nextcloud container (Docker). Without PHP it uses Docker.
- Open work: `TODO.md`. `/todo` adds, `/next` plans, `/status` and `/review` check, skill
  `pr-review` reviews a PR. Subagents: `honeycomb-implementer` (one task),
  `honeycomb-reviewer` (one change). Red CI: `gh run view <run> --log-failed`.
- The interactive mockup: open `docs/mockup/index.html` in a browser; no build.

## Read first

| Topic | Document |
|---|---|
| What we build | `docs/01-requirements.md` |
| What the merged code does, per feature | `docs/specs/` (rules in its `README.md`) |
| Plan, milestones, open questions | `docs/plan.md` |
| Branch, test, PR, review | `docs/02-workflow.md` — **binding**, read before the first commit |
| How code is written here | `docs/conventions.md` (every language), `docs/03-coding-standards.md` (stack) |
| Words we use | `docs/04-glossary.md` |
| Why decisions were made | `docs/adr/` |

## Reading budget

Every tool result is re-read, and paid for, on each later turn.

- **Open only the section a change touches.** Start from `docs/README.md`, never read the set.
  `docs/mockup/index.html` is large: grep it, read by offset.
- **Grep before you read**, and read a large file by offset.
- **Bundle independent commands into one call.** Never repeat a check whose answer cannot have
  changed.
- **Delegate by threshold:** fact-finding reads over ~10 KB, full test or CI runs, red CI logs
  and repository-wide rename sweeps go to a subagent (`Explore` to find, `model: "sonnet"` to
  run) that reports in a few lines. Judgement and spec writing stay with you.
- **Edit, don't rewrite:** change files with targeted edits, never by writing them out whole.
  An analysis you repeat becomes a script under `scripts/`.
- **One task per session**, under ~150k tokens of context. Review and clean-up run in a fresh
  session. A subagent past ~120k tokens stops and returns a hand-off.

## Non-negotiable rules

1. **Files only through `OCP\Files`** (`IRootFolder`, the user's folder). Never touch the
   file system directly, so permissions, versions and the trash bin keep working.
2. **Deleting moves to the Nextcloud trash bin** and acts on a whole pair (JPEG, RAW, sidecars).
   A partial failure is reported per file and leaves a traceable state (milestone M4.1).
3. **No production code before the owner signs off the mockup** (ADR 0003, milestone M0).
4. **Test first.** The failing test is its own commit before the implementation. Tests are
   deterministic: no sleep, no timing waits, no wall clock, no network. Never skip or retry a
   failing test; fix the cause. Vitest coverage gate: logic modules 95 % lines and 90 % branches
   (ADR 0006, `docs/02-workflow.md` §2.3).
5. **Pinned and locked.** `composer.lock` and `package-lock.json` are committed and never edited
   by hand; Actions are pinned by full commit SHA.
6. **Write an ADR before an architectural choice:** storage format, new dependency, new table,
   public API shape (ADR 0001).
7. **Use the glossary's words** (`docs/04-glossary.md`); no synonyms. New UI uses its UI words
   and the shared components (`docs/plan.md` Shared UI components) before adding new ones.
8. **Everything in the repository is English** — code, docs, UI strings, commits, PRs, issues —
   even when the owner writes in another language.
9. **REUSE compliant.** A new file carries an SPDX header or is covered by `REUSE.toml`.
10. **Spec and code stay in sync** (ADR 0015). A behaviour change updates its spec in
    `docs/specs/` in the same PR, or the PR description says `Spec-Unchanged: <reason>`. A test
    that proves a criterion is marked `// spec: <ID>.<n>`. `scripts/specs.sh` checks.

## Code style

Binding: `docs/conventions.md`. In short:

- Single responsibility, small public surface, files of at most 300 lines; side effects (files,
  clock, randomness) injected, never global or static.
- Names say *what*, comments say *why*, one line at most; a one-line doc comment on every export
  and public service method. No magic strings or numbers. No duplicated logic.
- Fail loud: no empty `catch`, typed errors, log through the injected logger, raw error text
  never reaches the user. No `any`, no dropped promise, no `innerHTML` or `v-html`.
- Thin backend: PHP lists, moves, trashes, writes and stores, and rechecks every path. Logic
  lives in pure TypeScript modules without DOM or network (ADR 0006).
- Vue: `@nextcloud/vue` components, `@nextcloud/axios`, no hover-only interaction, colours from
  Nextcloud CSS variables.

## Workflow

1. Understand the task; read only the docs it touches, and the spec of the feature.
2. Update or add the spec (`docs/specs/`), then write or extend the tests first, at the lowest
   layer that can express the behaviour, with their `// spec:` markers.
3. Implement the smallest change that makes them pass.
4. `scripts/verify.sh` is green.
5. Update the docs the change touches and delete the finished item from `TODO.md`.
   `CHANGELOG.md` is written by release-please, never by hand.
6. Conventional Commits in English, body explains why. No `Co-Authored-By` or "Generated with"
   lines. `main` changes only by pull request (`docs/02-workflow.md`).
