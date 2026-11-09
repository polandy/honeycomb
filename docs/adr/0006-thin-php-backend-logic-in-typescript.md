# 0006 – A thin PHP backend, the logic in pure TypeScript modules

- Status: accepted
- Date: 2026-11-09

## Context

The brief asks for a PHP backend with the Nextcloud App Framework and PHPUnit tests for pairing
(`01-requirements.md`). Nextcloud also offers AppAPI external apps (ExApps), which run in their
own container in any language. Most of honeycomb's rules — pairing, filters, undo, gestures —
act on what the user sees and change with every decision, so a round trip per rule would cost
latency on the iPad and split each feature across two languages. The owner decided on
2026-11-09.

## Decision

honeycomb stays a classic PHP Nextcloud app; no AppAPI ExApp. The backend is as thin as
possible and does only what needs the server:

- **List** a folder: one file-cache query by path prefix and mime type, returned as flat entries
  (file id, path, size, mtime, ETag, mime type) with EXIF basics where Nextcloud has them.
- **Move** and **trash** files, **write XMP bytes** the client produced, through `OCP\Files`.
- **Store** per-user decisions, the resume position and settings.
- **Serve** Nextcloud previews.

It validates every path it gets — owned by the user, still exists, the expected version — and
never trusts the client. Everything else lives in pure TypeScript modules without DOM or
network: pairing, series, filters, sort, name templates and move conflicts, the XMP read and
write mapping, undo, gestures, hotkeys and the header scroll logic. Vue components only wire
those modules to the DOM and the API.

Tests are written first: the failing test lands in its own commit before the implementation,
and the PR review checks the order. CI gates Vitest coverage: logic modules 95 % lines and 90 %
branches, Vue components lower. PHPUnit covers each endpoint's failure paths (a foreign path, a
vanished file, a conflict, no permission). Playwright runs end to end against a real Nextcloud
container. Pairing, XMP and name-template test vectors are shared with Framehive as data files.
No test sleeps or waits on time.

## Consequences

- One language per rule, and almost every rule is unit-tested without a server or a browser.
- The client sees a whole folder's entries; listing stays one query, so 2,000+ pairs remain
  fast, and filtering and sorting cost no round trip.
- Because the client computes pairs and moves, each endpoint takes explicit file ids or paths
  and rechecks them; a stale or forged request fails without touching a file.
- The brief's PHPUnit pairing tests become Vitest tests on the same cases. M5 needs a
  TypeScript XML library instead of the PHP one named in ADR 0005.
- Rejected: an ExApp — a second runtime and container to install, for no gain in the rules.
