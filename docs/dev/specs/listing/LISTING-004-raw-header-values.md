# LISTING-004 – RAW header values

- Status: implemented
- Area: listing
- Origin: ADR 0061; owner, nc-test folder `Series` (2026-11-25)
- Depends on: LISTING-002

## Purpose

The Photos app reads no capture time or camera from RAW files. honeycomb reads both from a RAW
file's header and keeps them in Nextcloud's file metadata, so a RAW-only picture can join its
burst's series. This spec covers the read, the write, the listing reading the key and the
backfill of existing files (ADR 0061).

## Behaviour

**Which files.** When Nextcloud generates a file's metadata (a write, `occ files:scan
--generate-metadata`, a metadata refresh), honeycomb reads the file if its owner has opened
honeycomb (ADR 0045) and its extension is one of the owner's RAW extensions (LISTING-002), the
defaults when the owner's lists are unset or invalid. Any other file is left as it is.

**Where.** On a storage that is not local, the live metadata generation asks for core's
background job instead; the background generation then reads the file. On a local storage the
live generation reads it at once.

**The read.** At most the first MiB of the file, opened read-only through Nextcloud's files
API and read in order without seeking. A value beyond the first MiB counts as absent. The format
is told by the content, not the extension:

| Format | Where the values are |
|---|---|
| TIFF-based (NEF, CR2, ARW, DNG, PEF, SRW; ORF with `IIRO`, `IIRS` or `MMOR`; RW2 with `IIU`) | IFD0's `Make` and `Model`, the Exif IFD's `DateTimeOriginal` and `OffsetTimeOriginal` |
| RAF | the Exif segment of the embedded JPEG preview whose offset the header holds at byte 84 |
| CR3 | the `CMT1` (IFD0) and `CMT2` (Exif IFD) boxes in Canon's `uuid` box of `moov` |

**The value.** The key `honeycomb-raw_exif` holds `{DateTimeOriginal?: int, Make?: string,
Model?: string}`, each field only when the header has it: `DateTimeOriginal` in Unix seconds, read
as `Y:m:d H:i:s` in the zone of `OffsetTimeOriginal` when that is a valid offset such as `+02:00`,
else in the server's default time zone; `Make` and `Model` as the header holds them, cut at the
first NUL and trimmed. An empty string, a value that is not UTF-8 and a date that is no real date
(such as `0000:00:00 00:00:00`) count as absent. Another format, or a truncated or malformed
header, stores `{}`, so the file is not read again; file content never fails the write. When the
file cannot be opened or read, the failure is logged and no key is written.

**Reading the key.** An entry (LISTING-001) and the folder summary's capture times and bursts
(FOLDERS-005) take Photos' capture time and camera first, and the key's for a file without them.
The camera is the key's `Make` and `Model` joined as LISTING-001.2 joins Photos' values. A key
whose fields have the wrong type counts as one without them. So a RAW-only picture joins its
burst's series, and *Pick this, reject the rest* takes it.

**Backfill.** A RAW file written before its owner's first visit, or before honeycomb, has no key.
The listing (LISTING-001) and the library scan (FOLDERS-005) queue the background job
`ReadRawHeaders` with `{"userId", "fileIds"}` for the files they meet that have one of the user's
RAW extensions, belong to the user and have no key: the ids sorted, at most 500 per job, and a job
whose argument already waits is not queued again. The job refreshes each file's metadata as
`occ files:scan --generate-metadata` does, so the read above writes the key, then drops the
folder summaries of the folders of the files that got it: writing metadata leaves the folder's
etag unchanged, so without that the next scan would keep the old bursts. A file that got no key,
because it could not be read, leaves its folder's summary, so it cannot make every scan start
over; a later listing of its folder queues it again, one bounded job per listing, with no
stored retry count. A file that is gone, or whose refresh fails, is skipped and the failure
logged; the job goes on with the next.

## Acceptance criteria

### LISTING-004.1 – TIFF-based RAW files

- **Given** a NEF, CR2, ARW, DNG, PEF, SRW, ORF or RW2 file, in either byte order
- **When** its header is read
- **Then** `Make`, `Model` and `DateTimeOriginal` are those of its IFD0 and Exif IFD

### LISTING-004.2 – RAF files

- **Given** a RAF file
- **When** its header is read
- **Then** the values are those of the Exif segment of its embedded JPEG preview

### LISTING-004.3 – CR3 files

- **Given** a CR3 file
- **When** its header is read
- **Then** `Make` and `Model` are those of its `CMT1` box and `DateTimeOriginal` that of its `CMT2`
  box

### LISTING-004.4 – The capture time and its zone

- **Given** a header with `DateTimeOriginal`, with or without a valid `OffsetTimeOriginal`
- **When** it is read
- **Then** the time is in the offset's zone, else in the server's default time zone; an invalid
  offset counts as none

### LISTING-004.5 – Absent, empty and invalid values

- **Given** a header that lacks a value, holds it empty, padded with NULs or spaces, not as text,
  not as UTF-8 or as a date that is no real date
- **When** it is read
- **Then** that field is left out and the others are kept

### LISTING-004.6 – Another format or a malformed header

- **Given** a file of another format, an empty one, or a header that is truncated or points
  outside itself
- **When** it is read
- **Then** `{}` is stored and no error is raised

### LISTING-004.7 – Only the first MiB

- **Given** a RAW file whose values lie beyond its first MiB
- **When** it is read
- **Then** they count as absent and no more than one MiB is read

### LISTING-004.8 – Which files are read

- **Given** metadata generated for a file
- **When** its owner has opened honeycomb and its extension is one of the owner's RAW extensions
- **Then** the key is written; for a user who never opened honeycomb, a folder, a rendered file,
  an extension the owner removed from the RAW list or a file without owner nothing is read

### LISTING-004.9 – Storages that are not local

- **Given** a RAW file on a storage that is not local
- **When** its metadata is generated live
- **Then** core's background job is requested and nothing is read; the background generation
  reads it

### LISTING-004.10 – A file that cannot be read

- **Given** a RAW file that cannot be opened or read
- **When** its metadata is generated
- **Then** the failure is logged and no key is written

### LISTING-004.11 – The listing reads the key

- **Given** a file without Photos' capture time or camera, with the key
- **When** it is listed
- **Then** its entry's capture time is the key's `DateTimeOriginal` and its camera the key's
  `Make` and `Model`; Photos' values, when there, win, and a field of the wrong type counts as
  absent

### LISTING-004.12 – The folder summary reads the key

- **Given** a RAW-only picture with the key, a second after another photo of its folder
- **When** the folder summary is computed
- **Then** its capture time is the key's, so both are one burst

### LISTING-004.13 – A RAW-only picture in its burst's series

- **Given** a burst of photos whose middle shot is a RAW-only picture with a capture time in its
  header
- **When** the folder is culled
- **Then** the RAW-only picture is a card of the burst's series, and *Pick this, reject the rest*
  on another card rejects it

### LISTING-004.14 – The listing queues the backfill

- **Given** a listed folder with RAW files of the user without the key
- **When** it is listed
- **Then** one `ReadRawHeaders` job per 500 of their sorted ids is queued; a file with the key,
  a file of another owner, a JPEG and an extension the user removed from the RAW list are left
  out, and nothing is queued without such a file

### LISTING-004.15 – The library scan queues the backfill

- **Given** folders of a library root with RAW files without the key
- **When** the scan summarises them
- **Then** their ids are queued as in LISTING-004.14

### LISTING-004.16 – Queued once while it waits

- **Given** a `ReadRawHeaders` job that waits with the same argument
- **When** the same files are met again
- **Then** no second job is queued

### LISTING-004.17 – The job writes the key and drops the summaries

- **Given** a `ReadRawHeaders` job
- **When** it runs
- **Then** each file's metadata is refreshed and the summaries of the folders of the files that
  got the key are dropped, so the next scan counts the RAW-only picture in its burst; a file
  that got no key keeps its folder's summary, a missing file or a folder is skipped, a failed
  refresh is logged and the others still run, and an argument without a user and file ids is
  logged and does nothing

## History

| Date | Change |
|---|---|
| 2026-11-26 | Created with the parser and the listener (ADR 0061, PR 2) |
| 2026-11-26 | The listing and the folder summary read the key (ADR 0061, PR 3) |
| 2026-11-27 | The listing and the library scan backfill files without the key (ADR 0061, PR 4) |
