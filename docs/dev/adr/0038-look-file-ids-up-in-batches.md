# 0038 – Look file ids up in batches

- Status: accepted
- Date: 2026-11-18
- Extends: [0031](0031-access-check-and-rate-limit-on-every-write.md)

## Context

ADR 0031 checks every file id of a save through `UserPhotos`, one
`Folder::getFirstNodeById()` each. That costs 3 queries per id: 60,000 decisions took 180,000
queries and 19.5 s, and a first visit's XMP cache save of 50,000 rows 16.8 s
(`docs/dev/plan.md` Multiple folders item 9). The check must stay as strict: an id counts only if
the user reaches it in their own files, a share, a team folder or an external storage.

The options:

- **Read `oc_filecache` and the mounts ourselves:** one query, but the app would repeat
  Nextcloud's mount and share rules and drift from them.
- **`Folder::search()` on the user's folder with `fileid IN (...)`:** the OCP search Nextcloud's
  own search uses. It sets up the user's mounts once and asks all their caches in one query, and
  answers only nodes below the user's folder, as `getFirstNodeById()` does. The OCP has the
  interfaces only, so the app implements `ISearchQuery` and `ISearchComparison` as two small
  value classes.
- **Keep the lookup per id:** simple, but a large folder set's save stays slow.

## Decision

- `UserPhotos` looks the file ids of a save up through `Folder::search()` on the user's folder,
  `IQueryBuilder::MAX_IN_PARAMETERS` (1,000) ids per search, so no database sees a longer list.
- A node found through several mounts counts once, by the first one found, as with
  `getFirstNodeById()`. The type rules (photo, JPEG, sidecar) and the etag check are unchanged.
- The single-file checks (`photo()`, `jpeg()`, `sidecar()`, `listed()`) keep
  `getFirstNodeById()`: they look up one id per request.

## Consequences

- A save of n ids costs a fixed set-up and one query per 1,000 ids instead of 3 per id.
- A database test against a real Nextcloud proves that the batch reaches the same ids as the
  lookup per id: the user's photos, a share's photos, and not another user's files.
- If Nextcloud changes how its search treats `fileid`, that test fails; going back to the lookup
  per id is a change inside `UserPhotos` only.
