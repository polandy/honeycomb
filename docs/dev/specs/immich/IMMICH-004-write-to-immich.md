# IMMICH-004 – Write to Immich

- Status: accepted
- Area: immich
- Origin: ADR 0041 Phase 2, ADR 0043, ADR 0044; Phase 1 mockup and the owner's sign-off condition
  of 2026-11-20
- Depends on: IMMICH-001, IMMICH-002, IMMICH-003

## Purpose

*Write to Immich* is the explicit step of Phase 2 that sends the picks, rejects and ratings made in
honeycomb to Immich, after checking that Immich has not changed them meanwhile. Nothing is final:
a reject goes to the Immich trash bin by default and can be restored.

## Behaviour

- **What happens:** a reject becomes the Immich trash bin (`DELETE /assets`, `force:false`), or,
  chosen in the dialog, *Archive* or *Rating “rejected” only* (rating −1); a pick becomes a
  favourite only on a connection with `picksAsFavorites`; a rating 1–5 is set, 0 clears Immich's
  rating; colour label and *Keep RAW* are not written. A reject taken back restores the asset from
  the trash bin or the archive. `force:true` is never sent.
- **Blocks of 100:** `write/check` and `write` take at most 100 assets per request; the browser
  sends the blocks in sequence and shows the progress per block.
- **The check:** before writing, every affected asset is reloaded and its `updatedAt` compared with
  the one saved with the decision. A changed rating is resolved per asset (*Keep honeycomb’s*, the
  default, or *Keep Immich’s*); an asset in a shared album offers *Trash anyway*, *Archive
  instead* or *Skip*; one already in Immich's trash bin counts as done; the top of a stack goes
  alone.
- **The dialog** names the counts of rejects, of rejects taken back, of picks and of ratings, the
  choice for rejects and the conflicts. With more than 100 affected assets it shows numbers and
  the conflicts only, never a thumbnail per asset. *Write N changes* is disabled at 0 or while
  Immich does not answer.
- **Results** per asset: written, skipped or failed. A failed asset keeps its decision and is
  offered again; the others are written. The result says *Written: N* or *Written: N · Failed:
  M*, a failed asset names its state, never Immich's text. After trashing, the toast *Moved N
  pictures to the Immich trash* offers *Undo*, which restores them.
- **Scopes:** `asset.update` for rating, favourite and archive, `asset.delete` for the trash bin.
  Without `asset.delete` the trash choice is disabled with *Your API key lacks `asset.delete`*
  and rejects default to *Archive*.
- **Statistics:** a written decision counts in STATS-001 from this phase on.

## Acceptance criteria

### IMMICH-004.1 – Rejects to the trash bin

- **Given** three rejected assets and the default choice
- **When** the user writes
- **Then** Immich receives `DELETE /assets` with their ids and `force:false`, and the toast offers
  *Undo*

### IMMICH-004.2 – Never for good

- **Given** any write body, including one that asks for `force:true`
- **When** it reaches the server
- **Then** no request to Immich carries `force:true`, and such a body is `400` `request`

### IMMICH-004.3 – Archive or rating only

- **Given** rejects and the choice *Archive*, or *Rating “rejected” only*
- **When** the user writes
- **Then** they are archived, or rated −1, and none is trashed

### IMMICH-004.4 – Picks and ratings

- **Given** picks and ratings on a connection with and one without `picksAsFavorites`
- **When** the user writes
- **Then** ratings 1–5 are set and 0 clears the rating on both; picks become favourites only on
  the first

### IMMICH-004.5 – Blocks of 100

- **Given** 250 affected assets
- **When** the user writes
- **Then** the check and the write go in blocks of 100, 100 and 50, one after the other, and a
  request with more than 100 assets is `400`

### IMMICH-004.6 – A large write as numbers

- **Given** more than 100 affected assets
- **When** the dialog opens
- **Then** it shows the counts per kind of change and the conflicts, with a thumbnail for each
  conflict only

### IMMICH-004.7 – A rating changed in Immich

- **Given** an asset whose `updatedAt` and rating changed in Immich since the decision was saved
- **When** the check runs
- **Then** the dialog offers *Keep honeycomb’s* (preselected) or *Keep Immich’s*, and the write
  follows the choice

### IMMICH-004.8 – A shared album

- **Given** a reject in a shared album and the trash choice
- **When** the check runs
- **Then** the dialog names the album and offers *Trash anyway*, *Archive instead* or *Skip*

### IMMICH-004.9 – Already trashed

- **Given** a reject already in Immich's trash bin
- **When** the user writes
- **Then** it counts as done and nothing is sent for it

### IMMICH-004.10 – A partial failure

- **Given** a block where Immich refuses one asset
- **When** the write ends
- **Then** the others are written, the result says *Written: N · Failed: 1*, and the failed asset
  keeps its decision and is offered again next time

### IMMICH-004.11 – A reject taken back

- **Given** an asset written as a reject, now unflagged in honeycomb
- **When** the user writes
- **Then** it is restored from the Immich trash bin, or the archive

### IMMICH-004.12 – Without `asset.delete`

- **Given** a key without `asset.delete`
- **When** the dialog opens, or a trash write meets Immich's `403`
- **Then** the trash choice is disabled with *Your API key lacks `asset.delete`*, and rejects
  default to *Archive*

### IMMICH-004.13 – Immich down

- **Given** an Immich that does not answer
- **When** the dialog opens
- **Then** *Write N changes* is disabled and the decisions stay in honeycomb

### IMMICH-004.14 – Statistics

- **Given** a write that trashed and rated assets
- **When** the statistics are read
- **Then** they count the written results
