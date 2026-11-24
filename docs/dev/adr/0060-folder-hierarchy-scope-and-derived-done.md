# 0060 – Folder hierarchy, scope and a derived done

- Status: accepted
- Date: 2026-11-25
- Amends: [0049](0049-folders-to-cull-done-status-and-library-progress.md)
- Builds on: [0006](0006-thin-php-backend-logic-in-typescript.md),
  [0031](0031-access-check-and-rate-limit-on-every-write.md),
  [0051](0051-settings-lists-in-their-own-keys.md),
  [0058](0058-picture-source-adapter.md)

## Context

*Folders* (ADR 0049) lists every folder flat, each with its own photos. `2024/Iceland` has no
photos of its own, so it is not in the list, and its three day folders stand apart. *Cull with
subfolders* hides in the ⋯ menu, only on folders with photos of their own. The numbers and the done
status of a trip as a whole are nowhere.

The owner wants to walk the hierarchy as the library root picker does, choose the level to cull
on, and choose whether the subfolders belong to it. The concept (2026-11-25) offered three
variants; the owner decided the same day. The look is the mockup
[`mockup/folders/hierarchy.html`](../mockup/folders/hierarchy.html), signed off with this ADR
(ADR 0003) and the UX spec of the pull requests below.

## Decision

### Variant A: a drill-down with a breadcrumb

- **A level** is a path below a library root. The top level is the *Library* with the roots; with
  one root the view starts inside it. A tap on a row with › goes one level deeper; the breadcrumb
  goes back up and never above a root.
- **The tree is built in the client** from the rows `GET /library/folders` already returns (`root`
  and `path`), in a pure module `src/logic/folder-hierarchy.ts` (ADR 0006). A folder without photos
  of its own shows as a level when photos lie below it. A folder without photos in its whole subtree
  is not shown, and nothing says it is hidden.
- **Chains.** Folders without photos of their own that have exactly one subfolder with photos shown
  as one row (*Archive / Analog / Scans 1998*). A breadcrumb of more than 4 levels shows the first,
  "…" and the last two; "…" opens the levels in between.
- **Filters** *Suggested* and *New photos* stay flat inside the level: one row per folder below
  it, with that folder's own photos, ranked as today (ADR 0049). *All* lists the direct subfolders.
  At the top level everything is as before.
- **Other variants.** The expandable tree (B) and Miller columns (C) were not taken, see *Options
  considered*. The folder picker stays for folder sets of several paths; the new start point does
  not replace it. Decide again once the drill-down has shipped.

### The scope: *Include subfolders*

- **A switch** *Include subfolders* in the header of the view, **on by default** and **saved per
  user** with the other view state (setting `foldersIncludeSubfolders` in the settings object, ADR
  0014 and 0051). It applies to the whole view.
- **On:** the numbers, bars and previews of a row, and its *Cull*, cover the whole subtree: a
  folder set `{paths: [path], subfolders: true}`. **Off:** the folder's own photos only, as
  today, `subfolders: false`. Each combination keeps its own resume position (ADR 0049).
- **Counting** is the sum of the folder summaries below the level, in the client. A RAW+JPEG pair
  is one photo in its folder's summary and lies in exactly one folder, so a sum counts it once.
- **The level card** above the rows names the level, its photos with and without subfolders and
  *Cull this level*. A folder with photos of its own and subfolders also gets a grey row *Photos
  directly in ⟨folder⟩*, whatever the switch says; it culls only those and shows the folder's own
  status.
- **Back from a cull** (*Back to folders*) restores level, switch, filter, sort and scroll.

### Done stays per folder; the parent's state is derived

- **No new stored status.** `honeycomb_folder_done` keeps one row per folder. A stored "subtree
  done" would sit beside the status of the folders in it, leave open whether *Day 4–7* is done when
  only *Iceland* was marked, count photos twice in the progress headline and need a flip when a
  folder arrives (the rule ADR 0049 rejected).
- **The parent row's line** is derived: *Done · all n folders* when every rateable folder with
  photos in the subtree is done, else *k of n folders done*. A *complete* subtree (no undecided
  photo) with a rateable folder not done reads *Complete · n folders not marked done* and offers
  *Mark all done*.
