# 0043 – Immich decisions in a table of their own, per connection and asset

- Status: accepted
- Date: 2026-11-19
- Extends: [0041](0041-immich-as-an-external-picture-source.md),
  [0042](0042-declarative-immich-connections.md)
- Leaves unchanged: [0040](0040-flags-per-picture-in-the-database.md),
  [0039](0039-statistics-as-daily-counters.md)

## Context

ADR 0041 decided, with the architecture review of 2026-11-19 (decision 2, measures M11 and
M12), that the **whole decision** of an Immich asset lives in honeycomb's database per
(connection, asset id), in a table of its own that is a `UserRowStore` and never a
`FileRowStore`, and left the table's columns and endpoints to this ADR. ADR 0042 made the
connection's `id` from the connections file the stable key and said that the rows of a connection
that left the file go with the daily sweep. The owner decided on 2026-11-19 that Immich decisions
do not count in the statistics in Phase 1. Those decisions are binding here; this ADR fixes the
shape they left open.

`honeycomb_flags` (ADR 0040) cannot hold these rows. It is keyed by a Nextcloud file id, has no
user, and holds the flag and *Keep RAW* only, because a Nextcloud picture's rating and colour label
live in its sidecar. An Immich asset has no file id and no sidecar: the table is the only place
for all four values. The two kinds of rows also live differently: a file row follows its file
(carried over on a move to another storage, swept when the file is deleted for good), an Immich
row follows its connection and its user.

The options were:

- **A, widen `honeycomb_flags`** with nullable connection, asset, rating and colour columns. One
  table, two shapes: every `FlagStore` query branches on which key is set, and the file sweep and
  `carryOver` would meet rows without a file id.
- **B, a table of its own for the whole decision**, chosen: one shape per table, one lifecycle
  per table, `honeycomb_flags` untouched.
- **C, flag and *Keep RAW* only**, with rating and colour label written to Immich at once. Phase 1
  is read only, so a rating would be lost; and Immich has no colour label at all (review,
  decision 2).

## Decision

### The table `honeycomb_immich_assets`

One row per asset the user has decided on, holding the whole `Decision` of
`src/logic/decision.ts`. A live photo is one asset and one row; for a stack the row is keyed by
the asset that is shown (ADR 0041).

| Column | Type | Rule |
|---|---|---|
| `id` | bigint, autoincrement | primary key, like every honeycomb table |
| `connection_id` | string 64 | the connection's `id` from the connections file (ADR 0042) |
| `asset_id` | string 36 | the Immich asset id, a UUID in lower case |
| `user_id` | string 64 | the Nextcloud user the connection belonged to when the row was written |
| `rating` | smallint | 0 to 5, honeycomb's value; 0 is undecided and becomes Immich's `null` (ADR 0041) |
| `colour_label` | string 16, nullable | one of the nine `COLOUR_LABELS`, or null |
| `flag` | string 16 | `picked`, `rejected`, `unflagged` |
| `keep_raw` | boolean | kept so that the pure logic sees one `Decision`; Phase 1 never sets it |
| `asset_updated_at` | string 32 | Immich's `updatedAt` as the listing delivered it when the decision was saved; compared for equality in Phase 2, never parsed |
| `updated_at` | bigint | from the injected clock |

A unique index on `(connection_id, asset_id)`. The name is not `honeycomb_immich_decisions`
because Nextcloud limits a table with an autoincrement key to 23 characters.

`user_id` is in the row although the file maps a connection to its user: `forgetUser` must work
while the file is missing or invalid, a deleted user's rows go at once, and a connection id the
admin later gives to another user leaves the old rows to the sweep instead of handing them over.

`asset_updated_at` is in the row, not in the browser, so that Phase 2's conflict check compares
with the moment the decision was made, on any device and after any reload. The Immich listing
therefore carries Immich's `updatedAt` in every entry (the source's API ADR).

### A `UserRowStore` and nothing else

1. **`ImmichDecisionStore extends UserRowStore`**, implemented by one mapper, registered with one
   alias in `Application.php` and one entry in `UserRowStores`. `forgetUser` removes every row
   with the user's id.
2. **Not a `FileRowStore`:** no `carryOver`, no row-id cursor, no entry in `FileRowStores`; the
   file sweep of `RemoveVanishedDecisions` never sees the table. `honeycomb_flags`, `FlagStore`
   and the flags endpoints stay as ADR 0040 has them, and the comment on `UserRowStores` that the
   flags are no one's stays true.
3. **No take-over.** There is no sidecar to read; an asset without a row is `UNDECIDED`.

### Reading: in the listing only

