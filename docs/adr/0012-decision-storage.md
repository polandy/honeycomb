# 0012 – Decision storage: per file id and user, written as whole states

- Status: accepted
- Date: 2026-11-10

## Context

Rating, colour label, flag and *Keep RAW* are stored per picture and user in the database
(ADR 0005, Q2, Q20), and so is the resume position per folder set and user, so a cull continues on
another device ([`plan.md`](../plan.md#culling-workflow) item 6). Pictures exist only on the
client: the server lists flat entries and the client pairs them (ADR 0006, ADR 0009). File ids
survive a rename and a move within a storage; *Remove RAWs* takes the RAW member away from a
picture. A bulk action can change 2,000 pictures of two or three files each at once.

## Decision

- **Key.** A decision is stored per file id and user, one row for each member of a picture with
  the same values. Whatever member survives *Remove RAWs*, a move or a new pairing still carries
  the decision; the client merges the members' rows into the picture's decision.
- **Tables.** `honeycomb_decisions`: `user_id`, `file_id` (unique together), `rating` 0–5,
  `colour_label` (digiKam's nine colours by name, `NULL` for none), `flag` (`picked`,
  `rejected`, `unflagged`), `keep_raw`. A row equal to the default — unrated, no colour label,
  unflagged, not *Keep RAW* — is deleted rather than stored. `honeycomb_positions`: `user_id`,
  `folder_set_key` (unique together; SHA-256 of the sorted paths and the subfolders switch, the
  same form as `folderSetKey()` in `src/logic/folder-set.ts`), `folder_set` (JSON), `file_id` of
  the current picture, `decided` and `total` for *Recent*, `updated_at`. Only the 20 most recent
  positions per user are kept.
- **Read decisions:** `POST /apps/honeycomb/api/v1/decisions/lookup` with
  `{"fileIds": [...]}`, at most 60,000 (the listing's limit, ADR 0009), answers
  `{"decisions": [...]}` with the stored rows only; a file id without a row is undecided. A
  decision is `fileId`, `rating`, `colourLabel` (`red`, `orange`, `yellow`, `green`, `blue`,
  `magenta`, `gray`, `black`, `white` or `null`), `flag` and `keepRaw`. `POST`, because 60,000
  ids do not fit a URL.
- **Write decisions:** `PUT /apps/honeycomb/api/v1/decisions` with `{"decisions": [...]}`, each
  a whole decision, at most 60,000, in one transaction. Whole states, not changes: the client
  holds every value, so undo and redo send the earlier state back, and the same request twice
  leaves the same rows. A malformed item rejects the whole request with `400`; nothing is
  written.
- **Resume positions:** `GET /apps/honeycomb/api/v1/positions` answers `{"positions": [...]}`,
  newest first; `PUT /apps/honeycomb/api/v1/positions` stores one: `folderSet` (`paths`,
  `subfolders`, as `FolderSet` in `src/logic/folder-set.ts`), `fileId`, `decided`, `total`; the
  answer adds `updatedAt` (Unix seconds).
- **File ids are not looked up.** A row is the user's own, read back only by that user, and
  touches no file, so a foreign or vanished file id reveals and changes nothing. Checking every id
  would cost a file-cache query per file on a bulk action. Every action that touches a file —
  delete, move, writing a sidecar — rechecks its ids as before.
- **Errors:** `400` for a malformed body, a path with `..` or more than the limit; `401` without
  a user. The body is empty.

## Consequences

- One lookup per folder set after the listing; a bulk action is one request.
- Rows of files deleted for good are removed by the daily job `RemoveVanishedDecisions`, which
  compares them with the file cache; a file in the trash bin keeps its row and its decision. The
  rows and positions of a deleted user go with the user (`UserDeletedEvent`). A position whose
  picture is deleted for good stays, so *Recent* still lists its folder set.
- Two devices writing the same picture: the last write wins.
- A new field is added, never renamed or removed, without a new version in the path.
