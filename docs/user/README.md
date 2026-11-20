# Using honeycomb

For people who cull their photos with honeycomb, on the desktop or a tablet. A first look: the
[README](../../README.md); what it changes in your files: [your files and
privacy](your-files-and-privacy.md).

## What honeycomb does

- **One picture, two files.** A RAW and a JPEG with the same name, ignoring case, are one picture.
  Pictures without a partner are marked as singles and can be hidden.
- **Folders.** Open one or several folders, with or without their subfolders. RAWs and JPEGs may
  sit in the same folder or in separate subfolders.
- **Grid.** Thumbnails of 2,000+ pictures without stalls, sorted by name or capture time, with a
  progress bar and filters for stars, colour labels, flags and singles.
- **Loupe.** Full-screen view for one picture: swipe or tap the photo's edges to page, pinch to
  zoom, 100 % view, and a view without chrome.
- **Deciding.** Stars, colour labels, Pick and Reject by large buttons, by swipe gestures or by
  [keys](keyboard-shortcuts.md), with undo and redo. Decisions are stored on the server per user,
  so a cull stops on one device and goes on at the same place on another.
- **Selection.** Select many pictures in the grid and rate, label or flag them in one step.
- **Deleting.** Review the rejects once more, rescue single pictures, then move every file of the
  rejected pictures (JPEG, RAW and sidecars) into the Nextcloud trash bin after a summary.
  Anything deleted can be restored from there; a partial failure is reported per file.
- **Remove RAWs.** Free the space of the RAWs you do not keep and leave the JPEGs and decisions.
- **Settings.** Per user: file types, folder layout, singles, gestures, flag buttons, vi keys and
  auto-advance ([settings](settings.md)).
- **Similarity.** Compute the similarity of a whole folder tree ahead of the cull, so series show
  at once ([similarity](similarity.md)).

The words the app uses (Pick, Reject, Unflag, series and more) are in the
[glossary](../dev/04-glossary.md).

## Pages

| Page | Contents |
|---|---|
| [Your files and privacy](your-files-and-privacy.md) | What honeycomb changes in your files, backups, what it stores |
| [Culling a shoot](culling.md) | One pass from start to end: folders, grid, loupe, series, deleting, moving |
| [Choosing folders](choosing-folders.md) | The folder tree: expanding, ticking several folders, subfolders |
| [Keyboard shortcuts](keyboard-shortcuts.md) | Every key in the grid, the loupe and the series compare |
| [Ratings, flags and colour labels](ratings-flags-colours.md) | How digiKam, darktable and Lightroom show honeycomb's decisions |
| [Deleting photos](deleting.md) | Deleting every rejected photo, or the ones you choose |
| [Sidecars and digiKam](sidecars.md) | What honeycomb writes into XMP sidecars, setting up digiKam, changes made elsewhere |
| [Shared folders and permissions](shared-folders.md) | Read-only folders, shared folders, the trash bin and moves across storages |
| [Tags](tags.md) | Adding, filtering and saving tags |
| [Settings](settings.md) | The per-user settings and what each one does |
| [Similarity](similarity.md) | How similar pictures are grouped into series |
| [Statistics](statistics.md) | The statistics page: periods, tiles, bars, folder sets, switching it off |
| [Clearing the cache](cache.md) | For admins: `occ honeycomb:cache:clear` for one user or every user |
| [Administering honeycomb](admin/README.md) | For Nextcloud admins: installing, updating, removing |
