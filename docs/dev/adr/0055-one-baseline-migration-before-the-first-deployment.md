# 0055 – One baseline migration before the first deployment

- Status: accepted
- Date: 2026-11-23
- Amends: [0022](0022-tag-storage.md), [0040](0040-flags-per-picture-in-the-database.md), [0054](0054-one-decision-table-for-files-and-immich-assets.md)

## Context

Thirteen migrations (0 to 12) build the schema one feature at a time. Several of them only undo
an earlier one: migrations 0 and 1 create `honeycomb_decisions` and `honeycomb_file_tags`, which
migration 5 drops after writing the preference `pictures_decided_before` that nothing reads
(ADR 0039); migration 8 rebuilds `honeycomb_hashes` without `user_id`; migration 11 recreates
`honeycomb_decisions` and drops `honeycomb_flags`; migration 12 drops the decision columns of
`honeycomb_immich_assets`. Index names drifted (`honeycomb_sfiles_user_file`,
`honeycomb_xmp_user_file`, `honeycomb_stats_day`), `honeycomb_tag_list` lets a tag appear twice
per user, and the empty-series sweep (`SeriesMapper::deleteEmptySeries`) looks members up by
`series_id` alone, which no index leads with. honeycomb runs in no production yet, so the chain
can still be replaced (architecture report 2026-11-22, A1).

## Decision

- **One migration, `Version000200Date20261123200000`,** creates every table as the chain left it,
  and the chain is deleted. Every later schema change is a new migration on top of it, one per
  feature, as before.
- **Every index is named after its table and its columns**, `<table>_<column>_<column>`, so a name
  never needs a choice. Nextcloud 35 allows 63 characters; the longest name has 46.
- **`honeycomb_tag_list` is unique on `(user_id, tag)`**, which also serves every read of a user's
  list. `TagMapper::addToTagList` inserts only the tags missing from the list; when two saves add
  the same tag at once, the second hits the key and `RetryOnConflict`, which already wraps it,
  repeats it without that tag. ADR 0022 kept the key off because MySQL's default collation folds
  case and accents, but Nextcloud creates its MySQL tables as `utf8mb4_bin` (`utf8_bin`), so
  `Anna`, `anna` and `café`, `cafe` stay four tags, which `TagMapperTest` proves on every database.
  An instance that sets `mysql.collation` to a folding collation would reject such a second tag.
- **`honeycomb_series_files` gains an index on `series_id`** for the sweep's `NOT EXISTS` lookup.
- **The table names stay.** Each is `honeycomb_` and a glossary word (*tag list*, *XMP cache*,
  *folder summary*); renaming them would touch every mapper and the admin guides for no reader.
- **No `hasTable` guard, but a check up front.** Before it creates a table, the migration stops
  with one sentence that names the existing `honeycomb_*` tables and points to
  [updating](../../user/admin/updating.md) when any exists, instead of failing on the first one
  with a database error or keeping a schema the code no longer expects (amended 2026-11-24).
- `tests/php-db/SchemaTest.php` compares the live schema on SQLite, MariaDB and PostgreSQL with
  `tests/fixtures/schema/honeycomb.json`, taken from the old chain and changed only as listed here,
  and checks the index name rule.

## Amendment 2026-11-24: the baseline before 0.2.0

The architecture and data model review of 2026-11-24 found gaps the baseline can still close
before 0.2.0 is released; the owner approved them. Until that release the baseline may change;
an instance that already ran it (a test server) reinstalls as above.

- **`honeycomb_decisions.updated_by`** (`string(64)`, null) notes who saved or took a row over
  last, for information like `honeycomb_folder_done.user_id`: nothing reads it to decide, and
  deleting the user empties it and keeps the row.
- **`honeycomb_decisions.sidecar_etag`** (`string(40)`, null): the sidecar's etag when the row
  and the XMP sidecar last agreed, so a later sync can tell which side changed (digiKam first,
  owner decision 2026-11-24). This change adds the column only; it stays null until the sync
  writes it.
- **`honeycomb_hashes.method`** (`smallint`, not null, default 1): the version of the visual
  hash, as `honeycomb_quality.method` is of the sharpness (ADR 0046). The listing delivers it
  with the hash, a save sends it, the missing-hash walk asks for one method, and the browser
  treats a hash of another method as missing.
- **`asset_id` is `string(255)`** in `honeycomb_decisions`, `honeycomb_immich_assets` and
  `honeycomb_positions`: Immich's UUID today, room for a source whose ids are longer.
- **Indexes** `honeycomb_decisions(user_id)` for forgetting a user, `honeycomb_decisions(source,
  connection_id)` for the connection sweep, and `honeycomb_immich_assets(user_id)`.
- **`honeycomb_positions` opens for Immich:** `file_id` becomes null, `asset_id` and `taken_at`
  (`bigint`) are added, both null. A position of a folder set keeps `file_id`; the Immich
  position (IMMICH-003, a later task) writes the other two.

## From 0.2.0: migrations are append-only

Once 0.2.0 is released the baseline is frozen, and every schema or data change follows these
rules (CLAUDE.md names them in one line).

- **A published migration is never changed or deleted.** Every change is a new migration class
  and a `info.xml` version bump; the schema fixture and `SchemaTest` change with it.
- **Idempotent:** a migration checks `hasTable`, `hasColumn` and `hasIndex` before it adds, so a
  run that stopped half way can run again.
- **Data moves with the `QueryBuilder`** in `preSchemaChange` or `postSchemaChange`, never with
  entities or mappers: those describe today's schema, not the one the migration meets.
- **Large data** is moved by an `IRepairStep` or a background job in portions (a row-id cursor in
  the app config, as `SweepVanishedRows` does), never in one migration request.
- **Limits of every supported database** (SQLite, MariaDB, PostgreSQL, Oracle): a table name
  including the `oc_` prefix has at most 27 characters; a column or index name at most 30; a
  boolean column is never `NOT NULL`; a `string` has at most 4000 characters, more is `TEXT`; every
  table has a primary key.
- **Changing a column** means adding the new one, copying the data in a later step and dropping
  the old one in a later release, never an in-place `ALTER` that Oracle or SQLite cannot do.

## Options considered

- **Keep the chain**: no reinstall, but every fresh install replays dropped tables and a data
  rewrite, and the drifted names stay for good.
- **A baseline with `hasTable` guards**: an old instance updates without an error, but keeps the
  old index names and misses the new indexes, so its schema differs from a fresh one unnoticed.

## Consequences

- A fresh install runs one migration.
- Every instance installed before this change, the test servers included, removes honeycomb, drops
  its tables and `oc_migrations` rows and installs it again; its data is lost. The release
  0.1.0 cannot update to the next release.
- The fixture is the schema's one written record: a schema change updates the fixture with its
  migration.
