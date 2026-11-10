# 0014 – Settings endpoint: one JSON object per user, checked in TypeScript

- Status: accepted
- Date: 2026-11-10

## Context

The per-user settings of M4.4 ([`plan.md`](../plan.md#m4--deleting-and-settings) item 4,
requirements §1.6) — RAW and rendered extensions, folder mode, show singles, the swipe mapping,
auto-advance, show flag buttons and vi keys — follow the user to every device, so they live on the
server, not in browser storage. Every rule about them (defaults, valid extensions, an extension in
both lists) is client logic (ADR 0006). Later milestones add more settings (the name template of
M7.4, the storage mode of M5).

## Decision

- **Storage.** One JSON string per user in `OCP\Config\IUserConfig`, app `honeycomb`, key
  `settings`. No new table: the object is small, read once per visit and written whole.
- **Read:** `GET /apps/honeycomb/api/v1/settings` answers `{"settings": {...}}` with the stored
  object, `{}` when none is stored or the stored string is not a JSON object.
- **Write:** `PUT /apps/honeycomb/api/v1/settings` with `{"settings": {...}}` stores the whole
  object and answers it back. Whole objects, not changes: the client holds every value.
- **Thin backend.** The server checks only that `settings` is a JSON object (not a list or a
  scalar) and at most 8 KB encoded; it stores the fields as they come. Defaults and the check of
  each field are in `src/logic/settings.ts`, which falls back to the default per field, so an
  unknown, missing or invalid field never breaks the app.
- **Errors:** `400` for a body that is not an object or is too large; `401` without a user. The
  body is empty.

## Consequences

- A new setting needs no server change; an old client ignores fields it does not know.
- Two devices writing at once: the last write wins, for the whole object.
- Values stored in browser storage before M4.4 (`honeycomb.flagButtonsShown`, `honeycomb.viKeys`)
  are dropped without migration; there was no release yet.
