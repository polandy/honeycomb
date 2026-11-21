# 0041 – Immich as an external picture source: an exception to rule 1

- Status: accepted
- Date: 2026-11-19
- Extends: [0040](0040-flags-per-picture-in-the-database.md),
  [0006](0006-thin-php-backend-logic-in-typescript.md)

## Context

The owner's family phones back up into Immich's upload library, which Nextcloud never sees:
the files belong to the `immich-server` container, and everything about them (rating, favourite,
archive, trash bin, albums, stacks) lives in Immich's database. Nothing of this can be culled
today. The 24,118 Nextcloud photos Immich reads as an external library are not affected: they
are Nextcloud files, culled natively with sidecars and the Nextcloud trash bin, and Immich follows
on its next scan.

Rule 1 of `CLAUDE.md` says files are touched only through `OCP\Files`, so that permissions,
versions and the trash bin keep working. An upload-library file is reachable from the Nextcloud
host, but touching it on disk would break what the rule protects in Immich's terms: a moved or
deleted file goes *offline* in Immich, and its albums and stacks break. Immich's API (v3.4.2 at
the time of writing) offers everything the cull needs over bulk endpoints: listing with filters
and cursor paging (`POST /search/metadata`), previews (`GET /assets/{id}/thumbnail`), rating,
favourite and archive (`PUT /assets`), the Immich trash bin (`DELETE /assets` with `force:false`,
restorable for 30 days by default) and restoring from it.

The investigation of 2026-11-19 weighed three options:

- **A, Immich as a second source in honeycomb:** PHP proxies the Immich API, the logic stays in
  pure TypeScript (ADR 0006), the decisions live in honeycomb's database per asset. The cull stays
  in one app and the existing uploads are covered. Large: about one milestone, with its own ADRs,
  specs and a stub of the Immich API in e2e. Immich's API changes quickly (the rating value 0 and
  the search filters changed within v3 alone).
- **B, phone backup through Nextcloud instead of Immich:** no code, but the Immich app is no
  backup any more, the existing uploads would have to be exported once, and every family account
  changes its workflow.
- **C, read plus rating only:** honeycomb writes rating −1 for a reject and the user deletes in
  Immich. Smaller, but the cull is split across two apps, and Immich v3 no longer offers rating −1
  as a search filter, so the rejects could only be found by a tag.

The owner chose A on 2026-11-19, in two phases, and answered the open questions; those answers
are binding here. The report and its interactive mockup (English UI, built from the tokens of
`docs/dev/mockup/index.html`) are the basis of this ADR, together with the architecture review of
the same day, which asked whether the Immich work can run beside the statistics work (M9) and
whose seven decisions the owner took as recommended.

## Decision

### The exception to rule 1

1. **Immich assets are reached only through the Immich API**, server to server, from PHP. No
   code of honeycomb reads, moves or deletes a file of Immich's upload library, and no path of it
   appears in honeycomb. Rule 1 stays as it is for every Nextcloud file.
2. **The one local read** outside `OCP\Files` is the admin's *connections file* and the key files
   it names (below). It is read with the injected file system seam, never with a global function,
   and never written.
3. **The browser never talks to Immich.** Listing, previews and every write go through honeycomb
   endpoints; PHP proxies the preview bytes (`size=preview`) with cache headers, so the browser
   keeps them. The API key stays on the server, and the content security policy and the reverse
   proxy's authentication play no role.
4. **Nothing is deleted for good.** `force:true` is never sent, by any path; the client has no
   option for it and the server refuses a body that asks for it. The analogue of rule 2 is
   Immich's own trash bin.
5. **No sidecar, no file** is written for an Immich asset. digiKam does not see the upload
   library; ADR 0032 and 0040 and `06-xmp-interop.md` are unaffected.

### Connections: declarative, several per user

