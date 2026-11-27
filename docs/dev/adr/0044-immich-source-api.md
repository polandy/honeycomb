# 0044 – The public API of the Immich source

- Status: accepted
- Date: 2026-11-20, amended 2026-11-20 by M10 PR 6 (the listing on Immich's v3 search filter)
  and by M10 PR 10 (`GET /connections` answers `[]` when not configured)
- Extends: [0041](0041-immich-as-an-external-picture-source.md),
  [0042](0042-declarative-immich-connections.md),
  [0043](0043-immich-decisions-per-connection-and-asset.md)

## Context

ADR 0041 leaves the endpoints of the Immich source to an ADR of their own; ADR 0042 fixes the
connections file and its error states, ADR 0043 the decision table, its save endpoint and its
counts. The owner signed off the Phase 1 mockup on 2026-11-20 on a condition: the grid loads page
by page from Immich's paged search with infinite scroll, only visible tiles load previews, the
counters and filter numbers come from the server, the loupe and the filmstrip load past the loaded
page on their own, and *Write to Immich* writes in blocks of 100 and shows a large write as
numbers and conflicts only. The browser never talks to Immich (ADR 0041), so every one of these
needs a honeycomb endpoint.

The options for the listing were:

- **A, one endpoint that returns the whole library**, filtered in the browser like a folder set.
  Breaks the condition: a library of fifty thousand assets is fifty thousand entries per open.
- **B, a paged listing whose cursor the server issues**, chosen: the server pages Immich's
  search (`POST /search/metadata` with its `filter` and `cursor`), joins each page with the
  decision table, and hands the browser an opaque cursor. Counts are a second endpoint.
- **C, the browser pages by capture time** (`takenBefore` of the last entry). No server state in
  the cursor, but ties on one second lose or repeat assets, and the decision filter (ADR 0043)
  pages rows, not Immich.

## Decision

All routes live under `/apps/honeycomb/api/v1/immich`, take the signed-in user (`401` without
one), and recheck that `{connectionId}` is one of the user's connections in the connections file
(ADR 0042) before anything else. Times are Unix seconds, asset ids lower-case UUIDs.

### Errors

An Immich route answers a failure with its status and `{"error": "<code>"}`, so the UI can name
the state ADR 0042 lists; the code never carries a path, a key or Immich's own text.

| Status | `error` | State (ADR 0042) |
|---|---|---|
| `404` | `not-configured` | no app config key |
| `404` | `unknown-connection` | the file names no such connection for the user |
| `503` | `connections-file` | the file is missing, unreadable or invalid |
| `502` | `key` | the key file is missing, unreadable or empty |
| `502` | `unreachable` | Immich does not answer in time |
| `502` | `refused` | Immich answers `401` to the key |
| `502` | `version` | Immich's version is not one the client targets |
| `404` | `unknown-asset` | the image route: Immich does not know the asset, or the key may not read it |
| `403` | `scope` | Immich answers `403`; the body adds `"scope"`, the scope the call needed |
| `400` | `request` | a malformed body or query, or a cursor of other filters |

### Routes

| Route | Answer |
|---|---|
| `GET /connections` | `{"connections": [{"id", "label", "url"}]}`, the user's connections in file order; `[]` when the file names none or no app config key is set, since every page asks it and a `404` is a console error; `connections-file` as above |
| `GET /{connectionId}/status` | `{"state", "account", "version", "total"}`: `state` is `ok` or one of the `502`/`403` codes, `account` the Immich user name (`null` without `user.read`), `version` and `total` (`null` when unknown); always `200` for a known connection, since the status reports, not fails |
| `POST /{connectionId}/assets` | one page of the listing (below) |
| `POST /{connectionId}/counts` | the counters and filter numbers (below) |
| `GET /{connectionId}/assets/{assetId}/image?size=thumbnail\|preview&v=<updatedAt>` | the bytes of Immich's thumbnail or preview, its content type, `Cache-Control: private, max-age=31536000, immutable`; `v` changes the URL when the asset changes |
| `PUT /{connectionId}/decisions` | ADR 0043 |
| `POST /{connectionId}/write/check`, `POST /{connectionId}/write` | Phase 2, below |

### The listing

The body is `{"filters", "cursor", "from", "size"}`. `filters` holds `takenAfter` and
`takenBefore` (either `null`), `devices` (camera models, `null` standing for *no camera data*),
`kinds` (`photo`, `live`, `video`), `flags`, `rating` (`{"op": "atLeast"|"atMost"|"exactly",
"value"}` or `null`) and `colourLabels`; an empty list does not filter. `size` is 1 to 250,
default 100. The answer is `{"entries", "nextCursor", "previousCursor"}`, newest capture time
first, ties by asset id; a cursor is `null` at the end it names.

1. **An entry** carries `assetId`, `name` (the original file name), `takenAt`, `cameraModel`,
   `kind`, `width`, `height`, `duration` (seconds, `null` for a photo), `stackSize` (`null`
   outside a stack), `updatedAt` (Immich's, as a string) and the decision's `rating`,
   `colourLabel`, `flag` and `keepRaw` (ADR 0043).
2. **Two paging modes**, chosen by the server from the filters. When the decision filter admits
   undecided assets (no flag filter, or one with *Unflagged*, and no rating above 0 or colour
   label asked), the server pages Immich's search with the time, device and kind filters and drops
   the entries the decision filter refuses; such a page may hold fewer than `size` entries, or
   none, and still have a `nextCursor`. Otherwise it pages the decision table's matching rows and
   fetches their assets by id (ADR 0043).
3. **Several devices or kinds** are branches of one Immich search: Immich's `filter` (v3.2 and
   later) ANDs its top-level fields with an `or` of branches, so each branch is one device
   condition (the models, or *no camera data*) and one kind. At most 20 devices, else `400`.
4. **The cursor** is an opaque string the server signs and binds to the connection and the
   filters; another connection's or other filters' cursor is `400`. It holds no key. It wraps
   Immich's own cursor and the time of the first page: every later page asks only for assets
   Immich received before it, so an upload during the paging shifts no page and shows after the
   next start.
5. **`from`** (`{"assetId", "takenAt"}`, instead of `cursor`) starts the page at that asset, for
   the resume position; `previousCursor` then pages the newer entries.
6. **Only the upload library:** the search asks for assets of no library, so the Nextcloud photos
   Immich reads as an external library never show (ADR 0041). Trashed, archived, hidden and
   locked assets are left out in Phase 1 (`trashedAt` null, `visibility` `timeline`), and so are
   audio and other files.
7. **Stacks:** a stack member that is not the stack's primary asset is left out; the primary
   carries the stack's size when Immich names the stack.
8. **Order:** Immich sorts by `fileCreatedAt` and asset id, both descending; `takenAt` is
   `fileCreatedAt`.

### Immich's version and its errors

The client targets the pinned schema (Immich v3.4.2, `tests/fixtures/immich/openapi.json`) and
accepts Immich 3.2 and later of major 3, the first with the search `filter` and `cursor`; the
status reads the version (`GET /server/version`, which needs no key) and answers `version` for
any other. Every call maps Immich's answer the same way: no answer in time, or a `5xx`, is
`unreachable`; `401` is `refused`; `403` is `scope` with the scope that call needs; any other
answer, and an answer that does not match the schema, is `version`, since the request or the
answer no longer fits the Immich it talks to.

### The counts

The body is `{"filters", "periods"}` with the filters of the listing and a
list of `{"takenAfter", "takenBefore"}` for the time options. The answer:

```json
{
  "total": 3660, "undecided": 3412, "decided": 248, "matching": 3660,
  "flags": {"picked": 120, "rejected": 128, "unflagged": 3412},
  "ratings": {"0": 3500, "1": 0, "2": 40, "3": 80, "4": 30, "5": 10},
  "colourLabels": {"red": 4},
  "devices": [{"model": "Pixel 9 Pro", "count": 2810}, {"model": null, "count": 112}],
  "kinds": {"photo": 3100, "live": 400, "video": 160},
  "periods": [1204, 318]
}
```

`total` is Immich's count (`POST /search/statistics`) for the filters; the flag, rating and colour
counts are ADR 0043's grouped query, with *Unflagged* and rating 0 as `total` minus the decided
rows. `decided` is `total` minus `undecided`, `matching` the count under the flag, rating and
colour filters as well (the toolbar's *N of M*; the body then carries them). A facet
(`devices`, `kinds`, `periods`) counts under the filters of the other groups, so an option shows
what choosing it would give. The device list comes from Immich's suggestions for
camera models, each with its own count; a model without uploads under the other filters shows only
while chosen, *No camera data* always. *Decided* means picked or rejected, so `undecided` is
*Unflagged*. A body takes at most 50 periods.

### Write to Immich (Phase 2)

Both routes take at most **100 assets** per request (`400` above it); the browser sends blocks of
100 in sequence. `write/check` takes `{"assetIds": [...]}`, reloads them from Immich and answers
`{"assets": [{"assetId", "updatedAt", "rating", "favorite", "trashed", "archived", "sharedAlbum",
"stackSize"}]}` for each asset Immich still holds; `sharedAlbum` is `{"name", "others"}` or
`null`. The write plan in the browser finds the conflicts (rating changed, shared album, already
trashed, stack top) from it (ADR 0006); amended 2026-11-27, it first named the conflicts here.
`write` takes the write plan's changes, `{"assets": [{"assetId", "immichRating", "trash"?,
"restore"?, "archived"?, "favorite"?, "rating"?}]}`, and answers `{"results": [{"assetId", "state":
"written"|"failed", "error"?}]}` in the asked order; amended 2026-11-27, it first took the reject
handling and a resolution per asset, which would have computed the plan a second time in PHP
(ADR 0006). The server still reads each asset's saved decision from the table: it trashes only a
saved reject and stores the decision's flag and rating plus `immichRating` as what it wrote.
`force:true` is never sent (ADR 0041).

### Resume position

A connection's position goes through the positions endpoint of DECISIONS-002 with
`{"immich": "<connectionId>"}` in place of `folderSet` and `assetId` in place of `fileId`. Its key
is `immich:<connectionId>`; `honeycomb_positions` gains a nullable `asset_id` (string 36) beside
`file_id`, and a connection's position goes with its rows in the sweep (ADR 0042).

## Consequences

- The browser holds pages, never the library; the grid's scroll, the loupe and the filmstrip ask
  for the next page themselves, and every number on screen is the server's.
- A page under a decision filter can be short or empty; the client keeps asking while it needs
  entries. The price of a simple server.
- A signed cursor keeps the server stateless across requests; changing a filter starts over.
- Several devices or kinds are branches of one Immich search, so a page costs one search.
- An Immich account with partner sharing in its timeline lists the partner's uploads too, since
  Immich's search spans them; the admin gives honeycomb an account without, or Phase 2 handles
  it.
- Counts cost one Immich statistics call per facet option, a dozen per change of filter; the
  browser asks again only when a filter changes, a decision updates its counts locally.
- Screenshots and messenger images, which the mockup shows as kinds, are not in Phase 1: Immich
  cannot filter them, so the server could not count them without paging the library. They are a
  `TODO.md` item.
- The positions table gets one nullable column; a folder set's position is unchanged.
