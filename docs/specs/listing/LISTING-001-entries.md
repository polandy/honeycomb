# LISTING-001 – Entries of a folder set

- Status: implemented
- Area: listing
- Origin: plan.md M1.2, Multiple folders; ADR 0009; decisions.md (2026-11-10, listing)
- Depends on: –

## Purpose

The client needs every photo file and sidecar of a folder set, with the facts to pair, sort and
show them, from one request per folder. The server lists; it never pairs (ADR 0006).

## Behaviour

`GET /apps/honeycomb/api/v1/entries?path=<folder>[&subfolders=1]`, logged in, with the CSRF
token. `path` is relative to the user's files; empty is the root. The answer is
`{"entries": [...], "truncated": <bool>, "folders": [...]}`. An entry has `fileId`, `path`
(from the user's files, leading `/`), `size`, `mtime`, `etag`, `mime` and `captureTime`,
`orientation`, `width`, `height` from Nextcloud's file metadata, each `null` where it has none.
`folders` has one item per folder
that holds an entry, `{"path": "/Photos", "shared": <bool>}`: shared when another user or a
federated user has access to it or to a folder above it, when it or a folder above it is shared
by public link or by mail, when it lies in a group folder, or when it lies on external storage
mounted for another user too (ADR 0017).

Listed are files whose mime type is `image/*` or whose name ends in `.xmp`, `.cr3` or `.srw`
(case-insensitive): Nextcloud types Canon and Samsung RAW files `application/octet-stream`. Without
`subfolders` only the folder's own files; with it every folder below, through every mount inside,
except hidden folders and files (a segment starting with `.`) below the picked folder. Folders
outside the user's files (trash bin, preview folders) never match. The listing stops at 60,000
entries and then sets `truncated`.

| Case | Answer |
|---|---|
| Path with `..`, a vanished folder, a file, a folder outside the user's files | `404`, empty body |
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

### LISTING-001.12 – Each folder says whether it is shared

- **Given** entries in a folder of the user's own, in a folder shared with another user, below a
  folder shared with a federated user, in a folder shared by public link, in one shared by mail,
  in a group folder, on external storage of the user only and on external storage mounted for
  another user too
- **When** the client lists them
- **Then** `folders` lists each of these folders once, with its path, and `shared` is false only
  for the user's own folder and the external storage of the user only

### LISTING-001.13 – RAW files Nextcloud does not type are listed

- **Given** a `.CR3` and a `.SRW` file typed `application/octet-stream`, and another file of that
  type
- **When** their folder is listed, with or without `subfolders`
- **Then** the `.CR3` and `.SRW` files are entries and the other file is not

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
