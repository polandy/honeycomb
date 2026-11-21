# XMP-009 – Orphaned sidecars

- Status: implemented
- Area: xmp
- Origin: owner request 2026-11-21 (release 0.2.0, "XMP-Leichen bereinigen"); ADR 0047
- Depends on: DELETE-001

## Purpose

A sidecar whose photo was deleted outside honeycomb stays behind and clutters the folder. The page
*Orphaned sidecars* finds these sidecars in one folder tree or the whole library, shows them
without changing anything, and moves them to the trash bin only after the user confirms.

## Behaviour

- An **orphaned sidecar** is an `.xmp` file with no media file in its own folder that it belongs
  to. A media file is a photo (ListingService::isPhoto: an `image/` type or a RAW extension) or a
  video (a `video/` type). Hidden files count as well. The sidecar `<stem>.xmp` belongs to a media
  file whose name is `<stem>` (the digiKam and darktable form, `IMG_0001.CR2.xmp`), whose name
  without its last extension is `<stem>` (the Adobe form, `IMG_0001.xmp`), or, for a darktable
  duplicate `IMG_0001_01.CR2.xmp`, whose name is `IMG_0001.CR2`. Names compare ignoring case.
- The page *Orphaned sidecars* (`/apps/honeycomb/orphaned-sidecars`) opens from the navigation. It
  shows the user's folders to choose one, its subfolders always included, and offers *Whole
  library*, which is the user's folder `/`.
- `GET /apps/honeycomb/api/v1/sidecars/orphaned?path=/Photos&after=<cursor>` answers
  `{"sidecars": [{"fileId": 9, "etag": "…", "path": "/Photos/IMG_0001.CR2.xmp", "size": 4096}],
  "next": "<cursor>"}`: the orphaned sidecars of the folder and every folder below it, folder by
  folder in name order. A page ends after the folder in which it looked at its 1,000th file;
  `next` names that folder, `/` for the chosen folder itself, `null` when the walk is through.
  Hidden and unreadable folders, and folders of another mount (a share, a group folder, external
  storage), are skipped, as on the similarity page (SERIES-004). `404` for a path that is not the
  user's folder, `403` when it is not readable, `400` for a cursor that is not such a path. The
  scan changes nothing.
- *Find orphaned sidecars* asks for the pages one after another and lists every orphaned
  sidecar by folder: the folder's path, how many and how large, then each file name and size;
  above the list the total count and size. When none is found the page says *No orphaned
  sidecars found.*
- Nothing is moved before the user presses *Move N sidecars to trash*. A new scan or a new folder
  drops the list.
- `POST /apps/honeycomb/api/v1/sidecars/orphaned/trash` with
  `{"sidecars": [{"fileId": 9, "etag": "…"}]}`, at most 500, each once, checks each sidecar again
  and answers `{"sidecars": [{"fileId": 9, "result": "trashed"}]}` in the order sent. The result
  is one of DELETE-001's: `trashed`, `notFound` (gone, or no longer an `.xmp` file of the user),
  `changed` (another etag), `notPermitted`, `noTrashBin`, `tooLarge`, `locked`, `failed`, or
  `notOrphaned` when a media file it belongs to is now in its folder. A sidecar the trash bin
  would not keep is never deleted for good. Files of one name go to the trash bin in different
  seconds (ADR 0037). `409` when the trash bin app is off for the user, `400` for a malformed
  request; nothing is touched then.
- The page sends the sidecars in requests of at most 500 and then says *N moved to the trash bin,
  M skipped*; the skipped ones are listed with their path and reason. A failed request stops the
  run; the sidecars not sent count as skipped.

## Acceptance criteria

### XMP-009.1 – Both sidecar forms with a media file are no orphans

- **Given** a folder with `A.CR2` and `A.CR2.xmp`, `B.JPG` and `b.xmp`, `C.MOV` and `C.MOV.XMP`,
  `D_01.NEF.xmp` and `D.NEF`, and `E.CR2.xmp`, `F.xmp` with no media file
