# Your files and privacy

What honeycomb changes in your files, why you keep a backup, and what it stores about you. Read
this before you use it on photos you cannot replace.

## What honeycomb changes in your files

honeycomb reads your photos and changes files only through Nextcloud's file API, so permissions,
file versions and the trash bin apply.

- **Deleting** moves every file of a rejected picture (JPEG, RAW and sidecars) into the
  Nextcloud trash bin. It needs the trash bin to be on and refuses otherwise. A file the trash bin
  would not keep (a storage without a trash bin, or a file larger than the trash bin size
  `trashbin_size`) is deleted for good only after a warning that names it; cancelled, its picture
  stays ([deleting photos](deleting.md)).
- **Moving** renames and moves the files of a picture into the folder you choose, by a name
  template (see [settings](settings.md#moving-photos)). A picture is moved whole or not at
  all, and the move can be undone. A *Replace* goes to the trash bin; a file it would not keep is
  replaced for good only after a warning that names it. It stays on its storage: honeycomb does
  not move files out of or into a share, a group folder or external storage.
- **XMP sidecars** (`<file>.xmp`) receive your stars, colour labels and tags, and by default the
  flag and *Keep RAW* too, so digiKam, darktable and Lightroom see them. An existing sidecar is
  merged, so what other programs wrote stays, and it is only replaced while Nextcloud's file
  versions are on. When and what honeycomb writes:
  [sidecars and digiKam](sidecars.md). The photos themselves are never modified.
- **Everything else** lives in honeycomb's own tables, not in your files: the master copies of
  the flag and *Keep RAW* (mirrored into the sidecars by default), series, positions, similarity
  and statistics.

## Back up first

honeycomb is pre-release software and moves, trashes and writes files. Keep a backup of photos you
cannot replace before you cull them. The trash bin keeps files only for its retention time
(`trashbin_retention_obligation`) and empties itself sooner when space runs short, so a deleted
photo is not safe there for ever. The [licence](../../LICENSE) excludes any warranty.

## Privacy

honeycomb sends nothing out: no telemetry and no outgoing requests. It stores in the Nextcloud
database:

- flags and *Keep RAW* per picture, one set for everyone who reaches it;
- per user: what honeycomb read from your photos' sidecars and embedded XMP — ratings, colour
  labels, tags, the flag and *Keep RAW* — your tag list, the position where you stopped a cull,
  your series, settings and view state.

For every user who reaches a picture it stores the picture's visual hash and, for a picture in a
series, its sharpness; deleting a user leaves them while the picture exists.

It stores file ids, not file names. The Nextcloud log can contain full file paths when a sidecar
cannot be saved, so remove them before you share a log. Deleting a user deletes their honeycomb
data. There is no per-user export. `occ app:remove` leaves the tables in place; see
[removing](admin/removing.md) to delete them.

Report a security problem privately: [`SECURITY.md`](../../SECURITY.md).
