# DECISIONS-002 – Resume position

- Status: implemented
- Area: decisions
- Origin: `docs/plan.md` M2.4, Culling workflow item 6, Multiple folders item 8; ADR 0012
- Depends on: DECISIONS-001

## Purpose

The last position per folder set and user is kept on the server, so a cull stopped on one device
continues on another, and *Recent* can list the last folder sets with their progress.

## Behaviour

- `PUT /apps/honeycomb/api/v1/positions` stores `folderSet` (`paths`, `subfolders`), `fileId`,
  `decided` and `total`; the answer repeats it with `updatedAt` (Unix seconds).
  `GET /apps/honeycomb/api/v1/positions` lists the user's positions, newest first.
- A folder set is its sorted paths and the subfolders switch: the same paths in another order are
  the same set, without subfolders another one. The root folder is the path `""`.
- Only the 20 most recent positions per user are kept; each user's positions are their own.
- `400` for a malformed position, `401` without a user.
- The client does not save or offer positions yet, and *Recent* does not exist yet.

## Acceptance criteria

### DECISIONS-002.1 – Save and list

- **Given** a user
- **When** they save a position
- **Then** the answer repeats it with the time of saving, and the list holds it

### DECISIONS-002.2 – One position per folder set

- **Given** a saved position
- **When** the same paths are saved in another order
- **Then** the position is replaced; the same paths without subfolders are another folder set

### DECISIONS-002.3 – The 20 most recent, newest first

- **Given** more than 20 saved folder sets
- **When** the user lists positions
- **Then** the 20 most recent come back, newest first, the latest of the same second first

### DECISIONS-002.4 – Each user apart

- **Given** a position saved by one user
- **When** another user lists positions
- **Then** they see none of it

### DECISIONS-002.5 – A malformed position

- **Given** no paths, a path that is not text or holds `..` or NUL, too many paths, a missing
  switch, a file id below 1 or `decided` outside 0 to `total`
- **When** it is saved
- **Then** the answer is `400` and nothing is stored

### DECISIONS-002.6 – Without a user

- **Given** no logged-in user
- **When** a position is read or saved
- **Then** the answer is `401`

### DECISIONS-002.7 – The client saves and offers the position (gap)

- **Given** a cull on one device
- **When** the user moves through it and later opens the same folder set on another device
- **Then** the position was saved and the app offers to continue there

### DECISIONS-002.8 – Recent (gap)

- **Given** saved positions
- **When** the user opens the navigation
- **Then** *Recent* lists the last folder sets with their progress and opens one at its position

## Out of scope

The progress of the open cull (GRID-002).

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged M2.4 (#42) |
