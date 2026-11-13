# 0023 – The embedded XMP endpoint: the JPEG's packet found on the server

- Status: accepted
- Date: 2026-11-13

## Context

A default digiKam writes tags into the JPEG itself, not into a sidecar
([`07-tags.md`](../07-tags.md) What digiKam does). The owner decided that honeycomb reads a JPEG's
embedded XMP as one more tag source and never writes it (D1). Reading the XMP and its tags is the
pure TypeScript module `src/logic/xmp/` (ADR 0006, ADR 0016); the backend touches files only
through `OCP\Files` (CLAUDE.md rule 1). A JPEG keeps its XMP in an APP1 segment that starts with
`http://ns.adobe.com/xap/1.0/` and a zero byte, before the image data; a packet is at most 65,502
bytes. A packet too large for one segment continues in *Extended XMP* segments, which hold what
did not fit (previews, edit histories); tags stay in the standard packet.

The options:

- **Send the whole JPEG** (WebDAV or the image endpoint) and find the packet in the browser:
  no new endpoint, but megabytes per photo for a few kilobytes of XMP.
- **Send the JPEG's first bytes** and find the packet in the browser: the segments before the
  image data have no fixed size (an ICC profile alone can take several hundred kilobytes), so a
  cut either misses packets or sends too much.
- **Find the packet on the server** and send only its bytes: a small walk over the JPEG's segment
  headers in PHP, as the RAW preview already walks a JPEG's segments (`lib/Preview/EmbeddedJpeg.php`).

## Decision

- **Read:** `POST /apps/honeycomb/api/v1/embedded-xmp/lookup`, logged in, with the usual CSRF
  token, and `{"fileIds": [7, …]}` from the listing, at most 1,000. The answer is `200` with
  `{"packets": [{"fileId": 7, "result": "read", "content": "<base64>"}, …]}` in the order sent.
  `result` is `read` (the packet's bytes), `none` (a JPEG without a standard XMP packet before its
  image data, or not a well-formed JPEG), `notFound` (vanished, foreign, a folder or not
  `image/jpeg`), `notPermitted`, `locked` or `failed` (logged).
- **The walk:** the server reads the JPEG as a stream, segment after segment from the start of
  image, and stops at the first APP1 segment with the standard XMP header, at the start of scan or
  at the end of the file. It never reads the image data. Extended XMP is not read.
- **Errors** as the sidecar endpoints (ADR 0017): `400` for a malformed body, an id given twice
  or more than 1,000 ids, nothing read; `401` without a user; the body is empty.
- **Nothing writes** the embedded XMP (D1).

## Consequences

- One more request when a cull opens with pictures that take tags over, and one more per tag
  write, each only for the JPEGs whose embedded XMP counts (TAGS-002).
- The server opens each JPEG once per lookup and reads its segment headers, a few kilobytes up to
  a few hundred for a large ICC profile or EXIF thumbnail.
- Tags kept only in Extended XMP are not seen; no tool known to us writes them there.
- A new result or field is added, never renamed or removed, without a new version in the path.
