# 0054 – One decision table for files and Immich assets

- Status: accepted
- Date: 2026-11-23
- Amends: [0040](0040-flags-per-picture-in-the-database.md), [0043](0043-immich-decisions-per-connection-and-asset.md)

## Context

The decisions of a picture live in two tables with overlapping columns: `honeycomb_flags`
(ADR 0040) holds the flag and *Keep RAW* of a Nextcloud file, `honeycomb_immich_assets`
(ADR 0043) the whole decision of an Immich asset and a copy of its facets. Each has its own mapper
set, and *Write to Immich* (Phase 2) would add a third set of decision queries. The architecture
review of 2026-11-22 (A7, target data model) proposed one decision table for both sources, and the
owner chose it on 2026-11-22 while nothing is deployed, so the switch needs no data migration.

## Decision

- **`honeycomb_decisions`** holds one row per decided subject of a source:

  | Column | Type | Rule |
  |---|---|---|
  | `id` | bigint, autoincrement | primary key |
  | `source` | string 16 | `file` or `immich`; a file query meets file rows through `file_id` |
  | `file_id` | bigint, nullable | the Nextcloud file id, set for `file` only |
  | `connection_id` | string 64, nullable | the connection's `id` (ADR 0042), set for `immich` only |
  | `asset_id` | string 36, nullable | the Immich asset id, set for `immich` only |
  | `user_id` | string 64, nullable | the connection's user (ADR 0043), set for `immich` only |
  | `flag` | string 16 | `picked`, `rejected`, `unflagged` |
  | `keep_raw` | boolean | as before for both sources |
  | `rating` | smallint, nullable | `immich` only; a file's rating lives in its sidecar |
  | `colour_label` | string 16, nullable | `immich` only, for the same reason |
  | `updated_at` | bigint | from the injected clock |

  Unique indexes on `(file_id)` and on `(connection_id, asset_id)`. A row of the other source has
  null in these columns, which every supported database leaves out of a unique index.
- **A file row is shared, an Immich row is per user**, as ADR 0040 *Who shares what* says. A file
  row keeps every rule of ADR 0040: it follows its file id (`carryOver`), the file sweep removes it
  once the file is gone for good, and no user owns it.
- **The file queries only meet file rows.** They select by `file_id`, which is null on every
  `immich` row, and the sweep's row-id paging skips rows without a file id.
- **The facets stay with the asset.** `honeycomb_immich_assets` keeps `taken_at`, `camera_model`,
  `kind` and `asset_updated_at`; its decision columns move into `honeycomb_decisions`.
- **In two steps.** The first PR adds the table, drops `honeycomb_flags` and moves `FlagMapper`
  onto it. The second moves the decision part of `honeycomb_immich_assets` and
  `ImmichDecisionMapper`; until then the `immich` columns stay empty.
- The name `honeycomb_decisions` is the one migration 5 dropped. A fresh install and every
  instance past migration 5 create it anew; the baseline migration of the review's A1 folds the
  steps together.

## Options considered

- **Two tables, as ADR 0040 and 0043 left them**: one shape per table, but two mapper sets for the
  same decision and a third for *Write to Immich*. The review counted it as the second stack.
- **One table keyed by `source` and a string `source_key`**, as the review sketched it: one unique
  index, but the file id would sit twice in a file row (as the key and as `file_id` for the file
  cache joins and the sweep), and a move would have to update both. Rejected for the typed
  columns above.
- **One table with the facets as well**: one row per asset, no join for the Immich counts, but the
  facets describe the asset, not the decision, and every file row would carry four empty columns.

## Consequences

- One decision table and, after the second step, one place for the decision queries of both
  sources. The Immich counts and filters join the facets by `(connection_id, asset_id)`.
- `occ honeycomb:cleanup --all` and the removal guide name `honeycomb_decisions` instead of
  `honeycomb_flags`.
- An instance that runs this migration loses its flag rows, as allowed before the first deployment.