The Immich listing (the source's API ADR) joins the assets of the page it returns with their
rows and gives every entry `rating`, `colourLabel`, `flag` and `keepRaw`, `UNDECIDED` without a
row, beside Immich's `updatedAt`. There is no lookup of arbitrary asset ids and no listing of a
connection's rows: the server answers for the signed-in user's connection and the assets Immich
returned, nothing else.

### Saving

1. **`PUT /apps/honeycomb/api/v1/immich/{connectionId}/decisions`** with `{"decisions":
   [{"assetId", "rating", "colourLabel", "flag", "keepRaw", "assetUpdatedAt"}]}`, at most as many
   as the flags endpoint takes (the one limit constant), answers `{"saved": [assetIds]}`. Each
   decision is the asset's whole state; the rows are inserted or updated by `(connection_id,
   asset_id)` in one transaction, `user_id` and `updated_at` set on every write. The last save
   wins; an undo is a new save of the earlier values (ADR 0040). A decision that equals
   `UNDECIDED` is written like any other, so the save has one path.
2. **The connection is checked on every request** (ADR 0042): a `connectionId` the file does not
   name for the signed-in user is a `404`, before anything is read or written. The connections
   file missing or invalid is the same typed error every Immich endpoint gives (ADR 0042's table;
   the source's API ADR names the status). The write rate limit applies (ADR 0031).
3. **A malformed body is a `400` for the whole request:** an asset id that is not a UUID, a rating
   outside 0 to 5, an unknown colour label or flag, a missing field, or more decisions than the
   limit. Nothing is saved then.
4. **No call to Immich on save.** The server checks the asset id's shape, not its existence, so a
   decision is saved while Immich is down (ADR 0041: decisions already made stay in honeycomb),
   needs no scope, and keeps the key out of the hot path. A row for an id Immich never returns is
   never shown and costs one row.
5. **Every connection is rateable.** The file gives it to the user, and Phase 1 writes nothing to
   Immich, so the key's scopes play no role here; Phase 2 reports a lacking scope per connection
   (ADR 0042).

### Lifecycle: throw-away data, as ADR 0040

- **A deleted user:** `forgetUser` through `UserRowStores`, like every user table.
- **A connection that left the file:** the daily sweep in `RemoveVanishedDecisions` (ADR 0042),
  as a step of its own beside the file sweep. It keeps a row only while the file names a
  connection with the row's `connection_id` for the row's `user_id`, and sweeps nothing while the
  file is not configured, missing or invalid.
- **An asset that is gone in Immich** keeps its row in Phase 1: no background job calls Immich,
  so no key is read outside a user's request and no scope is needed for housekeeping. The row is
  never shown. Phase 2 decides in its spec what happens to the row of an asset it wrote to Immich.
- **A bulk step** of the Phase 1 UI (for example clearing the picks and rejects of a connection)
  is a save of every affected asset through the endpoint above; the specs name the steps.

### Statistics in Phase 1

The decisions endpoint counts nothing. `honeycomb_stats`, STATS-001 and ADR 0039 stay as they
are, and `pictures_decided` counts Nextcloud pictures only. Nothing of a Phase 1 decision has
happened to the asset yet, so there is no result to count, and a read-only decision must not
inflate the numbers of a cull that trashed and moved files. Phase 2 (PR 13 of ADR 0041) lets
Immich decisions enter the statistics with *Write to Immich*, where a decision becomes a result,
and amends STATS-001 then.

### Implementation order

The pull requests are those of ADR 0041's order; this ADR says what each adds for the table.

| ADR 0041 PR | What this ADR adds to it |
|---|---|
| 3 `docs(specs)` | the spec *decisions per connection*: the fields, the save and its errors, the lifecycle, no statistics in Phase 1 |
| 7 `feat(immich)` | the migration (its number is the one shared line), `ImmichDecisionStore` and its mapper, the controller with the save endpoint and its validation, the entry in `UserRowStores`, the connection sweep as a step of `RemoveVanishedDecisions`; after PR 6, whose connection registry the access check needs, and after the sign-off |
| 8 `feat(immich)` | pure TypeScript: an entry's four fields to a `Decision`, `UNDECIDED` without a row |
| 10 `feat(immich)` (b) | grid and loupe save through the endpoint, undo as a new save, every connection rateable |
| 11 `test(e2e)` | against the stub: a decision survives a reload; the fixture's second connection sees none of the first's rows |
| 13 `feat(immich)` | Phase 2 reads `asset_updated_at` for the conflict check, decides the row of a written asset, and lets Immich decisions enter the statistics |

PR 7 touches new files and one-line registrations only (`Application.php`, the `UserRowStores`
constructor, the migration number), as ADR 0041's hotspot rule demands.

## Consequences

- Two storage shapes for one `Decision` (ADR 0041): a Nextcloud picture's rating and colour label
  in the sidecar and its flag in `honeycomb_flags`, an Immich asset's four values in one row. The
  pure logic sees one `Decision` either way, and neither table knows the other.
- A row is a few hundred bytes; a fully decided library of fifty thousand assets is about ten
  megabytes. `user_id` costs up to 64 bytes per row and buys a `forgetUser` that needs no file.
- Rows of assets deleted in Immich linger, invisible, until the connection leaves the file or the
  user is deleted. Accepted in Phase 1 rather than a job that holds a key.
- A connection id the admin gives to another user starts empty for that user; the old rows go with
  the sweep within a day. Keeping the id for the same account is ADR 0042's rule anyway.
- Phase 2's conflict check works across devices and reloads, because the baseline travels with the
  decision; the price is one string per row and one field in every save.
- A user who culls only Immich sees unchanged statistics in Phase 1; the numbers mean the same as
  before. The first Immich numbers arrive with *Write to Immich*.
- Nothing in this ADR changes a byte of `honeycomb_flags`, `honeycomb_stats`, ADR 0040 or
  STATS-001; a reader of either can skip the Immich code.
