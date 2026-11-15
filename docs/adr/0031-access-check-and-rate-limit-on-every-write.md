# 0031 – Access check and rate limit on every write

- Status: accepted
- Date: 2026-11-15
- Extends: [0012](0012-decision-storage.md), [0022](0022-tag-storage.md), [0026](0026-rate-limit-of-the-visual-hash-saves.md)

## Context

The risk review for the public release (R10) found two gaps. Decision and tag saves stored a row
for any positive file id, without asking whether the user reaches that file: no data leaks,
since the rows belong to the user, but one request could add 60,000 rows of made-up ids. And only
the visual hash save (ADR 0026) was rate limited, so a script could send any write as often as the
server answers.

The options for a file id the user does not reach as a photo:

- **Refuse the whole save with `400` or `404`:** one file deleted or unshared in another tab would
  fail the save of every other file in it, and the cull would put the decisions back.
- **Skip it, as the series and visual hash saves do:** the reachable files are stored, the rest is
  left as it was. The answer stays `204`, so the API keeps its shape.

The options for the limit:

- **A limit per route sized from its own traffic:** nine numbers to keep up to date.
- **One shared limit of 600 requests a minute per user and route:** the decision, tag, position
  and view state saves send one save at a time and merge what changes meanwhile, so they send at
  most one save per round trip and per change; ten changes a second for a whole minute is beyond
  a person culling. A move or delete sends at most 50 pictures a request, one after another
  (ADR 0029): 600 requests are 30,000 pictures a minute.

## Decision

- **Access:** a decision or tag save looks up each file id once through `UserPhotos::photos()`,
  the check the series and visual hash saves use, and writes only those the user reaches as a
  photo, RAW files included. A row of a skipped file id is neither written nor removed. A save
  without such a file id writes nothing. Malformed bodies are still refused with `400` before any
  lookup.
- **Limit:** every route that writes carries
  `#[UserRateLimit(limit: WriteRateLimit::LIMIT, period: WriteRateLimit::PERIOD_SECONDS)]`,
  600 a minute: the decision, tag, series, position, view state, settings and sidecar saves, the
  move and the trash. The visual hash save keeps its 300 a minute (ADR 0026). Nextcloud answers a
  request beyond the limit `429` without running it.
- **Not limited:** the routes that only read, the lookups, the probe of move targets, and the
  preview warming, which renders previews Nextcloud caches and runs several requests at once; its
  load is bounded by its 100 file ids a request.
- **Client:** a limited save is a failed save as before: logged, and put back as DECISIONS-001.15
  describes. No honest client sends enough to reach it, so the client does not wait and retry.
- A test reads the attributes of every routed method that is not `GET`, so a new write route
  without the limit fails it.

## Consequences

- A user cannot make the server store rows for files they do not reach, nor run any write more
  than 600 times a minute.
- A decision or tag save costs one file lookup per file id; the cull sends a few at a time, the
  take-over from sidecars at most one folder set.
- A write route added later needs the limit, or must be named as reading in the test.
