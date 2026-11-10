# 0019 – View state endpoint: two booleans per user, written key by key

- Status: accepted
- Date: 2026-11-10

## Context

The loupe kept whether its info panel is open and whether the gesture guide was dismissed in
browser storage. The owner's review of 2026-11-10 moved both to the server, so they follow the
user to every device and browser like the settings (ADR 0014). The info panel's width, the
Nextcloud navigation toggle and the tile size depend on the device's screen and stay in browser
storage.

The settings endpoint writes the whole settings object. Storing these two values there would make
a toggle of the info panel a whole-object write that can race a settings change on another tab
or device.

## Decision

- **A separate endpoint**, `view state` in the glossary: the loupe's per-user state that is not a
  setting.
- **Storage.** `OCP\Config\IUserConfig`, app `honeycomb`, one bool value per key: `infoPanelOpen`
  and `gestureGuideSeen`. No new table. A key that was never stored reads as `null`
  (`hasKey`), so the client can tell "never stored" from `false`.
- **Read:** `GET /apps/honeycomb/api/v1/view-state` answers
  `{"viewState": {"infoPanelOpen": true|false|null, "gestureGuideSeen": true|false|null}}`.
- **Write:** `PUT /apps/honeycomb/api/v1/view-state` with a partial object, e.g.
  `{"viewState": {"gestureGuideSeen": true}}`, stores only the keys given and answers the full
  object like the read. Changes, not whole objects: two writes of different keys never undo each
  other.
- **Errors:** `400` with an empty body for a `viewState` that is not an object, has an unknown
  key or a value that is not a boolean, or has no key at all; `401` without a user.
- **Migration.** The client reads the view state once per visit. For a key the server has never
  stored, it takes a `true`/`false` left in browser storage (`honeycomb.infoOpen`,
  `honeycomb.gestureGuideSeen`), writes it once and removes the local key after that write
  succeeded; a local key beside a stored value is removed. The rules live in
  `src/logic/view-state.ts` (ADR 0006).

## Consequences

- A new view state key needs a server change: the server knows the keys and their type, unlike
  the settings blob. That keeps the stored values typed and the endpoint small.
- Two devices writing the same key at once: the last write wins, for that key only.
- The loupe reads the view state from the server once per visit; a failed read falls back to the
  values left in browser storage, without migrating them.
