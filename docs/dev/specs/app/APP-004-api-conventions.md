# APP-004 – API conventions: error body and cursor

- Status: implemented
- Area: app
- Origin: architecture report A8 of 2026-11-22, ADR 0052
- Depends on: APP-001

## Purpose

Every route of the internal API fails and pages the same way, so the browser has one error reader
and one paging loop.

## Behaviour

- A failure of an `/apps/honeycomb/api/v1` route answers its HTTP status with the body
  `{"error": "<code>"}`. The codes: `unauthorized` (`401`), `request` (`400`), `folder-not-found`
  and `image-not-found` (`404`), `folder-not-readable` and `image-not-readable` (`403`),
  `trash-bin-disabled` (`409`). A route may add fields; the Immich routes keep their own codes
  (IMMICH-001) and add `scope` to a `403`.
- A paginated route takes `cursor` and answers `nextCursor`, `null` after the last page. The
  client hands `nextCursor` back as `cursor` and never reads inside it. No `cursor` asks for the
  first page.
- The browser tells the trash bin is off by the code `trash-bin-disabled`, not by the status alone.

## Acceptance criteria

### APP-004.1 – A failure answers its code

- **Given** a route that fails with a vanished folder, an unreadable image, a malformed request or
  an off trash bin
- **When** it answers
- **Then** the body is `{"error": "folder-not-found"}`, `{"error": "image-not-readable"}`,
  `{"error": "request"}` or `{"error": "trash-bin-disabled"}` with the status `404`, `403`, `400` or
  `409`

### APP-004.2 – No user answers 401 with its code

- **Given** a request without a logged-in user
- **When** a route is called
- **Then** the answer is `401` with `{"error": "unauthorized"}` and the handler does not run

### APP-004.3 – A page names its next cursor

- **Given** the missing hashes, the orphaned sidecars and the library folders
- **When** one page is asked with `cursor` and more follow
- **Then** the answer holds `nextCursor`, and `nextCursor` is `null` after the last page

### APP-004.4 – The browser reads the code

- **Given** a move or trash answer `409` with `{"error": "trash-bin-disabled"}`
- **When** the browser reads it
- **Then** it raises the trash bin error; a `409` with another code is passed on unchanged

## History

| Date | Change |
|---|---|
| 2026-11-22 | Created from ADR 0052. |
