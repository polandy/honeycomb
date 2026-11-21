# APP-003 – Background job status

- Status: implemented
- Area: app
- Origin: E22/B30 of the weakness analysis of 2026-11-19, owner decision `/decide` 2026-11-19
- Depends on: IMAGES-001, DECISIONS-001

## Purpose

An admin sees whether honeycomb's background jobs run and what went wrong, without reading the
Nextcloud log or `oc_appconfig`.

## Behaviour

- honeycomb has two background jobs: *sweep* (the daily removal of rows of files deleted for good,
  of series without members and of Immich decisions of connections that left) and *warm-up* (the
  rendering of a written photo's previews, one run per photo).
- Each run stores when it ended and whether it went through. A failed run also stores the class of
  the error, never its text, a path or a file name, and when it happened. A later good run keeps
  that error, so the admin sees the last error even after the job recovered.
- The *sweep* fails when any of its steps hit a database error; the other steps still run.
- `occ honeycomb:jobs` prints one line per job: its name, its status (`never run`, `ok` or
  `failed`), the time of the last run in UTC with its age, and the last error with its time, or
  `none`. It changes nothing.

## Acceptance criteria

### APP-003.1 – A job that never ran says so

- **Given** a job that has not run
- **When** `occ honeycomb:jobs` runs
- **Then** its line says `never run`, shows no time and `none` as the last error

### APP-003.2 – A good run shows its time

- **Given** a job whose last run went through two hours ago
- **When** `occ honeycomb:jobs` runs
- **Then** its line says `ok`, the time of the run in UTC and `2 hours ago`, and `none` as the
  last error

### APP-003.3 – A failed run shows the error

- **Given** a job whose last run failed with a database error
- **When** `occ honeycomb:jobs` runs
- **Then** its line says `failed`, the time of the run and the error's class and time, and neither
  the error's text nor a path

### APP-003.4 – A later good run keeps the last error

- **Given** a job that failed and then ran through
- **When** `occ honeycomb:jobs` runs
- **Then** its line says `ok` and still names the last error and its time

### APP-003.5 – The sweep records its run

- **Given** the daily sweep
- **When** it runs without and with a database error in one of its steps
- **Then** the first run is stored as good, the second as failed with the error's class, and the
  other steps of the second run still ran

### APP-003.6 – The warm-up records its run

- **Given** a warm-up job
- **When** it renders a photo, and when it fails to
- **Then** the first run is stored as good, the second as failed, and the failure is rethrown

## Out of scope

- Forcing or resetting a job's cursor (`occ honeycomb:jobs:reset`).
- A statistics job: none exists; it joins the list when it does.

## History

| Date | Change |
|---|---|
| 2026-11-20 | Accepted (E22/B30) |