- **When** the user scans the folder
- **Then** the answer lists exactly `E.CR2.xmp` and `F.xmp`

### XMP-009.2 – A sidecar belongs only to a media file of its own folder

- **Given** `/Photos/A.xmp` and `/Photos/2024/A.JPG`, and `/Photos/G.xmp` next to `G.txt`
- **When** the user scans `/Photos`
- **Then** both `A.xmp` and `G.xmp` are listed

### XMP-009.3 – The scan walks the tree folder by folder and changes nothing

- **Given** orphaned sidecars in a folder, its subfolders, a hidden folder, an unreadable folder
  and a shared folder
- **When** the user scans the folder
- **Then** the answer lists those of the folder and its readable, own, visible subfolders in name
  order with file id, etag, user path and size, `next` is `null`, and no file was deleted

### XMP-009.4 – A page ends after a folder and the next goes on after it

- **Given** more files than a page looks at, spread over the folder and its subfolders
- **When** the user asks for a page and then for the page after its `next`
- **Then** each page ends after a whole folder, `next` is `/` for the chosen folder itself, and
  the pages together list every orphaned sidecar once

### XMP-009.5 – The scan refuses a wrong folder or cursor

- **Given** a path that is not a folder of the user, or a cursor with an empty, `.` or `..`
  segment, or without a leading `/`
- **When** the user scans
- **Then** the answer is `404` for the path and `400` for the cursor

### XMP-009.6 – Confirmed sidecars move to the trash bin

- **Given** two orphaned sidecars with their listed etags
- **When** the user sends them to the trash endpoint
- **Then** both are in the trash bin and both results are `trashed`, in the order sent

### XMP-009.7 – A sidecar that found its media file is skipped

- **Given** an orphaned sidecar from the scan, and a matching photo added to its folder since
- **When** the user sends it to the trash endpoint
- **Then** its result is `notOrphaned` and the sidecar stays

### XMP-009.8 – A changed, foreign or unrestorable sidecar is skipped

- **Given** a sidecar with another etag, an id that is not an `.xmp` file of the user, an
  undeletable sidecar and one the trash bin would not keep
- **When** the user sends them to the trash endpoint
- **Then** the results are `changed`, `notFound`, `notPermitted` and `noTrashBin`, and none was
  deleted

### XMP-009.9 – A malformed request or a disabled trash bin touches nothing

- **Given** a request that is not a list of file ids and etags, names a file twice or holds more
  than 500 sidecars, or a user whose trash bin app is off
- **When** the user sends it to the trash endpoint
- **Then** the answer is `400`, or `409` for the trash bin, and no file was deleted

### XMP-009.10 – Nothing moves without the confirmation

- **Given** the page found orphaned sidecars
- **When** the user does not press *Move N sidecars to trash*, scans again or chooses another
  folder
- **Then** no trash request is sent

### XMP-009.11 – The page lists the orphans by folder with count and size

- **Given** orphaned sidecars in two folders over two pages of the scan
- **When** the scan is through
- **Then** the page shows each folder with its count and size, each file, and the total count and
  size

### XMP-009.12 – The page reports what was moved and what was skipped

- **Given** a confirmed list of which the server trashes some and skips others, or whose second
  request fails
- **When** the move is through
- **Then** the page says how many moved to the trash bin and how many were skipped, and lists each
  skipped sidecar with its reason; after a failed request, the sidecars not sent count as skipped

### XMP-009.13 – The page opens from the navigation

- **Given** the app
- **When** the user opens the navigation
- **Then** *Orphaned sidecars* is listed after *Statistics* and opens the page

## Out of scope

- Sidecars whose media file lies in another folder, such as the RAW subfolder of *Separate
  subfolders*: they are orphans here; the preview shows them before anything moves.
- Counting the moved sidecars in the statistics (STATS-001 counts pictures and their files).

## History

| Date | Change |
|---|---|
| 2026-11-21 | Created with the feature (owner request for 0.2.0). |
