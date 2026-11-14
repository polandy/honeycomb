# 0026 – Rate limit of the visual hash saves

- Status: accepted
- Date: 2026-11-14
- Extends: [0024](0024-visual-hashes-stored-on-the-server.md), [0025](0025-missing-visual-hashes-by-path-cursor.md)

## Context

`PUT /apps/honeycomb/api/v1/visual-hashes` (ADR 0024) takes up to 1,000 items a request and looks
up every file id, one query each. Nothing bounds how often a user sends it, so one script can
keep the database busy. The similarity page (ADR 0025) is the heaviest honest client: it saves
in batches of 250, one save in flight per run, while up to eight Web Workers hash the previews.
A limit must stay far above what that page sends on a strong computer, or a full run would stall.

What a full run sends at most: each worker loads one preview from the server per picture and
draws and hashes it; with cached previews on a fast network that takes 20 ms or more per picture,
so eight workers hash at most 400 pictures a second, 1.6 batches of 250, about 100 saves a
minute. The cull adds a save per 100 hashes, one picture at a time, a few a minute. Hashing,
not the save, is the bound: the save of 250 lookups is quicker than hashing 250 pictures.

The options:

- **No limit:** a script can send 1,000 lookups as often as the server answers.
- **A low limit, e.g. 60 a minute:** a strong computer would run into it on every run.
- **300 saves a minute per user:** three times the estimated peak of a full run, and at most
  300,000 lookups a minute per user.

## Decision

- **Limit:** `#[UserRateLimit(limit: 300, period: 60)]` on the save. Nextcloud counts per user
  and controller method and answers a save beyond the limit `429` without running it. The
  endpoint needs a login, so no anonymous limit is set. The missing-hashes listing is not limited:
  a run asks for it once per 500 photos.
- **No `Retry-After` from the server:** Nextcloud 35's rate limit middleware answers `429`
  without the header. The browser honours the header's seconds when one is there (a proxy may
  set it); without it, or with the HTTP-date form, which would need the clock, it waits 60 s, the
  period of the limit, after which the counted saves have run out.
- **Similarity page:** a limited save does not pause the run. The run shows how long it waits,
  waits through an injected timer seam, and sends the same batch again, as often as it takes;
  the workers go on hashing meanwhile and no other save is sent. *Pause* takes effect once that
  save is through.
- **Cull:** a limited save is a failed save (SERIES-003.13): logged, the hashes count for the
  visit and are computed again on the next one. It sends far too few saves to reach the limit.

## Consequences

- A user cannot make the server run more than 300 saves a minute.
- A run on an unusually fast setup that reaches the limit loses no hash; it waits up to a minute.
- Raising the batch size or the worker count of the similarity page means checking this limit.
