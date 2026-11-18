# 0017 – The sidecar endpoints: bytes in base64, a checked save

- Status: accepted, amended by [0032](0032-sidecar-is-the-source-of-truth.md) and on 2026-11-18
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
- **The checked save** (CORE-009.16–.19, ETag and size in place of BLAKE3; in place since
  2026-11-18):
  1. The target is checked: an existing sidecar must still have the given ETag and size and be
     updateable; a new one must not exist yet, and its folder must allow creating files.
  2. Right after the check the bytes are written: an existing sidecar in place with
     `File::putContent()`, so it keeps its file id, the Versions app keeps the replaced bytes as a
     version and the write events fire; a new one with `Folder::newFile()`. No other file is
     written.
- **Save answer:** `200` with `{"sidecars": [{"result": "saved", "fileId": 9, "etag": "…",
  "size": 830, "mtime": 1700000100}, …]}` in the order sent, so the client can save the same
  sidecar again without listing. `result` is `saved`, `notFound` (an existing sidecar vanished or
  is not a sidecar; a new one's image is missing), `changed` (another ETag or size, or a new one
  that appeared meanwhile), `noVersions` (amended 2026-11-15), `notPermitted`, `locked` or
  `failed` (logged). One sidecar's failure
  does not stop the others.
- **Shared folders:** the listing (ADR 0009) adds `"folders": [{"path": "/Photos", "shared":
  false}, …]`, one item per folder that holds a listed entry. A folder is shared when another user
  or a federated user has access to it or to a folder above it, or it or a folder above it is
  shared by public link or by mail (`IShareManager::getAccessList()`); when it lies in a folder
  shared with the user or in a group folder (mount type `shared` or `group`, without asking the
  share manager); or when it lies on external storage (mount type `external`) that
  is mounted for another user too (`IUserMountCache::getMountsForStorageId()`). The endpoints do
  not refuse a shared folder; asking first is the client's job (ADR 0005).
- **Errors:** `400` for a malformed body, an id or path given twice, a path with `..`, content
  that is not base64 or over 1 MiB, or more than 1,000 items; nothing is read or written. `401`
  without a user. The body is empty.

## Consequences

- A save never overwrites what the client has not seen: `changed` sends the client back to
  reading and merging.
- The check before the rename and the rename are two steps; a write by another program in between
  is lost. Nextcloud's own uploads have the same window.
- Replacing an existing sidecar needs only the right to update it; creating a new one needs the
  right to create files in its folder.
- A crash in the middle of a write can leave a sidecar half written. An existing one is replaced
  only while its folder keeps versions (amendment 2026-11-15), so its previous bytes can be
  restored; a new one had none.
- External storage counts as mounted for another user only once that user's mounts are known to
  Nextcloud's mount cache, that is after their first login since it was configured.
- A new result or field is added, never renamed or removed, without a new version in the path.

## Amendment 2026-11-10

The owner's review of 2026-11-10 widened *shared*: public links, mail shares and external storage
mounted for several users count too, since anyone they reach may edit the sidecars. The first
version counted only other users, federated users and group folders.

## Amendment 2026-11-15

The public-release risk review (R2) found that a merge rewrites another program's sidecar in
honeycomb's canonical form and loses what the model does not hold (the `<?xpacket?>` wrapper,
`x:xmptk`, comments). An existing sidecar is therefore saved only while the Versions app
(`files_versions`) is enabled for the user, so the replaced bytes can be restored; otherwise it
answers the new result `noVersions` and keeps its bytes. A new sidecar is created either way.
A one-time `<name>.xmp.orig` copy was rejected: it adds files to the user's folders that sync to
every desktop and that other programs may read, and it keeps only the first version.

## Amendment 2026-11-18

Nextcloud 35.0.3 checks the rename right in `Node::move()` (`DavUtil::canRename()`). A part file
made with `Folder::newFile()` has only a stub cache entry with permissions 0, so moving it onto
the sidecar answered `notPermitted` and no sidecar could be saved. The options:

- **A cached temporary name** (not `.part`): Nextcloud moves it like any file, so the sidecar
  would take the temporary file's id and the replaced bytes would not become a version of it;
  every save would also add a file to the folder that desktop clients sync.
- **Nextcloud's own upload path** (`OC\Files\View::rename()` of a part file): private API,
  against CLAUDE.md rule 1.
- **Write in place right after the check** (chosen): public API only, the file id and the version
  come from Nextcloud's own write, it needs no create right in the folder and leaves no part
  file behind. It gives up the all-or-nothing rename; the version taken before the write covers an
  existing sidecar, and the window between check and write shrinks to the versions lookup.

The ETag and size check stays, now once, right before the write.
