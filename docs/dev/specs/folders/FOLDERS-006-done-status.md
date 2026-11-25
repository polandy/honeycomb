# FOLDERS-006 – Mark a folder done and reopen it

- Status: accepted
- Area: folders
- Origin: owner decisions 2026-11-22 (folders to cull, milestone M12); ADR 0049 The done status
- Depends on: FOLDERS-005, DECISIONS-001, STATS-001

## Purpose

*Mark done* is the user's statement that they are through with a folder; *Reopen* takes it back.
The status is one per folder, shared like the flags, and changes no file.

## Behaviour

- `PUT /apps/honeycomb/api/v1/library/folders/{fileId}/done` with `{"photos": n}` marks the folder
  with that file id done and answers `200` with `{"fileId": <fileId>, "done": {"by": <user id>,
  "at": <Unix seconds>, "photos": n}}`. `photos` is the folder's photo count the client showed,
  from which *n new* is computed later (ADR 0049).
- The folder is looked up in the user's own files: a folder of the home storage, not a share,
  group folder or external storage. It is **rateable** when its permissions include update and
  create, the rule of a flag (XMP-008).
- The status is stored with the marking user, the time of the request and `photos`. A folder
  already done is marked again: the row is replaced, so the status names the latest user.
- `DELETE` on the same path removes the status and answers `204` without a body, also when the
  folder was not done.
- Both take the write rate limit (ADR 0031).
- The daily counter `folders_done` counts each successful `PUT` as 1 while *Keep statistics* is
  on; `DELETE` subtracts nothing (STATS-001).
- `404` when the file id is no folder in the user's own files; `403` when the folder is not
  readable or not rateable; `400` for a `photos` that is missing or no whole number from 0;
  `401` without a user. Nothing is stored, removed or counted for an error.
- `GET /library/folders` lists the status as `done` (FOLDERS-005.10).
- **Batch** (*Mark all done*, *Reopen all*, FOLDERS-009, ADR 0060). `PUT
  /apps/honeycomb/api/v1/library/done` with `{"folders": [{"fileId": f, "photos": n}]}` marks
  each folder done and answers `200` with `{"done": [{"fileId", "done"}], "skipped": [{"fileId",
  "reason"}]}`, `done` in the form of the single `PUT`. A readable folder that is not rateable is
  skipped with `read-only`, one already done with `done` and keeps its status. `DELETE` on the same
  path with `{"fileIds": [f]}` removes each status and answers `204`, also for a folder not done.
- Each folder of a batch is checked as a single one; one that fails the check fails the whole
  call: `404` for no folder of the user's own files, `403` for one not readable and, in a `DELETE`,
  for one not rateable. A body that is no list, an item without a whole `fileId` from 1 or `photos`
  from 0, or a file id given twice is `400` with its reason (ADR 0057); more than 500 folders is
  `400` with `too-many`. Nothing is stored, removed or counted for an error.
- A batch is written in one transaction and takes the write rate limit once. `folders_done`
  counts each folder it marked.

## Acceptance criteria

### FOLDERS-006.1 – Marking a folder done

- **Given** a rateable folder of the user's own files that is not done
- **When** the user sends `PUT …/done` with `{"photos": 412}`
- **Then** the answer is `200` with `done` naming the user, the time of the request and 412, and
  the next list shows the same `done`

### FOLDERS-006.2 – Marking again replaces the status

- **Given** a folder marked done by Bob with 400 photos
- **When** Alice sends `PUT …/done` with `{"photos": 412}`
- **Then** the folder has one status: by Alice, now, 412

### FOLDERS-006.3 – Reopening

- **Given** a folder marked done
- **When** the user sends `DELETE …/done`, and again
- **Then** both answers are `204` and the next list shows `done` `null`

### FOLDERS-006.4 – Not rateable

- **Given** a folder the user may read but not change, and one that lacks only the create
  permission, one marked done
- **When** the user marks the first two and reopens the third
- **Then** each answer is `403` and no status was stored or removed

### FOLDERS-006.5 – Not a folder of the user's own files

- **Given** a file id that does not exist, a file's id, a share's id
- **When** the user marks or reopens it
- **Then** the answer is `404` and nothing is stored or removed