1. A honeycomb user can cull **several Immich accounts** (their own and, say, a spouse's). Each
   is a *connection*: the Nextcloud user id, a label, the Immich base URL and the path of a file
   that holds the API key.
2. The connections live in **one JSON file the server configuration generates** (on the owner's
   server: nixos-server from sops secrets), mounted **read-only** into the Nextcloud container
   together with the key files. The app config holds the file's path; nothing else. Keys are never
   stored in the database, never logged and never sent to the browser.
3. **No connection is created, changed or removed in the UI.** The UI lists the connections of the
   signed-in user by label and shows whether each answers. A connection whose key lacks a scope
   shows what it cannot do (Phase 2: *Your API key lacks `asset.delete`*).
4. A missing file, an unreadable key or an unreachable Immich is reported as such, the Nextcloud
   source stays usable, and the decisions already made stay in honeycomb.

### What the cull does with an asset

| honeycomb | In Immich | Why |
|---|---|---|
| *Rejected* | **Immich trash bin** by default; *archive* or *rating −1 only* selectable per write | Mirrors rule 2; restorable; takes the whole asset, motion video included |
| *Picked* | Favourite **only when the connection opts in** (`picksAsFavorites`) | Immich has no pick; a favourite shifts the meaning |
| Rating 1–5 | Rating 1–5 | one to one |
| Rating 0 | `null` | Immich v3 rejects 0 |
| Colour label, tags, *Keep RAW* | nothing | no counterpart in Immich; the colour label stays in honeycomb's table; a live photo is one asset, a stack is shown but only the chosen asset goes |

### The decision per (connection, asset id)

The **whole decision** of an Immich asset, rating, colour label, flag and *Keep RAW* as
`src/logic/decision.ts` defines it, is kept in honeycomb's database **per (connection, asset id)**
in a table of its own, never in `honeycomb_flags`. That table is keyed by a Nextcloud file id and
holds the flag and *Keep RAW* only, because the rest goes into the sidecar (ADR 0040); an Immich
asset has no sidecar, so its table is the only place for the rating and the colour label. The
store is registered as a `UserRowStore` only, never as a `FileRowStore`: there is no file id to
carry over and no vanished file to sweep. A row whose connection left the connections file is
swept instead. The table's columns and its endpoints are ADR 0043 (rule 6).

### The picture id in the browser

The logic modules and components identify a picture by `fileId: number` today; Immich identifies
an asset by a UUID. The browser gets a `PictureId` alias, `number` for a Nextcloud file and
`string` for an Immich asset, introduced as a refactor of type lines only before the first Immich
module. The asset id stays the truth; no server table hands out synthetic numbers for it.

### Two phases

1. **Phase 1, read only.** The *Immich* source lists one connection's upload library (external
   libraries left out, so a Nextcloud photo never shows twice), filtered by time, camera model and
   kind, with previews through PHP, and the user picks, rejects and rates in honeycomb. Nothing
   is written to Immich. A key with `asset.read` and `asset.view` is enough. Immich assets do not
   count in the statistics (ADR 0039) in this phase. The UI is lean: grid, loupe, filters,
   decisions, position and *Recent*. The source's capabilities switch everything else off: no
   series, no similarity hashes, no tags, no delete, move or XMP. Series and hashes over the
   preview proxy may follow later as work of their own.
2. **Phase 2, *Write to Immich*.** An explicit step, like *Write picks/rejects to XMP*, with a
   dialog that names what happens to rejects, picks and ratings. Before writing, the affected
   assets are loaded again and their `updatedAt` compared with the value at listing time; a changed
   rating is resolved per asset (keep honeycomb's or Immich's), an asset already in Immich's trash
   bin counts as done, an asset in a shared album offers *trash anyway*, *archive* or *skip*. Writes
   go in chunks (ADR 0029). A failed asset keeps its flag in honeycomb and is offered again; the
   others are written (M4.1). A reject taken back restores the asset from the trash bin or archive.
   Phase 2 needs `asset.update` and, for the trash bin, `asset.delete`.

Every version of the Immich API in use is pinned: the client checks the server version it
targets and its contract tests run against the OpenAPI schema of that version. **e2e runs against
a stub** of the Immich API built from that pinned schema, run by PHP's built-in server inside the
e2e Nextcloud container, with a fixture of two connections and their key files; it answers in
seconds and runs in `scripts/verify.sh`. Amended on 2026-11-21: a second Playwright web server on
the host, as first written, would need a free port per parallel run and a route from the container
to the host; inside the container the connections file names one fixed origin. A real Immich (Postgres, Redis, machine learning) is the owner's hand test on
the test server only, never a CI step.

### Implementation order

Phase 1's production code is about eight pull requests, following the 26-task plan of 2026-11-19
and section 4 of the architecture review. They run autonomously by the chain rules: a pull request
starts when the ones it depends on are merged, merges `origin/main` before every push, and no
production code lands before the mockup is signed off (rule 3). The one thing the owner allowed
before the sign-off is PR 5, the refactor of type lines: it changes no behaviour and no UI, and
it frees the pure TypeScript of PR 8 from `fileId: number` (decision 5 of the review).

