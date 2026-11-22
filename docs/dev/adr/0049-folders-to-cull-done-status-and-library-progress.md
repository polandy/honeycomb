# 0049 – Folders to cull: summaries, the done status and the library progress

- Status: accepted
- Date: 2026-11-22
- Builds on: [0006](0006-thin-php-backend-logic-in-typescript.md), [0021](0021-series-by-capture-time-and-visual-hash.md),
  [0025](0025-missing-visual-hashes-by-path-cursor.md), [0031](0031-access-check-and-rate-limit-on-every-write.md),
  [0039](0039-statistics-as-daily-counters.md), [0040](0040-flags-per-picture-in-the-database.md)

## Context

The owner wants honeycomb to show **which folders are worth culling**, to mark a folder they have
been through as **done**, and to see the whole library get clean step by step, with visible
progress. Today the app opens on *No folder chosen*; the folder picker and *Recent* are the only
guide. No folder status exists anywhere: not in the database, not in XMP, not in digiKam. The
only progress is `decided / total` per folder set on the resume position, which the statistics
page lists as *Folder sets*.

The concept (2026-11-22) offered options for each question; the owner decided them the same day.
The look is the mockup [`mockup/folders/index.html`](../mockup/folders/index.html), the UX spec
of every pull request below.

## Decision

### Library roots

- **Required, one or more.** A user lists and counts folders only below their **library roots**,
  folders of their own home storage. There is no default to the whole home folder; at least one
  root must exist, and no root may lie inside another (the server refuses a nested or duplicate
  root with `400`).
- **First run:** while a user has no root, *Folders* shows the root picker (*Where is your
  library?*) instead of the list. *Settings* edits the roots later. Stored as a user setting.
- **Per root and in total:** the list groups its rows by root, a chip row chooses one root or *All
  roots*, and the progress shows the total and one bar per root.
- Shares, group folders and external storage stay out, as in the walker of ADR 0025: phase 2.

### Folder summaries, cached on the server (S2)

- **Counted in PHP, judged in TypeScript** (ADR 0006). PHP counts per folder, its own photos
  without subfolders: photos, bytes and RAW bytes, picked, rejected, undecided (unflagged and not
  in a done series), bursts, the oldest and newest capture time and the last activity. A burst
  photo is one taken at most 3 s after its predecessor, the series rule's constant (ADR 0021);
  a PHPUnit and a Vitest test check the same value.
- **Table `honeycomb_folder_summary`:** `file_id` of the folder (unique), `etag`, `photos`,
  `bytes`, `raw_bytes`, `picked`, `rejected`, `undecided`, `bursts`, `oldest`, `newest`,
  `last_activity`, `dirty`, `scanned_at`. A `FileRowStore`, and throw-away data: a migration may
  empty it, the next scan rebuilds it (ADR 0040).
- **Fresh by etag and dirty:** a folder's etag changes when its content changes, so photos, bytes,
  bursts and ages follow it. Flags do not change the etag: every flag, series and delete write
  marks the parent folders of its files *dirty*. Opening *Folders* reads all rows in one query
  and rescans, by the path cursor of ADR 0025, the folders whose etag differs or that are dirty,
  at most a fixed number per request; the list shows *Updating n folders*. The daily background
  job that sweeps the `FileRowStore`s refreshes every row, so new folders appear unvisited.
- Unrated photos, near duplicates and soft photos are not counted: they exist only where a folder
  was visited, so they cannot rank.

### Ranking (A)

- **Default sort *Suggested*,** a score in the pure module `src/logic/folder-score.ts`:
  `undecided × (1 + 2 × bursts / photos) × (1 + min(1, bytes per photo / 25 MB))`. Undecided
  photos count linearly, bursts up to ×3, RAW-heavy folders up to ×2. The weights are constants,
  calibrated like the 5 % of the sharpest mark, never a setting.
- **No age in the score.** Age is a sort of its own, so the user chooses between culling by gain
  and culling chronologically.
- **Explicit sorts:** *Suggested*, *Most undecided*, *Largest*, *Oldest*, *Newest*, *Name*;
  *Oldest* and *Newest* add sticky year headings.
- Each row shows its reason as text ("63 % undecided · 18 in bursts · 4.2 GB · 2019"), never the
  score. A folder with no undecided photo that is not done leads *Suggested* as *Complete · not
  marked done* with *Mark done*. A folder without UPDATE is never suggested.

### The done status

- **A user's statement, not a derived value.** *Complete* (no undecided photo) is derived and
  shown; *done* is what the user marked.
- **Shared per folder,** like the flags (ADR 0040): one status per folder, with the user who
  marked it shown as *done by*. Not per user.
