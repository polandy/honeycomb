# 0035 – A folder set excludes folders below a ticked one

- Status: accepted
- Date: 2026-11-17

## Context

With *Include subfolders* on, a ticked folder takes every folder below it along, and a tap on an
included folder used to tick it as well, which changed nothing (LISTING-003.18). The owner wants
to leave single folders out instead, say the RAW exports below a trip (#187, 2026-11-17): a tap
on an included folder excludes it with everything below it, a second tap includes it again, and
a folder ticked inside an excluded one is back in.

The folder set travels in three places: the picker's count and the cull's listing
(`GET /api/v1/entries`, LISTING-001), the stored resume position (`honeycomb_positions`,
ADR 0012) and its key (ADR 0034). The options for the listing:

- **Filter on the client:** list the ticked folder whole and drop the excluded paths. Simple, but
  the server still walks the excluded folders, and they count towards the 60,000-entry limit.
- **Tell the server:** pass the excluded folders with each listing, so it never opens them.

## Decision

- **Shape:** `FolderSet` gets an optional `excluded` list of folder paths, in TypeScript
  (`src/logic/folder-set.ts`) and PHP (`lib/Service/FolderSet.php`). An excluded folder leaves
  out itself and everything below it, except ticked folders inside it and what they take along.
  Exclusions only count with *Include subfolders* on and below a ticked folder; others are kept
  but leave nothing out.
- **Listing:** each ticked folder is listed with `excluded[]=<path>` for the excluded folders
  below it. The server skips those folders in its walk without opening them; malformed or more
  than 1,000 paths are a `400`.
- **Storage:** no migration. `folder_set` is JSON text; `excluded` is written only when not
  empty, so a row stored before keeps its bytes and a set without exclusions is stored as before.
- **Key:** the key appends the sorted exclusions that leave something out, as a third element;
  without any it is the old two-element form, so every stored key stays valid and
  `LegacyPositionKeys` re-keys nothing. TypeScript and PHP cut the same ancestors at each `/`.

## Consequences

- An excluded folder costs nothing to list and does not count towards the entry limit.
- `folderSetKey()` and `FolderSet::key()` must agree on which exclusions count; their tests share
  the cases.
- Exclusions kept while *Include subfolders* is off come back when it is turned on again, as the
  ticks below a ticked folder do (ADR 0034).
- The names of a folder set under *Recent* and in the toolbar do not mention exclusions.
