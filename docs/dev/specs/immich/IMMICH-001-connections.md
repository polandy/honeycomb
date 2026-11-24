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
- **Not configured:** the connections route answers an empty list, so a page without Immich asks
  nothing that fails; the other Immich routes answer `404` `not-configured`.
- **Errors** carry a code, never a path, a key or Immich's text: `not-configured` (`404`),
  `connections-file` (`503`), `key`, `unreachable`, `refused`, `version` (`502`) and `scope`
  (`403`, naming the scope). A broken file is one log line with the first violation;
  a broken key file one log line with the connection id. A log line never holds a path.
- **Source switcher:** *Nextcloud* and *Immich* at the top of the navigation, the app's header,
  since Nextcloud's own header sits above it; *Immich* shows only while the user has a connection
  or the file is broken. Without the app config the Nextcloud source works as before; a broken
  file shows the Immich source as unavailable because of the server configuration. The Nextcloud
  source keeps its cull while the Immich source is open, and the page opens on Nextcloud. While
  *Immich* shows, the folder picker can be closed before a first cull, so Immich needs no folder.
- **Only Immich:** without an open cull the folder picker's footer offers *I only use Immich*
  while the user has a connection (owner decision 2026-11-22). It works while the connection
  that would open (IMMICH-001.14) answers `ok`; while that status is asked, or the file is
  broken, or the state is not `ok`, it is disabled and the dialog says why. Choosing it stores
  `immichOnly` in the user's settings (ADR 0014) and opens the Immich source. A later start
  without a folder set opens the Immich source without the picker once that connection answers
  `ok`; otherwise the page opens on Nextcloud with the picker as before and the choice stays
  stored. Opening a folder set from the picker clears the choice.
- **Immich navigation:** the Immich source replaces *Folder* and *Recent* in the navigation with
  its connections and *Connection details*; the pages of their own stay.
- **Connection switcher:** with several connections the navigation lists them by label, each with
  its status line; the one opened last is opened again, remembered in the browser. With one
  connection there is no switcher. Opening the Immich source asks the status of every connection.
- **A connection that does not work** shows its state in the content with one line on what to do
  (written for the user and their admin) and *Try again*, which asks the status again; a failed
  status request counts as *Immich unreachable*. *Try again* is the primary action only for
  *Immich unreachable*, the one state that can pass by itself; in every other state *Connection
  details* is primary. A link *Help for your admin* opens the admin page
  `docs/user/admin/immich.md` at the state's section; the connection dialog and the *unavailable*
  state link to the page too.
- **Connection dialog** (*Immich connection*): read only, the label, the Immich server URL, the
  status, the account and Immich's version, the scopes Phase 1 needs (`asset.read`,
  `asset.view`, `asset.statistics`, optional `user.read`) and the note that the admin defines
  connections. No field can be edited, no key is shown, masked or entered; *Test connection*
  asks the status again; *Done* closes it.
- **Status per connection:** *Connected as <account>* (or the label without `user.read`), the
  version and the number of phone uploads (none without
  `asset.statistics`); *Immich unreachable*, *The API key is refused*, *The
  API key cannot be read*, *This Immich version is not supported*. Decisions already made stay in
  honeycomb in every state, and the other connections work.

## Acceptance criteria

### IMMICH-001.1 – Not configured

- **Given** no `connections_file` app config
- **When** the user opens honeycomb
- **Then** the source switcher shows no *Immich*, the connections route answers an empty list,
  and nothing is logged

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
- **And** a redirect is not followed, so the key never reaches another host

### IMMICH-001.7 – A bad key file

- **Given** a connection whose key file is missing, unreadable or empty, and a second good one
- **When** the user asks the status of both
- **Then** the first is `key` with a log line naming its id (no path), the second is `ok`

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

### IMMICH-001.16 – An answer that does not fit

- **Given** an Immich that answers a call with another `4xx` than `401` or `403`, or with a body
  the pinned schema does not describe
- **When** the user asks the status or lists the assets
- **Then** the status is `version` and the listing answers `502` `version`; an Immich that
  answers `5xx` is `unreachable`

### IMMICH-001.17 – Status without `asset.statistics`

- **Given** a key without `asset.statistics`
- **When** the user asks the status
- **Then** `state` is `ok` and `total` is `null`

### IMMICH-001.18 – Immich unavailable

- **Given** a connections file that is broken
- **When** the user opens the Immich source
- **Then** it says Immich is unavailable because of the server configuration and that the
  Nextcloud folders work as before, and asks no status

### IMMICH-001.19 – A connection that does not work

- **Given** a connection whose status is not `ok`, or whose status request fails
- **When** the user opens it
- **Then** the content names the state, says the decisions stay in honeycomb, and *Try again*
  asks the status again

### IMMICH-001.20 – Immich without a folder

- **Given** a user with a connection and no folder culled yet
- **When** the user opens honeycomb
- **Then** the folder picker can be closed, and the source switcher opens Immich

### IMMICH-001.21 – *I only use Immich* only with a working connection

- **Given** a user without a connection, with a broken file, or whose connection to open is
  asked, `unreachable`, `refused`, `key` or `version`
- **When** the folder picker opens from the navigation without a cull
- **Then** without a connection the footer has no *I only use Immich*; otherwise it is disabled
  and the dialog names the reason; with that connection `ok` it can be chosen

### IMMICH-001.22 – Choosing *I only use Immich*

- **Given** the folder picker without a cull and a connection that answers `ok`
- **When** the user chooses *I only use Immich*
- **Then** the picker closes, the Immich source opens, and the settings are saved with
  `immichOnly`

### IMMICH-001.23 – A start straight into Immich

- **Given** `immichOnly` stored and no folder set to open
- **When** the user opens honeycomb and the connection to open answers `ok`
- **Then** the Immich source opens, and neither the start screen (FOLDERS-007.1) nor the folder
  picker is shown

### IMMICH-001.24 – Back to folders when Immich does not work

- **Given** `immichOnly` stored and a broken file, no connection, or a connection to open that is
  not `ok`
- **When** the user opens honeycomb
- **Then** the page opens on Nextcloud's start screen (FOLDERS-007.1), the folder picker opened
  from the navigation names the reason, and `immichOnly` stays stored

### IMMICH-001.25 – A folder set clears the choice

- **Given** `immichOnly` stored
- **When** the user opens a folder set from the folder picker or its *Recent*
- **Then** the cull opens and the settings are saved without `immichOnly`

### IMMICH-001.26 – What to do per state

- **Given** a connection whose state is `unreachable`, `refused`, `key` or `version`, or a broken
  connections file
- **When** the user opens it
- **Then** the content says what to do in one line for that state, and *Help for your admin*
  links to the section of `docs/user/admin/immich.md` that explains it
- **And** *Try again* is the primary button only for `unreachable`

### IMMICH-001.27 – Help from the dialog

- **Given** the connection dialog
- **When** it opens
- **Then** it links to `docs/user/admin/immich.md`, which names the connections file's format and
  path, and the scopes the key needs
