# 0032 – The XMP sidecar is the source of truth; the database holds only a cache

- Status: accepted
- Date: 2026-11-15
- Supersedes: [0005](0005-decisions-in-database-and-xmp-sidecars.md),
  [0012](0012-decision-storage.md)
- Amends: [0017](0017-sidecar-endpoints.md), [0022](0022-tag-storage.md),
  [0023](0023-embedded-xmp-endpoint.md)

## Context

ADR 0005 made the app database the working state and the sidecars a target written through to.
Since #206 writing through is opt-in and off by default, so the ratings, flags, colour labels,
*Keep RAW* marks and tags of most users live only in `honeycomb_decisions` and
`honeycomb_file_tags`. Nextcloud becomes a second photo library beside digiKam and darktable,
bound to one instance and one user, and each side silently overtakes the other (XMP-003 "Out of
scope: re-reading a sidecar that another program changed").

The owner decided on 2026-11-15 (issue #187):

- Photo metadata lives in the sidecar. The database holds only a cache that can be rebuilt from
  the sidecars at any time, plus pure app state. Stored series (ADR 0027) stay app state.
- **digiKam compatibility comes first** and is never traded away: where digiKam and another tool
  disagree, honeycomb writes what digiKam expects. darktable is second; Lightroom and Capture One
  are not target platforms.
- With sidecar writing off, deciding is locked. The primary goal stays culling the photos inside
  Nextcloud.

Constraints from what exists: mapping, merging and serializing are pure TypeScript
(`src/logic/xmp/`, ADR 0006); PHP reads and saves bytes only (ADR 0017). The listing returns every
sidecar as an entry with `fileId`, `etag`, `size` and `mtime` (LISTING-001.1), so a stale cache
entry is visible without another request. Sidecars are per file, not per user.

## Decision

### Truth and saving

1. **Truth.** A picture's rating, flag, colour label, *Keep RAW* and tags are what its sidecars
   say. A JPEG without a sidecar of its own says it through its embedded XMP, which is only read
   (ADR 0023, now for all values, not only tags). The reading rules are
   [`06-xmp-interop.md`](../06-xmp-interop.md#reading): first valid source per value; of several
   sidecars the newest wins as a whole, a tie goes to the RAW's; tags are the union (XMP-004). A
   sidecar that is read hides the embedded XMP completely, exactly as digiKam does, so a new JPEG
   sidecar takes over every value of the embedded XMP when it is created, not only the delta.
2. **Saving means saving the sidecar.** A change is saved when every target sidecar of the
   picture answers `saved`; the checked save through a part file stays (ADR 0017). The UI shows
   the change at once and takes it back for the pictures that were not saved.
3. **Edits are deltas, applied to the state each sidecar states.** A step carries only the fields
   it changes (`{rating: 4}`, `{flag: 'rejected'}`, a tag change). Per target sidecar the delta is
   applied to the decision *that sidecar* reads as, and the whole honeycomb field set is written
   from the result: `mergeDecision(packet, apply(sidecarDecision(packet), delta))`. Fields the
   delta does not touch keep each sidecar's own value. On `changed` the fresh bytes are merged
   with the same delta once more (XMP-003.8).
4. **Reject is written digiKam's way, never as `xmp:Rating` −1.** *rejected* with n stars is
   `xmp:Rating` n, `digiKam:PickLabel` 1, `xmpDM:pick` −1, `xmpDM:good` `False`, in every sidecar,
   darktable's included; darktable then does not see honeycomb's reject (accepted). Reading
   `xmp:Rating` −1 still means *rejected*. When a sidecar holds `xmp:Rating` −1, any write sets
   `xmp:Rating` to the result's stars 0–5 and the reject, if it stays, moves to the pick fields.
   No `honeycomb:RejectedRating`.

### Writability and permissions

1. **No writing, no deciding.** Whether a picture can be decided on is a pure function with the
   values `writable`, `off`, `readOnly`, `shared`, `noVersions` and `refused`, shown in this
   order. A picture that is not writable cannot be rated, flagged, labelled, marked *Keep RAW* or
   tagged, and the UI names the reason; viewing, comparing, filtering, moving and deleting stay.
   Reading and showing happen always, also with writing off.
2. **Setting.** *Write decisions to XMP sidecars* is *Off* or *On*. *On* writes every existing
   sidecar and creates a missing one as `<member file>.xmp`. A stored `existing` loads as `off`
   with a one-time hint on the settings page; `existing-and-new` loads as `on`. The first attempt
   to decide while *Off* opens the opt-in dialog; the settings page can enable it too.
3. **Permission source** is `Folder::getPermissions()` of each member's folder (READ 1, UPDATE 2,
   CREATE 4, DELETE 8, SHARE 16). The bits already hold the share mask, the reshare chain (never
   more than the sharer), group and team folder ACLs, read-only external storage and federated
   shares. The listing adds them per folder: `folders[].permissions`.
4. **A picture is writable** when, for every member's folder: the setting is *On*, UPDATE and
   CREATE are set, the folder is not shared or the user confirmed it, the storage keeps versions,
   and no sidecar of the picture is refused. UPDATE and CREATE are exactly what the server's save
   needs (`SidecarWriter`); DELETE is not needed.
5. **Read-only users** (READ without UPDATE or CREATE) view, compare and filter; they read
   sidecars and embedded XMP and write only their own cache rows, never an XMP file. Moving and
   deleting keep their own permission checks.
6. **Shared folders** (ADR 0017's detection) need a confirmation that everyone with access sees
   and changes the ratings. It is per user and per opened folder including its subfolders, keyed
   by the opened folder's `fileId` (the path only for display), stored in the user config
   `settings`. It is asked at the first attempt to decide; when writing is also *Off*, one dialog
   asks both.
7. **Special cases.** A public link or mail share: link users can change the sidecars, so the
   folder counts as `shared`; honeycomb never writes without a login. External storage mounted for
   several users is `shared`, a read-only mount `readOnly`. A group or team folder is always
   `shared`, its ACL comes through the bits, and it has its own versions backend.
8. **Versions per storage and owner.** The check is per node: a versions backend exists for
   `$node->getStorage()` (`IVersionManager::getBackendForStorage`) and `files_versions` is enabled
   for `$node->getOwner()`; on a received share the versions are made at the owner's. The listing
   adds `folders[].versions`. *On* cannot be selected while the Versions app is off for the user;
   a folder without versions is `noVersions`. External storage stays `noVersions` until versions
   are proven for it on nc-test.
9. **The server stays the authority.** Every save checks again; on `notPermitted` the client takes
   the change back for that picture and names the reason (XMP-003.13).

### Cache

1. **One row per user and source file** in the new table `honeycomb_xmp_cache`: a sidecar, or a
   JPEG whose embedded XMP counts. Columns: `user_id`, `file_id` (unique together), `kind`
   (`sidecar`, `embedded`), `etag` of the bytes read, `reader` (version of the reading rules),
   `state` (`read`, `refused` with reason, `none`), `rating`, `flag`, `colour_label`, `keep_raw`
   (each null when the source says nothing) and `tags`. Pairing, newest-wins and the tag union stay
   in the client, so each row is a pure function of one file's bytes.
2. **Valid** while its `etag` equals the listing's and its `reader` is current; otherwise the file
   is read again. The cache is never the base of a merge: a save always reads the bytes (or uses
   the bytes it saved last).
3. **Endpoints**: `POST /api/v1/xmp-cache/lookup` and `PUT /api/v1/xmp-cache`, at most 60,000
   each, and `DELETE /api/v1/xmp-cache`, with the access check and rate limit of every write
   (ADR 0031). The rows are registered in `FileRowStores`, so the daily job and user deletion
   remove them.
4. **Clearing the cache.** A *Clear cache* button in the settings deletes the user's XMP cache and
   visual hashes; the admin command `occ honeycomb:cache:clear [user]` does it for one or all
   users. Both are safe at any time: the next folder visit rebuilds the cache. Neither touches
   sidecars, positions, series, settings or the tag list.
5. **Not read yet:** a picture without a valid row shows its old value as being refreshed, or
   *unknown*. It can be decided on (the save reads the sidecar anyway and fills the cache), but it
   stays out of *Delete rejected* and *Remove RAWs* until read.
6. **ETag, not mtime**, because Nextcloud changes the ETag on every content change it sees, while
   the desktop sync client sets the mtime. A change on external storage that Nextcloud has not
   scanned is seen by no one; the next save answers `changed` once the scanner ran.

### Bundling, undo and conflicts

1. **Bundling.** Deltas are merged per picture until the user leaves it or 2 s pass without a
   change, timed by an injected scheduler; bulk actions save at once. A pending picture shows a
   marker. The pending save is flushed on `visibilitychange` to hidden and on `pagehide` (best
   effort: a `PUT` with CSRF, no `sendBeacon`), and always before *Delete rejected*, *Remove
   RAWs* and *Move*.
2. **Undo** saves the before-delta. A field another program changed since the step is not reset;
   the picture is reported as changed elsewhere. A step is recorded only for the pictures that
   were saved. Undo of a delta not yet saved drops it locally, without a save.
3. **Conflicts.** Two honeycomb devices: the last save wins per field, other fields merge. A pair
   with one sidecar `saved` and one failed shows what the reading rules now give (the saved one
   is newest); the failed one is listed with retry, nothing is rolled back.

### Deleting by decision

*Delete rejected* and *Remove RAWs* flush pending saves, list the affected folders again, read the
sidecars whose ETag changed, and act only on pictures whose every readable sidecar states the
flag the flow needs. A pair whose sidecars disagree, or a picture that is *unknown* or `refused`,
is skipped with a hint naming the reason. Deleting a picture removes its sidecars with it (rule 2
of CLAUDE.md, [`06-xmp-interop.md`](../06-xmp-interop.md#sidecar-names)). Before *Remove RAWs*
removes `IMG.NEF.xmp`, a pair without `IMG.JPG.xmp` gets one with the picture's state; where that
cannot be written (not writable), the pair is skipped with a hint, so a JPEG never loses its
values.

### App state and migration

1. **App state stays in the database:** positions, visual hashes, stored series, the tag list
   (`honeycomb_tag_list`, the vocabulary of ADR 0022; tags read from sidecars flow into it),
   settings and view state. The undo history stays in client memory.
2. **Migration** extends ⋯ → *Write decisions to sidecars…* (XMP-003.12) to every picture with a
   row in `honeycomb_decisions` or `honeycomb_file_tags`. It needs *On* and versions, and a shared
   folder's confirmation. Where a sidecar field differs, the database value wins (versions allow
   going back); tags are unioned. A picture is acknowledged with `DELETE /api/v1/legacy` once
   every target is `saved` and its cache row is written, also when nothing differed; the remaining
   rows are the progress, so a run is idempotent and can resume. A banner shows the inventory
   (`GET /api/v1/legacy/folders`) while rows remain; until migrated a picture shows its legacy
   value, locked. Rows of ids the user can no longer reach, and rows that failed, go into a JSON
   export and are deleted only by an explicit *Discard*.
3. **Removal.** After a successful migration an `IRepairStep` drops `honeycomb_decisions` and
   `honeycomb_file_tags` when they are empty, and `occ honeycomb:legacy:drop` does it for admins.
   The `decisions` and `tags` endpoints and their `carryOver` go with them, without a new API
   version: the only client ships with the backend. This departs from ADR 0012 and 0022 ("never
   removed without a new version") on purpose.

### Implementation order

| # | Pull request | Contents |
|---|---|---|
| 0 | `docs(adr)` | this ADR, `06-xmp-interop.md`, XMP-006, user docs |
| 1 | `refactor(xmp)` | the delta applied to each sidecar's state; never `xmp:Rating` −1 |
| 2 | – | dropped (`honeycomb:RejectedRating`) |
| 3 | `feat(xmp)` | embedded XMP as a source of rating, flag and colour label; a new JPEG sidecar takes them over |
| 4 | `feat(api)` | cache table, lookup, put, delete, `occ honeycomb:cache:clear`, versions per node, `permissions` and `versions` in the listing |
| 5 | `feat(xmp)` | migration through the ⋯ entry, acknowledgement, banner, export |
| 6 | `feat(cull)` | the switch: cull reads through the cache, writability with `readOnly`, confirmation, *Off*/*On*, *Clear cache* |
| 7 | `feat(xmp)` | bundling with an injected scheduler and the flushes |
| 8 | `fix(delete)` | the fresh check, every sidecar must state the flag, the JPEG sidecar before *Remove RAWs* |
| 9 | `refactor(db)` | the repair step and `occ` drop the legacy tables, endpoints and `carryOver` |

1 before 5 before 6; 3 and 4 before 6; 7 before 8; no release ships 6 without 7 and 8 (a delete
on values not yet saved). 9 comes a release after 6.

## Consequences

- digiKam and honeycomb see the same values; a change in digiKam shows at the next folder visit,
  and honeycomb's writes reach digiKam at its next scan (it reads a sidecar newer than the image).
  digiKam needs *Read from sidecar files* on, a writing mode with sidecars, the default sidecar
  name and the field switches for rating, pick, colour and tags
  ([`user/ratings-flags-colours.md`](../user/ratings-flags-colours.md#digikam-settings)); without
  reading, its own write drops `honeycomb:KeepRaw` and darktable's history.
- digiKam's extra copies (`MicrosoftPhoto:Rating`, `acdsee:rating`, `photoshop:Urgency`, four more
  tag fields) go stale; digiKam reads `xmp:Rating`, `ColorLabel` and `TagsList` first, so they are
  not seen. honeycomb does not write them.
- darktable sees honeycomb's ratings, colours and tags only through its crawler (off by default,
  confirmed in a dialog) and overwrites `xmp:Rating` from its database on its next write.
  darktable is second priority.
- Without writing, honeycomb views, compares, moves and deletes; culling needs the opt-in, so the
  first attempt asks.
- Every saved change makes a Nextcloud version and a desktop sync (risk R9); bundling keeps it to
  about one version per picture and visit, and the versions app thins them out.
- In a shared folder ratings are no longer per user; Q20 holds only for app state.
- The first visit of a large folder reads every sidecar once (about 20,000 for 10,000 pairs); the
  client packs lookups to at most 8 MiB and 1,000 ids by the listed `size`, parses in idle chunks
  and shows progress. Later visits read only what changed. The cache is per user, so in a shared
  folder each user reads each sidecar once; a cache per `(file_id, etag)` across users would be
  possible, since the sidecar lookup checks access.
- A picture with a refused sidecar cannot be decided on in honeycomb.
- Moves need no `carryOver` for decisions and tags: the sidecar moves with the picture and, since
  #208, keeps its file id.
- Known limits: without DELETE permission a failed save leaves its `.part` file; the flush on
  hide is best effort.
