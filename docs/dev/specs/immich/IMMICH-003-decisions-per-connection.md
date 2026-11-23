# IMMICH-003 – Decisions per connection

- Status: accepted
- Area: immich
- Origin: ADR 0041, ADR 0043, ADR 0044, ADR 0054, [mockup](../../mockup/immich/index.html)
- Depends on: IMMICH-001, IMMICH-002, DECISIONS-002, LOUPE-002

## Purpose

In Phase 1 nothing is written to Immich: the user picks, rejects and rates in honeycomb, and the
whole decision of each asset is kept per (connection, asset id) in the decision table.

## Behaviour

- **Save:** `PUT /apps/honeycomb/api/v1/immich/{connectionId}/decisions` with `{"decisions":
  [{"assetId", "rating", "colourLabel", "flag", "keepRaw", "takenAt", "cameraModel", "kind",
  "assetUpdatedAt"}]}`, at most the flags endpoint's limit, answers `{"saved": [assetIds]}`. Each
  decision is the asset's whole state; the last save wins; an undo is a new save of the earlier
  values; an asset named twice in one save keeps its last decision. The write rate limit
  applies. The save calls no Immich and needs no scope, so it works while Immich is down; every
  connection is rateable.
- **Read:** a listing entry carries its decision, `UNDECIDED` without a row (rating 0, no colour
  label, unflagged, no *Keep RAW*). No route returns the rows as they are.
- **Storage:** the decision (flag, *Keep RAW*, rating, colour label, `updated_at`) is a row of
  the source `immich` in `honeycomb_decisions` (ADR 0054), the facets copied from the listing
  (`takenAt`, `cameraModel`, `kind`, `assetUpdatedAt`) a row of `honeycomb_immich_assets`, both
  keyed by (connection, asset id) and the user. The decision filter and the counts join the two.
  The Immich decisions never read, change or remove a row of the source `file` (IMMICH-003.22).
- **Keys and the UI** are the cull's (KEYS-001, LOUPE-002): *P*, *X*, *U*, *1*–*5*, *0*, swipe up
  and down, auto-advance after a pick or reject, the reject toast with *Undo*. A rejected tile is
  dimmed; nothing is deleted, and no tile says "Not written to Immich" in Phase 1.
- **Undo and redo** are the cull's history (KEYS-001.10, .11): every decision is one step,
  `Ctrl+Z` and `Ctrl+Shift+Z` take steps back and put them again in the grid and the loupe, and
  the toast's *Undo* takes the latest step back. Each undo or redo is a new save. A decision that
  changes nothing is no step and is not saved. Opening a connection starts an empty history.
- **One save at a time:** the cull sends a connection's saves in order, one at a time, so a quick
  undo never reaches the server before the decision it takes back. Decisions made while a save is
  in flight go in the next save together, the newest per asset. A failed save puts back only the
  decisions no later save stored.
- **Bulk steps** save every affected asset in requests of at most the limit; assets past the
  loaded page are paged through the decision filter first.
- **Lifecycle:** a deleted user's rows go at once; rows of a connection that left the file go in
  the daily sweep, which sweeps nothing while the file is not configured, missing or invalid; a
  row whose asset Immich no longer lists in the upload library (deleted, trashed or archived there)
  is deleted when a decision filter asks for it. A connection's position goes with its rows once
  positions of a connection exist (IMMICH-003.18).
- **Position and *Recent*:** the cull saves the loupe's asset as the connection's position through
  the positions endpoint (`{"immich": "<connectionId>"}`, `assetId`, `takenAt`, `decided`,
  `total`). Opening the connection offers *Continue where you left off*, and *Resume* opens the
  loupe at that asset through the listing's `from`. *Recent* lists a connection by its label with
  *x / y decided*, beside the folder sets.
- **Statistics:** Phase 1 decisions count nothing (ADR 0043); `honeycomb_stats` is unchanged.

## Acceptance criteria

### IMMICH-003.1 – Save and read back

- **Given** an asset without a row
- **When** the user picks it and rates it 3, and the listing is read again
- **Then** the entry carries rating 3, flag `picked`, and the save answered its asset id

### IMMICH-003.2 – Undecided without a row

- **Given** an asset no one has decided on
- **When** it is listed
- **Then** its entry carries rating 0, colour label `null`, flag `unflagged` and `keepRaw` false

### IMMICH-003.3 – The whole state, last save wins

- **Given** a row with rating 4 and flag `picked`
- **When** a save sends rating 0 and flag `unflagged` for it
- **Then** the row holds exactly the second save, with `updated_at` from the clock

### IMMICH-003.4 – Undo is a new save

- **Given** a rejected asset
- **When** the user takes the reject back with *Undo*
- **Then** a save sends the earlier decision, and the entry is undecided again

