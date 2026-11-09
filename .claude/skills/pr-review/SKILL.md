---
name: pr-review
description: Risk-tiered quality review of one honeycomb pull request against CLAUDE.md and the docs — tests against the diff, the UI loop, CI (fix failures), branch freshness — posted as one "PR quality review" comment with a merge-readiness verdict. Use when asked to review a PR by number or branch, and unasked right after opening your own PR.
argument-hint: <PR number or branch>
---

# PR quality review

Review the pull request in `$ARGUMENTS` (a number or a branch; without one, the pull request of the
current branch). The procedure around it is `docs/02-workflow.md`. Hunt for real findings rather
than rubber-stamping, fix what the rules below say to fix, and finish with a verdict.

## Pick the tier first

Decide from `gh pr diff <PR> --name-only`, and name the tier in the verdict.

- **Light:** only `*.md`, `docs/` (the mockup included), `.claude/`, `.github/`, `assets/` or
  `LICENSES/`. Check that the text is correct, English, consistent with the files it describes,
  and that no doc contradicts another one. For a mockup change, open it and check that it still
  loads without console errors and builds its controls from the shared renderers
  (`docs/plan.md` Shared UI components). Skip the test table.
- **Full:** anything else. Every step below.

## Rules for both tiers

- Read the diff before any file, and open a doc *section* (`grep -n` its heading, then read that
  range), never a whole directory.
- Trust a green CI: it ran on the head commit. Run `scripts/verify.sh` locally only after a fix of
  yours.
- Red CI: `gh run view <run> --log-failed`, through a `sonnet` subagent when the log is long.
- Fix real defects on the pull request's branch, test first: a missing test, a broken rule from
  `CLAUDE.md`, a doc that contradicts the code. Report matters of taste, do not change them.
- Work in the PR's own worktree if it is yours; otherwise in a review worktree
  (`git worktree add ../honeycomb-review-<PR> <branch>`). Never in the main checkout.

## 1. Context

- `gh pr view <PR> --json title,body,headRefName,mergeStateStatus,statusCheckRollup` and
  `gh pr diff <PR>` in one call. Review the change against the intent the description states.
- The title must be a Conventional Commit subject, and the description pure commit-body text,
  because both become the squash commit (`docs/02-workflow.md` §2.5).

## 2. The standard

Follow `.claude/commands/review.md`, steps 2 and 3. `CLAUDE.md` and the docs it points to are the
standard; a restated list here would go stale.

## 3. Tests against the diff (Full)

Build a table with one row per changed source file under `lib/` or `src/`: the test that drives
*its changed lines* (file and test name). A row you cannot fill is a finding, whatever the title
says. A pull request often carries a second change, and that one ships without tests. Deleting
and pairing need their failure paths covered (CLAUDE.md rules 1–2).

Check the order with `gh pr view <PR> --json commits`: each new behaviour's test lands in its own
commit before the one that changes the source under test (`docs/02-workflow.md` §2.3). A source
change with no earlier test commit is a finding. Coverage below the gate in CI is a blocker.

## 4. UI changes (Full)

- The change matches the signed-off mockup (`docs/mockup/`) or a closed `needs-owner` issue. A UI
  decision the owner has not made is a **blocker**.
- Works by touch alone, in light and dark, in iPad portrait and landscape. A `## Screenshots`
  comment shows it (`docs/02-workflow.md` §2.7).

## 5. CI

`gh pr checks <PR>`: every check green. When red, fix the cause on the branch, run
`scripts/verify.sh` locally, commit, push and wait for the new run with one
`gh pr checks <PR> --watch` in the background. Never re-run a red job unchanged.

## 6. Freshness

`git fetch origin && git rev-list --count <head>..origin/main`. When behind, merge `origin/main`
into the branch and push; never rebase. Then repeat steps 2 to 5, because `main` may have brought
a decision the pull request now contradicts (a taken ADR number, a changed doc).

## 7. Verdict

1. **Summary:** what the pull request does, in one paragraph, and the tier.
2. **Test table** (Full).
3. **Findings:** per check ✅ ok, ⚠️ issue (`file:line`) or 🔧 fixed by me (commit).
4. **Blockers:** what must change before the merge that you could not fix.
5. **Merge readiness:** `ready` or `not ready` — exactly one of these words on that line, which the
   orchestrator's merge gate reads. Never merge: the owner or the orchestrator decides.

Post it in English, after your last push, headed `## 🤖 PR quality review`:
`gh pr comment <PR> --body-file <file>`. Replace an earlier verdict with
`gh pr comment <PR> --edit-last --body-file <file>` instead of adding a second one. No
attribution footer. Then remove your review worktree, if you made one.
