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
- **An entry** is one picture: a live photo is one entry of kind `live`, a stack shows its
  primary asset with the stack's size. The grid groups entries under day headers.
- **Infinite scroll:** the grid loads the first page on open and the next one when its last loaded
  row comes within one screen of the viewport. Only tiles in or near the viewport load previews
  (`size=thumbnail`); the loupe shows `size=preview`. A page under a decision filter may be short
  or empty with a `nextCursor`; the grid asks again until it fills the screen or the cursor ends.
- **Loupe and filmstrip past the page:** stepping or swiping to within twelve entries of the last
  loaded one loads the next page; the filmstrip shows its neighbours as they arrive, and the
  counter *k / N* uses the server's total. A loupe opened at the resume position shows *N pictures*
  until the newer pages are loaded, since a page started at an asset carries no offset.
- **Filters:** time (*Last 7 days*, the months with uploads, *All phone uploads*; the current month
  by default), device (camera models and *No camera data*, any number), kind (*Photos*, *Motion
  photos*, *Videos*, any number) and the flag filter of GRID-002 with its rating filter. Groups
  combine with AND, chips in a group with OR. Changing a filter starts the listing over.
- **Decision filters:** when the filter admits undecided assets, the listing pages Immich and
  leaves out the decided ones it refuses. When it admits decided assets only (*Picked* or
  *Rejected* alone, a rating above 0, a colour label), the listing pages the matching decisions by
  the capture time saved with them, newest first, and asks Immich for those assets by id.
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
- **Empty view:** "No pictures match. Change the time, device or flag filter."
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
  says *91 / 1000*

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
- **Then** the grid says "No pictures match. Change the time, device or flag filter."

### IMMICH-002.19 – A failed page

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
