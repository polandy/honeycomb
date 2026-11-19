# LISTING-001 – Entries of a folder set

- Status: implemented
- Area: listing
- Origin: plan.md M1.2, Multiple folders; ADR 0009; decisions.md (2026-11-10, listing)
- Depends on: –

## Purpose

The client needs every photo file and sidecar of a folder set, with the facts to pair, sort and
show them, from one request per folder. The server lists; it never pairs (ADR 0006).

## Behaviour

**Concept D (ADR 0040).** M8 PR 5 adds to each entry the
picture's `flag`, `keepRaw` and `flagUpdated` from `honeycomb_flags` (DECISIONS-001.21), each
`null` while the file has no row. Until then the text below holds.

`GET /apps/honeycomb/api/v1/entries?path=<folder>[&subfolders=1][&excluded[]=<folder>...]`,
logged in, with the CSRF token. `path` is relative to the user's files; empty is the root. The
answer is `{"entries": [...], "truncated": <bool>, "folders": [...], "fileId": <n>}`, `fileId`
being the listed folder's. An entry has `fileId`, `path`
(from the user's files, leading `/`), `size`, `mtime`, `etag`, `mime` and `captureTime`,
`orientation`, `width`, `height` from Nextcloud's file metadata, each `null` where it has none,
and `visualHash`, the user's stored visual hash of the file's current version or `null`
(SERIES-003).
`folders` has one item per folder that holds an entry, `{"path": "/Photos", "permissions": 31}`
(ADR 0040). `permissions` are Nextcloud's bits of the folder for the user (READ 1, UPDATE 2,
CREATE 4, DELETE 8, SHARE 16), with the share mask, reshares, ACLs and read-only mounts in them.
No share or versions lookup is made.

Listed are files whose mime type is `image/*` or whose name ends in `.xmp`, `.cr3` or `.srw`
(case-insensitive): Nextcloud types Canon and Samsung RAW files `application/octet-stream`. Without
`subfolders` only the folder's own files; with it every folder below, through every mount inside,
except hidden folders and files (a segment starting with `.`) below the picked folder and the
`excluded` folders (paths like `path`, at most 1,000), which are never opened (ADR 0035). Folders
outside the user's files (trash bin, preview folders) never match. The listing stops at 60,000
entries and then sets `truncated`.

| Case | Answer |
|---|---|
| Path with `..`, a vanished folder, a file, a folder outside the user's files | `404`, empty body |
| `excluded` not a list of paths, a path with `..`, more than 1,000 | `400` |
| A folder the user may not read | `403`, empty body |
| No logged-in user | `401` |

The client lists each ticked folder and merges the answers, so a file is listed once even when a
ticked parent with subfolders and a ticked child both hold it.

## Acceptance criteria

### LISTING-001.1 – Photos and sidecars of the folder

- **Given** a folder with JPEG, RAW, XMP and other files and a subfolder
- **When** the user lists it without `subfolders`
- **Then** the answer holds its image files and sidecars as entries, and nothing else

### LISTING-001.2 – An entry carries the file and its EXIF basics

- **Given** a listed file with capture time, orientation, dimensions and camera in its metadata
- **When** it is listed
- **Then** its entry has file id, path, size, mtime, ETag, mime type and those values; the camera
  is make and model, trimmed and joined by a space, or the one of them that is there

### LISTING-001.3 – Missing metadata is null

- **Given** a file whose metadata lacks some or all EXIF basics
- **When** it is listed
- **Then** each missing value is `null` and the entry is still listed

### LISTING-001.4 – Subfolders at any depth

- **Given** a folder with nested subfolders
- **When** the user lists it with `subfolders=1`
- **Then** the answer holds the photos and sidecars of every folder below, read folder by folder:
  each folder's listing once, each file once, a folder the user may not read never

### LISTING-001.5 – Hidden folders and files are skipped

- **Given** hidden folders and files below the picked folder
- **When** the folder is listed with `subfolders=1`
- **Then** they are left out and a hidden folder is never opened; a hidden folder picked on purpose
  is listed

### LISTING-001.6 – The entry limit

- **Given** a folder set with more than 60,000 entries
- **When** it is listed
- **Then** the answer holds 60,000 entries and `truncated` is true; exactly 60,000 is complete

### LISTING-001.7 – A foreign or vanished path reveals nothing

