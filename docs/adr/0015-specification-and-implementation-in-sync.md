# 0015 – Specification and implementation stay in sync

- Status: accepted
- Date: 2026-11-10

## Context

honeycomb is built by AI agents and reviewed by its owner, who should be able to read what the app
does without reading the code. `docs/plan.md`, the mockup and the ADRs say what we plan and why,
but nothing tied them to the merged code, so they drift. Framehive (ADR 0010 there) couples a
specification to the tests by IDs and checks it in CI; JIT-Pack and skipper-cd require the spec
update in the same pull request as the feature, checked by review only.

## Decision

- **Specs.** `docs/specs/<area>/<ID>-<name>.md`, one feature per file, with a status and numbered
  Given / When / Then criteria. Rules and template: `docs/specs/README.md`. `docs/plan.md` and the
  mockup stay the plan; the spec is the binding description of the merged behaviour.
- **Coupled to tests.** A test that proves a criterion carries `// spec: <ID>.<n>` on the line
  above it. Every criterion of an `implemented` spec has such a test, or is marked `(gap)` and
  named by a `TODO.md` item, so a known gap is visible instead of silently untested.
- **Same pull request.** A pull request that changes behaviour (`lib/`, `src/`, `appinfo/`,
  `templates/`, `css/`) changes the spec, or its description carries `Spec-Unchanged: <reason>`.
  One that changes an `implemented` spec changes code or tests, or carries `Spec-Only: <reason>`.
- **Checked.** `scripts/specs.sh` (structure, markers, gaps) runs in the convention gates and
  `scripts/verify.sh`. `scripts/spec-trailers.sh` judges the pull request as its squash commit:
  its changed files and its title and description. It runs in the `Pull request message`
  workflow, which reruns on an edited description. `/pr-review` checks the diff against the spec
  and whether a trailer's reason is true.

## Alternatives

- *Framehive's per-commit check.* honeycomb squash-merges, and a test-first commit never changes
  the spec, so per-commit trailers would only add noise; the squash commit is what lands.
- *Review only (JIT-Pack, skipper-cd).* Cheaper, but a forgotten spec passes silently.
- *Specs in `docs/plan.md`.* It mixes plan, rationale and open questions; a spec per feature is
  small enough to open alone (reading budget).

## Consequences

- Every behaviour-changing pull request touches a spec or states why not.
- The checks are heuristics: they force spec and tests to be considered together, not that the
  prose is right. That stays with the author and `/pr-review`.
