# IMMICH-004 – Write to Immich

- Status: accepted
- Area: immich
- Origin: ADR 0041 Phase 2, ADR 0043, ADR 0044; Phase 1 mockup and the owner's
  sign-off condition of 2026-11-20, [mockup](../../mockup/immich/index.html) (phase 2)
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
- **What is pending:** an asset whose flag or rating differs from what honeycomb last wrote for it,
  or, never written, one that is picked, rejected or rated. A field already as decided in Immich
  is not sent; an asset with nothing left to send counts as written. A trashed reject gets nothing
  else; a pick taken back stops being a favourite on a connection with `picksAsFavorites`.
- **Blocks of 100:** `write/check` and `write` take at most 100 assets per request; the browser
  sends the blocks in sequence and shows the progress per block.
- **The candidates:** the write plans over every decision the user saved on the connection, which
  `write/candidates` answers in pages of 500 with what was last written for each, from honeycomb's
  tables alone.
- **The check:** before writing, every affected asset is reloaded and its `updatedAt` compared with
  the one saved with the decision. A changed rating is resolved per asset (*Keep honeycomb’s*, the
  default, or *Keep Immich’s*); an asset in a shared album offers *Trash anyway*, *Archive
  instead* or *Skip*; one already in Immich's trash bin counts as done; the top of a stack goes
  alone. *Keep Immich’s* saves Immich's rating in honeycomb, Immich's −1 as no stars. The
  server's `write/check` answers only Immich's state of each asset it still holds (`updatedAt`,
  rating, favourite, trash bin, archive, the first shared album with the number of its other
  members, the size of a stack it tops); the write plan in the browser finds the conflicts, and an
  asset Immich no longer holds is left out.
- **The write:** the server's `write` takes the changes the write plan made, per asset the fields
  it sets in Immich and the rating Immich holds afterwards. It trashes the trashed ones in one
  `DELETE /assets` (`force:false`), restores the restored ones in one `POST /trash/restore/assets`,
  then sets favourite, archive and rating with one `PUT /assets/{id}` each; a bulk call Immich
  refuses is repeated per asset, so a refused asset fails alone. It trashes only an asset whose
  saved decision is a reject. Once Immich does not answer or refuses the key, every asset not yet
  written fails with that error. For each written asset it stores the saved decision's flag and
  rating and Immich's rating as what was last written; a later save of the decision keeps them.
- **The run in the browser:** the check asks `write/check` for the pending candidates only; a
  block that fails stops it, so nothing is written. The write sends the plan's changes and its done
  assets, a done one without a field so honeycomb stores it as written, each with the rating Immich
  holds afterwards; a skipped asset is answered as skipped, a gone one not at all. A block whose
  request fails fails its assets and every one not yet sent, and nothing more is sent.
- **The button:** *Write to Immich* names how many assets are pending, from the write candidates
  loaded when the connection opens and after a write, with the decisions made since; it is
  disabled at 0 and shows no number while the candidates cannot be loaded.
- **The dialog** names the counts of rejects, of rejects taken back, of picks and of ratings, the
  choice for rejects and the conflicts. With more than 100 affected assets it shows numbers and
  the conflicts only, never a thumbnail per asset; up to 100, the rejects, the rejects taken back
  and the picks each show a strip of their thumbnails. *Write N changes* is disabled at 0 or while
  Immich does not answer.
- **The dialog in the browser:** *Write to Immich* in the Immich source's toolbar opens it. It
  loads the candidates and checks the pending ones with the progress per block; a failed load or
  check shows that Immich does not answer and keeps *Write N changes* disabled. Ready, it shows the
  counts, the strips of a small write, the reject choice and each conflict with its thumbnail and
  choices; a choice plans the write again. *Write N changes* writes with the progress per block, then the dialog shows the
  result with *Close*; the next open plans what is still pending. Saving *Keep Immich’s* in honeycomb
  and the scope check come in later steps.
- **Results** per asset: written, skipped or failed. A failed asset keeps its decision and is
  offered again; the others are written. The result says *Written: N* or *Written: N · Failed:
  M*, a failed asset names its state, never Immich's text. After trashing, the toast *Moved N
  pictures to the Immich trash* offers *Undo*, which restores them.
- **Scopes:** `asset.update` for rating, favourite and archive, `asset.delete` for the trash bin,
  `album.read` for the check's shared albums.
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
  conflict only; the counts leave out what is not sent: a skipped asset, and the rating of a reject
  going to the trash bin or rated −1

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

### IMMICH-004.15 – What is pending