- **Table `honeycomb_folder_done`:** `file_id` of the folder (unique), `user_id` (done by),
  `done_at` from the injected clock, `photos` at that moment. A `FileRowStore`: a rename or move
  keeps the file id and the status, the daily sweep drops the rows of folders deleted for good.
- **Needs UPDATE,** like flagging: a folder whose permissions lack UPDATE shows *Read-only* and
  offers neither *Mark done* nor *Reopen*; the server answers `403`.
- **New photos (N1):** a done folder stays done when undecided photos arrive. Its row shows the
  badge *n new* and *Cull new*, which opens it with the flag filter *Unflagged*; the filter chip
  *New photos* collects these folders. Nothing reverts by itself.
- **Mark done asks nothing.** No dialog: the folder is marked at once and a toast says "Marked
  ⟨folder⟩ done · Undo" for about 8 s; *Undo* reopens it. The user can **dismiss the toast** by its
  close button or by swiping it away; it does not only time out. *Reopen* in the row's ⋯ menu
  works at any time, without confirmation: it is a status, no file changes.
- **Never writes XMP.** Marking done writes no sidecar and offers no XMP option; *Write
  picks/rejects to XMP* stays the separate toolbar action. digiKam has no album status to map to.
- **Where:** the row (*Mark done* for a complete folder, the ⋯ menu for every rateable one) and
  the *Cull finished* card (*Mark folder done*, when the folder set is one folder). The undo
  history of the cull is untouched.
- **Statistics:** the daily counter `folders_done` (ADR 0039) counts each mark; a reopen
  subtracts nothing, as an unflag does not subtract from `pictures_decided`.

### Endpoints

```text
GET    /apps/honeycomb/api/v1/folders?root=<path>&after=<path>&limit=200
       → { folders: [...], next, scanning: { done, total } | null }
PUT    /apps/honeycomb/api/v1/folders/{fileId}/done  { photos }  → the row
DELETE /apps/honeycomb/api/v1/folders/{fileId}/done              → 204   (undo, reopen)
```

Each row: `fileId`, `root`, `path`, `photos`, `bytes`, `rawBytes`, `picked`, `rejected`,
`undecided`, `bursts`, `oldest`, `newest`, `lastActivity`, `permissions`, `done: { by, at, photos }
| null`. Every path is rechecked against the user's folder and roots; the writes take the rate
limit of ADR 0031. Immich albums are not folders in phase 1 (ADR 0041).

### Library progress (P1)

- **Headline: photos in done folders / all photos below the roots,** in total and per root. It
  grows visibly with every *Mark done*.
- Below it: folders done of all folders, done this month, and the share of decided photos as an
  honest cross-check.
- **Statistics:** the *Folder sets* panel is replaced by this headline with a link to *Folders*.

### Navigation (V1)

- ***Folders* is the new start screen** in the app shell, a sibling of the grid, not a page of
  its own: the list stays mounted, so its scroll, filter and sort survive a cull. *Cull* opens the
  folder set `{paths: [path], subfolders: false}` at its resume position, as *Recent* does, and
  the grid's toolbar gets *Back* to the list. The navigation lists *Folders* first; the folder
  picker and *Recent* stay.
- **UI words** (glossary): *Folders*, *Mark done*, *Reopen*, *Suggested*, *New photos*, *Library*.

## Options not taken

- Ranking by explicit sorts only (B): bursts and bytes, the difference between much work and much
  gain, would be lost. A learned weighting (C): too little data, not explainable.
- A scan on every opening without storage (S1): about 5 s for 300,000 photos, each time. The
  browser computing everything from the listing (S3): about 18 MB of JSON for 60,000 photos.
- A done folder reverting to open (N2): one late phone photo would pull a 2,000-photo folder out
  of done and make the statistics count backwards. Asking on the next opening (N3): a dialog for
  what a badge says.
- The done status per user: contradicts the shared flags.
- A Nextcloud system tag or a marker file as the done status: instance-wide without who and when,
  or files in every folder and sync client.
- A confirmation dialog or an XMP checkbox on *Mark done*: a status needs no dialog, and XMP has
  its own action.
- The whole home folder as the default library: document folders with two scans would fill the
  list.
- A page of its own (V2): a full reload on every jump loses the list's state and the hash
  workers' queue.

## Consequences

- Two new tables, both `FileRowStore`s in the daily sweep.
- Flag, series and delete writes mark folders dirty, one more write per affected folder.
- The first visit of *Folders* scans the roots once, about 1 s per 60,000 photos on SQLite and
  more on MySQL and PostgreSQL; later visits rescan only changed folders.
- Bursts are a proxy from capture times; photos without a capture time never count as a burst.
- The pull request that adds *Folders* to the shell touches `App.vue` and the grid toolbar.
