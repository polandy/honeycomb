# FOLDERS-001 – Folder score and reason line

- Status: accepted
- Area: folders
- Origin: ADR 0049 Ranking (A), `docs/dev/mockup/folders/index.html`
- Depends on: SERIES-001

## Purpose

Ranks the folders worth culling and says why in words; the number itself is never shown.

## Behaviour

The score of a folder is `undecided × (1 + 2 × bursts / photos) × (1 + min(1, bytes per photo / 25 MB))`,
0 when the folder has no photos. Undecided photos count linearly, bursts weigh up to ×3, RAW-heavy
folders up to ×2. The weights are constants, not settings. A burst is a photo taken at most 3 s
after its predecessor, the series rule's gap (SERIES-001).

The reason line joins, with ` · `: the share of undecided photos (`63 % undecided`), the photos in
bursts (`18 in bursts`, left out with none), the bytes (`4.2 GB`, in MB below 1 GB) and the year of
the oldest photo (`2019`, left out without a capture time).

## Acceptance criteria

### FOLDERS-001.1 – The score

- **Given** a folder with 10 undecided of 100 photos, 50 bursts and 25 MB per photo
- **When** its score is computed
- **Then** it is 40 (10 × 2 × 2)

### FOLDERS-001.2 – No photos

- **Given** a folder with no photos
- **When** its score is computed
- **Then** it is 0

### FOLDERS-001.3 – The factors are capped

- **Given** a folder whose photos are all bursts and weigh more than 25 MB each
- **When** its score is computed
- **Then** the burst factor is 3 and the size factor 2, so the score is 6 × undecided; a lighter
  folder without bursts scores its undecided photos × its size factor

### FOLDERS-001.4 – The reason line

- **Given** a folder with 63 of 100 photos undecided, 18 in bursts, 4.2 GB and oldest photo in 2019
- **When** its reason line is built
- **Then** it reads `63 % undecided · 18 in bursts · 4.2 GB · 2019`, without the score

### FOLDERS-001.5 – Parts without a value are left out

- **Given** a folder with no bursts, under 1 GB and no capture time
- **When** its reason line is built
- **Then** it holds only the undecided share and the size in MB; 10 GB and more show no decimal

### FOLDERS-001.6 – The burst gap is the series gap

- **Given** the burst gap and the series gap
- **When** they are compared
- **Then** both are 3 s, the value ADR 0049 names for the folder summary's PHP counter

## Out of scope

The server counting bursts: the folder summary. The rows themselves: FOLDERS-002.

## History

| Date | Change |
|---|---|
| 2026-11-22 | Written with M12 PR 4 |