- **Given** assets decided in honeycomb, some of them written before
- **When** the write is planned
- **Then** an asset is pending when its flag or rating differs from what was last written, or,
  never written, when it is picked, rejected or rated; a colour label or *Keep RAW* alone is not

### IMMICH-004.16 – The top of a stack

- **Given** a reject that is the top of a stack, and the trash or the archive choice
- **When** the check runs
- **Then** the dialog names the stack's size and that only this asset goes

### IMMICH-004.17 – A pick taken back

- **Given** an asset written as a pick on a connection with `picksAsFavorites`, now unflagged
- **When** the user writes
- **Then** it stops being a favourite in Immich; without `picksAsFavorites` nothing is sent for it

### IMMICH-004.18 – The check reloads the assets

- **Given** asked assets of which one is in Immich's trash bin, one archived, one in a shared album,
  one the top of a stack and one no longer held by Immich
- **When** `write/check` runs
- **Then** it answers each held asset's `updatedAt`, rating, favourite, trash bin and archive state,
  the shared album's name and number of other members and the stack's size, leaves out the one
  Immich no longer holds, and a body with no asset, a malformed id or an id twice is `400`
  `request`

### IMMICH-004.19 – The write sends the changes

- **Given** a block with a trashed, a restored and an archived and rated asset
- **When** `write` runs
- **Then** Immich receives one `DELETE /assets` with `force:false`, one `POST
  /trash/restore/assets` and one `PUT /assets/{id}`, each asset answers `written`, and a body with
  an unknown field, a malformed id or rating, an id twice or a trash beside another field is `400`
  `request`

### IMMICH-004.20 – Only a reject is trashed

- **Given** a trash for an asset whose saved decision is not a reject, or that has no decision
- **When** `write` runs
- **Then** that asset fails with `request` or `unknown-asset` and nothing is trashed for it

### IMMICH-004.21 – What was written is stored

- **Given** a write in which one asset is written and one fails
- **When** the decisions are read again, also after a later save of the written asset's decision
- **Then** the written asset keeps the flag and rating it was written with and Immich's rating
  afterwards, and the failed one has no written state

### IMMICH-004.22 – The write candidates

- **Given** decisions of the user's on a connection, one written before, one of another user, and
  more than one page of them
- **When** the browser loads the write candidates
- **Then** `write/candidates` answers each of the user's own decisions with what was last written
  for it and Immich's `updatedAt` when it was decided, ordered by asset id in pages of 500 with
  `nextCursor`, without asking Immich, and a malformed cursor is `400` `request`

### IMMICH-004.23 – The check in blocks

- **Given** 250 pending candidates beside ones not pending
- **When** the browser checks them
- **Then** it asks `write/check` for the pending ones only, in blocks of 100, 100 and 50, one after
  the other, with the progress after each block, and a block that fails stops the check with its
  error

### IMMICH-004.24 – The write in blocks

- **Given** a write plan with changes, assets already done, skipped and gone
- **When** the browser writes it
- **Then** it sends the changes and the done assets in blocks of 100 with the rating Immich holds
  afterwards, answers each sent asset's result and the skipped ones as skipped, and once a block's
  request fails, that block's assets and the ones not yet sent fail and nothing more is sent

### IMMICH-004.25 – The dialog

- **Given** rejects, a pick and a rating pending, one reject the top of a stack
- **When** the user opens *Write to Immich*
- **Then** the dialog checks them with the progress per block, then names the counts of rejects,
  of rejects taken back, of picks and of ratings, the reject choice and the stack's conflict with
  its thumbnail, and offers *Write N changes*; a choice plans the write again

### IMMICH-004.26 – The result in the dialog

- **Given** the dialog ready with N changes
- **When** the user writes
- **Then** it shows the progress per block, then *Written: N*, or *Written: N · Failed: M*, with
  *Close*, and opened again it plans only what is still pending; a failed asset shows its
  thumbnail, more than 100 failed show their number only

### IMMICH-004.27 – The pending count on the button

- **Given** a connection with pending assets, one of them written before
- **When** its screen opens, the user decides an asset, the filters change, or a write ends
- **Then** *Write to Immich* names the number of pending assets, counting each decision made since
  the candidates were loaded, is disabled at 0, and while the candidates cannot be loaded shows
  no number and stays enabled

### IMMICH-004.28 – The thumbnail strips of a small write

- **Given** at most 100 affected assets with rejects, a reject taken back, a pick and a rating, and
  a write of more than 100
- **When** the dialog opens
- **Then** the rejects, the rejects taken back and the picks each show a strip with the thumbnail
  of every asset they count, the ratings show none, and the larger write shows no strip
