# 0055 – One baseline migration before the first deployment

- Status: accepted
- Date: 2026-11-23
- Amends: [0040](0040-flags-per-picture-in-the-database.md), [0054](0054-one-decision-table-for-files-and-immich-assets.md)

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
  repeats it without that tag.
- **`honeycomb_series_files` gains an index on `series_id`** for the sweep's `NOT EXISTS` lookup.
- **The table names stay.** Each is `honeycomb_` and a glossary word (*tag list*, *XMP cache*,
  *folder summary*); renaming them would touch every mapper and the admin guides for no reader.
- **No `hasTable` guard.** An instance that ran the old chain fails the migration on its first
  existing table instead of keeping a schema the code no longer expects; it reinstalls the app
  ([updating](../../user/admin/updating.md)).
- `tests/php-db/SchemaTest.php` compares the live schema on SQLite, MariaDB and PostgreSQL with
  `tests/fixtures/schema/honeycomb.json`, taken from the old chain and changed only as listed here,
  and checks the index name rule.

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
