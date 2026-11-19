# 0039 – Statistics as daily counters

- Status: accepted
- Date: 2026-11-19
- Extends: [0006](0006-thin-php-backend-logic-in-typescript.md),
  [0032](0032-sidecar-is-the-source-of-truth.md)

## Context

The owner wants honeycomb to show what it did for the user: pictures decided, pictures moved to
the trash bin, space freed, sidecars created and updated, series done (concept of 2026-11-18,
signed off with its mockups and every recommendation). Today honeycomb keeps states, not history:
no stored row has the time of a decision, there are no events and the logs only report errors.
So every number of the form "how many, when, by honeycomb" needs a new record and counts from
the day it starts.

Three ways to record:

- **Event log:** one row per action with file id, field and time. Any later analysis is
  possible, but it grows with every decision and stores who looked at and discarded which photo.
- **Daily counters:** one row per user, day and metric with a sum. Enough for totals, periods,
  streaks and a year in review; it cannot tell which pictures, by design.
- **Derivation only:** compute from the resume positions, the XMP cache and the stored series.
  No new storage, but only states: it does not know who set a rating, deleted pictures or time.

## Decision

- **Daily counters.** A new table `honeycomb_stats`: `user_id`, `day` (`YYYY-MM-DD`), `metric`
  (a short string from a fixed list), `value` (64-bit integer), unique per user, day and metric.
  No file ids, no paths, no names. Folder set progress and the state of the pictures read so far
  are derived from the resume positions and the XMP cache, not counted.
- **The server counts in the request that acts**, only successful results, one sum per metric
  and request: trash, deletes for good, Remove RAWs, sidecar saves, series done, moves. Bytes are
  the server's file sizes, never the browser's.
- **What only the browser knows** (which decision changed, active time, a sidecar from digiKam or
  darktable) travels as a small count list in the request that already runs (the sidecar save,
  the position save). The logic stays in TypeScript; PHP checks bounds only (a count no larger
  than the sidecars in the request, active time no longer than the time since the folder set's
  previous position save) and adds.
- **A sidecar counts as updated at most once a day** without remembering file ids: the server
  counts an existing sidecar only when its modification time before the save lies before the
  start of the user's day.
- **The day** is the calendar day in the user's Nextcloud time zone, UTC without one; the clock
  comes from `ITimeFactory`.
- **Counting never breaks an action.** A failed counter write is logged as a warning through the
  injected logger; the action's answer is unchanged.
- **Never in a sidecar.** Statistics add nothing to any XMP: no field, no `honeycomb:` property,
  no time stamp, no history entry. A sidecar save is byte for byte what it is without statistics,
  so digiKam and darktable see no difference (ADR 0032 keeps sidecars for decisions only).
- **On by default**, per user: the settings field `keepStatistics` (missing means on); the server
  reads it before it counts. *Reset statistics* deletes the user's rows. *Clear cache* leaves them:
  statistics are app state, not a cache. Deleting a user deletes their rows.
- **API:** `GET /apps/honeycomb/api/v1/stats?from=&to=` answers the user's rows of those days and
  the first counted day; `DELETE /apps/honeycomb/api/v1/stats` resets. Both only for the user
  themselves; no admin view, nothing leaves the server.
- **One start value from the past:** before M8 PR 5 (ADR 0040) drops `honeycomb_decisions`, its
  migration writes the number of decided pictures in it as the metric `pictures_decided_before`,
  dated the day of the migration, shown as "Before that: n pictures decided (no date)".

## Consequences

- About 20 rows per user and active day, about 7,000 a year; a page reads at most 366 days over
  the index (`user_id`, `day`).
- Each counting request adds a handful of upserts (`UPDATE … SET value = value + n`, else
  `INSERT`, retried on a unique conflict), also for a 500-picture trash chunk.
- No number can ever say which pictures it counted; a later wish for that needs a new decision.
- A sidecar another program changed earlier the same day does not count as updated; the number
  is a lower bound, never inflated.
- Moving to an event log later is a new table beside this one; the counters stay valid.