### FOLDERS-006.6 – A malformed count

- **Given** a `PUT` without `photos`, with −1, with `"12"`, or with 1.5
- **When** the user sends it
- **Then** the answer is `400` and nothing is stored

### FOLDERS-006.7 – Without a user

- **Given** no logged-in user
- **When** a `PUT` or `DELETE` arrives, for one folder or a batch
- **Then** the answer is `401` and nothing is stored or removed

### FOLDERS-006.8 – Writes are limited per user

- **Given** a user who marks and reopens folders, one at a time or in batches
- **When** they send more than 600 writes within a minute
- **Then** Nextcloud answers the further ones `429`

### FOLDERS-006.9 – Each mark is counted, a reopen is not subtracted

- **Given** *Keep statistics* on
- **When** the user marks two folders and reopens one
- **Then** `folders_done` of the day is 2

### FOLDERS-006.10 – Counting off

- **Given** *Keep statistics* off
- **When** the user marks a folder
- **Then** the status is stored and no counter is written

### FOLDERS-006.11 – A failed count does not fail the mark

- **Given** the counter write fails
- **When** the user marks a folder
- **Then** the answer is `200`, the status is stored and a warning is logged

### FOLDERS-006.12 – A folder deleted for good loses its status

- **Given** a done status of a folder deleted for good and one of a folder that exists
- **When** the daily clean-up runs
- **Then** the first status is gone and the second stays (FOLDERS-005.17)

### FOLDERS-006.13 – A deleted user's done statuses stay without the name

- **Given** a user who marked folders done and another user who marked one
- **When** Nextcloud deletes the first user
- **Then** their statuses stay with the same time and photo count but no *done by*, those folders
  stay done for the others, and the other user's status keeps its name (ADR 0040, *Who shares what*)

### FOLDERS-006.14 – A status without a name reads without it

- **Given** a done status whose user was deleted
- **When** the list answers and the row shows its done line
- **Then** `done.by` is `null` and the line reads *Done 2026-11-20* without *· by*

### FOLDERS-006.15 – Marking a batch

- **Given** two rateable folders that are not done, a read-only folder and a folder done by Bob
- **When** the user sends `PUT /library/done` with the four
- **Then** the answer is `200`, `done` lists the two by the user with their photos, `skipped`
  lists the read-only folder with `read-only` and Bob's with `done`, Bob's status stays and
  `folders_done` of the day is 2

### FOLDERS-006.16 – A malformed batch

- **Given** a `PUT` whose `folders` is no list, one with an item without `photos`, with `photos`
  −1, with `fileId` 0, with a file id twice, with 501 folders, and a `DELETE` with 501 file ids
- **When** each is sent
- **Then** each answer is `400` with the reason `not-a-list`, `bad-value`, `bad-value`,
  `bad-file-id`, `duplicate`, `too-many` and `too-many`, and nothing is stored or removed

### FOLDERS-006.17 – One folder fails the whole batch

- **Given** a batch of a rateable folder with a file id that does not exist, a share's id, or an
  unreadable folder, and a `DELETE` of a done folder with a read-only done folder
- **When** the user sends each
- **Then** the answers are `404`, `404`, `403` and `403`, and no status is stored, removed or
  counted

### FOLDERS-006.18 – Reopening a batch

- **Given** two done folders and one that is not done
- **When** the user sends `DELETE /library/done` with the three
- **Then** the answer is `204` and none of them is done

## Out of scope

- The *Folders* screen, its toast, *Undo* and the row menu (FOLDERS-008, FOLDERS-009).
- *n new* and the *New photos* filter (pure TypeScript, FOLDERS-002).

## History

| Date | Change |
|---|---|
| 2026-11-25 | The batch endpoints (FOLDERS-006.15 to .18, ADR 0060, PR 4). |
| 2026-11-22 | A deleted user's statuses are removed (FOLDERS-006.13). |
| 2026-11-22 | Superseded: they stay without the name (FOLDERS-006.13, .14, ADR 0040). |
| 2026-11-22 | Created with the done endpoints (M12 PR 3, ADR 0049). |