### IMMICH-003.5 – Malformed body

- **Given** a save with an asset id that is not a UUID, a rating outside 0 to 5, an unknown colour
  label, flag or kind, a `takenAt` that is not an integer, a missing field, or more decisions
  than the limit
- **When** it is sent
- **Then** the answer is `400` `request` and nothing is saved

### IMMICH-003.6 – Another user's connection

- **Given** a connection id the file does not name for the user
- **When** they save a decision for it
- **Then** the answer is `404` `unknown-connection` and nothing is saved

### IMMICH-003.7 – Saving while Immich is down

- **Given** a connection whose Immich does not answer
- **When** the user decides on a loaded asset
- **Then** the save succeeds without calling Immich

### IMMICH-003.8 – Connections are apart

- **Given** the same asset id under two connections of the user
- **When** one is picked
- **Then** the other stays undecided

### IMMICH-003.9 – A deleted user

- **Given** a user with rows under a connection
- **When** the user is deleted
- **Then** their rows are gone, also while the connections file is invalid

### IMMICH-003.10 – A connection that left the file

- **Given** rows of a connection the valid file no longer names, or names for another user
- **When** the daily sweep runs
- **Then** those rows are removed and the rows of the file's connections stay

### IMMICH-003.11 – No sweep on a broken file

- **Given** rows and a connections file that is not configured, missing or invalid
- **When** the daily sweep runs
- **Then** no row is removed

### IMMICH-003.12 – An asset gone in Immich

- **Given** a picked asset that Immich reports as deleted, and another that is only in Immich's
  trash bin or archived
- **When** the user filters to *Picked* only
- **Then** neither shows; the deleted asset's row is deleted in the same request and the counts no
  longer hold it; the trashed or archived asset keeps its row, so restoring it in Immich brings
  its decision back
- **Note** Measured against Immich 3.4.2: a search by ids without `trashedAt` and `visibility`
  filters answers live, trashed and archived assets; an asset deleted for good is absent from it
  (measured by hand, not recorded). The fixtures `search-held-by-ids.json` and
  `search-uploads-by-ids.json` record the first three.

### IMMICH-003.13 – Keys and auto-advance

- **Given** the loupe on an Immich asset
- **When** the user presses *X*
- **Then** the asset is rejected, the toast offers *Undo*, the loupe moves to the next undecided
  asset, and nothing is sent to Immich

### IMMICH-003.14 – Resume position

- **Given** a cull of a connection stopped at the 600th asset of 1,000
- **When** the user opens the connection on another device and taps *Resume*
- **Then** the loupe opens at that asset, loaded through the listing's `from`, and the newer
  assets load when the user scrolls back up

### IMMICH-003.15 – *Recent*

- **Given** a position of a connection and one of a folder set
- **When** *Recent* renders
- **Then** it lists both, newest first, the connection by its label with *x / y decided*

### IMMICH-003.16 – No statistics in Phase 1

- **Given** a user who picks and rejects Immich assets
- **When** the statistics are read
- **Then** they are unchanged

### IMMICH-003.17 – An asset twice in one save

- **Given** a save that names the same asset twice, first picked and then rejected
- **When** it is sent
- **Then** the row holds the rejected decision and the answer names the asset once

### IMMICH-003.18 – The position goes with the sweep

- **Given** a position of a connection the valid file no longer names for the user
- **When** the daily sweep runs
- **Then** the position is removed with the connection's rows

### IMMICH-003.19 – Undo chain

- **Given** an Immich cull where the user rated one asset and then rejected another
- **When** they press `Ctrl+Z` twice and then `Ctrl+Shift+Z`
- **Then** the reject is taken back first and the rating second, each as a new save and with a
  toast *Undid: …*; the redo saves the rating again

### IMMICH-003.20 – One save at a time

- **Given** an Immich cull whose save of a reject is still in flight
- **When** the user rates another asset and takes both steps back
- **Then** no second save starts until the first is answered, and the next save carries both
  assets once, each with its newest decision

### IMMICH-003.21 – A failed save puts back only what no later save stored

- **Given** an Immich cull that rejected two assets and then picked the first, while the reject
  was in flight
- **When** the reject's save fails and the pick's save succeeds
- **Then** the first asset stays picked, the second is unflagged again, the counts follow, and
  the user is told once

### IMMICH-003.22 – The decision table holds the decision, the asset table the facets

- **Given** file rows in `honeycomb_decisions`
- **When** a user saves, removes, sweeps or forgets Immich decisions
- **Then** each decision is one row of the source `immich` with the connection, asset id, user,
  flag, *Keep RAW*, rating, colour label and `updated_at`, its facets one row of
  `honeycomb_immich_assets`, and the file rows are unchanged
