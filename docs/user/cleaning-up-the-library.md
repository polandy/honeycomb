# Cleaning up the library

*Folders* is honeycomb's start screen. It lists the folders of your library, suggests the ones
worth culling first and shows how far you have come. Marking a folder done is a note for you: it
changes nothing in your files.

## Library roots

The list shows the folders below your **library roots**: folders of your own Nextcloud files that
hold your photos, for example `/Photos`. On the first run honeycomb asks *Where is your library?*:
tick one folder in the tree and press *Add as root*, repeat for more, then press *Show folders*.

- A root cannot lie inside another root or be added twice. Your home folder itself is no root;
  choose a folder in it.
- Once you have roots, the folder pickers of *Open folder*, the similarity scan and the orphaned
  sidecar scan offer only folders inside them; the rest shows *Outside your library roots*.
- Shared folders, group folders and external storage cannot be roots. They are not listed yet.
- Change the roots later in **Settings → Library**: add one the same way, or remove one with
  its ✕ button. Removing a root only takes its folders off the list; it deletes nothing.
- The first time, honeycomb counts the photos of every folder. The strip *Updating n folders*
  shows while it does; the list fills in as it goes.

## Suggested

*Suggested* is the default filter and sort: the folders with undecided photos, the most worthwhile
first. A folder ranks higher with more undecided photos, with photos taken in bursts and with
large (RAW-heavy) files. Each row says why in words, for example *63 % undecided · 18 in bursts ·
4.2 GB · 2019*. A folder where every photo is decided, and not yet done, comes first with *Mark
done* in its row.

The other chips are *New photos* and *All*; *Suggested* and *New photos* sort by *Most undecided*,
*Largest*, *Oldest*, *Newest* or *Name* too. Each chip lists only the folders of the level you see.

## Levels

*Folders* shows one level of your library at a time, starting at your root. The breadcrumb
above the list names the levels above it; tap one to go up. With several roots it starts at
*Library*, where *All* lists the roots. The card on top of a level
counts its photos and offers *Cull this level*.

On *All*, a folder with subfolders opens its level: tap the row or its arrow. The row *Photos
directly in* holds a level's own photos, without its subfolders. A chain of single subfolders
shows as one row, for example *2019 / Trip*.

The switch **Include subfolders**, on by default and kept for you, decides what a row and *Cull
this level* cover: on, a folder counts and culls its subfolders too; off, only its own photos.

*Cull* opens the folders in the grid, at the place you stopped. *Back to folders* in the cull
returns to the same level, which keeps its scroll, filter and sort.

## Mark done and Reopen

Open the ⋯ menu of a folder and choose **Mark done** when you are finished with it. No dialog asks
first; a toast says *Marked … done* with *Undo* for a few seconds. A folder where every photo is
decided offers *Mark done* in its row, and the *Cull finished* card offers it for the folder you
just culled.

A done folder moves out of *Suggested*. **Reopen** in its ⋯ menu takes it back; a toast says
*Reopened …*. A folder you are not allowed to change (a read-only share) offers neither.

A folder with subfolders does it for all of them at once. Its ⋯ menu offers **Mark all done**,
which marks every subfolder you may change and skips the read-only ones; the toast says how many it
marked and skipped, with *Undo*. A subtree where every photo is decided offers *Mark all done* in
its row too. **Reopen all** in the same menu takes every done folder of the subtree back.

The status belongs to the folder, not to you: everyone who may change the folder sees it done.

## New photos

A done folder remembers how many photos it held when you marked it done. When photos arrive later
it shows the badge *n new* and **Cull new** in its row. *Cull new* opens the folder with the filter
*Unflagged*, so you see just the photos you have not decided. Mark the folder done again when you
are through.

## Library progress

The card on top of *Folders* shows the share of your photos that lie in done folders, for the
whole library and, with several roots, for each root. Below it: how many folders are done, how
many you marked done this month, and the share of photos decided, as a cross-check: it can be
higher than the share in done folders while folders are still open. Marking a folder done raises
the number at once.

The same card sits on the [statistics](statistics.md) page, with a link to *Folders*. While you
have no library roots it says *Choose your library*.

## What is never written to a sidecar

Marking a folder done, reopening it and the library roots never write an XMP sidecar, never
touch a photo and move nothing to the trash bin. They live in honeycomb's own tables
([your files and privacy](your-files-and-privacy.md)). A cull writes to the sidecars: stars,
colour labels and tags always, and the flag and *Keep RAW* by default ([sidecars](sidecars.md)).
