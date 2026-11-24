# 0057 – A malformed request names its reason

- Status: accepted
- Date: 2026-11-24
- Amends: [0052](0052-one-error-body-and-one-cursor-convention.md)

## Context

A `400` said only `{"error": "request"}`. The server knew which part was wrong (a list too long, a
file id given twice, a path with `..`), but the browser could not tell, so every failed write read
"Could not move the photos". The services threw 17 empty subclasses of `InvalidRequestException`,
one per kind of request, that nothing told apart: the controller mapped the parent class.

## Decision

- **Reason.** `InvalidRequestException` is final and built with
  `InvalidRequestException::because(Reason, detail)`.
  `Reason` is an enum of twelve kebab-case codes: `not-an-object`, `not-a-list`, `too-many`,
  `bad-file-id`, `bad-etag`, `duplicate`, `conflict`, `bad-value`, `bad-path`, `bad-cursor`,
  `too-large`, `unknown-name`. The detail is free text for the log and never reaches the browser.
- **Body.** A `400` from a malformed request answers `{"error": "request", "reason": "<code>"}`.
  The `error` code is unchanged, so a client that ignores `reason` keeps working.
- **Client.** The browser reads `reason` with `errorReasonOf` and names it only where the user can
  act on it (a move with an invalid target path, a move that replaces a moved file).

## Options considered

- **One exception class per reason**: the 17 classes again, only finer.
- **Put the reason in `error` (`request-too-many`)**: breaks the one code the clients switch on.
- **Send the detail text**: raw server text never reaches the user (conventions).

## Consequences

- 17 classes are gone; a new kind of request adds no class, at most a reason.
- Every reason has a test; a new reason is added to `Reason` and to the spec of the route.
