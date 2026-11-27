# 0062 – Photos added from the folder summaries' shot days

- Status: accepted
- Date: 2026-11-27
- Amends: [0049](0049-folders-to-cull-done-status-and-library-progress.md)

## Context

The statistics page should show how many photos came into the library over time, against how many
were decided and deleted (owner, redesign slice R5b, 2026-11-26). honeycomb keeps no time at which
it first saw a picture. What it has is each picture's capture time (Nextcloud's file metadata) and
its files' modification time, read by every folder scan (FOLDERS-005).

The options were (owner, 2026-11-27):

- **A, shot days in the folder summary**, chosen. The scan stores per folder how many pictures were
  shot on each day; the statistics page sums them. It reaches back before the counting and costs
  the page nothing extra, since it reads the folder rows for *Library progress* anyway.
- **B, the same, read live** by `/api/v1/stats` from the file cache and the metadata on every call:
  no schema change, but a large library is read in full on each visit.
- **C, a new counter** at scan time, the day honeycomb first sees a picture: it keeps the pictures
  deleted later, but counts only from its introduction, and the first scan of a library would count
  it all on one day.

## Decision

- **Column.** `honeycomb_folder_summary.shot_days`, text, null: the days as `YYYY-MM-DD:n` joined
  with commas, in day order. Null means the summary was written without it.
- **Shot day.** A picture's shot time is its earliest member's capture time, else its earliest
  member's modification time. The day is the scanning user's, in their Nextcloud time zone (UTC
  without one), like the counters' days (ADR 0039).
- **API.** Each folder row of `GET /api/v1/library/folders` carries `shotDays`, a list of
  `{day, photos}`. `/api/v1/stats` is unchanged; the page sums the rows in `src/logic/stats-added.ts`.
- **Migration.** `Version000200Date20261127120000` adds the column where it is missing and drops
  the summaries with photos and no shot days, so the next scan writes them (as for the previews,
  FOLDERS-005.19).

## Consequences

- *Photos added* counts only the pictures still in the library roots. A picture deleted since is
  missing, so in a period with deletes the added pictures read lower than shot; the spec and the
  page's wording say "added", never "shot" (STATS-001.81).
- A user who changes their time zone sees the old days until a folder's etag changes.
- A folder outside the library roots, or one not yet scanned, adds nothing.
