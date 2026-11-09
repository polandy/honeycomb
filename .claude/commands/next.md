Identify the next task and plan it:

1. Sources of open work, in this order:
   - whatever the owner has just asked for
   - `TODO.md`, top to bottom: its order is the milestone order of `docs/plan.md`
   - the milestone in `docs/plan.md` that the first open `TODO.md` item belongs to
2. Skip work already in progress (`gh pr list`, `git worktree list`, `git branch -r`) and items
   with an open `needs-owner` issue (`gh issue list --label needs-owner`). A closed one is
   answered: its last owner comment is the decision.
3. Open questions are not tasks for you; they need the owner. List them only if one blocks the
   chosen task: `grep -n '^### Q' docs/plan.md`.
4. Read ONLY the docs sections and ADRs that the item references, never a whole directory.
5. Propose a plan of at most 5 steps. Each step is one Conventional Commit with a green
   `scripts/verify.sh`. Tests first (`docs/02-workflow.md`), and the last step updates the docs
   and removes the item from `TODO.md`.
6. Name the decisions the owner has to make, each with your recommendation. A UI look, UI text
   or a product choice becomes an `Owner decision: <task>` issue (`docs/02-workflow.md` §2.2).
