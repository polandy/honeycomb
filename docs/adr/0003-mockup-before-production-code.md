# 0003 – An interactive mockup before production code

- Status: accepted
- Date: 2026-11-09

## Context

The original brief describes a binary keep/discard review. The owner's update of 2026-11-09 asks
for digiKam-style culling instead — filters, ratings, colour labels, pick and reject flags, bulk
actions — and says the details still need to be worked out. Building production code on
unsettled interaction details would mean rebuilding it.

## Decision

Before any production code, `docs/mockup/index.html` shows how the app works: one static,
self-contained HTML file with generated placeholder photos, no build and no external requests,
so the owner can open it on the iPad directly. Choices that are still open carry a visible marker
that names the question in `docs/plan.md`. Milestone M0 is the owner's sign-off on it.

## Consequences

- The mockup is the reference for UI work; a UI pull request that departs from it needs an owner
  decision first.
- The mockup is kept current while requirements are refined, then frozen once M0 is signed off.
- It is not production code: its JavaScript is not linted or tested, and nothing is copied from
  it into `src/`.
