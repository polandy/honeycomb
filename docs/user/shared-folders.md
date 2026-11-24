# Shared folders and permissions

honeycomb acts with your Nextcloud permissions only: what you may not change in the Files app,
honeycomb does not change either.

A photo is *rateable* when you may change its folder (Nextcloud's *Edit* right, which brings
*Create*), else *read only*: it shows a lock and its flag, stars, colour label, *Keep RAW* and tags
cannot be changed. Flags and *Keep RAW* are one set per photo for everyone who reaches it: what one
user picks or rejects, the others see, and whoever deletes the rejects deletes them for all.

## What counts as shared

A folder shared with you, a group or Team folder, external storage that other users also mount or
that has shares, and your own folder once you share it with other users, by link, by mail or with
another server.

## Writing sidecars

- **Shared folders.** Everyone who shares the folder sees your decisions in its sidecars;
  honeycomb writes them there without asking.
- **Folders you may only read.** honeycomb never writes a sidecar there, and nothing can be rated:
  *Not changed: read only*. The loupe's info panel says *Not written, read-only folder*.
- **Folders without versions.** External storage keeps no file versions; honeycomb writes its
  sidecars all the same.
- **A full storage.** When the storage or the quota of the folder's owner is full, the sidecar is
  not written: *not saved: no storage space left*.
- **A selection with some of these photos.** A step over several photos changes the rateable ones
  and leaves the rest: *Rejected 3 photos; 2 photos not changed: read only*. **Details** names
  each photo left, and **Undo** takes the whole step back.

## Deleting

Deleted files go to the Nextcloud trash bin; a file it would not keep goes for good only after a
warning. Before anything goes, honeycomb checks
every file of a photo: you must be allowed to delete it, it must not have changed since the folder
was listed, and the trash bin must keep it. A storage without a trash bin, or a file larger than
the trash bin allows, keeps the whole photo unless you confirm the warning to delete those files
permanently ([Deleting photos](deleting.md#files-the-trash-bin-would-not-keep)); otherwise the
report says why per file. Team folders have
their own trash bin.

## Moving

A move stays on the storage the photo is on: honeycomb does not move files out of or into a folder
shared with you, a group folder or external storage. Such a photo stays where it is with *Not
moved: the target is outside the shared folder or storage the file is on*.

## Similarity

Computing the similarity of a folder ahead of the cull ([similarity](similarity.md)) takes only
your own photos and skips shared folders, group folders and external storage.
