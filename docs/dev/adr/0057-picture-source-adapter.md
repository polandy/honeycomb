# 0057 – One picture source adapter for folders and Immich

- Status: proposed
- Date: 2026-11-24
- Amends: [0041](0041-immich-as-an-external-picture-source.md), [0044](0044-immich-source-api.md)

## Context

A cull's source is a closed union, `OpenedSource = FolderSource | ImmichSource`
(`src/logic/opened-source.ts`), and each kind has its own cull: `useCull` (`src/cull.ts`) holds the
whole listing client side and decides through flags, sidecars, tags and series; `useImmichCull`
(`src/immich-cull.ts`) pages the server's listing and keeps its own decided map, counts, undo
history and save queue with roll back. Deciding, undo, saving with roll back and moving the counts
along exist twice, and a third source (an Immich album, ADR 0049 phase 2) would add a third cull.
The review of 2026-11-24 asked for an adapter per source and one cull core; the owner approved the
measure on 2026-11-24.

## Proposed decision

- **`PictureSource<E>`** (TypeScript) is what a cull asks of its source:
  `capabilities` (the existing `SourceCapabilities`), `list(cursor, filters)` returning a `Page<E>`,
  `counts(filters)`, `imageUrl(id, size)` and `decide(rows)` (save the decision rows).
  The folder adapter answers `list` with one page holding the folder set's whole listing and counts
  client side; the Immich adapter pages and counts on the server (ADR 0044).
- **One cull core** owns the paged listing state, the decided map, the undo history of decision
  steps, saving with roll back of what no later save stored, and the counts moved along by a
  decision. Source-specific stay the listing request and the image URL; the folder-only steps
  (tags, series, sidecar write-through, access gate) hang on the core where `capabilities` allow them.
- **PHP**: a `PictureSource` interface (`listing`, `counts`, `image`, `decide`) implemented by a
  folder and an Immich class; the controllers keep their routes and bodies and delegate to it, so the
  API shape does not change.
- **Staging**, each PR behaviour-neutral with green e2e: (1) this ADR, the TS interface, the Immich
  adapter and the core with `useImmichCull` on it; (2) the folder adapter and `useCull`'s decision
  steps on the core; (3) the PHP interface behind the existing routes.

## Open question

The cut spans several PRs and is costly to undo, so the owner decides it before code is written
(issue #187): the staging above, one PR for all of it, or TypeScript only without the PHP
interface (the controllers are already thin and no generic PHP consumer exists yet).

## Consequences

- A new source is an adapter and its capabilities, not a new cull.
- `OpenedSource` stays the value naming a source; the adapter is what acts on it.
