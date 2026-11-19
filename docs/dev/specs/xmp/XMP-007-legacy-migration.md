# XMP-007 – Migrating the stored decisions and tags to sidecars

- Status: removed
- Area: xmp
- Origin: ADR 0032 (App state and migration), `docs/dev/06-xmp-interop.md`
- Withdrawn by: ADR 0040, removed in M8 PR 4
- Depends on: DECISIONS-001, TAGS-001, XMP-002, XMP-003, XMP-004, SETTINGS-001

## Purpose

Before ADR 0032 the ratings, flags, colour labels, *Keep RAW* marks and tags lived in the tables
`honeycomb_decisions` and `honeycomb_file_tags` (the legacy rows). The migration writes them into
the pictures' sidecars, removes each picture's rows once its sidecars hold them, and keeps the
rows of files the user no longer reaches until the user exports or discards them.

## Behaviour

**Removed.** ADR 0040 drops the migration: honeycomb runs in no production, so M8 PR 5 drops
`honeycomb_decisions` and `honeycomb_file_tags` without writing their rows anywhere. M8 PR 4 removed
the endpoints, the ⋯ entry, the notice, the export and *Discard*; no criterion below holds any more.

## Acceptance criteria

### XMP-007.1 – The inventory names the folders with legacy rows (removed)

### XMP-007.2 – The export holds the rows of unreachable file ids (removed)

### XMP-007.3 – The acknowledgement removes the rows of the file ids (removed)

### XMP-007.4 – A malformed acknowledgement removes nothing (removed)

### XMP-007.5 – The ⋯ entry writes every picture with legacy rows, the database winning (removed)

### XMP-007.6 – Only a picture with every sidecar saved is acknowledged (removed)

### XMP-007.7 – The ⋯ entry needs legacy rows (removed)

### XMP-007.8 – The notice names the folders and offers a copy and forgetting (removed)

### XMP-007.9 – A failed inventory shows no notice (removed)

### XMP-007.10 – A folder of the notice opens that folder (removed)

### XMP-007.11 – The run shows its progress and ends with one result (removed)

### XMP-007.12 – A run with failures ends with how many failed and why (removed)

### XMP-007.13 – A shared folder not confirmed is skipped until confirmed (removed)

### XMP-007.14 – The notice does not come back after a migration (removed)

## History

| Date | Change |
|---|---|
| 2026-11-15 | Written with ADR 0032 PR 5 |
| 2026-11-17 | Clearer notice with folder buttons, *Save a copy* and *Forget…*; the run shows progress and one result (XMP-007.10–.12) |
| 2026-11-18 | Shared folders need the confirmation of XMP-008.4; the run skips those not confirmed (XMP-007.13, owner decision #187) |
| 2026-11-18 | An acknowledged picture is unlocked and gets no legacy rows back, so the notice stays away (XMP-007.14, ADR 0032) |
| 2026-11-19 | Withdrawn by ADR 0040 |
| 2026-11-19 | M8 PR 3: no setting and no shared-folder skip (.7, .8 changed, .13 removed) |
| 2026-11-19 | M8 PR 4: removed, with all criteria |
