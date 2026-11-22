# FOLDERS-003 – Library progress and texts

- Status: accepted
- Area: folders
- Origin: ADR 0049 Library progress (P1), `docs/dev/mockup/folders/index.html`
- Depends on: FOLDERS-002

## Purpose

Counts how far the library has come, in total and per root, and words what the *Folders* screen says.

## Behaviour

Only rows below a library root count. The *progress* of a set of rows has: the photos in done
folders as a share of all photos (the headline, rounded to whole percent), the folders done of all
folders, the folders marked done in the current calendar month (UTC, from an injected clock), and
the share of decided photos (picked and rejected) of all photos. With no photos every share is 0.

## Acceptance criteria

### FOLDERS-003.1 – The headline

- **Given** rows of which two are done, with 600 of 1,000 photos
- **When** the progress is built
- **Then** the headline is 60 % and the folders done count the two

### FOLDERS-003.2 – Per root

- **Given** rows below two roots and a row below none
- **When** the progress is built
- **Then** the total covers the rows below the roots, and each root has its own progress, in the
  order of the roots

### FOLDERS-003.3 – Done this month

- **Given** a clock at the end of November and folders marked done in October, at the start of
  November and at the end of November
- **When** the progress is built
- **Then** the two of November count

### FOLDERS-003.4 – Decided share

- **Given** rows with picked and rejected photos
- **When** the progress is built
- **Then** the decided share is their sum of all photos

### FOLDERS-003.5 – An empty library

- **Given** no rows, or rows without photos
- **When** the progress is built
- **Then** every share is 0 % and nothing divides by zero

### FOLDERS-003.6 – The texts

- **Given** the filters, sorts, a progress and rows
- **When** the texts are built
- **Then** they read as the mockup: the chip and sort labels, `63 % of photos in done folders`,
  `3 of 18 folders done`, `2 this month`, `41 % of all photos decided`, `Complete · not marked
  done`, `Done 2026-11-02 · by Andy`, `Read-only`, `Updating 12 folders`, `No folders here.`, and
  `2 roots · 18 folders · 14,120 photos` (singular for one)

## Out of scope

Rendering and the statistics page: the *Folders* screen and STATS-001.

## History

| Date | Change |
|---|---|
| 2026-11-22 | Written with M12 PR 4 |
