# 0001 – Record architecture decisions as ADRs

- Status: accepted
- Date: 2026-11-09

## Context

honeycomb is developed by AI agents, which have no memory across sessions. Humans must still be
able to see why something was built the way it was.

## Decision

Every decision that affects structure, data formats, storage, public APIs, dependencies or tools
is recorded **before** implementation as an ADR in MADR style under `docs/adr/`, numbered
`NNNN-title.md`. An accepted ADR is not changed afterwards; a new ADR supersedes it ("Superseded
by NNNN"). Only a real trade-off, with options weighed and one chosen at a cost, gets an ADR.

## Consequences

- The rationale lives next to the code and is versioned with it.
- Agents read the ADRs a change touches before they make it.
