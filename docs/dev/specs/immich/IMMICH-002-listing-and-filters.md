# IMMICH-002 – Listing, filters and counts

- Status: accepted
- Area: immich
- Origin: ADR 0041, ADR 0044; Phase 1 mockup and the owner's sign-off condition of
  2026-11-20, [mockup](../../mockup/immich/index.html)
- Depends on: IMMICH-001, IMMICH-003, GRID-001, LOUPE-001

## Purpose

The grid and the loupe show one connection's upload library, however large, page by page: only
what is on screen is loaded, and every number comes from the server.

## Behaviour

- **The listing** (`POST …/immich/{connectionId}/assets`, ADR 0044) answers a page of at most
  `size` entries (1 to 250, default 100), newest capture time first, ties by asset id, with a
  `nextCursor` and a `previousCursor`. Only the upload library is listed; external libraries,
  trashed, archived, hidden and locked assets, audio and other files are left out. An upload
  during the paging shifts no page; it shows once the listing starts over.
- **From an asset:** a first request with `from` (`{"assetId", "takenAt"}`, no cursor) starts the
  page at that asset, uploads of its second split at it by asset id, or at the next older upload
  when the listing no longer holds it. Its `previousCursor` pages the newer entries, oldest of
  them last, until it answers `null`. `from` with a cursor, a malformed `from`, or `from` under a
  decision filter that admits decided assets only is a bad request.
- **An entry** is one picture: a live photo is one entry of kind `live`, a stack shows its
  primary asset with the stack's size. The grid groups entries under day headers.
- **Infinite scroll:** the grid loads the first page on open and the next one when its last loaded
  row comes within one screen of the viewport. Only tiles in or near the viewport load previews
  (`size=thumbnail`); the loupe shows `size=preview`. A page under a decision filter may be short
  or empty with a `nextCursor`; the grid asks again until it fills the screen or the cursor ends.
- **Loupe and filmstrip past the page:** stepping or swiping to within twelve entries of the last
  loaded one loads the next page; the filmstrip shows its neighbours as they arrive, and the
  counter *k / N* uses the server's total. A loupe opened at the resume position shows *N pictures*
  until the newer pages are loaded, since a page started at an asset carries no offset. The newer
  page loads when the loupe comes within twelve entries of the first loaded one, or on *Show newer
  photos* above the grid; the loupe stays on its asset as the page goes before it.
- **Filters:** time (*Last 7 days*, the months with uploads among the current month and the eleven
  before it, in the browser's time zone, *All phone uploads*; the current month by default),
  device (camera models and *No camera data*, any number), kind (*Photos*, *Motion photos*,
  *Videos*, any number) and the flag filter of GRID-002 with its rating filter. Groups
  combine with AND, chips in a group with OR. Changing a filter starts the listing over.
- **The filter bar** shows the time, device and kind options as chips in the style of the
  folder filter bar (GRID-002), each with its count once the counts arrive; while they are asked
  again the device chips of the last answer stay. *Clear filters* shows only while a filter
  differs from its default and brings back every default, the flag filter's included.
- **Kept per connection:** the chosen filters are stored in the view state (LOUPE-003.10) and come
  back when the connection opens again, on any device. A time left on the current month follows
  the calendar; a stored month no longer among the time options, or a value the app cannot read,
  falls back to its default.
- **Decision filters:** when the filter admits undecided assets, the listing pages Immich and
  leaves out the decided ones it refuses. When it admits decided assets only (*Picked* or
  *Rejected* alone, a rating above 0, a colour label), the listing pages the matching decisions by
  the capture time saved with them, newest first, and asks Immich for those assets by id. The
  grid, the listing, the counts and the decision query judge a decision by one rule: the flag is one
  of the chosen flags, the rating compares with the chosen stars, the colour label is one of the
  chosen labels (none passes no label chip).
- **A decision the filter refuses** takes the picture out of the grid without a request: when the
  loupe closes, or at once when the loupe is not open (an undo from the grid). While the loupe is
  open the picture stays, so the filmstrip and *k / N* do not jump. Undo and redo bring it back
  the same way; a page left short still loads the next one.
- **Counts** (`POST …/counts`): the toolbar's *N of M pictures · K decided* (`matching`, `total`,
  `decided`), the flag chips'
  numbers, and each time, device and kind option's number, all from the server for the active
  filters; a facet counts under the filters of the other groups. The device options are Immich's
  camera models with at least one upload under those filters, and every chosen one. At most 50
  time options are counted per request. A decision changes the counts in place without a request;
  a change of a filter asks again.
- **Previews** go through honeycomb (`GET …/assets/{assetId}/image`), cached by the browser for a
  year under a URL that names the asset's `updatedAt`.
- **Capabilities off:** no series, similarity, tags, delete, move, *Remove RAWs*, *Keep RAW* or
  XMP for an Immich source; their buttons, keys and menu entries do not show.
- **Empty view:** "No photos match. Change the time, device or flag filter." with *Clear filters*,
  which shows the default filters again from the listing's start; on the default filters it does
  not show, since it would change nothing.
