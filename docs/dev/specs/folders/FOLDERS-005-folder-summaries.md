# FOLDERS-005 – Folder summaries and the library endpoints

- Status: implemented
- Area: folders
- Origin: owner decisions 2026-11-22 (folders to cull, milestone M12); ADR 0049
- Depends on: LISTING-002, LISTING-003, DECISIONS-001, SERIES-005

## Purpose

*Folders* ranks the folders below the user's library roots by the work and gain left in them. The
server counts each folder's photos once per content version and keeps the count; the decision
counts are read live on every request. This spec covers the two endpoints the list reads; the
done status writes, the ranking and the screen follow in their own specs.

## Behaviour

- A **library folder** is the root or a folder below it on the root's own storage, without a
  hidden name (`.` first) on the way; folders of another storage mounted below (shares, group
  folders, external storage) are left out. A folder's own photos are the files directly in it.
- A folder's **summary**, kept per folder for every user in `honeycomb_folder_summary`:
  - `photos`: its pictures as the default pairing lists count them (LISTING-002, LISTING-003.20):
    a RAW and a rendered file of one base name are one picture, hidden files are left out.
  - `bytes`: the size of all its photo files, RAW included; `rawBytes`: the size of its RAW files.
  - `bursts`: the pictures whose capture time is at most 3 s after the previous picture's, in
    capture time order (the series gap, `SERIES_GAP_SECONDS` of `src/logic/series.ts`). A
    picture's capture time is its earliest member's, from Nextcloud's file metadata; a picture
    without one is never a burst and never anyone's predecessor.
  - `oldest`, `newest`: the earliest and latest capture time, Unix seconds, `null` without any.
  - `lastActivity`: the latest modification time of its photo files, Unix seconds, `null` without
    a photo.
  - `previews`: up to 3 pictures that stand for the folder, `{fileId, mtime}` of each one's
    rendered file (a RAW alone is no candidate), taken from the candidates in capture time order
    (those without one come last, in name order) at the first, the middle and the last place
    (the first and the last of two, the one of one); empty without a candidate. The scan takes
    them from the files it reads anyway.
  - It is **fresh** while it was taken from the folder's current etag. A stale summary is listed
    with its stored values until a scan replaces it.
