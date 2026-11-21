# SERIES-009 – The shake risk hint from EXIF

- Status: implemented
- Area: series
- Origin: owner decisions 2026-11-20 (culling aids, milestone M11); ADR 0046 amendment
  2026-11-21; mockup `docs/dev/mockup/quality/index.html`, scenes *Info panel*, *Hints on tiles*
  and *Hints filter*
- Depends on: LISTING-001, GRID-002, GRID-004, LOUPE-001

## Purpose

A photo shot at an exposure time too long for its focal length is likely to be blurred by the
camera's movement. honeycomb says so from the EXIF facts alone, with no pixel analysis, so it
works for singles as well as for series. It is a hint: it never flags, never picks and never
rejects, and it is never written to a sidecar.

## Behaviour

- **The facts:** each listing entry carries `exposure` (LISTING-001.20); the picture's facts are
  its RAW member's, else its JPEG's.
- **The rule:** a photo is at risk when its exposure time is longer than `1 / f` seconds, `f`
  being the full-frame focal length in millimetres, or the focal length as shot where the camera
  reports no full-frame value. Stabilisation is not known, so the rule errs towards a hint. A
  photo without an exposure time, or without either focal length, has no hint.
- **The info panel** shows the rows *Exposure* (`1/15 s · f/5.6 · ISO 800`, each part left out
  where unknown) and *Focal length* (`200 mm`, with `300 mm full frame` where it differs), and
  for a photo at risk a section *Quality* row *Hints*: the icon and *Shake risk*, with the
  reason `1/15 s at 300 mm full frame; slower than 1/300 s`.
- **The tile** shows a small icon at the bottom right of its photo for a photo at risk, with the
  tooltip and the label *Shake risk*; no colour, no badge.
- **The filter bar** has the group *Hints* with the chip *Shake risk*: a picture passes while the
  chip is pressed only when it is at risk. The group counts as an active filter group.
- Nothing is written: no flag, no sidecar, no request beyond the listing.

## Acceptance criteria

### SERIES-009.1 – The rule

- **Given** an exposure of 1/15 s at 300 mm full frame, 1/500 s at 300 mm full frame, 1/60 s at
  50 mm as shot with no full-frame value, and exposures lacking the time or both focal lengths
- **When** the shake risk is judged
- **Then** the first is at risk with the limit 1/300 s; the second, the exact limit 1/300 s at
  300 mm and the others are not; the one lacking facts has no judgement

### SERIES-009.2 – The RAW member's facts

- **Given** a pair whose RAW and JPEG both have exposure facts, and one whose RAW has none
- **When** the facts of the picture are taken
- **Then** the first gives the RAW's, the second the JPEG's

### SERIES-009.3 – The info panel

- **Given** the loupe's info panel on a photo at risk, and on one without exposure facts
- **When** it shows
- **Then** the first has the rows *Exposure*, *Focal length* and *Hints* with its reason, the
  second none of them

### SERIES-009.4 – The tile's icon

- **Given** the grid with a photo at risk and one that is not
- **When** the tiles show
- **Then** only the first carries the icon, and its label ends with *Shake risk*

### SERIES-009.5 – The filter

- **Given** the filter chip *Shake risk* pressed
- **When** the grid filters
- **Then** only pictures at risk pass, combined with the other groups as GRID-002.5 says; the chip
  counts as one active filter group, and *Clear filters* releases it

## Out of scope

- A setting for the factor `k` or for stabilisation: only if feedback asks.
- Clipping (the other hint of the mockup): its own pull request.

## History

| Date | Change |
|---|---|
| 2026-11-21 | Written (M11 PR 5, ADR 0046 amendment) |
