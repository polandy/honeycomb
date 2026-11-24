# Connecting Immich

For Nextcloud admins. honeycomb can cull the phone uploads of an [Immich](https://immich.app)
account. You declare each account once in a connections file; users cannot add or change one.
Without the file nothing of Immich shows in honeycomb, and the Nextcloud folders work as before.

## The connections file

Create a JSON file of `version` 1 and name it in the app config:

```sh
sudo -u www-data php /var/www/nextcloud/occ config:app:set honeycomb connections_file --value /etc/honeycomb/immich.json
```

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
| `version` | The number `1`. |
| `id` | 1 to 64 characters of `a-z`, `0-9` and `-`, unique in the file. honeycomb stores the user's decisions under it, so never change it for the same account. |
| `user` | The Nextcloud user id the connection belongs to. A user can have several connections. |
| `label` | The name the user sees. It may change at any time. |
| `url` | The Immich server: `http` or `https`, host and an optional port, no path. |
| `keyFile` | The absolute path of a file that holds the API key. Whitespace around the key is ignored; an empty file is an error. |
| `picksAsFavorites` | Optional, `false` by default. |

- The **path** can be anywhere the web server user can read; it is set with the `occ` command above
  and read again on every request, so a change takes effect at once, without a restart.
- Put the file and the key files where only the web server user can read them, and make them
  readable for the Nextcloud cron container too if you run one. honeycomb never writes them and
  never shows, logs or sends a key to the browser.
- The file is valid **as a whole or not at all**: an unknown field, a missing field, a wrong type, a
  duplicate `id` or a `url` with a path makes honeycomb treat every connection as unavailable. The
  Nextcloud log names the first mistake, without a path.

## API key scopes

Create one API key per account in Immich (*Account settings*, *API keys*). It needs these scopes:

| Scope | Needed for |
|---|---|
| `asset.read` | Listing and searching the phone uploads. |
| `asset.view` | Thumbnails and previews. |
| `asset.statistics` | The number of uploads and the filter counts. Without it these show as unknown. |
| `user.read` | Optional. Shows the account's name; without it honeycomb shows the label. |

A key without one of the first three works, but the grid reports the scope it lacks when it first
needs it. Keys are read only; honeycomb does not change anything in Immich yet.

## What each message means

A user sees these in honeycomb's Immich source and in the *Immich connection* dialog. Decisions
already made stay in honeycomb in every state, and the user's other connections keep working.

### Immich unreachable

honeycomb got no answer from the `url`, or an error from Immich's server. It is the one state that
can pass by itself, so the user is offered *Try again*.

- Check that Immich is running, and that the Nextcloud server (and its cron container) can open the
  `url`: `curl <url>/api/server/ping` from there.
- `localhost` in the `url` means the Nextcloud container, not Immich. Use the host name Immich has
  for Nextcloud, such as `immich-server` on a shared Docker network.

### The API key is refused

Immich answered that the key is not valid: it was deleted, revoked or replaced, or the key file
holds the key of another server. Create a new key in Immich, write it into the key file and try
again; nothing else needs a restart.

### The API key cannot be read

The `keyFile` is missing, not readable by the web server user, or empty. Check the absolute path
in the connections file, the file's permissions and that it is mounted into the Nextcloud
container. The Nextcloud log names the connection `id`.

### This Immich version is not supported

honeycomb supports Immich 3.2 and later of major 3. Any other version, and an answer that does not
fit what honeycomb expects from that Immich, shows this message. Update Immich to a supported
version, or honeycomb if Immich is newer. *Connection details* shows the version Immich reports.

### Immich is unavailable because of the server configuration

The connections file is broken: it is missing, not readable, not valid JSON, or breaks a rule in
the table above. Fix the first mistake in the Nextcloud log ("The Immich connections file") and the
connections come back on the next request.
