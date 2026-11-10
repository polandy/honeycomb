# 0017 – The sidecar endpoints: bytes in base64, a checked save through a part file

- Status: accepted
- Date: 2026-11-10

## Context

M5 reads XMP sidecars when a picture is first listed and writes decisions through to them
([`06-xmp-interop.md`](../06-xmp-interop.md), ADR 0005). Reading, the mapping and serializing are
the pure TypeScript module `src/logic/xmp/`, which takes and returns bytes (`Uint8Array`), so the
module itself reports a sidecar that is not UTF-8 (ADR 0006, ADR 0016). The backend only reads
and saves bytes through `OCP\Files` (CLAUDE.md rule 1). Saving must not overwrite a sidecar that
another program changed since the client read it, and must not leave a half-written sidecar
(CORE-009 "Saving"). Sidecars are shared by every user of a folder, so in a shared folder nothing
is written through on its own ([`plan.md`](../plan.md#decisions-gestures-and-shared-folders)); the
client has to know which folders are shared.

The options for the transfer:

- **WebDAV** (`GET`/`PUT` per file): no new endpoint, but one request per sidecar, no ETag check
  on create, and a `PUT` writes in place.
- **JSON with the bytes as text:** small, but a sidecar that is not UTF-8 cannot travel in JSON,
  and the client could not report it.
- **JSON with the bytes in base64:** a third larger, exact for any bytes, batched like the other
  endpoints.

## Decision

- **Read:** `POST /apps/honeycomb/api/v1/sidecars/lookup`, logged in, with the usual CSRF token,
  and `{"fileIds": [9, …]}` from the listing, at most 1,000. The answer is `200` with
  `{"sidecars": [{"fileId": 9, "result": "read", "content": "<base64>", "etag": "…", "size": 812,
  "mtime": 1700000000}, …]}` in the order sent. `result` is `read`, `notFound` (vanished, foreign,
  a folder or a name not ending in `.xmp`), `tooLarge` (over 1 MiB), `notPermitted`, `locked` or
  `failed` (logged); only `read` carries the bytes and their ETag, size and modification time.
- **Save:** `PUT /apps/honeycomb/api/v1/sidecars` with `{"sidecars": [...]}`, at most 1,000, each
  at most 1 MiB. A sidecar is either an existing one, `{"fileId": 9, "etag": "…", "size": 812,
  "content": "<base64>"}` with the ETag and size the client read, or a new one, `{"path":
  "/Photos/IMG_0001.NEF.xmp", "content": "<base64>"}`, whose path ends in `.xmp` (any case) and
  names an image file plus `.xmp`.
- **The checked save** (CORE-009.16–.19, ETag and size in place of BLAKE3):
  1. The target is checked: an existing sidecar must still have the given ETag and size and be
     updateable; a new one must not exist yet, and its folder must allow creating files.
  2. The bytes are written to `<name>.part` beside the target with `Folder::newFile()`.
  3. The target is checked again, and the part file is renamed onto it with `Node::move()`.
     Nextcloud treats the rename of a part file onto a regular file as a write
     (`OC\Files\View::rename()`), so an existing sidecar keeps its file id, gets a version and
     fires the write events; a crash leaves the old sidecar whole and at most a part file, which
     Nextcloud's scanner ignores.
  4. When a step fails, the part file is deleted again.
- **Save answer:** `200` with `{"sidecars": [{"result": "saved", "fileId": 9, "etag": "…",
  "size": 830, "mtime": 1700000100}, …]}` in the order sent, so the client can save the same
  sidecar again without listing. `result` is `saved`, `notFound` (an existing sidecar vanished or
  is not a sidecar; a new one's image is missing), `changed` (another ETag or size, or a new one
  that appeared meanwhile), `notPermitted`, `locked` or `failed` (logged). One sidecar's failure
  does not stop the others.
- **Shared folders:** the listing (ADR 0009) adds `"folders": [{"path": "/Photos", "shared":
  false}, …]`, one item per folder that holds a listed entry. A folder is shared when another user
  or a federated user has access to it or to a folder above it (`IShareManager::getAccessList()`),
  or when it lies in a group folder (mount type `group`). The endpoints do not refuse a shared
  folder; asking first is the client's job (ADR 0005).
- **Errors:** `400` for a malformed body, an id or path given twice, a path with `..`, content
  that is not base64 or over 1 MiB, or more than 1,000 items; nothing is read or written. `401`
  without a user. The body is empty.

## Consequences

- A save never overwrites what the client has not seen: `changed` sends the client back to
  reading and merging.
- The check before the rename and the rename are two steps; a write by another program in between
  is lost. Nextcloud's own uploads have the same window.
- A part file needs the right to create files in the folder, also when an existing sidecar is
  replaced; a share that allows only updating answers `notPermitted`.
- External storage mounted for several users is not detected as shared; only shares and group
  folders are.
- A new result or field is added, never renamed or removed, without a new version in the path.
