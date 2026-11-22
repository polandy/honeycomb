# 0052 – One error body and one cursor convention for the API

- Status: accepted
- Date: 2026-11-22
- Amends: [0025](0025-missing-visual-hashes-by-path-cursor.md), [0044](0044-immich-source-api.md)

## Context

The routes answered a failure in two forms: the Immich routes with `{"error": "<code>"}`
(ADR 0044), every other route with an empty list `[]` and only the status. A client could not tell
a vanished folder from an unreadable one but by the status, and `409` was the only way to learn that
the trash bin is off. The paginated routes named their cursor differently: `after` and `next` on the
missing hashes, the orphaned sidecars and the library folders, `cursor` and `nextCursor` on the
Immich listing. The API is internal to the app, so it needs no compatibility path.

## Decision

- **Error body.** Every failure of an `/api/v1` route answers `{"error": "<code>"}`, the code a
  lower-case kebab-case word the client may switch on; a route may add fields (`scope` on the Immich
  `403`). The status stays as before. The codes: `unauthorized` (`401`), `request` (`400`, any
  malformed body or query, also the Immich one), `folder-not-found` and `image-not-found` (`404`),
  `folder-not-readable` and `image-not-readable` (`403`), `trash-bin-disabled` (`409`). The Immich
  codes of ADR 0044 are unchanged. The client reads the code, not the status, where it acts on one.
- **Cursor.** A paginated route takes the query or body field `cursor` and answers `nextCursor`,
  `null` after the last page. A cursor is opaque to the client, which hands the last answer back
  unchanged; its JSON type is the route's (a path string, an integer file id, a signed string). An
  empty or absent `cursor` asks for the first page. The Immich listing keeps `previousCursor` for
  the other direction.

## Options considered

- **Keep the empty body, add a header with the code**: no body change, but the client reads a
  header and the Immich routes would still differ.
- **`{"error": {"code", "message"}}`**: room for text, but raw error text never reaches the user
  and the codes carry the meaning; one flat code is enough.
- **Cursor as an opaque string everywhere**: the library's integer would turn into text and back
  for nothing.

## Consequences

- One error type for the browser; new failures add a code in `ApiError`.
- Specs that said "empty body" say `{"error": <code>}`.
- No version bump: the app and its browser code ship together.
