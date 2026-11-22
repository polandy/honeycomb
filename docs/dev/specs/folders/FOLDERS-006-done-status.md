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
- **When** a `PUT` or `DELETE` arrives
- **Then** the answer is `401` and nothing is stored or removed

### FOLDERS-006.8 – Writes are limited per user

- **Given** a user who marks and reopens folders
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

### FOLDERS-006.13 – A deleted user leaves no done status

- **Given** a user who marked folders done and another user who marked one
- **When** Nextcloud deletes the first user
- **Then** their statuses are gone, those folders are open again, and the other user's status stays

## Out of scope

- The *Folders* screen, its toast, *Undo* and the row menu (a later pull request, ADR 0049).
- *n new* and the *New photos* filter (pure TypeScript, FOLDERS-002).

## History

| Date | Change |
|---|---|
| 2026-11-22 | A deleted user's statuses are removed (FOLDERS-006.13). |
| 2026-11-22 | Created with the done endpoints (M12 PR 3, ADR 0049). |
