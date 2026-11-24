# Database performance, measured 2026-11-24

Source: the architecture review of 2026-11-24, which asked to measure the indexes and transactions of
the baseline migration (ADR 0055) instead of guessing. Nothing here changes the schema: no
measurement showed an index or a smaller transaction paying off.

## Method
`tests/php-db/DatabaseBenchTest.php` fills the real tables with synthetic rows through the real
mappers and times them. It runs on SQLite, MariaDB 11.4 and PostgreSQL 17 inside the newest e2e
Nextcloud image, on one developer machine, in Docker:

```sh
HONEYCOMB_DB=sqlite|mariadb|postgres scripts/php-db-tests.sh --group bench --filter DatabaseBenchTest
```

Queries are the median of 15 runs after `ANALYZE`; saves are one run. Rows: 60,000 `xmp_cache` rows
(80 % read, the rest `none`), 12,000 for each of five users sharing the same files, and 50,000 Immich
decisions of one user plus 50,000 of a second and 10,000 of a third (three connections), three
assets per second so the asset id breaks ties. The numbers compare options on one machine; they
are not a promise for a production host.

## Results
| Measure | SQLite | MariaDB | PostgreSQL |
|---|---|---|---|
| `readCounts`, 60,000 rows | 9.6 ms | 30 ms | 7.7 ms |
| `readCounts`, 12,000 rows | 1.8 ms | 8.2 ms | 1.7 ms |
| `readCounts` with index `(user_id, state)` | 9.4 ms | 28.5 ms | 5.6 ms |
| `readCounts` with index `(user_id, state, flag, rating)` | 17 ms | 27 ms | 5.6 ms |
| Save 60,000 `xmp_cache` rows, one transaction | 0.38 s | 0.66 s | 1.04 s |
| The same in 12 transactions of 5,000 | 0.38 s | 0.62 s | 1.03 s |
| The same again over existing rows | 0.46 s | 0.99 s | 1.10 s |
| `xmp_cache` find of 500 ids, 60,000 rows of one user | 1.0 ms | 1.8 ms | 1.2 ms |
| The same, 12,000 rows of five users sharing files | 1.0 ms | 1.7 ms | 1.1 ms |
| Save five users × 12,000 rows against one shared copy | 0.34 s / 0.09 s | 0.60 s / 0.12 s | 0.99 s / 0.20 s |
| Save 50,000 Immich decisions, one transaction | 0.53 s | 1.36 s | 1.76 s |
| The same in 10 transactions of 5,000 | 0.79 s | 1.24 s | 1.85 s |
| Immich page (200 rows), first | 53 ms | 145 ms | 150 ms |
| Immich page after the middle of 50,000 | 38 ms | 73 ms | 144 ms |
| Immich page with flag and device filter | 19 ms | 70 ms | 52 ms |
| Immich page of the last ten minutes | 0.4 ms | 4.9 ms | 135 ms |
| Immich decision groups of a connection | 31 ms | 67 ms | 140 ms |
| The same pages with index `(connection_id, taken_at, asset_id)` | within 1 ms | within 8 ms | within 1 ms |

## Findings and decisions
- **`readCounts` needs no index.** The unique key `(user_id, file_id)` already narrows to the user's
  rows; the statistics call costs 8–30 ms at 60,000 rows. A narrower index saves at most 2 ms, and
  the covering one makes SQLite slower.
- **One transaction for a save is fine.** 60,000 cache rows take 0.4–1.0 s and 50,000 Immich
  decisions 0.5–1.8 s in one transaction; chunks of 5,000 are no faster. No change.
- **The Immich page gains nothing from a `(connection_id, taken_at, asset_id)` index.** The times
  stay the same with it, so the join and its sort are the cost (the query plan was not read). A
  page costs 40–150 ms at 50,000 decisions, which stays. If a library grows past several hundred
  thousand decisions, first keep the sort key in the decisions table (a migration, so an ADR),
  once a measurement says so.
- **`xmp_cache` per user, not shared.** A shared table would hold 1/5 of the rows for five users
  who share files and save about 4× faster, but lookups are equal (1–2 ms either way), and the
  per-user row keeps each user's own ETag and read state. Sharing is a data-model change for no
  measured gain on reads: not done. Reconsider if the table size, not speed, becomes the issue.
- **Why no migration.** The baseline of 0.2.0 stays as it is.
