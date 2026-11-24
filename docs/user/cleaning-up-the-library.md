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

The other chips and sorts are *New photos* and *All*, and *Most undecided*, *Largest*, *Oldest*,
*Newest* and *Name*. With several roots, a chip row picks one root or *All roots*.

*Cull* opens a folder in the grid, at the place you stopped. *Back to folders* in the cull
returns to the list, which keeps its scroll, filter and sort.

## Mark done and Reopen

Open the ⋯ menu of a folder and choose **Mark done** when you are finished with it. No dialog asks
first; a toast says *Marked … done* with *Undo* for a few seconds. A folder where every photo is
decided offers *Mark done* in its row, and the *Cull finished* card offers it for the folder you
just culled.

A done folder moves out of *Suggested*. **Reopen** in its ⋯ menu takes it back; a toast says
*Reopened …*. A folder you are not allowed to change (a read-only share) offers neither.

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
