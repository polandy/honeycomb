# 0002 – Development by AI agents, rules enforced mechanically

- Status: accepted
- Date: 2026-11-09

## Context

No human is expected to write code in this project. The code must still be understandable, and
quality must not depend on human review. The owner runs several projects this way (Framehive,
Stella, glissando, skipper-cd); honeycomb adopts their setup.

## Decision

- `CLAUDE.md` holds rules and pointers only and is short, because every session loads it in full.
  `AGENTS.md` is a symlink to it for other agents. Detail lives in `docs/`.
- A reading budget keeps sessions cheap: one task per session under ~150k tokens, a subagent
  hand-off past ~120k, large reads and rename sweeps delegated to subagents.
- Every rule that can be checked is checked by `scripts/verify.sh`, which CI mirrors.
- Everything in the repository is English, whatever language the owner writes in.
- One task, one worktree, one pull request; Conventional Commits; squash merge; agents never
  merge. The `pr-review` skill posts a merge-readiness verdict on every pull request.
- Decisions only the owner can make become `needs-owner` issues instead of guesses.

## Consequences

- Up-front effort for tooling and docs before the first line of app code.
- A human can join at any time: README → `docs/README.md` → glossary → ADRs → code.
