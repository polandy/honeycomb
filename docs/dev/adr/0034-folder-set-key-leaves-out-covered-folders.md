# 0034 – The folder set key leaves out folders covered by *Include subfolders*

- Status: accepted
- Date: 2026-11-16

## Context

A resume position is stored per user and folder set key, `folder_set_key` in
`honeycomb_positions` (ADR 0012): the SHA-256 of the sorted paths and the subfolders switch, the
same form as `folderSetKey()` in `src/logic/folder-set.ts`. With *Include subfolders* on, ticking
`/Trip` and `/Trip/Day 2` lists the same photos as `/Trip` alone, but the key told them apart, so
*Recent* showed one folder set twice with two positions. The folder tree's "*n* inside" badge
(LISTING-003.17) makes ticking deep folders more likely (concept LISTING-003, M3).

The options for positions already stored under the old key:

- **Keep their rows:** a set saved once before and once after the change shows twice under
  *Recent* until the older one falls out of the 20.
- **Re-key them in a migration:** runs once, but only on an app upgrade, and a test build
  deployed without a version bump would never run it.
- **Re-key them when the list is read:** a read already loads every row of the user, at most 20.

## Decision

With subfolders, the key leaves out every ticked path below another ticked path, in TypeScript
and PHP alike; without subfolders it is unchanged. The stored `folder_set` keeps every ticked
path, so switching subfolders off restores the ticks.

`PositionMapper::all()` re-keys the user's rows whose stored key differs from the key of their
folder set (`LegacyPositionKeys`): when two rows become one set, the newer stays and the older is
deleted, then the rest take the new key, in one transaction. A read of rows stored under the new
key writes nothing.

## Consequences

- One folder set has one position and one *Recent* entry, however many covered folders are
  ticked. A covered folder that was ticked last still gives the stored set its paths.
- The first read after the upgrade writes once per user; later reads only compare keys.
- `folderSetKey()` and `FolderSet::key()` must leave out the same paths; their tests share the
  cases.
