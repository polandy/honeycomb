# 0040 – Flags per picture in the database; who may write may rate

- Status: accepted
- Date: 2026-11-19
- Supersedes in part: [0032](0032-sidecar-is-the-source-of-truth.md),
  [0005](0005-decisions-in-database-and-xmp-sidecars.md), [0012](0012-decision-storage.md),
  [0017](0017-sidecar-endpoints.md), [0022](0022-tag-storage.md)

## Context

ADR 0032 made the sidecar the source of truth for all six values and guarded every write with six
locks (`off`, `readOnly`, `shared`, `noVersions`, `refused`, `legacy`), a switch, a per-folder
confirmation of shared folders and a migration of the old per-user rows (XMP-007). The owner
found it too complicated (#252, #253): it protects data that exists nowhere, since honeycomb runs
in no production, and asks about shares that Nextcloud already governs. On 2026-11-18 the owner
chose concept D: flags live in the database per picture, ratings, colour labels and tags stay in
the sidecars, and whoever may write a folder may rate in it. The owner's answers to the concept's
open questions and the throw-away data rule of the same day are binding here.

Nextcloud gives every folder one number of rights for the user (READ 1, UPDATE 2, CREATE 4,
DELETE 8, SHARE 16), with share masks, team folder ACLs, read-only mounts and federated shares
already in it (`Folder::getPermissions()`). A shared file has the same file id for every user who
reaches it, so a row keyed by file id alone is "per picture".

The options were: A, everything in the sidecars at once (digiKam sees all, but honeycomb would
write picks into other programs' files all the time); B, flags per user in the database (two users
of one folder would delete each other's photos by different rejects); C, A in writable and B in
read-only folders (two models and a migration whenever rights change); D, chosen.

## Decision

### Where each value lives

| Value | Truth | In the sidecar |
|---|---|---|
| Rating | sidecar | written at once, `xmp:Rating` |
| Colour label | sidecar | written at once, `digiKam:ColorLabel`, `xmp:Label`, darktable's where it wrote |
| Tags | sidecar | written at once, `digiKam:TagsList`, `lr:hierarchicalSubject`, `dc:subject` |
| Flag | `honeycomb_flags`, per file id | only through *Write picks/rejects to XMP* |
| *Keep RAW* | `honeycomb_flags`, per file id | only through the same entry, `honeycomb:KeepRaw` |

The field mapping stays as [`06-xmp-interop.md`](../06-xmp-interop.md) has it; a reject is never
written as `xmp:Rating` −1. A write of a rating, colour label or tag leaves the flag fields and
`honeycomb:KeepRaw` of the sidecar as they are.

### Rateable and read only

1. **Two states.** A picture is *rateable* when the folder of every member grants UPDATE and
   CREATE in the listing's `permissions`, otherwise *read only*. A folder the listing does not
   name counts as rateable; the server checks every write again (ADR 0031).
2. **One rule for all six values.** A read-only picture cannot be flagged, rated, labelled, marked
   *Keep RAW* or tagged. The rule holds for the flags too, although they live in the database, so
   a bulk step is all or nothing per picture and the export can write every picture that could be
   rated. UPDATE and CREATE stay the rule although the sidecar save writes in place since ADR
   0017's amendment of 2026-11-18 (an existing sidecar needs UPDATE only): one rule per folder is
   simpler for bulk steps, and the export may have to create a sidecar.
3. **No other locks.** A shared folder needs no confirmation and gets no hint; a folder without
   versions (every external storage) is rateable, and the sidecar save overwrites there too; a
   sidecar that cannot be read as XMP is a failed write of that picture, not a lock. The switch
   *Write decisions to XMP sidecars*, the shared-folder detection and the `shared` and `versions`
   fields of the listing go. Moving and deleting keep their own checks (DELETE on the file,
   CREATE in the target).
4. **Failed writes** of a rating, colour label or tag are taken back for that picture, and the
   toast names the reason: `locked`, `notPermitted`, `changed`, `failed`, and the new `noSpace`
   when the storage or quota is full (a new sidecar in a received share counts against the
   owner's quota). The other pictures of the step stay changed. A flag write fails only on a
   server error and is taken back the same way.

### The table and its endpoints

1. **`honeycomb_flags`**: `file_id` (unique), `flag` (`picked`, `rejected`, `unflagged`),
   `keep_raw`, `updated_at` from the injected clock. No `user_id`. One row per member of a
   picture; the client writes every member's row with the same values, and a picture whose
   members' rows differ reads as the row changed last.
2. **Reading** is part of the listing only: each entry carries `flag`, `keepRaw` and
   `flagUpdated`, `null` while the file has no row. There is no lookup of arbitrary file ids, so
   nobody learns the flags of files they cannot list.
3. **Setting**: `PUT /apps/honeycomb/api/v1/flags` with `{"flags": [{"fileId", "flag",
   "keepRaw"}]}`, at most 60,000, answers `{"saved": [ids], "skipped": [{"fileId", "reason"}]}`
   with `notFound` for an id the user does not reach as a photo and `notPermitted` for a folder
   without UPDATE or CREATE. Ids are checked per folder, not per file (ADR 0038 batches). The last
   save wins. An undo is a new save of the earlier values.
4. **Taking over**: `POST /apps/honeycomb/api/v1/flags/take-over` with the same body inserts a row
   only for a file id that has none, and needs READ only; it never changes a row. The client
   sends it for each listed photo without a row, with the flag and *Keep RAW* its sidecars and
   embedded XMP state (XMP-001.8, through the XMP cache), or *unflagged* without either. A
   picture counts as taken over once honeycomb has seen it (owner, question 3): a later change in
   digiKam is not read any more. A reader may take over, since taking over only records what the
   files already say.
5. **Moving** to another storage, where a file gets a new id, carries its row to the new id
   (`MoveService::carryOver`).
6. **Throw-away data** (owner, 2026-11-18). The rows are culling data, not an archive:
   - Deleting a picture through honeycomb (*Delete rejected*, *Delete…*, *Remove RAWs* for the
     RAW member) removes the rows of the files it trashed or deleted, in the same request.
     Restoring from the trash bin brings no flag back.
   - *Clear picks/rejects* in the grid's ⋯ menu sets every rateable picture of the open folder
     set to *unflagged* without *Keep RAW*, as one undo step; the rows stay, so the old sidecar
     flags are not taken over again. The sidecars are not touched.
   - `SweepVanishedRows` removes the rows of files deleted for good, like the other file
     row tables.
   - `occ honeycomb:cleanup` and *Clean up orphaned data* in the settings, shown to admins only
     because it acts on every user's photos, remove the rows whose file id no longer exists or
     lies in a trash bin, and report how many.
   - Deleting a user leaves the rows: they belong to the photos.

### Write picks/rejects to XMP

1. An entry of the grid's ⋯ menu, for every picture of the open folder or folder set, whatever
   the filters show (owner, question 1). It replaces *Write decisions to sidecars…* and writes
   through the existing sidecar write path (`src/sidecar-flow.ts`). There is no switch.
2. The entry shows the number of sidecars whose flag or `honeycomb:KeepRaw` differs from the
   database, as the XMP cache states them, plus the sidecars it would create, without asking
   first (owner, question 2): *Write picks/rejects to XMP · 214*.
3. For each rateable picture it writes the flag and *Keep RAW* into every sidecar that differs;
   *unflagged* removes the pick fields, except an existing digiKam `PickLabel` 2. A picture with
   a flag or *Keep RAW* and a member without a sidecar gets `<member file>.xmp`; an *unflagged*
   picture without *Keep RAW* gets none.
4. Its toast says *N XMP files written*, with failures *N written, M not written: read only* or
   the reason of 4 above, with *Details*; with nothing to write *All XMP files are up to date*. It
   is no undo step.

### Deleting by decision

The fresh check reads no sidecar any more. *Delete rejected* sends `"expect": "rejected"` and
*Remove RAWs* `"expect": "rawRemovable"` (not *Keep RAW*, not rejected) with each picture to the
trash endpoint, which trashes a picture only while every member's row still says so and answers
`decisionChanged` otherwise; checking and deleting are one request, also when two users work at
once. The client still lists the folders again, so moved, renamed and vanished members show.
Before *Remove RAWs* takes `IMG.NEF.xmp`, a JPEG without a sidecar of its own gets one seeded
from `IMG.NEF.xmp` read again, with every field but `honeycomb:KeepRaw`
(amended 2026-11-20, owner, #187 D68: before, it got the rating, colour label and tags the cull
showed, which lost other programs' fields such as face regions; amended 2026-11-21, owner, #187
H6: digiKam's pick fields are kept too); where that cannot be read or
written, the pair is skipped. A
failed request deletes nothing; the dialog *Fresh check not possible* of #274 goes.

### What of the earlier ADRs holds

- **0032:** *Truth* holds for rating, colour label and tags only; *Writability* 1, 2, 4, 6, 7, 8
  and *App state and migration* 2 and 3 are replaced by this ADR; *Deleting by decision* is
  replaced by the section above; *Cache*, *Bundling, undo and conflicts* and *Writability* 3, 5, 9
  hold.
- **0005, 0012:** the flag and *Keep RAW* are in the database again, now per file id without a
  user; the rest stays replaced.
- **0017:** the shared-folder detection goes; the sidecar endpoints and the checked save hold, and
  an existing sidecar is overwritten without versions too.
- **0022:** file tags in the database (`honeycomb_file_tags`) go; the tag list per user
  (`honeycomb_tag_list`) stays.

### Implementation order

| # | Pull request | Contents |
|---|---|---|
| 1 | `docs(adr)` | this ADR, the specs, `06-xmp-interop.md`, the user docs, `TODO.md` |
| 2 | `docs(mockup)` | lock on tiles, greyed controls, *Write picks/rejects to XMP* and its toast, *Clear picks/rejects*; for the owner's sign-off (ADR 0003) |
| 3 | `refactor(cull)` | the switch, the shared confirmation, `noVersions` and `refused` as locks, `SharedFolders`, `shared` and `versions` in the listing go; two states |
| 4 | `refactor(xmp)` | the migration XMP-007 goes, PHP and Vue |
| 5 | `feat(db)` | `honeycomb_flags`, the listing's values, the set and take-over endpoints, `carryOver`, the clean-up job, `occ honeycomb:cleanup` and its button; the old tables and endpoints go, the start value of ADR 0039 first |
| 6 | `feat(cull)` | the cull reads flags from the listing, takes over once, writes ratings without the flag fields, *Clear picks/rejects*, the lock as the mockup draws it |
| 7 | `feat(xmp)` | *Write picks/rejects to XMP* with its count and toasts |
| 8 | `fix(delete)` | the trash endpoint checks `expect` and removes the rows; the fresh check reads no sidecar |

1 before all; 2 before 6; 3 and 4 after 1, in any order; 5 after 3 and 4; 6 after 5; 7 and 8
after 6. **5 to 8 ship in one release**: after 5 alone the cull has no flags, and before 8 a
delete checks sidecars that no longer hold the rejects. No migration keeps the old rows:
honeycomb runs in no production, so PR 5 drops `honeycomb_decisions` and `honeycomb_file_tags`
at once.

## Consequences

- digiKam sees honeycomb's ratings, colour labels and tags at its next scan, its picks only after
  *Write picks/rejects to XMP*; until then a digiKam pick that honeycomb rejected shows in
  digiKam. The count in the menu entry shows how far digiKam is behind.
- Every user of a folder sees the same flags; whoever deletes the rejects deletes them for all.
  The owner's trash bin and the server-side check of `expect` bound the damage. A reader can take
  over flags for a photo honeycomb has not seen yet, never change one; the reject review shows
  every reject before anything is deleted.
- Flags are lost when a file gets a new id outside honeycomb (a sync client re-uploads it, the
  Files app moves it to another storage); an exported flag is taken over again from the sidecar.
- There is no trace of who changed a flag; the last save wins.
- Without versions there is no way back in Nextcloud for a sidecar on external storage; the
  delta write keeps other programs' fields, and undo in honeycomb works.
- Lightroom keeps its pick flags in its catalogue, not in the sidecar; a `xmp:Rating` −1 is taken
  over as a reject.
- Read-only users view, compare, filter and see every value; they write no sidecar and set no
  flag.
- The migration XMP-007, the legacy tables and the settings `sidecarWrite` and
  `confirmedSharedFolders` go, several thousand lines in all.
