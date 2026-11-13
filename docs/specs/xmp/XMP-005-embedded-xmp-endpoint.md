# XMP-005 – Embedded XMP endpoint

- Status: implemented
- Area: xmp
- Origin: `docs/07-tags.md` Reading (D1), ADR 0023
- Depends on: LISTING-001, XMP-002

## Purpose

Hands the client the XMP packet a JPEG embeds, so its tags can count as one more source of a
picture (TAGS-002) while the photo itself is never written.

## Behaviour

`POST /apps/honeycomb/api/v1/embedded-xmp/lookup` takes `{"fileIds": [7, …]}`, at most 1,000, and
answers `{"packets": [{"fileId": 7, "result": "read", "content": "<base64>"}, …]}` in the order
sent. The packet is the payload of the first APP1 segment that starts with
`http://ns.adobe.com/xap/1.0/` and a zero byte, found before the start of scan; the image data
is not read.

| Result | Meaning |
|---|---|
| `read` | The packet's bytes |
| `none` | A JPEG without such a segment before its image data, or not a well-formed JPEG |
| `notFound` | Vanished, foreign, a folder or not `image/jpeg` |
| `notPermitted` | The user may not read it |
| `locked` | Locked by another process |
| `failed` | Any other error, logged as a warning |

| Case | Answer |
|---|---|
| A malformed body, an id given twice, more than 1,000 ids | `400`, empty body, nothing read |
| No logged-in user | `401` |

## Acceptance criteria

### XMP-005.1 – Lookup answers the packet of each JPEG

- **Given** a JPEG whose EXIF segment comes before its XMP segment, and one with only an XMP
  segment
- **When** both are looked up
- **Then** each answers `read` with exactly the packet's bytes, in the order sent

### XMP-005.2 – A JPEG without a packet answers none

- **Given** a JPEG without XMP, one whose only XMP is Extended XMP, one with an XMP segment after
  the start of scan, one cut off in a segment, and a file that is not a JPEG but has the type
- **When** they are looked up
- **Then** each answers `none`

### XMP-005.3 – Lookup reports what it cannot read

- **Given** a vanished id, a folder, a sidecar, an unreadable JPEG, a locked one and one whose
  read fails otherwise
- **When** they are looked up
- **Then** they answer `notFound`, `notFound`, `notFound`, `notPermitted`, `locked` and `failed`,
  and only the last is logged

### XMP-005.4 – A malformed request reads nothing

- **Given** ids that are not positive integers, an id twice, or 1,001 ids
- **When** they are looked up
- **Then** the answer is `400` with an empty body and no file is opened

### XMP-005.5 – Logged in only

- **Given** no logged-in user
- **When** the lookup is called
- **Then** the answer is `401`

### XMP-005.6 – A real JPEG's packet against a real Nextcloud

- **Given** a JPEG with embedded XMP uploaded to Nextcloud
- **When** it is looked up
- **Then** the answer is `read` with its packet

## Out of scope

- Which pictures' JPEGs are looked up and how their tags count: TAGS-002.
- Extended XMP, and writing the embedded XMP (D1).

## History

| Date | Change |
|---|---|
| 2026-11-13 | Written with the endpoint (ADR 0023) |