- **A failed page** keeps the pages already shown and offers *Try again* at the end of the grid;
  the error names the state (IMMICH-001), never Immich's text.

## Acceptance criteria

### IMMICH-002.1 – A page and its cursor

- **Given** a connection with 250 uploads
- **When** the listing is asked with `size` 100 and then with each `nextCursor`
- **Then** three pages of 100, 100 and 50 arrive, newest first, no asset twice or missing, and the
  last `nextCursor` is `null`

### IMMICH-002.2 – Ties on one second

- **Given** several uploads with the same capture time across a page boundary
- **When** the pages are read
- **Then** they are ordered by asset id and each appears once

### IMMICH-002.3 – Upload library only

- **Given** Immich assets in the upload library, in an external library, in the trash bin and in
  the archive
- **When** the listing is read
- **Then** only the upload library's visible photos and videos appear

### IMMICH-002.4 – Entry fields

- **Given** a photo, a live photo, a video and the primary asset of a stack of three
- **When** they are listed
- **Then** each is one entry with `assetId`, `name`, `takenAt`, `cameraModel`, `kind` (`photo`,
  `live`, `video`), `width`, `height`, `duration` (`null` for photos), `stackSize` (3 for the
  stack, `null` otherwise), `updatedAt` and its decision (IMMICH-003)

### IMMICH-002.5 – Malformed request

- **Given** a `size` outside 1 to 250, an unknown kind or flag, a rating op other than *atLeast*,
  *atMost* or *exactly*, a cursor of other filters or another connection, or more than 20 devices
- **When** the listing is asked
- **Then** the answer is `400` `request`

### IMMICH-002.6 – Infinite scroll

- **Given** a library of 1,000 uploads and a grid that shows 40 tiles
- **When** the grid opens and the user scrolls to the end
- **Then** the first page loads on open, each further page only when the last loaded row comes
  within one screen, and at the end every upload has been shown once

### IMMICH-002.7 – Only visible tiles load previews

- **Given** a loaded page of 100 entries and a viewport of 40 tiles
- **When** the grid renders
- **Then** only the tiles in or near the viewport request their thumbnail

### IMMICH-002.8 – Short pages

- **Given** a flag filter that drops every entry of the next Immich page
- **When** the grid needs more entries
- **Then** it asks again with the `nextCursor` until entries arrive or the cursor ends, and shows
  no empty gap

### IMMICH-002.9 – Loupe past the page

- **Given** the loupe on the 90th of 100 loaded entries of 1,000
- **When** the user steps forward
- **Then** the next page loads, stepping goes on past the 100th without a stop, and the counter
  says *91 / 1,000*

### IMMICH-002.10 – Filmstrip past the page

- **Given** the loupe near the end of the loaded entries
- **When** the next page arrives
- **Then** the filmstrip shows the new neighbours

### IMMICH-002.11 – Time filter

- **Given** uploads in October and November
- **When** the user chooses *October 2026*
- **Then** the listing starts over with October's uploads only; *November 2026* is the default in
  November

### IMMICH-002.12 – Device and kind filters

- **Given** uploads from two camera models, some without camera data, and of every kind
- **When** the user ticks one model and *No camera data*, and *Videos*
- **Then** only videos of that model or without camera data show, merged newest first

### IMMICH-002.13 – Counts from the server

- **Given** 3,660 uploads of which 248 are decided, and a grid that has loaded 100
- **When** the toolbar renders
- **Then** it shows the server's numbers (*N of 3,660 pictures · 248 decided*), not the loaded
  page's, and the flag chips carry the server's flag counts

### IMMICH-002.14 – Filter numbers

- **Given** a device filter on one model
- **When** the counts arrive
- **Then** each time option counts that model's uploads, each device option counts its own under
  the time and kind filters, and each kind option its own under the time and device filters

### IMMICH-002.15 – A decision updates the counts

- **Given** an unflagged picture
- **When** the user picks it
- **Then** *Picked* counts one more and *Unflagged* one less at once, without a counts request

### IMMICH-002.16 – Previews through honeycomb

- **Given** a tile and the loupe
- **When** they show an asset
- **Then** the tile requests `size=thumbnail`, the loupe `size=preview`, both from honeycomb's
  image route with `v` set to the asset's `updatedAt`, answered with
  `Cache-Control: private, max-age=31536000, immutable`; the browser makes no request to Immich

### IMMICH-002.17 – Capabilities off

- **Given** an open Immich connection
- **When** the grid, the loupe, the ⋯ menu and the shortcut sheet render
- **Then** none offers series, similarity, tags, delete, move, *Remove RAWs*, *Keep RAW* or XMP,
  and their keys do nothing

### IMMICH-002.18 – Empty view

- **Given** filters no upload passes
- **When** the counts say 0
- **Then** the grid says "No photos match. Change the time, device or flag filter." and offers
  *Clear filters*, which shows the default filters again from the listing's start; on the default
  filters (the rating comparison aside) it offers no *Clear filters*

### IMMICH-002.19 – A failed page (gap)

- **Given** two loaded pages and an Immich that stops answering
- **When** the grid asks the third
- **Then** the two pages stay, the end of the grid names the state and offers *Try again*, which
  asks the same cursor again

