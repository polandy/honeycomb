# 0056 – Flags written to the XMP sidecars by default, digiKam's changes taken over

- Status: accepted
- Date: 2026-11-24
- Amends: [0040](0040-flags-per-picture-in-the-database.md),
  [0032](0032-sidecar-is-the-source-of-truth.md),
  [0055](0055-one-baseline-migration-before-the-first-deployment.md)

## Context

ADR 0040 keeps the flag and *Keep RAW* in `honeycomb_decisions` and writes them to the sidecars
only through the ⋯ entry *Write picks/rejects to XMP*. A picture is taken over once; a later
change in digiKam is not read any more. So digiKam shows stale picks until the user remembers the
entry, and a pick or reject made in digiKam after the first visit is lost for honeycomb.

The architecture and data model review of 2026-11-24 found this the largest gap to the owner's
rule *digiKam compatibility comes first* (ADR 0032). The owner approved the measure on
2026-11-24 (issue #187): write the flag and *Keep RAW* to the sidecars by default, with a setting
to opt out, and use `honeycomb_decisions.sidecar_etag` (ADR 0055) to take over a pick changed in
digiKam instead of overwriting it.

## Decision

### Writing by default

1. **Setting** *Write picks, rejects and Keep RAW to XMP sidecars*, `writeFlagsToXmp` in the
   user's settings object, **on** by default, in a new *XMP sidecars* section of the settings
   dialog. Off, honeycomb behaves as ADR 0040 describes: taken over once, written only through the
   ⋯ entry.
2. **On**, a flag or *Keep RAW* step, an undo or redo of one, saves the rows as before and writes
   the flag fields and `honeycomb:KeepRaw` through to the picture's sidecars, bundled with its
   other fields (ADR 0032 *Bundling*). Missing sidecars are created by the export's rule: only for
   a picture that ends flagged or kept (XMP-003.41). The fields are written as
   [`06-xmp-interop.md`](../06-xmp-interop.md) has them; *unflagged* keeps digiKam's `PickLabel` 2.
3. **A failed flag write keeps the flag.** The row is saved and decides deleting, so a sidecar
   that cannot be written is reported like any other (XMP-003.13), but the flag is not taken back.
   The next visit writes it again (below). A rating, colour label or tag that failed is taken back
   as before.
4. The ⋯ entry stays for both settings: it writes what still differs at once, with its count.

### The sidecar's ETag as honeycomb knew it

`honeycomb_decisions.sidecar_etag` holds, per member file, the ETag of **that member's sidecar**
(`<member file>.xmp`, else the shared `<base>.xmp`) as honeycomb last knew it:

- after honeycomb saved that sidecar, whatever fields it wrote, also with the setting off;
- after a take-over, which records the sidecar it took the flag from;
- after a visit found the sidecar stating the row's flag and *Keep RAW*.

It is not the ETag of "the last agreement" alone, as ADR 0055 put it: a rating honeycomb writes
while the flags differ (setting off, or a failed flag write) changes the ETag, and only honeycomb
did that. A save of a flag keeps the row's ETag; `null` means honeycomb never knew the sidecar.

`PUT /apps/honeycomb/api/v1/flags/sidecar-etags` with `{"etags": [{"fileId", "sidecarEtag"}]}`,
at most 60,000, sets the column of existing rows only, needs UPDATE and CREATE like the flag save,
leaves `flag`, `keepRaw`, `updated_at` and `updated_by` alone, and answers like the flag save
(`notFound`, `notPermitted`, and `missing` for a file without a row). The take-over takes an
optional `sidecarEtag` per item. The listing carries `sidecarEtag` per entry.

### Syncing on a visit

With the setting on, after the cull read a picture's sidecars through the XMP cache, each
rateable picture with rows is compared, by a pure function, with what each of its read sidecars
states (the export's comparison, `src/logic/xmp-export.ts`):

| Sidecars state the row | A member's sidecar changed since its ETag | Then |
|---|---|---|
| yes | – | record the ETags that differ |
| no | yes | **take over** the picture's state by the reading rules (newest sidecar wins), save it as rows, then write it to the sidecars that still differ |
| no | no, or never known (`null`) | **write** the row's state to the sidecars that differ |

A sidecar changed since its ETag is one whose listed ETag differs from a non-null stored one. A
take-over here is no undo step and is not counted in the statistics. When both sides changed
(honeycomb's write failed and digiKam changed the pick), the sidecar wins: digiKam first. A
picture with a sidecar that is refused or not read yet is left out. Read-only pictures are not
synced: a reader may not change a row or a sidecar, and sees the row.

## Consequences

- digiKam sees honeycomb's picks at its next scan without an extra step; honeycomb sees digiKam's
  at its next visit, for pictures it already knows too.
- Every flag change makes a sidecar save, a Nextcloud version and a desktop sync, bundled per
  picture like ratings (risk R9).
- The first visit after an update writes the sidecars of pictures whose rows and sidecars differ
  without a known ETag, honeycomb's row winning; on a fresh 0.2.0 install that is none.
- Known limits: when digiKam changes a pick in the seconds between honeycomb's read and save of
  the same sidecar, the merge of XMP-003.8 keeps digiKam's field but the recorded ETag hides it, so
  the next visit writes honeycomb's flag over it. With the setting off honeycomb still records the
  ETags of its own saves, so a pick changed in digiKam before such a save is not taken over when
  the setting is turned on again.
- ADR 0040 *Where each value lives* (flag, *Keep RAW*: "only through *Write picks/rejects to
  XMP*"), *Taking over* 4 ("a later change in digiKam is not read any more") and the consequence
  "its picks only after *Write picks/rejects to XMP*" hold only with the setting off. ADR 0032
  *Truth* 1 holds for the flag again as far as the sync goes: a sidecar changed elsewhere wins.
