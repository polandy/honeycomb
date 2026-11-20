# IMMICH-001 – Connections

- Status: accepted
- Area: immich
- Origin: ADR 0041, ADR 0042, ADR 0044; Phase 1 mockup signed off on 2026-11-20,
  [mockup](../../mockup/immich/index.html)
- Depends on: –

## Purpose

A user culls one or more Immich accounts. The admin declares each as a connection in the
connections file; honeycomb reads it, shows the user their own connections and their status, and
never stores, shows or logs a key.

## Behaviour

- **The file:** app config `connections_file` names a JSON file of `version` 1 with a list of
  connections, each with `id`, `user`, `label`, `url`, `keyFile` and an optional
  `picksAsFavorites` (ADR 0042 has the field rules). The file is valid as a whole or not at all.
  It is read on every request that needs it and never written; a key file is read only for the
  one Immich call that needs it.
- **The routes:** `GET /apps/honeycomb/api/v1/immich/connections` lists the user's connections
  (`id`, `label`, `url`); `GET …/immich/{connectionId}/status` answers `state`, `account`,
  `version` and `total` (ADR 0044). A connection of another user, or one the file does not name,
  is `404` with `unknown-connection`, on every Immich route.
- **Errors** carry a code, never a path, a key or Immich's text: `not-configured` (`404`),
  `connections-file` (`503`), `key`, `unreachable`, `refused`, `version` (`502`) and `scope`
  (`403`, naming the scope). A broken file is one log line with its path and the first violation;
  a broken key file one log line with the connection id and its path.
- **Source switcher:** *Nextcloud* and *Immich* in the app header; *Immich* shows only while the
  user has a connection. Without the app config, or with a broken file, the Nextcloud source works
  as before; a broken file shows the Immich source as unavailable because of the server
  configuration.
- **Connection switcher:** with several connections the navigation lists them by label; the one
  opened last is opened again. With one connection there is no switcher.
- **Connection dialog** (*Immich connection*): read only, the label, the Immich server URL, the
  status, the account and Immich's version, the scopes Phase 1 needs (`asset.read`, `asset.view`,
  optional `user.read`) and the note that the admin defines connections. No field can be edited,
  no key is shown, masked or entered; *Test connection* asks the status again; *Done* closes it.
- **Status per connection:** *Connected as <account>* (or the label without `user.read`), the
  version and the number of phone uploads; *Immich unreachable*, *The API key is refused*, *The
  API key cannot be read*, *This Immich version is not supported*. Decisions already made stay in
  honeycomb in every state, and the other connections work.

## Acceptance criteria

### IMMICH-001.1 – Not configured

- **Given** no `connections_file` app config
- **When** the user opens honeycomb
- **Then** the source switcher shows no *Immich*, the connections route answers `404`
  `not-configured`, and nothing is logged

### IMMICH-001.2 – The user's own connections

- **Given** a valid file with connections of two users
- **When** one of them lists their connections
- **Then** the answer holds their connections only, in file order, with `id`, `label` and `url`,
  and no key, key file path or `picksAsFavorites`

### IMMICH-001.3 – The whole file or nothing

- **Given** a file with one bad entry (unknown field, missing field, wrong type, duplicate `id`,
  an `id` outside `a-z0-9-` or 1–64 characters, a `url` with a path, a `version` other than 1)
- **When** any user lists their connections
- **Then** the answer is `503` `connections-file` for every user, one error line names the file
  and the first violation, and the answer names neither

### IMMICH-001.4 – A missing or unreadable file

- **Given** an app config that names a file that is missing or unreadable
- **When** the user lists their connections
- **Then** the answer is `503` `connections-file`, and the Nextcloud source works as before

### IMMICH-001.5 – Someone else's connection

- **Given** a connection id of another user, or one the file does not name
- **When** the user calls any Immich route with it
- **Then** the answer is `404` `unknown-connection`, before any key is read or Immich is called

### IMMICH-001.6 – The key stays on the server

- **Given** a connection with a valid key file
- **When** honeycomb calls Immich for it
- **Then** the key is sent in the `x-api-key` header only, with surrounding whitespace trimmed,
  and appears in no answer, log line or exception message

### IMMICH-001.7 – A bad key file

- **Given** a connection whose key file is missing, unreadable or empty, and a second good one
- **When** the user asks the status of both
- **Then** the first is `key` with a log line naming its id and key file path, the second is `ok`

### IMMICH-001.8 – Immich unreachable or refusing

- **Given** a connection whose Immich does not answer, or answers `401`
- **When** the user asks its status or lists its assets
- **Then** the status is `unreachable` or `refused`, the listing answers `502` with that code,
  and the user's decisions for it stay

### IMMICH-001.9 – A lacking scope

- **Given** a key without `asset.view`
- **When** the grid asks a preview
- **Then** the answer is `403` `scope` naming `asset.view`, found from Immich's `403` on that call
  and never probed ahead

### IMMICH-001.10 – Status without `user.read`

- **Given** a key without `user.read`
- **When** the user asks the status
- **Then** `state` is `ok`, `account` is `null`, and the status shows the label

### IMMICH-001.11 – The version

- **Given** an Immich whose version is not the one the client targets
- **When** the user asks the status
- **Then** the state is `version` and the dialog says the version is not supported; a version the
  key may not read shows as unknown and the connection works

### IMMICH-001.12 – A deployment takes effect at once

- **Given** a connection taken out of the file, or one added
- **When** the user's next request reads the file
- **Then** the connection is gone from, or in, the switcher; nothing is cached across requests

### IMMICH-001.13 – The read-only dialog

- **Given** the connection dialog
- **When** it opens
- **Then** it shows label, URL, status, account, version, the scopes and the note that the admin
  defines connections; it has no input, no key and no button that changes the connection

### IMMICH-001.14 – Connection switcher

- **Given** a user with two connections
- **When** they switch to the second and reload
- **Then** the second is opened again; a user with one connection sees no switcher

### IMMICH-001.15 – Nextcloud stays usable

- **Given** any Immich error state
- **When** the user switches to *Nextcloud*
- **Then** folders list, cull and delete as before
