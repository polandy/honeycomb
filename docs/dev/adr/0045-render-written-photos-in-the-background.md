# 0045 – Render written photos in the background

- Status: accepted
- Date: 2026-11-20
- Amends: [0010](0010-image-endpoint-and-background-previews.md)
- Reverses: the decision of 2026-11-10 in [`decisions.md`](../decisions.md) that nothing is
  rendered on upload

## Context

The budget for the first sharp image of a newly opened folder is 500 ms (`plan.md`, Image
delivery). Measured on 2026-11-20 with 24 MP JPEGs in the e2e container it took about 2.7 s
(#271). The cause is the server, not the browser or the network:

- Core's preview generator renders the max preview first (4096 px), however small the tier
  asked for, and scales the tiers from it. For a 24 MP JPEG that is about 1.1 s; most of it is
  the precise resample of the original (about 0.65 s), the decode is about 0.24 s.
- The grid's queue loads the small tier of every visible tile before any sharp one, six at a
  time (GRID-001.15), and the folder's warm-up asks for the same files at the same time. The
  first sharp tier waits for about two rounds of cold renders.
- Where the previews exist, the same folder shows its first sharp image in about 60–120 ms.

The options were:

- **A, a faster JPEG preview provider of honeycomb's own.** A scale on decode and a cheaper
  resample bring a cold tier to about 0.3–0.5 s, still near or over the budget with six renders
  in parallel; it changes the previews of every app on the instance and trades quality.
- **B, honeycomb scales the grid tiers itself**, as ADR 0010 foresaw, with its own cache and its
  clean-up. Large, and still about 0.4–0.7 s cold.
- **C, render the tiers when a photo is written**, chosen. A background job renders the three
  tiers through core's generator, so a folder opened after the jobs ran serves rendered
  previews. No new cache, no new provider, and the budget becomes a gate in e2e.

## Decision

- A listener on `NodeWrittenEvent` queues `RenderPhotoTiers`, a `QueuedJob`, for a file that is
  a photo (`ListingService::isPhoto`) below `/<user id>/files/` of a user who has opened
  honeycomb. The argument is `{"userId", "fileId"}`; a job with that argument already waiting is
  not queued again.
- The job renders the tiers 256, 1024 and 4096 px through `ImageService::warm`, the warm-up's
  code. A job whose user or file is gone renders nothing; a malformed argument is logged.
- Opening the app page records the user preference `honeycomb/opened`. Only those users get
  jobs, which answers the CPU and storage concern of 2026-11-10: people who never cull pay
  nothing.
- The warm-up when a folder is opened stays, for photos written before the first visit and for
  instances whose background jobs run late.

## Consequences

- A folder opened before its jobs ran is still cold: its first sharp image takes about 2.5 s.
  How soon the jobs run depends on the instance's background job mode; with cron every five
  minutes, a card read in by sync is rendered before most people open it.
- Each written photo costs one render of its three tiers, about 1.2 s of server time for a
  24 MP JPEG, and the previews' storage, also for photos never culled.
- A job and the warm-up can render the same file at the same time; core's preview table
  resolves the race, the second render is wasted work.
- `tests/e2e/image-budgets.spec.ts` gates the budget for a folder whose jobs ran by what keeps
  it: opening the folder renders no preview (IMAGES-001.12). Its first sharp image measured
  117–351 ms locally and 290–551 ms on CI runners, so the time is reported, not asserted; a
  time on a shared host is no gate.
- The Preview Generator app is no longer needed for the grid; it still covers photos written
  before the first visit.
- Changing the mind costs the listener, the job and the preference; no data needs migrating.