- `GET /apps/honeycomb/api/v1/library/folders?root=<path>&cursor=<fileId>&limit=<n>` answers
  `{"folders": [...], "nextCursor": <fileId>|null, "scanning": {"done": d, "total": t}|null}`.
  - `folders`: the library folders below `root` that have a summary with at least one photo, in
    file id order, those with a file id above `cursor` (default 0), at most `limit` (1 to 200,
    default 200). `nextCursor` is the last listed file id when more follow, else `null`.
  - Each row: `fileId`, `root` and `path` (paths in the user's files, `/` first), `photos`,
    `bytes`, `rawBytes`, `bursts`, `oldest`, `newest`, `lastActivity`, `picked`, `rejected`,
    `undecided`, `previews` (the summary's), `permissions` (the folder's Nextcloud permission
    bits) and `done`:
    `{"by": <user id>, "at": <Unix seconds>, "photos": n}` when the folder is marked done, else
    `null`.
  - `picked` and `rejected`: the folder's pictures with that flag now (DECISIONS-001; a picture
    whose members' rows differ counts by the latest one). `undecided`: `photos` less the picked,
    the rejected and the unflagged pictures in a done series of the requesting user (SERIES-005),
    at least 0.
  - `scanning`: `null` when every library folder below `root` has a fresh summary, else `total`
    the library folders and `done` those with a fresh summary.
- `POST /apps/honeycomb/api/v1/library/scan` with `{"root": <path>}` takes up to 50 library
  folders below `root` without a fresh summary, in path order, stores their summaries and
  answers `{"scanning": {"done": d, "total": t}}` counted after the scan. A user may scan at most
  600 times a minute (ADR 0031).
- `root` is a path in the user's files: `400` when it is no folder there, leaves the user's files
  or lies on a share, group folder or external storage (mount type other than the home
  storage's); `403` when the user may not read it. `400` for a `cursor` that is no integer of at
  least 0 or a `limit` that is no integer from 1 to 200. `401` without a user.
- The daily clean-up removes the summaries and done statuses of folders deleted for good; a
  renamed or moved folder keeps its file id, its summary and its done status.

## Acceptance criteria

### FOLDERS-005.1 – Photos counted per folder by the pairing rules

- **Given** a folder with a JPEG and a RAW of one base name, a JPEG alone, a text file, a hidden
  JPEG, and a subfolder with a photo
- **When** the folder is scanned
- **Then** its summary has 2 photos; the subfolder has a summary of its own with 1

### FOLDERS-005.2 – Bytes and RAW bytes

- **Given** a folder with a pair of a 3 MB JPEG and a 25 MB RAW, and a 4 MB JPEG alone
- **When** it is scanned
- **Then** `bytes` is 32 MB and `rawBytes` 25 MB

### FOLDERS-005.3 – Bursts by the series gap

- **Given** pictures taken at 0 s, 2 s, 5 s, 9 s and 12 s, and one without a capture time
- **When** the folder is scanned
- **Then** `bursts` is 3 (2 s, 5 s, 12 s); the gap is the series constant of `src/logic/series.ts`

### FOLDERS-005.4 – Capture times and the last activity

- **Given** a folder whose photos have capture times and modification times, and a pair whose
  members' capture times differ
- **When** it is scanned
- **Then** `oldest` and `newest` are the earliest and latest capture time, the pair counts by its
  earlier member, `lastActivity` is the latest modification time; a folder without capture times
  has `oldest` and `newest` `null`

### FOLDERS-005.5 – A scan takes a fixed batch in path order

- **Given** a root with 60 library folders without a summary
- **When** the user scans it
- **Then** the first 50 folders in path order get a summary and the answer is `{"scanning":
  {"done": 50, "total": 60}}`; the next scan stores the remaining 10 and answers 60 of 60

### FOLDERS-005.6 – Fresh by etag

- **Given** a scanned folder whose etag is unchanged and one whose etag changed since
- **When** the user lists and then scans the root
- **Then** the list shows both with their stored values and `scanning` counts only the first as
  done; the scan replaces only the second folder's summary

### FOLDERS-005.7 – The list pages by file id

- **Given** summaries of three folders with photos and one with none
- **When** the user lists with `limit=2`, then with `cursor` set to `nextCursor`
- **Then** the first page has the first two folders by file id and `nextCursor` the second's file id,
  the second page the third and `nextCursor` `null`; the folder without photos is not listed

### FOLDERS-005.8 – Scanning is null once every folder is fresh

- **Given** a root whose library folders all have a fresh summary
- **When** the user lists it
- **Then** `scanning` is `null`

### FOLDERS-005.9 – Decisions counted live per picture

- **Given** a scanned folder of 6 photos with a picked pair whose RAW's row is older and
  rejected, a rejected photo, an unflagged photo in a done series of the user, an unflagged photo
  in an open series, one in another user's done series and one without a flag
- **When** the user lists the root, without a new scan
- **Then** the row has `picked` 1, `rejected` 1 and `undecided` 3; a flag saved afterwards shows
  on the next list without a scan, and `undecided` is never below 0

### FOLDERS-005.10 – The done status

- **Given** one folder marked done by a user and one not
- **When** any user lists the root
- **Then** the first row's `done` is `{"by", "at", "photos"}` of that mark, the second's `null`

### FOLDERS-005.11 – The folder's permissions

- **Given** a library folder the user may read but not change
- **When** the user lists the root
- **Then** its row's `permissions` lack the update bit

### FOLDERS-005.12 – Hidden folders and other storages are left out

- **Given** a root with a hidden folder, a folder below a hidden one, and a share mounted below it
- **When** the user scans and lists the root
- **Then** none of them is scanned, listed or counted in `scanning`

### FOLDERS-005.13 – A root outside the home storage

- **Given** a root that does not exist, is a file, contains `..`, or is a share, group folder or
  external storage
- **When** the user lists or scans it
- **Then** the answer is `400` and nothing is stored; a root the user may not read is `403`

### FOLDERS-005.14 – A malformed page

- **Given** a `cursor` below 0 or not an integer, or a `limit` of 0, above 200 or not an integer
- **When** the user lists
- **Then** the answer is `400`

### FOLDERS-005.15 – Without a user

- **Given** no logged-in user
- **When** a list or a scan arrives
- **Then** the answer is `401` and nothing is stored

### FOLDERS-005.16 – Scans are limited per user

- **Given** a user who scans
- **When** they scan more than 600 times within a minute
- **Then** Nextcloud answers the further scans `429`

### FOLDERS-005.17 – Folders deleted for good

- **Given** a summary and a done status of a folder deleted for good, and of a folder that exists
- **When** the daily clean-up runs
- **Then** the first folder's rows are gone and the second's stay

### FOLDERS-005.18 – Preview pictures

- **Given** a folder of five JPEGs taken in the order `a`, `b`, `c`, `d`, `e`, a folder of one
  JPEG and a folder of a RAW alone
- **When** the folders are scanned and listed
- **Then** the first folder's `previews` are the files of `a`, `c` and `e` with their `mtime`, the
  one-JPEG folder's is that file, the RAW-only folder's is `[]`; a folder of two has its first and
  last

### FOLDERS-005.19 – Summaries from before the previews

- **Given** a summary of a folder with photos and one of a folder without, both written before the
  summary had `previews`, and a summary with previews
- **When** honeycomb updates to a release with the repair migration
- **Then** the first summary is gone, so the next scan writes it with its previews; the other two
  stay

### FOLDERS-005.20 – Only the library roots are listed and scanned

- **Given** the library roots `/Photos`, and the folders `/Photos-old` and `/Photos/2024`
- **When** the user lists or scans `/`, `/Photos-old`, `/Photos/../Other`, a root that was removed
  from the roots, or `/Photos/2024`
- **Then** the first four answer `400` with `bad-path` and return and store nothing; `/Photos/2024`,
  which lies inside a root, is answered; while no root is set every folder of the own storage is
  answered (the library setup, SETTINGS-001.36)

### FOLDERS-005.21 – Checking a candidate root

- **Given** the roots `/Photos` and a candidate `/Archive`
- **When** the setup calls `GET /apps/honeycomb/api/v1/library/root?root=<path>`
- **Then** it answers `204` for a folder of the user's own storage, whatever the roots, and `400` or
  `403` as FOLDERS-005.13 for any other; it returns no folder

## Out of scope

- Marking a folder done and reopening it (FOLDERS-006).
- The score, the reason text, the filters and sorts (pure TypeScript, `src/logic/folder-score.ts`).
- The library roots setting and its validation (client side, ADR 0049).
- Shares, group folders and Immich albums as library folders (phase 2).

## History

| Date | Change |
|---|---|
| 2026-11-22 | Created with the backend of *Folders* (M12 PR 2, ADR 0049). |
| 2026-11-25 | `previews` in the summary and the row (FOLDERS-005.18). |
| 2026-11-25 | Summaries from before the previews are scanned again (FOLDERS-005.19). |
| 2026-11-26 | Only the library roots are listed and scanned; the candidate root check (FOLDERS-005.20, .21). |