| # | Pull request | Contents | After |
|---|---|---|---|
| 1 | `docs(adr)` | this ADR, the glossary, `plan.md`, `TODO.md` | |
| 2 | `docs(adr)` | the connections file and its reader; the decision table per (connection, asset id); the public API of the source | 1 |
| 3 | `docs(specs)` | `docs/dev/specs/immich/`: connections, listing and filters, decisions per connection, *Write to Immich* | 2 |
| 4 | `docs(mockup)` | the Immich source under `docs/dev/mockup/immich/`: source and connection switcher, read-only connection dialog, status per connection; then the owner's sign-off (ADR 0003) | 3 |
| 5 | `refactor(types)` | `PictureId` alias and a `SourceEntry` base of `ListingEntry`; type lines only, allowed before the sign-off | now, beside statistics PR 4 |
| 6 | `feat(immich)` | backend: connection registry and status, the client with contract tests and upstream error classes, listing and preview proxy; new files and one-line registrations only | 2, sign-off |
| 7 | `feat(immich)` | the decision table, its mapper and endpoints as a `UserRowStore`; the sweep of rows whose connection left the file (ADR 0043) | 2, 6, sign-off |
| 8 | `feat(immich)` | pure TypeScript: asset to picture (live photo as one picture, stacks, device from EXIF, kinds) and the filters | 3, 5 |
| 9 | `refactor(shell)` | the opened source as a union with its key and capabilities, `imageUrl` in the cull context, `cull.ts` relieved; no behaviour change for folders | statistics PR 6 |
| 10 | `feat(immich)` | UI, two pull requests: (a) source and connection switcher with the read-only connection dialog; (b) grid and loupe with Immich data, capabilities off, decisions saved, position and *Recent* | 6 to 9 |
| 11 | `test(e2e)` | the stub Immich server from the pinned schema and the e2e spec, on the generic upstream-stub seam the verify work adds to the e2e setup first | 10 |
| 12 | owner | Phase 1 hand test on the test server with two real accounts and read-only keys; the server configuration renders the connections file | 11 |
| 13 | `feat(immich)` | Phase 2: the write plan in pure TypeScript, the write-back endpoint with per-asset results, the write dialog with conflicts and undo, e2e against the stub; Immich decisions enter the statistics here | 12 |
| 14 | `docs(user)` | the connections file format and key scopes for the admin; the user guide for culling Immich uploads | 13 |

The hotspot files of the Vue shell (`App.vue`, `cull.ts`, `cull-context.ts`,
`AppNavigation.vue`, `GridScreen.vue`) have one owner at a time: the statistics work (M9) until
its PR 6 is merged, the Immich work (M10) after that. Until then the Immich work touches only new
files and one-line registrations in `Application.php`, `ApiResponse.php` and the migration number.

## Consequences

- Phone uploads can be culled on the iPad with the same grid, loupe and keys; the cull stays in
  one app.
- Rule 1 has one named exception, bounded to the Immich API and the admin's read-only files.
  Everything else about Nextcloud files is unchanged, and the Immich code has no `OCP\Files`
  dependency at all.
- Adding or changing a connection is a server deployment, not a click: deliberate, so that keys
  never enter the database or the UI, at the price of needing the admin for a new account.
- The preview load runs through PHP, one request per thumbnail; the browser caches them.
- A dependency on the Immich API version: contract tests and a version check catch a change,
  and a newer Immich can still block the source until honeycomb follows.
- Immich writes rating and description into its own `.xmp` beside the original; a *rating −1
  only* reject ends up there as `xmp:Rating` −1, which honeycomb never writes for a Nextcloud
  photo. It is accepted for Immich assets and named in the write dialog.
- Nothing honeycomb does to an Immich asset is final: the Immich trash bin keeps it for its
  retention time, and the user can restore it in either app.
- The `PictureId` alias touches the type lines of many modules once; after it a picture id is
  `number | string` wherever Immich can appear, and the Nextcloud paths keep their numbers.
- Two storage shapes for one `Decision`: a Nextcloud picture's rating and colour label live in
  the sidecar, an Immich asset's in the table. The pure logic sees the same `Decision` either way.
- The stub keeps e2e fast and deterministic at the price of trusting the pinned schema; the
  contract tests and the owner's hand test against a real Immich cover what the stub cannot.