- **Read-only folders** count in the sums and show in the cull, but not in k and n and not as
  open for the parent's state: they cannot be marked.
- **New photos.** A parent's *n new* is the sum of the *n new* of the done folders below it; *Cull
  new* opens it with subfolders and the flag filter *Unflagged* only.
- **A new folder.** An empty new subfolder changes nothing; one with photos turns *k of n* into
  *k of n+1* until it is marked.
- **The progress headline** is unchanged: photos in done folders over all photos below the roots.

### *Mark all done* and *Reopen all*

- **Mark all done** marks every rateable folder with photos in the subtree that is not done, in one
  call. Read-only folders are skipped and named in the toast. The row offers it only when
  everything below is decided; the ⋯ menu offers it on every level, also with open photos, as it
  does for a single folder. A toast says "Marked n folders done · Undo".
- **Reopen all** (⋯ menu) reopens every done folder in the subtree without a question; the toast
  offers *Undo*.
- **Statistics:** the daily counter `folders_done` counts each folder of a batch (ADR 0039).

### Endpoints

```text
PUT    /apps/honeycomb/api/v1/library/done  { folders: [{ fileId, photos }] }
       → { done: [row...], skipped: [{ fileId, reason }] }
DELETE /apps/honeycomb/api/v1/library/done  { fileIds: [...] }  → 204   (undo, reopen all)
```

- **One write boundary per call** (ADR 0031): the access check and the rate limit once, every
  folder rechecked against the user's folder and the library roots. At most 500 folders per call,
  more is `400` with reason `too-many` (ADR 0057). All rows are written in one transaction.
- **`skipped`** names a folder that is not rateable (`read-only`) or already done (`done`); a
  folder that is no folder of the user's own files answers `404`, one that is not readable `403`,
  for the whole call, nothing written.
- **Not changed:** `PUT` and `DELETE /library/folders/{fileId}/done` of ADR 0049 stay for one
  folder.

### No new table, no migration

`honeycomb_folder_done` and `honeycomb_folder_summary` stay as they are. The view state is a
setting.

### Edge cases

- A subtree with very many photos (a root with 60,000) loads its whole list in the client (ADR
  0058 folder adapter). Above a threshold the level card warns that loading takes a while; nothing
  is forbidden.
- Summaries still being scanned are summed as stored; *Updating n folders* applies per root as
  before.
- A renamed or moved folder keeps its file id and its done status; the tree is rebuilt from the
  paths on the next read.
- Shares, group folders, external storage and hidden folders are not listed, as before (phase 2).

## Options considered

- **B – an expandable tree like the root picker.** Both numbers are always visible, but the rich
  row (bar, reason, preview, *n new*) does not fit an indented row (about 200 px left at depth
  5 on a phone), and ranking has no place in a tree.
- **C – Miller columns.** Fast on a landscape iPad and desktop, but a phone needs a second
  presentation, and `@nextcloud/vue` has no such component.
- **A stored done status per subtree.** Rejected for the reasons above.
- **A server-built tree.** Needs a new field and gains nothing; the client already reads every
  row.

## Consequences

- The hierarchy, sums, chains, breadcrumb shortening and derived state are one pure module with
  full Vitest coverage; PHP gains only the batch endpoints.
- Every combination of path and switch is a folder set with its own resume position and shows
  under *Recent*.
- Previews of a subtree row come from its whole subtree; whether the previews endpoint takes
  `subfolders` or the client picks the largest subfolders is decided with that pull request.
- FOLDERS-009 specifies the screen; FOLDERS-006 and FOLDERS-008 gain the batch rules with the
  pull request that builds them.

## Owner decisions

2026-11-25, on the concept's open questions: (1) variant A; (2) switch on by default and saved per
user; (3) filters flat inside the level; (4) a read-only folder does not count for the parent's
state; (5) *Mark all done* also for a subtree with open photos through ⋯, the row's button only
when everything is decided; (6) folders without photos not mentioned; (7) chains collapsed; (8) the
folder picker stays.
