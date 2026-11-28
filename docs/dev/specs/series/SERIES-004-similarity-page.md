# SERIES-004 – Similarity page

- Status: implemented
- Area: series
- Origin: owner decision 2026-11-14 (fingerprints in bulk on a page of their own); ADR 0025
- Depends on: SERIES-003, SERIES-006

## Purpose

A strong computer computes the visual hashes of a whole folder tree at once, and then the sharpness
of its series members, so a later cull on any device finds them stored, links series and marks the
sharpest at once.

## Behaviour

- The page *Similarity* (`/apps/honeycomb/similarity`) opens from the navigation. It shows the
  user's folders to choose one; its subfolders are always included.
- `GET /apps/honeycomb/api/v1/visual-hashes/missing?path=/Photos&cursor=<cursor>&method=1` answers
  `{"pictures": [{"fileId": 9, "etag": "…", "mtime": 1700000000, "path": "/Photos/a.jpg"}],
  "nextCursor": "<cursor>"}`: the user's own photos (PhotoFiles::isPhoto) in the folder and
  every folder below it without a stored hash of their current etag and the asked method
  (SERIES-003). It walks the tree in name order and stops after 500 photos; `nextCursor` is the path
  of the last photo looked at, relative to the folder, or `null` when the walk ended before 500. A
  page may hold fewer pictures, even none, while `nextCursor` is not `null`. Hidden and unreadable
  folders, and folders of another mount (a share, a group folder, external storage), are skipped.
  `404` for a path that is not the user's folder, `403` when it is not readable, `400` for a cursor
  that is not a relative path or a method that is not an integer from 1 to 255.
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
- **Sharpness.** Once the hashes are done, the page lists the folder with every folder below it
  (LISTING-001, `subfolders=1`), pairs the files by the user's pairing settings and links the
  series candidates by capture time and the listed visual hashes (SERIES-001). It measures the
  shown member of each candidate's pictures that has no `quality` of the current method, as the
  cull measures (SERIES-006): one photo at a time in a worker of the pool, from the loupe tier,
  saved every 100 values and when none is left, a limited save sent again, a failed save logged.
  The page knows no decisions and no stored series: a rejected picture of a candidate is measured
  too, a picture only a stored series holds is left to the cull. Of a listing cut at 60,000
  entries the listed part is measured.
- The sharpness progress shows the photos to measure, measured, failed and left, and a bar; once
  none is left the page says *Done: every photo of a series in this folder has its sharpness.*
  *Pause* hands no further photo to the worker, the one being measured finishes; *Resume* goes on.
  A photo whose measure fails counts as failed and is not measured again on this page. A listing or
  pairing settings that cannot be loaded pause the sharpness with *Could not list the series of
  this folder. Resume to try again.*; *Resume* lists again.

## Acceptance criteria

### SERIES-004.1 – The server lists the missing hashes of a tree

- **Given** photos in a folder and its subfolders, some with a stored hash of their current
  etag, one with a hash of an older etag, one with a hash of another method, a sidecar and a
  hidden folder
- **When** the user asks for the missing hashes of the folder by the current method
- **Then** the answer lists the photos without a current hash of that method, in name order through
  the tree, each with file id, etag, mtime and path, and `nextCursor` is `null`

### SERIES-004.2 – A page ends with a cursor

- **Given** more photos below a folder than one page holds
- **When** the user asks for the missing hashes and then again with the answered `nextCursor` as `cursor`
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
- **Then** it draws it with the code the cull's hashes use, as the cull hashes in the same
  workers (SERIES-003.26), and gives the same hash

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

### SERIES-004.17 – The series members are measured after the hashes

- **Given** a folder tree with a series of two photos without a quality value, a series with a
  value of the current method on one photo and of another method on the other, and a single photo
- **When** the run's hashes are done
- **Then** the page lists the folder with its subfolders, measures the photos without a value of
  the current method, one at a time, and no photo before the hashes are done; the single photo and
  the photo with a current value are not measured, and the values are saved

### SERIES-004.18 – The sharpness progress

- **Given** a sharpness pass with photos measured, failed and left
- **When** the page shows
- **Then** it shows those counts with the photos to measure and a bar, and once none is left says
  it is done; a tree without a series is done at once with nothing to measure

### SERIES-004.19 – Pause and resume the sharpness

- **Given** a sharpness pass measuring a photo, and one whose listing is still in flight
- **When** the user pauses
- **Then** the photo in work finishes and no further one is measured, a listing that arrives
  starts nothing, and *Resume* goes on with the next photo

### SERIES-004.20 – A failed listing pauses the sharpness

- **Given** a sharpness pass whose listing or pairing settings cannot be loaded
- **When** the pass starts
- **Then** it pauses with the failure shown, and *Resume* lists the folder again

### SERIES-004.21 – A failed measure is not repeated

- **Given** a series photo whose measure fails
- **When** the pass goes on
- **Then** it counts as failed, the other photos are measured, and it is not measured again when the
  pass of the same folder runs again on this page

### SERIES-004.22 – The sharpness in Nextcloud

- **Given** a folder with a series of two photos in a subfolder and a single photo
- **When** the user starts the page on the folder
- **Then** the page says the sharpness is done, and the listing delivers a quality value for both
  series photos and none for the single one

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
| 2026-11-15 | The cull hashes in the same workers (review R12 b, SERIES-003.26) |
| 2026-11-24 | The missing hashes are asked for one method (SERIES-003.30) |
| 2026-11-28 | The page measures the sharpness of its series members after the hashes (ADR 0046) |
