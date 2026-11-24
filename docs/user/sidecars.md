# Sidecars and digiKam

honeycomb writes your decisions — stars, flag, colour label, *Keep RAW* and tags — into XMP
sidecars next to your photos, where digiKam, darktable and Lightroom read them. The photos
themselves are never changed.

**Changing in the next release** ([ADR 0040](../dev/adr/0040-flags-per-picture-in-the-database.md)).
Stars, colour labels and tags are still written into the sidecars at once, without a setting to turn
on. Flags (pick, reject) and *Keep RAW* are kept by honeycomb itself and, by default, written into
the sidecars too ([ADR 0056](../dev/adr/0056-flags-written-to-xmp-by-default.md)): digiKam sees your
picks at its next scan, and a pick or reject you change in digiKam shows in honeycomb the next time
you open the folder. Turn off *Write picks, rejects and Keep RAW to XMP sidecars* in
[settings](settings.md#xmp-sidecars) to keep them in honeycomb alone; they then reach the sidecars
only when you choose *Write picks/rejects to XMP* in the ⋯ menu, whose entry shows how many sidecars
differ, and a photo honeycomb sees for the first time takes over the flag its sidecars state, once.

## When honeycomb writes

honeycomb writes the sidecars of every photo you may change, without a setting and without asking
first, shared folders and folders without file versions included. In a folder you may only read
nothing can be rated ([shared folders and permissions](shared-folders.md)).

## What honeycomb writes

- **Names.** honeycomb reads `IMG_0001.NEF.xmp` and `IMG_0001.xmp`. It creates only the first
  form, one per file: a pair without sidecars gets `IMG_0001.NEF.xmp` and `IMG_0001.JPG.xmp`.
  darktable's duplicates such as `IMG_0001_01.NEF.xmp` are neither read nor written, but are
  deleted with the photo.
- **Merging.** Only the fields you changed are written; everything else another program stored
  in the sidecar stays. A new sidecar starts from what the photo's other sidecars, and a JPEG's
  embedded XMP, already say.
- **When.** Changes to a photo are saved when you go on to another photo, or two seconds after the
  last change; until then its tile in the grid and the loupe's title row show *Not saved yet*.
  Leaving the page saves at once.
- **Versions.** An existing sidecar is only replaced where its folder keeps file versions, so the
  version before honeycomb's write can be restored in Nextcloud's *Versions* tab.

How each value shows in the other programs: [ratings, flags and colour
labels](ratings-flags-colours.md); tags: [tags](tags.md).

## Set up digiKam

digiKam ignores sidecars by default. Turn on reading and writing of sidecars, keep the
`IMG_0001.NEF.xmp` naming, and let the Nextcloud desktop client sync the folder to the computer
that runs digiKam. The settings step by step: [digiKam
settings](ratings-flags-colours.md#digikam-settings). digiKam sees honeycomb's changes at its next
scan of the folder.

## When a sidecar changes elsewhere

- **While honeycomb writes.** honeycomb checks that a sidecar is still the one it read just before
  it replaces it. If digiKam or a sync changed it in between, honeycomb reads it again, merges your
  change into it and saves once more, without asking. If it changed yet again, the write fails
  with *The sidecar changed again while honeycomb wrote it*.
- **Between two culls.** When you open a folder set, honeycomb takes over the decisions in the
  sidecars of photos it has no decision for yet. For a photo you already decided, honeycomb
  remembers which version of each sidecar it last wrote or read. If digiKam changed the pick,
  reject or *Keep RAW* since, honeycomb takes it over and writes it to the photo's other sidecars;
  if not, it writes its own decision to the sidecars that differ. So when both changed, digiKam's
  wins. With *Write picks, rejects and Keep RAW to XMP sidecars* off, a photo you already decided
  keeps honeycomb's decision and a later change on the desktop does not show in the grid. Photos
  in folders you may only read are left as they are.
- **Before deleting.** Deleting reads each rejected photo's sidecars afresh and leaves a photo
  alone when they no longer say rejected ([deleting photos](deleting.md)).

## When a sidecar cannot be written

A failed write names its reason, for example *Could not write 2 sidecars. You may not change this
sidecar or create files in its folder* (with *More reasons in Details* when they differ);
the change is taken back for that photo, so it shows what its sidecars still hold, and
**Details** lists each file with the reason. Change the photo again to try once more. A pick,
reject or *Keep RAW* is not taken back: honeycomb keeps it and tries the sidecar again the next
time you open the folder. honeycomb
never overwrites a sidecar it cannot read — not
well-formed XML, not UTF-8, larger than 1 MiB — and then leaves that photo unchanged until you
open the folder again. Folders you may only read, and shared folders: [shared
folders](shared-folders.md).

## Clean up orphaned sidecars

When a photo is deleted outside honeycomb, for example on the desktop, its sidecar can stay
behind. Open **Orphaned sidecars** in the navigation to find and remove such sidecars:

1. Choose a folder in the folder tree (its subfolders are always included), or press **Whole
   library**.
2. Press **Find orphaned sidecars**. Nothing changes yet: the page lists every orphaned sidecar
   by folder, with each folder's count and size, each file name and size, and the total above.
3. Check the list, then press **Move N sidecars to trash**. Choosing another folder or finding
   again drops the list without moving anything.
4. The page says how many moved to the trash bin and how many were skipped, and lists each
   skipped sidecar with its reason. Restore a sidecar from the Nextcloud trash bin if you need it
   back.

A sidecar is orphaned when no photo or video it belongs to is **in its own folder**:
`IMG_0001.CR2.xmp` (digiKam, darktable) belongs to `IMG_0001.CR2`, `IMG_0001.xmp` (Lightroom)
belongs to any `IMG_0001.*` photo or video, and a darktable duplicate `IMG_0001_01.CR2.xmp`
belongs to `IMG_0001.CR2`; upper and lower case do not matter. A photo in another folder does not
count, so if you keep RAW files in a subfolder of their own, check the list before you confirm.

A sidecar is skipped rather than moved when, since the list was made, a photo or video it belongs
to arrived in its folder, the sidecar changed or is gone, you may not delete it, or the trash bin
would not keep it; honeycomb never deletes an orphaned sidecar for good. Hidden folders and
folders shared with you, group folders and external storage are not searched.
