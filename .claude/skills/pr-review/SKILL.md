---
name: pr-review
description: Risk-tiered quality review of one honeycomb pull request against CLAUDE.md and the docs — the gates (CI, e2e, test first, failure paths), tests against the diff, the standard, the mockup as UX spec, branch freshness — posted as one "PR quality review" comment with a merge-readiness verdict. Use when asked to review a PR by number or branch, and unasked right after opening your own PR.
argument-hint: <PR number or branch>
context: fork
agent: general-purpose
---

# PR quality review

Review the pull request in `$ARGUMENTS` (a number or a branch; without one, the pull request of the
current branch). The procedure around it is `docs/02-workflow.md`. Hunt for real findings rather
than rubber-stamping, fix what the rules below say to fix, and finish with a verdict.

You run in a forked context: `CLAUDE.md` but none of the author's conversation, so you judge the
pull request, not the session's intentions. The caller gets the §8 verdict back.

## Pick the tier first

Decide from `gh pr diff <PR> --name-only`, and name the tier in the verdict. When in doubt, take the
higher one.

- **Light:** only `*.md`, `docs/` (the mockup included), `.claude/`, `assets/` or `LICENSES/`.
  §0, the *Light checks*, §6–§9. No test table.
- **Full:** any of: `lib/` code that reads, moves, trashes or writes files (CLAUDE.md rules 1–2),
  writing XMP or its mapping, pairing, a migration or new table, a new route or a changed response
  shape (`appinfo/routes.php`, a controller's return), a new dependency, a new screen or shared
  component. §0, the §4.0 table, then `references/full-tier.md` §1–§5, then §6–§9.
- **Standard:** everything else (a contained pure module or component, styling, tests only,
  `scripts/`, `.github/`). §0, the §4.0 table, the *Standard checks*, §6–§9. Do not open the
  reference.

## Rules for every tier

- Read the diff before any file, and open a doc *section* (`grep -n` its heading, then read that
  range), never a whole directory. `docs/mockup/index.html` is large: grep it, read by offset.
- `CLAUDE.md` and the docs it points to are binding; these checks distill them, and the *files*
  win where they disagree.
- Trust a green CI: it ran `scripts/verify.sh`'s tools on the head commit. Run `scripts/verify.sh`
  locally only after a fix of yours, or when CI has not run on the current head.
- Delegate by the threshold in `CLAUDE.md` *Reading budget*: a read over ~10 KB for a fact,
  `scripts/verify.sh`, a Playwright run, a red CI log (`gh run view <run> --log-failed`), the
  mutation proof's revert, run and restore, and merging `main` in go to a `model: "sonnet"`
  subagent that answers in a few lines (pass or fail, each failure as name and `file:line`). The
  findings, the table and the verdict stay with you.
- Fix real defects on the pull request's branch, test first: a missing test, a broken rule from
  `CLAUDE.md`, a doc that contradicts the code. Report matters of taste, do not change them.
- Work in the PR's own worktree when it is clean and its author's; otherwise in a review worktree
  (`git worktree add ../honeycomb-review-<PR> <branch>`). Never in the main checkout.

## 0. Context

- `gh pr view <PR> --json title,body,headRefName,headRefOid,mergeStateStatus,statusCheckRollup`
  (add `commits` from Standard on) and `gh pr diff <PR>` in one call. Review the change against the intent the description states,
  and the `TODO.md` item or issue it names.
- The title must be a Conventional Commit subject, and the description pure commit-body text,
  because both become the squash commit (`docs/02-workflow.md` §2.5). The type follows
  *user-facing* impact: a user-visible change as `chore:` or `docs:` vanishes from the release
  notes (§2.10).
- A UI change needs its `## Screenshots` comment (§2.7); missing screenshots block the verdict.

## 4.0 Tests against the diff — build the table first (Standard, Full)

One row per changed source file under `lib/`, `src/` or `appinfo/`: the test that drives *its
changed lines* (test file and case name). A row you cannot fill is a finding, whatever the title
says. The table itself goes into the verdict, not a claim that it was built: a pull request often
carries a second change, and that one ships without tests.

- **Test-first evidence.** From the `commits` list: each new behaviour's test lands in its own
  `test:` commit before the commit that changes the source under test (§2.3). A source change with
  no earlier test commit is a finding. A pure refactor names the existing tests that hold it.
- **Failure paths.** Every row whose code enforces a rule — a path recheck, a permission, a
  conflict, deleting, pairing ambiguity, an XMP that cannot be parsed — names a failure-path case
  too, not only the happy path. Missing ones are a gate failure.
- **A write half and a read half are two behaviours** (write XMP / read XMP, move / undo, trash /
  delete report): each needs its own driving case.
- **One rule written into N places needs N cases**, and is itself a DRY finding: it belongs in one
  `src/logic/` module or one shared component.
- **A shared test helper is never the assertion.** One that tolerates both states stays green when
  the behaviour is removed.

## Light checks

- The text is correct, English, uses the glossary's words, and is consistent with the files it
  describes; no doc contradicts another (`CLAUDE.md`, `docs/02`, `docs/03`, `docs/plan.md`, ADRs).
- A changed rule moves everywhere it is stated, and a finished `TODO.md` item is deleted.
- A mockup change still loads without console errors, builds its controls from the shared
  renderers (`docs/plan.md` Shared UI components), and is checked on the reference devices.
- A new decision is logged: an ADR for an architectural choice (rule 6), otherwise one dated line
  in `docs/decisions.md`.

## Standard checks

One line per check; `references/full-tier.md` §1–§5 holds each in depth for the Full tier.

- **Docs move with the change** (§1): the owning section of `docs/plan.md`, `docs/0x-*.md`, the
  user docs in `docs/user/` and the glossary; no doc still describes removed behaviour.
- **Decisions** (§2): an ADR for an architectural choice, a dated line in `docs/decisions.md` for a
  smaller one; nothing contradicts an existing ADR.
- **Project standard** (§3): `src/logic/` stays pure (no DOM, network, `@nextcloud/*`, ambient
  clock or randomness); thin controllers; strict types; no magic literal, dead code or narrating
  comment; DRY across grid, loupe and series viewer; small public surfaces (encapsulation).
- **Tests** (§4): names say which rule breaks, the lowest layer that expresses it, failure paths,
  a positive control for every "did not happen", no timing waits, the coverage gate not lowered.
- **UI** (§5): matches the signed-off mockup, shared components and glossary words, `t()` for every
  string, Nextcloud CSS variables, touch alone, light and dark, the e2e case once e2e exists.
- **Workflow files**: Actions pinned by full commit SHA; `scripts/verify.sh` and `ci.yml` still run
  the same tools at the same versions; no gate job dropped or made optional.

## 6. CI and e2e

- `gh pr checks <PR>`: every check green on the head commit, the PR title check included.
- **e2e:** once `tests/e2e/` holds a spec on the head commit, `ci.yml` must have a Playwright job
  that runs on `pull_request`, it must appear in `gh pr checks`, and it must be green. A spec that
  CI does not run is a blocker. Before `tests/e2e/` exists, the gate is `n/a`.
- Red: fix the cause on the branch, run `scripts/verify.sh` (a spec you touched: that spec alone),
  commit, push and wait for the new run with one `gh pr checks <PR> --watch` in the background.
  Never re-run a red job unchanged, never skip or retry a failing test.

## 7. Freshness

`git fetch origin && git rev-list --count <head>..origin/main`. When behind, merge `origin/main`
into the branch and push; never rebase. Then repeat your tier's checks and §6, because `main` may
have brought a decision the pull request now contradicts. Git flags none of these: a **taken ADR
number**, **two migrations with the same version**, a **duplicate e2e case or fixture name**, and
a `TODO.md` item finished twice.

## 8. Verdict

1. **Summary:** what the pull request does, in one paragraph, and the tier.
2. **Gates:** one line each — CI (✅ green on `<sha>` / ❌), e2e (✅ / ❌ / `n/a`, no `tests/e2e/`
   yet), test first (✅ commit order, and in Full the mutation proof / ❌ / `n/a` Light), failure
   paths (✅ / ❌ / `n/a` Light).
3. **Test table** (Standard, Full).
4. **Findings:** per check ✅ ok, ⚠️ issue (`file:line`) or 🔧 fixed by me (commit).
5. **Blockers:** what must change before the merge that you could not fix.
6. **Merge readiness:** `ready` or `not ready` — exactly one of these words on that line, which the
   orchestrator's merge gate reads. `ready` only when every gate is ✅ or `n/a` and nothing blocks.
   Never merge: the owner or the orchestrator decides.

## 9. Post it

Post the verdict in English, after your last push, headed `## 🤖 PR quality review`:
`gh pr comment <PR> --body-file <file>`. Replace an earlier verdict with
`gh pr comment <PR> --edit-last --body-file <file>` instead of adding a second one; when your last
comment on the pull request is not the review (a `## Screenshots` comment came after it), post a
new one instead. No attribution footer. Then remove your review worktree, if you made one.
