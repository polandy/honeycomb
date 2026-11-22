# FOLDERS-004 – Library roots

- Status: accepted
- Area: folders
- Origin: ADR 0049 Library roots
- Depends on: SETTINGS-001

## Purpose

Checks the list of library roots in the client, because the settings endpoint stores the blob (ADR 0014).

## Behaviour

A root is a path below the user's home folder, written as every folder path of the app, with a
leading `/`. Input is trimmed, repeated and trailing `/` are dropped and a missing leading `/` is
added. The home folder itself, `.` or `..` segments and backslashes are refused. No root may equal
or lie inside another.

## Acceptance criteria

### FOLDERS-004.1 – Normalising

- **Given** ` Photos//2019/ `
- **When** it is added as a root
- **Then** the root is `/Photos/2019`

### FOLDERS-004.2 – Empty

- **Given** a blank input, or `/`
- **When** it is added
- **Then** it is refused as `empty`, because the home folder is no root

### FOLDERS-004.3 – Invalid

- **Given** `/Photos/../Docs`, `/a/./b` or a path with a backslash
- **When** it is added
- **Then** it is refused as `invalid`

### FOLDERS-004.4 – Duplicate

- **Given** the root `/Photos`
- **When** `/Photos/` is added
- **Then** it is refused as `duplicate` naming `/Photos`

### FOLDERS-004.5 – Nested

- **Given** the root `/Photos`, then the root `/Photos/2019`
- **When** `/Photos/2019` is added to the first, and `/Photos` to the second
- **Then** the first is refused as `inside` naming `/Photos`, the second as `contains` naming
  `/Photos/2019`; `/Photos2` is no part of `/Photos`

### FOLDERS-004.6 – Adding and removing

- **Given** a list of roots
- **When** a valid root is added, or a listed one removed
- **Then** the list gains it at the end, or loses it; removing the last one leaves an empty list

### FOLDERS-004.7 – Validating a whole list

- **Given** a list of roots
- **When** it is validated
- **Then** the first refusal is returned with the path it concerns, or none when the list is
  valid; an empty list is valid (the first run shows the root picker, ADR 0049)

## Out of scope

The server's recheck of `root`: the folder summary spec. The root picker: the *Folders* screen.

## History

| Date | Change |
|---|---|
| 2026-11-22 | Written with M12 PR 4 |
