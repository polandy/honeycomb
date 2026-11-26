# 0061 – RAW capture time and camera read by honeycomb

- Status: accepted
- Date: 2026-11-26
- Amends: [0045](0045-render-written-photos-in-the-background.md),
  [0049](0049-folders-to-cull-done-status-and-library-progress.md)

## Context

The capture time and camera of an entry come from the Photos app's file metadata
(`photos-original_date_time`, `photos-ifd0`; `CaptureTimes`, `EntryFactory`). Photos 35 reads
them only for PNG, JPEG, HEIC and WebP (`Application::IMAGE_MIMES`); Nextcloud maps every RAW
extension it knows to `image/x-dcraw` and CR3 and SRW to none. So no RAW file has either value.
A RAW-only picture therefore never joins its burst's series and splits the filmstrip frame, and
*Pick this, reject the rest* leaves it out (owner, nc-test folder `Series`, 2026-11-25). The
folder summary's bursts and capture times (ADR 0049) miss it the same way.

The options were:

- **A, write Photos' keys for RAW files.** Photos would sort RAWs too, but honeycomb would write
  another app's data, which Photos may overwrite or clear when it learns RAW.
- **B, an own table**, with a migration (append-only from 0.2.0, ADR 0055), its own clean-up on
  file deletion and on removal (ADR 0053).
- **C, an own key in Nextcloud's file metadata**, chosen. Core stores it per file in
  `oc_files_metadata`, deletes it with the file and hands it out in the batch query the listing
  already makes. No table, no migration.

## Decision

- **Key.** `honeycomb-raw_exif`, an array `{DateTimeOriginal?: int, Make?: string, Model?: string}`,
  each field only when the header has it. Not indexed, not editable through WebDAV. Its presence
  means the file was read; a header without the values stores `{}`, so it is not read again.
- **Which files.** A file whose extension is one of its owner's RAW extensions (LISTING-002), by
  extension because CR3 and SRW have no mimetype, of a user who has opened honeycomb (ADR 0045).
- **The read, through `OCP\Files` only.** `File::fopen('r')` and sequential reads of at most the
  first 1 MiB, no seek (not every storage's stream seeks); a value beyond it counts as absent.
  A pure parser in `lib/` reads the bytes, no PHP `exif` call and no new dependency:
  `exif_read_data` takes only TIFF with the plain magic, so it rejects ORF, RW2, RAF and CR3.
  - TIFF-based files (NEF, CR2, ARW, DNG, PEF, SRW, ORF with `IIRO`, RW2 with `IIU`): IFD0's
    `Make` and `Model`, the Exif IFD's `DateTimeOriginal` and `OffsetTimeOriginal`.
  - RAF: the embedded preview's offset at byte 84 (big-endian), its APP1 Exif read as TIFF.
  - CR3: the `CMT1` (IFD0) and `CMT2` (Exif IFD) boxes in the Canon `uuid` box of `moov`.
  - Another format, or a malformed header, stores `{}`; the parser never throws on file
    content, only the stream's own failures are logged.
- **The time as Photos computes it.** `DateTimeOriginal` with `OffsetTimeOriginal` when there is
  one, else in the server's default time zone, format `Y:m:d G:i:s`, in Unix seconds. So a RAW
  member and its camera JPEG get the same capture time, and the camera string is `Make Model`
  trimmed, as `EntryFactory::camera` joins `photos-ifd0`.
- **New files.** A listener on `MetadataLiveEvent` and `MetadataBackgroundEvent` writes the key.
  On a storage that is not local, the live event asks for the background job instead, as Photos
  does; core runs it.
- **Reading side.** `CaptureTimes` and `EntryFactory` take Photos' values first and the
  honeycomb key for a file without them. The glossary's *capture time* (the RAW member's first)
  then holds for pairs too.
- **Backfill for existing files.** RAWs written before the listener, or before their owner's
  first visit, have no key. The listing and the library scan (FOLDERS-005) queue
  `ReadRawHeaders`, a `QueuedJob` with `{"userId", "fileIds"}` (at most 500 ids, not queued again
  while the same argument waits), for the RAW files they meet without the key. The job calls
  `IFilesMetadataManager::refreshMetadata` per file, so the listener does the read, then drops the
  folder summaries of the folders it touched: writing metadata leaves the etag unchanged, so the
  next scan would keep the old bursts. An admin can fill every file at once with
  `occ files:scan --generate-metadata`.

## Consequences

- A RAW-only picture joins its series once its key exists: at once for a file written after the
  user's first visit on local storage, after the next background jobs otherwise. A folder opened
  for the first time shows its RAW-only pictures outside series until the jobs ran.
- A pair's capture time becomes the RAW member's; for a camera that writes both, it is the same
  second as before.
- Each RAW costs one read of at most 1 MiB when written or backfilled.
- The key stays in `oc_files_metadata` after honeycomb is removed: core cannot find a file by an
  unindexed key, and the rows go with their files. `occ honeycomb:cleanup --all --drop` (ADR 0053)
  leaves it, and the removal docs say so.
- Changing the format later costs a new key and one backfill; no data needs migrating.
- Not yet read: other RAW formats (e.g. X3F, IIQ); they store `{}` and stay as today.
