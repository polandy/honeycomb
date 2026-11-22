# FOLDERS-002 – Filters, sorts and groups of the folder list

- Status: accepted
- Area: folders
- Origin: ADR 0049 Ranking (A), The done status, `docs/dev/mockup/folders/index.html`
- Depends on: FOLDERS-001

## Purpose

Decides which folders the list shows, in which order and under which headings.

## Behaviour

A row is one folder as `GET /api/v1/library/folders` answers. A row is *rateable* when its
permissions include UPDATE, *complete* when it has photos and none is undecided, and has *n new*
photos when it is done and has more photos than at *Mark done*: `n = max(0, photos − done.photos)`.

| Filter | Shows |
|---|---|
| *Suggested* | rateable folders that are not done and have undecided photos or are complete; complete ones first, then by score descending, then by undecided photos, then by path |
| *New photos* | done folders with *n new* above 0, sorted as the chosen sort |
| *All* | every folder |

| Sort | Order |
|---|---|
| *Suggested* | as the filter *Suggested*; done folders score 0 and come last |
| *Most undecided* | undecided photos descending |
| *Largest* | bytes descending |
| *Oldest* | oldest capture time ascending; folders without one last |
| *Newest* | newest capture time descending; folders without one last |
| *Name* | folder path in natural order (2 before 10), case-insensitive |

Every sort breaks ties by path. *Oldest* and *Newest* group the rows under sticky year headings,
the year of the sorted capture time (UTC), and a heading *Unknown year* for folders without one.

The rows are grouped by library root, in the order of the roots, when all roots are shown and there
are several; one root chosen shows its rows ungrouped. A root without a row shows no group.

## Acceptance criteria

### FOLDERS-002.1 – Suggested

- **Given** rows: open with undecided photos, complete not done, done, read-only open, open with
  no undecided photos and no photos
- **When** the filter *Suggested* applies
- **Then** only the first two remain, the complete one first

### FOLDERS-002.2 – Suggested order

- **Given** three suggested folders with different scores and two with equal scores
- **When** they are sorted by *Suggested*
- **Then** the order is complete first, then score descending, then undecided photos descending,
  then path

### FOLDERS-002.3 – New photos

- **Given** a done folder with 140 photos that had 138 at *Mark done*, one with the same count, one
  with fewer, and an open folder
- **When** the filter *New photos* applies
- **Then** only the first remains with *n new* = 2; the others have 0 new

### FOLDERS-002.4 – All

- **Given** any rows
- **When** the filter *All* applies
- **Then** every row remains, read-only and done ones too

### FOLDERS-002.5 – The explicit sorts

- **Given** rows with different undecided photos, bytes, capture times and names
- **When** each sort applies
- **Then** the order is as the table says, with ties broken by path and missing capture times last

### FOLDERS-002.6 – Year headings

- **Given** rows from three years and one without a capture time
- **When** sorted by *Oldest* and by *Newest*
- **Then** the groups follow the sort, each headed by its year, the last headed *Unknown year*; other
  sorts have no year headings

### FOLDERS-002.7 – Root groups

- **Given** rows below two roots and a chosen root of *All roots*, then of one root
- **When** the list is built
- **Then** all roots show one group per root with rows, in the roots' order; one root shows its
  rows alone, and with a single root there are no root groups

### FOLDERS-002.8 – Filter counts

- **Given** the rows of the chosen root
- **When** the filter chips are built
- **Then** each shows how many rows its filter keeps

### FOLDERS-002.9 – The badge

- **Given** a done folder with 12 new photos
- **When** its badge is built
- **Then** it reads `12 new`; a folder without new photos has none

## Out of scope

The score: FOLDERS-001. Marking done and the endpoints: the folder summary and done status
specs. Rendering: the *Folders* screen.

## History

| Date | Change |
|---|---|
| 2026-11-22 | Written with M12 PR 4 |
