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
  pure TypeScript (ADR 0006), flags live in honeycomb's database per asset. The cull stays in one
  app and the existing uploads are covered. Large: about one milestone, with its own ADRs,
  specs and an Immich container in e2e. Immich's API changes quickly (the rating value 0 and the
  search filters changed within v3 alone).
- **B, phone backup through Nextcloud instead of Immich:** no code, but the Immich app is no
  backup any more, the existing uploads would have to be exported once, and every family account
  changes its workflow.
- **C, read plus rating only:** honeycomb writes rating −1 for a reject and the user deletes in
  Immich. Smaller, but the cull is split across two apps, and Immich v3 no longer offers rating −1
  as a search filter, so the rejects could only be found by a tag.

The owner chose A on 2026-11-19, in two phases, and answered the open questions; those answers
are binding here. The report and its interactive mockup (English UI, built from the tokens of
`docs/dev/mockup/index.html`) are the basis of this ADR.

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
| Colour label, tags, *Keep RAW* | nothing | no counterpart; a live photo is one asset, a stack is shown but only the chosen asset goes |

Picks, rejects and ratings of an Immich asset are kept in honeycomb's database **per
(connection, asset id)** in a table of their own, never in `honeycomb_flags`, whose key is a
Nextcloud file id. The table's columns and its endpoints get their own ADR (rule 6).

### Two phases

1. **Phase 1, read only.** The *Immich* source lists one connection's upload library (external
   libraries left out, so a Nextcloud photo never shows twice), filtered by time, camera model and
   kind, with previews through PHP, and the user picks, rejects and rates in honeycomb. Nothing
   is written to Immich. A key with `asset.read` and `asset.view` is enough. Immich assets do not
   count in the statistics (ADR 0039) in this phase.
2. **Phase 2, *Write to Immich*.** An explicit step, like *Write picks/rejects to XMP*, with a
   dialog that names what happens to rejects, picks and ratings. Before writing, the affected
   assets are loaded again and their `updatedAt` compared with the value at listing time; a changed
   rating is resolved per asset (keep honeycomb's or Immich's), an asset already in Immich's trash
   bin counts as done, an asset in a shared album offers *trash anyway*, *archive* or *skip*. Writes
   go in chunks (ADR 0029). A failed asset keeps its flag in honeycomb and is offered again; the
   others are written (M4.1). A reject taken back restores the asset from the trash bin or archive.
   Phase 2 needs `asset.update` and, for the trash bin, `asset.delete`.

Every version of the Immich API in use is pinned: the client checks the server version it
targets and its contract tests run against the OpenAPI schema of that version.

### Implementation order

| # | Pull request | Contents |
|---|---|---|
| 1 | `docs(adr)` | this ADR, the glossary, `plan.md`, `TODO.md` |
| 2 | `docs(mockup)` | the Immich source under `docs/dev/mockup/`, for the owner's sign-off (ADR 0003) |
| 3 | `docs(adr)` | the connections file, its reader and the flag table and its endpoints; the public API of the source |
| 4 | `feat(immich)` | Phase 1: connections, listing, previews, the source in the UI, flags and ratings in the table; an Immich container in e2e |
| 5 | `feat(immich)` | Phase 2: *Write to Immich* with the conflict check |

No production code before 2 is signed off (rule 3).

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
