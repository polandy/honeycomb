# 0042 – Declarative Immich connections from a read-only file

- Status: accepted
- Date: 2026-11-19
- Extends: [0041](0041-immich-as-an-external-picture-source.md),
  [0031](0031-access-check-and-rate-limit-on-every-write.md)

## Context

ADR 0041 lets honeycomb cull Immich's upload library through the Immich API and leaves the
*connections file* to this ADR: its format, how honeycomb reads it, what the API key may do and
what happens when the file or a key is wrong.

An Immich API key is a bearer secret: whoever holds it reads, rates, archives and trashes every
asset of the account, bounded only by the key's scopes. honeycomb runs in a Nextcloud container on
the owner's server, which is configured declaratively (nixos-server) with secrets from sops. The
Immich stack of the same server is reached over an internal Docker network, not over the internet.
A honeycomb user culls several Immich accounts (their own and a family member's), so a user has
several connections, each with its own key.

The report of 2026-11-19 proposed a different model: one Immich URL in the admin config and one
key per Nextcloud user, entered in a dialog and stored encrypted with `ICrypto` in the user
config. The owner weighed it against a declarative file the same day:

- **A, key per user in the UI, encrypted in the database.** No admin step for a new account. But
  one connection per user only, a key-entry form (the UI word of a secret, pasted on an iPad), an
  encrypted secret in the database and its backups, and a URL the user cannot see the reason for.
- **B, connections declared by the admin in a file the server configuration renders.** Several
  connections per user, keys in sops like every other secret of the server, no secret in the
  database or in a backup, nothing to enter on the iPad. The price: a new account is a deployment,
  and honeycomb needs one local read outside `OCP\Files`, which ADR 0041 grants.

The owner chose B on 2026-11-19 and decided: several accounts per user, declarative, no keys in
the database, no connection management in the UI, *Picks as favourites* opt-in per connection.
Those answers are binding here; this ADR adds the shape and the rules.

## Decision

### The connections file

1. **One JSON file** describes every connection of the Nextcloud instance. The server
   configuration renders it (on the owner's server from sops secrets) and mounts it, together
   with the key files it names, **read-only** into the Nextcloud app and cron containers,
   readable by the web server user only. honeycomb never writes it.
2. **The shape**, `version` 1:

   ```json
   {
     "version": 1,
     "connections": [
       {
         "id": "andy-own",
         "user": "andy",
         "label": "My phone",
         "url": "http://immich-server:2283",
         "keyFile": "/run/secrets/honeycomb/andy-own.key",
         "picksAsFavorites": false
       }
     ]
   }
   ```

   | Field | Rule |
   |---|---|
   | `version` | the integer `1`; any other value is an error, so a later shape can be told apart |
   | `id` | the connection's stable id: 1–64 characters of `a-z`, `0-9` and `-`, unique in the file; the decision table keys rows by it (ADR 0041), so it never changes for the same account |
   | `user` | the Nextcloud user id the connection belongs to; compared exactly, never resolved |
   | `label` | the name the user sees, non-empty; it may change freely |
   | `url` | the Immich origin: scheme `http` or `https`, host, optional port; no path, query or fragment (Immich serves at the root), a trailing slash is stripped |
   | `keyFile` | the absolute path of a file whose content is the API key; surrounding whitespace is trimmed, an empty file is an error |
   | `picksAsFavorites` | optional, default `false`: a *Picked* asset becomes an Immich favourite in *Write to Immich* (ADR 0041) |

   An unknown field, a missing required field, a wrong type, a duplicate `id` or a `url` with a
   path is an error. **The file is valid as a whole or not at all**: one bad entry invalidates the
   file, because the renderer writes it from structured configuration, and a half-loaded file
   would hide the mistake from the admin behind one user's missing connection.
3. **The path is app config:** `occ config:app:set honeycomb connections_file --value <path>`.
   Nothing else about Immich is app config. Without the key, the Immich source is *not
   configured* and nothing of it shows.

### How honeycomb reads it

1. **At runtime, on every request that needs it**, through an injected local-file seam (a small
   interface over `file_get_contents`, faked in tests with fixtures); never cached across
   requests, so a deployment takes effect at once and no process holds a key in memory longer
   than one request. The file is small (tens of entries at most).
2. **A key is read only when calling Immich**, from its file, for the one call, and dropped. It
   is never stored in the database, never written to a log line, never part of an API response
   or an exception message, and never sent to the browser. The client puts it in the `x-api-key`
   header and nowhere else.
3. **A user sees only their own connections**, by `label` and `id`, with the URL and the
   connection's status. The key file path is not shown; an error names the connection, not the
   path. The server rechecks on every request that the named connection belongs to the signed-in
   user (ADR 0031's access check, for connections).
4. **The file is the trust boundary.** The admin wrote the URL, so no URL allowlist and no
   private-address check is needed: the server calls what the file says, and a request for a
   connection not in the file is a `404`. Immich's own rate limit is not touched; honeycomb's
   write rate limit (ADR 0031) applies to the write-back endpoints like to every other write.
5. **Errors are typed and reported where they can be fixed:**

   | State | Who sees what |
   |---|---|
   | no app config key | the Immich source is not configured; nothing is logged |
   | file missing, unreadable or invalid | one error log line with the file's path and the first violation; every user sees the Immich source as unavailable because of the server configuration, without the path or the message |
   | key file missing, unreadable or empty | an error log line with the connection id and the key file path; the user sees the connection as unusable because of its key; other connections work |
   | Immich does not answer or refuses the key | the connection shows as unreachable or refused, decisions already made stay in honeycomb; other connections work |
   | the key lacks a scope | detected from Immich's `403` on the call that needed it, never probed ahead; the connection shows what it cannot do (Phase 2: *Your API key lacks `asset.delete`*) |

   The user texts and their place in the UI are the mockup's (ADR 0003); this table fixes the
   states, not the words.

### No connection management in the UI

No connection is created, changed, tested with a pasted key, or removed in honeycomb. The UI
shows the connections the file gives the signed-in user, read-only, with the note that the admin
defines them. Adding, renaming or revoking an account is a change of the server configuration
and a deployment. A connection taken out of the file disappears from the UI at once.

### A connection that left the file

The decision table ([ADR 0043](0043-immich-decisions-per-connection-and-asset.md)) keeps a row
per `(connection id, asset id)`. Rows of a connection that is no longer in the file are **kept
until the daily sweep** of `RemoveVanishedDecisions` removes them, the same way the rows of files
deleted for good go (ADR 0040). The sweep reads the connections file itself and **sweeps nothing
when the file is missing or invalid**, so a broken deployment loses no decision. A connection
re-added with the same `id` before the sweep keeps its rows; a new `id` starts empty. An admin who
wants to pause a connection without losing its decisions keeps the entry and revokes the key in
Immich.

### Scopes per phase

The admin creates each key in the Immich account with the least scopes the phase needs, never
`all`. honeycomb does not read the key's scopes from Immich; the connections file does not list
them. A lacking scope shows up as a `403` on the call that needed it (above).

| Phase | Scope | Used for |
|---|---|---|
| 1, read only | `asset.read` | listing with filters and cursor paging (`POST /search/metadata`), reloading assets |
| 1, read only | `asset.view` | previews through the PHP proxy (`GET /assets/{id}/thumbnail`) |
| 1, read only | `asset.statistics` | the number of uploads in the status and the counts of ADR 0044 (`POST /search/statistics`); without it the status shows no number |
| 1, optional | `user.read` | the account's name in the connection's status (`GET /users/me`); without it the status shows the label only |
| 2, *Write to Immich* | `asset.update` | rating, favourite, archive (`PUT /assets`) |
| 2, optional | `asset.delete` | the Immich trash bin (`DELETE /assets`, `force:false`) and restoring from it; without it a reject can be archived or rated −1, not trashed |

The status check of a connection asks for nothing a Phase 1 key cannot answer: one page of the
listing and the server version. If the pinned schema puts the version endpoint behind a scope the
key lacks, the version shows as unknown and the connection still works. Scopes a later feature
needs (tags, stacks, the sync stream) are added to this table by the ADR that adds the feature.

### Implementation order

The connections work follows section 4 of the architecture review of 2026-11-19 and the pull
requests of ADR 0041:

| ADR 0041 PR | What this ADR adds to it |
|---|---|
| 3 `docs(specs)` | the connections spec: format, validation, read-only display, the error states above |
| 4 `docs(mockup)` | the connection switcher and the read-only connection dialog with status |
| 6 `feat(immich)` | the connection registry first (reads, validates, filters by user; typed errors; the local-file seam injected), then the client (the key per call, `x-api-key`, typed upstream errors), then the status; new files and one-line registrations only |
| 7 `feat(immich)` | the sweep of rows whose connection left the file, guarded by a valid file |
| 11 `test(e2e)` | a fixture file with two connections and their key files beside the stub Immich |
| 12 owner | nixos-server renders the file from sops, mounts it with the key files read-only into the app and cron containers, sets the app config path, joins the containers to the Immich network |
| 14 `docs(user)` | the file format and the scopes per phase for the admin, with the sops example |

## Consequences

- Keys live where the server's other secrets live and nowhere in honeycomb: not in the database,
  not in a backup, not in a log, not in the browser. A leak of the database leaks no Immich key.
- A new or changed connection is a deployment, not a click. The owner accepted this; the family's
  accounts change rarely.
- Several accounts per user come for free from the file; the UI needs a connection switcher
  rather than a key form.
- One local read outside `OCP\Files`, read-only, through an injected seam, as ADR 0041 allows.
  Tests use fixture files; no test touches a real key.
- A whole-file validation means one typo takes every connection offline until the admin fixes it,
  loudly and at once, instead of silently dropping one user's account.
- Rows of a removed connection go within a day of a valid file without it. The accepted way to
  pause an account is to keep its entry and revoke the key in Immich.
- Scopes are the admin's discipline, not honeycomb's check: honeycomb learns of a missing scope
  only when a call fails, and reports it per connection. No probing call needs a scope the cull
  does not.
- A `version` field costs one line and lets a later shape (say, per-connection options) be told
  apart from a stale render.
