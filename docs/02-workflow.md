# 2. Workflow

Every change reaches `main` through a pull request. This file is the procedure for agents and
humans alike; it is binding.

## 2.1 Branch and worktree

- One task, one branch, created from a fresh `origin/main`. `<type>` is the Conventional Commit
  type of the change (`feat`, `fix`, `docs`, `ci`, …), `<slug>` a few words in kebab case.
- Agents always work in their own worktree next to the checkout, never in the main checkout and
  never in someone else's worktree:
  `git fetch origin && git worktree add ../honeycomb-<slug> -b <type>/<slug> origin/main`.
- Before taking a task, check it is not in progress: `gh pr list`, `git worktree list`,
  `git branch -r`.

## 2.2 Owner decisions

A task that needs a decision only the owner can make — a UI look or text, a design or product
choice — is not guessed and not built. Instead:

1. Open a GitHub issue titled `Owner decision: <task>` with the label `needs-owner`. It states the
   question, two or three options with a recommendation and, for UI, a mockup (ASCII, a change to
   `docs/mockup/`, or screenshots).
2. Take the next task. Items with an open `needs-owner` issue are skipped.
3. A closed `needs-owner` issue is answered: implement it as its last owner comment says.

Questions known up front live in [`plan.md`](plan.md#open-questions); a question that comes up
during a task becomes an issue as above.

## 2.3 Tests

- Test first. The failing test is committed on its own (`test: …`) before the commit that makes
  it pass; watch it fail once. The `pr-review` skill checks the order.
- Test at the lowest layer that can express the behaviour (ADR 0006):
  - **Vitest** for the pure TypeScript modules (pairing, series, filters, sort, name templates,
    conflicts, XMP mapping, undo, gestures, hotkeys, header scroll) and, with `@vue/test-utils`,
    for components.
  - **PHPUnit** for every endpoint and service, with `OCP\Files` mocks or the Nextcloud test
    server, including the failure paths: a foreign path, a vanished file, a conflict, no
    permission.
  - **Playwright** end to end against a real Nextcloud container, for the flows across both.
- Coverage gate in CI: logic modules (`src/logic/`) at least 95 % lines and 90 % branches; Vue
  components at least 80 % lines. A pull request does not lower either.
- Test vectors shared with Framehive (pairing, XMP, name templates) are data files under
  `tests/fixtures/`, read by the tests rather than copied into them.
- Tests are deterministic: no sleep, no timing waits, no wall clock (inject a clock), no
  network, no shared state between tests. Playwright waits on a visible state, never on a
  timeout. Never skip, ignore or retry a failing test; fix the cause.
- Pairing and deleting cover their edge and failure cases (CLAUDE.md rules 1–2).
- A test that proves a spec criterion carries `// spec: <ID>.<n>` on the line above it
  (`docs/specs/README.md`).

## 2.4 Before opening

- `scripts/verify.sh` is green locally. CI runs the same tools at the same versions.
- Docs that the change touches and the `TODO.md` line it finishes are part of the same pull
  request. So is the spec in `docs/specs/` for any behaviour change (ADR 0015). `CHANGELOG.md`
  is written by release-please.

## 2.5 Title and description

The pull request is squash-merged. Its title becomes the commit subject, its description the
commit body, word for word. So:

- **Title:** a Conventional Commit subject in English, such as `feat(pairing): match RAW and JPEG
  case-insensitively`. The `Pull request message` workflow checks it (`scripts/check-pr-title.sh`)
  and reruns when the title is edited.
- **Description:** only commit body text: what changed and why. When behaviour code changes but
  no spec does, a line `Spec-Unchanged: <reason>`; when an implemented spec changes but no code
  or test does, `Spec-Only: <reason>`. The workflow checks them (`scripts/spec-trailers.sh`).
- Notes for the reviewer, open questions and test evidence go into a comment, not into the
  description.
- No `Co-Authored-By` or "Generated with" lines.

## 2.6 CI and review

- Jobs whose paths a pull request does not touch are skipped (`scripts/ci-changes.sh`); the
  required check is `CI gate`, which treats a skip as passed. Decisions: `decisions.md`.
- Wait for CI with one `gh pr checks <n> --watch` in the background, never by polling.
- When CI is red, read only the failed steps (`gh run view <run> --log-failed`), fix the cause on
  the branch and push again. Never re-run a red job unchanged.
- Once CI is green, the author runs the `pr-review` skill on their own pull request. It posts one
  `## 🤖 PR quality review` comment with its gates — CI, e2e once `tests/e2e/` exists, test first,
  failure paths — ending in `ready` or `not ready`; fix what it finds until CI is green and the
  verdict says `ready`.

## 2.7 Screenshots for UI changes

A pull request that changes the UI adds a `## Screenshots` comment before it is reviewed: 2–3
PNGs cropped to the change, at most 1200 px wide, on the
[reference devices](plan.md#reference-devices) in landscape and portrait, light and dark when
colours change. The images live in a separate public repository `polandy/honeycomb-assets` under
`pr-<n>/`, never in this one, and never in the description (it becomes the squash commit, and the
links would break once the images are pruned). A new revision replaces the files and edits the
same comment.

## 2.8 Keep it up to date

When the branch is behind `main`, merge `origin/main` into it and push. Do not rebase a pushed
branch: a merge needs no force push and keeps review comments anchored, and the squash merge
removes the merge commit anyway.

## 2.9 Merge

Agents never merge. The owner, or the orchestrator acting for them, squash-merges
(`gh pr merge <pr> --squash`). Afterwards the author removes their worktree.

## 2.10 Releases

release-please opens a release pull request from the Conventional Commits on `main` and keeps
`CHANGELOG.md`. `feat` bumps the minor and `fix` the patch version while the version is below
1.0. `appinfo/info.xml` and `package.json` are extra files in `release-please-config.json`, so
their versions move with the release; a PHPUnit test keeps the two equal.
