Run a quick project health check and report it as a short dashboard:

1. `scripts/verify.sh` — the same gate as CI; one line per step, the failing step in full.
   Delegate it to a subagent (`model: "sonnet"`) that reports only the result lines.
2. `git log --oneline -5`, `git status --short`, `gh pr list` and
   `gh issue list --label needs-owner` in one call.
3. The open items in `TODO.md` (count, and the next three).

Flag anything that needs attention: a failing step, uncommitted work, an open PR with red CI, an
owner decision that has been answered (closed `needs-owner` issue) but not yet implemented.
