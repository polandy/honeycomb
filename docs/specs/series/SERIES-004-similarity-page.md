# SERIES-004 – Similarity page

- Status: implemented
- Area: series
- Origin: owner decision 2026-11-14 (fingerprints in bulk on a page of their own); ADR 0025
- Depends on: SERIES-003

## Purpose

A strong computer computes the visual hashes of a whole folder tree at once, so a later cull on
any device finds them stored and links series at once.

## Behaviour

- The page *Similarity* (`/apps/honeycomb/similarity`) opens from the navigation. It shows the
  user's folders to choose one; its subfolders are always included.
- `GET /apps/honeycomb/api/v1/visual-hashes/missing?path=/Photos&after=<cursor>` answers
  `{"pictures": [{"fileId": 9, "etag": "…", "mtime": 1700000000, "path": "/Photos/a.jpg"}],
  "next": "<cursor>"}`: the user's own photos (ListingService::isPhoto) in the folder and every
  folder below it without a stored hash of their current etag. It walks the tree in name order
  and stops after 500 photos; `next` is the path of the last photo looked at, relative to the
  folder, or `null` when the walk ended before 500. A page may hold fewer pictures, even none,
  while `next` is not `null`. Hidden and unreadable folders, and folders of another mount (a
  share, a group folder, external storage), are skipped. `404` for a path that is not the user's folder,
  `403` when it is not readable, `400` for a cursor that is not a relative path.
- *Start* asks for the pages one after another and hashes their pictures, each the way the grid
  hashes it (SERIES-003.22): the same URL of the small grid tier and the same drawing and hash
  code, in Web Workers, as many as the processor's cores less one, at least one, at most eight.
  A worker starts when a picture needs one and no started worker is idle, not when the page
  opens. A worker that crashes fails the picture it was hashing; it is ended, and the next
  picture starts a new one.
- The hashes are saved in requests of at most 250, when 250 are computed, once no picture is
  left and when the run pauses.
- *Pause* hands no further picture to a worker; the pictures being hashed and a save in flight
  finish, then what is unsaved is saved; a page load in flight goes on and is queued. *Resume*
  goes on from there.
- A save the server limits (`429`, SERIES-003.23) does not pause the run: the run waits the
  seconds of the answer's `Retry-After` header, else 60 s, the period of the limit, and sends the
  same hashes again, as often as it takes. Meanwhile the workers go on hashing and no other save
  is sent, and the page says *The server asked for a break: the hashes are saved again in 60 s.*
  *Pause* takes effect once that save is through.
- A failed save pauses the run and keeps its hashes; *Resume* sends them again. A picture whose
  preview cannot be loaded or hashed, or that the server skips on save, counts as failed and is
  not tried again in this run; its path is listed under the progress.
- The progress uses the hash states of SERIES-003.16: *hashed*, *pending*, *failed*. It shows
  the photos found, hashed, failed and left, and a bar; while pages are still coming, the photos
  found are a lower bound.
- A run that stops, by a reload or a closed tab, starts again where it stopped: the server
  delivers only the photos still without a hash. Failed photos are tried once more.

## Acceptance criteria

### SERIES-004.1 – The server lists the missing hashes of a tree

- **Given** photos in a folder and its subfolders, some with a stored hash of their current
  etag, one with a hash of an older etag, a sidecar and a hidden folder
- **When** the user asks for the missing hashes of the folder
- **Then** the answer lists the photos without a current hash, in name order through the tree,
  each with file id, etag, mtime and path, and `next` is `null`

### SERIES-004.2 – A page ends with a cursor

- **Given** more photos below a folder than one page holds
- **When** the user asks for the missing hashes and then again after the answered `next`
- **Then** the second page goes on with the first photo after the cursor and lists no photo
  twice; folders before the cursor are not listed again

### SERIES-004.3 – Only the user's own files

- **Given** a folder below the chosen one that is another user's share, and a chosen folder
  that is a share
- **When** the user asks for the missing hashes
- **Then** no photo of a share is listed

### SERIES-004.4 – A wrong path or cursor

- **Given** a path that is not a folder of the user, a folder the user may not read, or a cursor
  that is absolute or climbs out of the folder
- **When** the user asks for the missing hashes
- **Then** the answer is `404`, `403` or `400`; without a user it is `401`

### SERIES-004.5 – A run hashes every page in workers and saves in batches

- **Given** two pages of missing hashes
- **When** the run starts
- **Then** each picture is hashed once from the grid's small preview URL, and the hashes are
  saved in requests of at most 250 and when none is left

### SERIES-004.6 – Workers follow the cores

- **Given** a processor with a number of cores
- **When** the run's workers are made
- **Then** they are the cores less one, at least one and at most eight

### SERIES-004.7 – A worker hashes like the grid

- **Given** a preview the grid would hash
- **When** a worker hashes it
- **Then** it draws it with the same code as the grid and gives the same hash

### SERIES-004.8 – Pause and resume

- **Given** a running run with pictures being hashed and a save in flight
- **When** the user pauses
- **Then** no further picture is handed to a worker, the hashes in flight are kept and saved,
  and *Resume* goes on with the next picture

### SERIES-004.9 – A failed save pauses

- **Given** a running run
- **When** a save fails
- **Then** the run pauses with the save failure shown, and *Resume* sends the same hashes again

### SERIES-004.10 – A failed picture is not repeated

- **Given** a picture whose preview cannot be loaded, and a picture the server skips on save
- **When** the run goes on
- **Then** both count as failed, their paths are listed, and neither is hashed again in this run

### SERIES-004.11 – The progress

- **Given** a run with pictures found, hashed, failed and left
- **When** the page shows
- **Then** it shows those four counts and a bar, the found count marked as a lower bound while
  pages are still coming

### SERIES-004.12 – A failed page

- **Given** a running run
- **When** a page of missing hashes cannot be loaded
- **Then** the run pauses with the failure shown, and *Resume* asks for the same page again

### SERIES-004.13 – The page in Nextcloud

- **Given** a user with photos without a stored hash
- **When** they open *Similarity*, choose the folder and start
- **Then** the hashes are computed in workers and stored, and the cull of the folder delivers them

### SERIES-004.14 – A limited save waits and is sent again

- **Given** a running run
- **When** the server answers a save `429`, with or without a `Retry-After` header
- **Then** the run keeps hashing, says how long it waits, waits that long (60 s without the
  header) and sends the same hashes again, and loses none of them

### SERIES-004.15 – Workers start when needed

- **Given** the page with no run started
- **When** a run hands out its first pictures
- **Then** no worker runs before, and a new worker starts only while none of the started ones is
  idle and fewer than the count run

### SERIES-004.16 – A crashed worker fails one picture

- **Given** a run whose worker crashes while it hashes a picture
- **When** the crash is reported
- **Then** that picture counts as failed, the worker is ended and the next picture is hashed in
  a new worker; a crash while idle starts none

## Out of scope

- The hash and the link rule: SERIES-001. Storing and delivering the hashes: SERIES-003.
- Telling a pair's RAW from a RAW-only picture: the server knows no pairing, so every photo
  is hashed (ADR 0025).

## History

| Date | Change |
|---|---|
| 2026-11-14 | Written with the similarity page (owner decision, ADR 0025) |
| 2026-11-14 | A save the server limits waits and is sent again (ADR 0026) |
| 2026-11-15 | Workers start when needed; a crashed worker fails one picture (review R12 a) |