- **Given** a path with `..`, a folder outside the user's files, a vanished folder or a file
- **When** it is listed
- **Then** the answer is `404` with an empty body

### LISTING-001.8 – An unreadable folder is forbidden

- **Given** a folder the user may not read, open or search
- **When** it is listed
- **Then** the answer is `403` with an empty body

### LISTING-001.9 – Logged in, with the CSRF token

- **Given** the entries route
- **When** it is called without a user
- **Then** the answer is `401`; the route is a `GET` for every user that checks the CSRF token

### LISTING-001.10 – 2,000 pairs without stalls

- **Given** a folder set of 2,000 RAW+JPEG pairs
- **When** it is listed with `subfolders=1`
- **Then** it takes one file-cache query per folder, not one per file

### LISTING-001.11 – Overlapping folders list a file once

- **Given** a ticked parent with subfolders and a ticked child folder
- **When** the client merges their listings
- **Then** each file is listed once, in listing order

### LISTING-001.12 – Each folder says whether it is shared (removed)

Withdrawn by ADR 0040 (M8 PR 3); a folder names its path and permissions only (.19).

### LISTING-001.13 – RAW files Nextcloud does not type are listed

- **Given** a `.CR3` and a `.SRW` file typed `application/octet-stream`, and another file of that
  type
- **When** their folder is listed, with or without `subfolders`
- **Then** the `.CR3` and `.SRW` files are entries and the other file is not

### LISTING-001.14 – Each folder names the user's permissions

- **Given** entries in a folder of the user's own and in a folder shared with the user read-only
- **When** the client lists them
- **Then** each folder's `permissions` are its bits for the user: all of them for the own folder,
  READ without UPDATE and CREATE for the read-only share

### LISTING-001.15 – Each folder says whether it keeps versions (removed)

Withdrawn by ADR 0040 (M8 PR 3); a folder names its path and permissions only (.19).

### LISTING-001.16 – Excluded folders are left out

- **Given** a folder with subfolders, two of them excluded, one of those nested deeper
- **When** the client lists it with `subfolders=1` and `excluded[]`, or with a malformed `excluded`
- **Then** the excluded folders and everything below them are neither listed nor opened, the
  others are; a malformed `excluded` answers `400`

### LISTING-001.17 – The shares are read once per listing (removed)

Withdrawn by ADR 0040 (M8 PR 3); a folder names its path and permissions only (.19).

### LISTING-001.18 – Each entry carries its flag (gap)

- **Given** a photo with a row in `honeycomb_flags` saying *rejected* with *Keep RAW*, a photo
  without a row and a sidecar
- **When** the client lists them
- **Then** the first entry has `flag` `rejected`, `keepRaw` true and `flagUpdated` the row's time;
  the other two have `null` in all three, and the flags are read in one query per 1,000 entries

### LISTING-001.19 – A folder names its path and permissions only (gap)

- **Given** entries in a folder of the user's own, in a folder shared with the user and on
  external storage
- **When** the client lists them
- **Then** each `folders` item has `path` and `permissions` only, and no share or versions lookup
  is made

## Out of scope

- Grouping entries into pictures: LISTING-002.
- The 20,000-picture cap applied after pairing: GRID-002.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged code of #37 and #41 (ADR 0015) |
| 2026-11-10 | `folders` with the shared flag (ADR 0017) |
| 2026-11-10 | Public links, mail shares and external storage of several users count as shared (owner review) |
| 2026-11-11 | `.cr3` and `.srw` files are listed by name (`TODO.md`, owner 2026-11-10) |
| 2026-11-14 | A folder shared with the user is shared without asking the share manager |
| 2026-11-14 | `visualHash` on every entry (SERIES-003, ADR 0024) |
| 2026-11-15 | `permissions` and `versions` per folder (.14, .15; ADR 0032) |
| 2026-11-15 | The listed folder's `fileId` (XMP-008.4) |
| 2026-11-17 | `excluded` folders left out (.16; ADR 0035) |
| 2026-11-18 | The shares are read once per listing, not per folder (.17; `docs/dev/plan.md` Multiple folders item 9) |
| 2026-11-19 | ADR 0040: `shared` and `versions` go, each entry carries its flag (.12, .15, .17 withdrawn; .18, .19 gaps) |
| 2026-11-19 | M8 PR 3: folders carry `path` and `permissions` only (.12, .15, .17 removed; .19 implemented) |