### IMMICH-002.20 – Preview of an unknown asset

- **Given** an asset id Immich does not know, or the key may not read
- **When** its preview is asked
- **Then** the answer is `404` `unknown-asset`

### IMMICH-002.21 – An upload during the paging

- **Given** a listing whose first page has been read
- **When** a new asset reaches Immich before the next page is asked
- **Then** the next pages neither repeat nor skip an asset, and the new one is in the first page
  of the next start

### IMMICH-002.22 – Paging under a decision filter

- **Given** five uploads of which three are picked
- **When** the listing is asked for *Picked* with `size` 2 and then with the `nextCursor`
- **Then** two pages of 2 and 1 picked entries arrive, newest first, each carrying its decision,
  and the last `nextCursor` is `null`

### IMMICH-002.23 – Decided entries a filter refuses

- **Given** a picked, a rejected and an undecided upload
- **When** the listing is asked for *Picked* and *Unflagged*
- **Then** the picked and the undecided entry arrive, the rejected one does not

### IMMICH-002.24 – Device options

- **Given** camera models of which one has no upload under the time and kind filters
- **When** the counts are asked, once without a device filter and once with that model chosen
- **Then** the model is left out the first time and counts 0 the second

### IMMICH-002.25 – Malformed counts request

- **Given** a counts request with malformed filters, a malformed time option or more than 50
- **When** it is sent
- **Then** the answer is `400` `request` and Immich is not asked

### IMMICH-002.26 – Time options

- **Given** 20 November 2026 and uploads in November, September and in 2024
- **When** the time options are counted
- **Then** the request counts *Last 7 days*, the twelve months from November 2026 back to
  December 2025 and *All phone uploads*; *Last 7 days*, *November 2026*, *September 2026* and
  *All phone uploads* show, a month counted 0 only while it is chosen or the current month

### IMMICH-002.27 – Counter at the resume position

- **Given** a loupe opened at the resume position, with newer entries not yet loaded
- **When** the counter renders
- **Then** it says *N pictures* with the server's total, and *k / N* once the newer pages are loaded

### IMMICH-002.28 – A decision the filter refuses leaves the grid

- **Given** the default flag filter (*Picked* and *Unflagged*) and the loupe on an unflagged
  picture
- **When** the user rejects it and closes the loupe
- **Then** the grid no longer shows it, without a new listing request, and *Rejected* counts one
  more; while the loupe was open the picture stayed in the filmstrip; an undo brings it back in
  its place, and with *Rejected* pressed it shows

### IMMICH-002.29 – One rule for the decision filters

- **Given** the decision filters (flags, a rating *atLeast*, *atMost* or *exactly*, colour labels)
  and a decision, as the shared vectors in `tests/fixtures/decision-filter/vectors.json` list them
- **When** the grid's filter, the server's check and the decision query each judge the decision
- **Then** all three admit it or all three refuse it, as the vector says

### IMMICH-002.30 – The filter bar

- **Given** counts with two camera models, uploads without camera data and every kind
- **When** the filter bar renders
- **Then** it shows the shown time options, *Pixel 9 Pro*, *SM-S918B* and *No camera data*, and
  *Photos*, *Motion photos* and *Videos*, each with its count; choosing *October 2026* or ticking
  a chip starts the listing over with that filter in the request

### IMMICH-002.31 – Clear filters

- **Given** the default filters
- **When** the filter bar renders
- **Then** *Clear filters* does not show; once a device, kind, time or flag differs from its
  default it shows, and pressing it brings back every default and starts the listing over

### IMMICH-002.32 – Filters kept per connection

- **Given** *Videos* and *October 2026* chosen for one connection
- **When** the connection opens again, in another browser
- **Then** both apply from the first request; another connection opens on its own stored filters
  or the defaults; a stored current month is the new current month once the month changed; a
  month older than the time options, an unknown kind or a malformed value falls back to its
  default; a failed read opens on the defaults

### IMMICH-002.33 – Filter options at the edges

- **Given** no uploads at all, a chosen camera model the counts no longer list, and a chosen month
  counted 0
- **When** the counts arrive
- **Then** no device chip shows but the chosen model, counted 0 and still able to be unticked;
  every kind counts 0; the chosen month stays with 0; while the counts are asked no number shows

### IMMICH-002.34 – Paging from an asset

- **Given** a listing opened `from` an asset that shares its second with two other uploads
- **When** the first page and then the pages of its `previousCursor` are asked
- **Then** the first page starts at the asset, the same-second uploads before it by asset id come
  on the newer pages, every entry shows once, and the last newer page answers `previousCursor`
  `null`; a newer page that adds nothing is followed by the next one at once, and a failed one
  offers *Try again* at its cursor

### IMMICH-002.35 – A malformed `from`

- **Given** a listing request
- **When** it carries `from` with a cursor, a `from` without an asset id or capture time, or
  `from` under *Picked* alone
- **Then** the answer is a bad request and Immich is not asked

## History

| Date | Change |
|---|---|
| 2026-11-24 | The empty view offers *Clear filters*, hidden on the default filters (#380, owner) |
