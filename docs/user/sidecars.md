# Sidecars and digiKam

honeycomb writes your decisions — stars, flag, colour label, *Keep RAW* and tags — into XMP
sidecars next to your photos, where digiKam, darktable and Lightroom read them. The photos
themselves are never changed.

## Turn writing on

Writing is *Off* until you turn on **Write decisions to XMP sidecars** in the
[settings](settings.md#xmp-sidecars), or confirm *Write to sidecars* at your first rating. While it
is off, nothing can be rated. *On* needs Nextcloud's Versions app, so every write can be undone
from the file's versions; without it the option is greyed out — ask your administrator.

## What honeycomb writes

- **Names.** honeycomb reads `IMG_0001.NEF.xmp` and `IMG_0001.xmp`. It creates only the first
  form, one per file: a pair without sidecars gets `IMG_0001.NEF.xmp` and `IMG_0001.JPG.xmp`.
  darktable's duplicates such as `IMG_0001_01.NEF.xmp` are neither read nor written, but are
  deleted with the photo.
- **Merging.** Only the fields you changed are written; everything else another program stored
  in the sidecar stays. A new sidecar starts from what the photo's other sidecars, and a JPEG's
  embedded XMP, already say.
- **When.** Changes to a photo are saved when you go on to another photo, or two seconds after the
  last change; until then its tile shows *Not saved yet*. Leaving the page saves at once.
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
  sidecars of photos it has no decision for yet. A photo you already decided in honeycomb keeps
  honeycomb's decision; a later change on the desktop does not show in the grid.
- **Before deleting.** Deleting reads each rejected photo's sidecars afresh and leaves a photo
  alone when they no longer say rejected ([deleting photos](deleting.md)).

## When a sidecar cannot be written

A failed write names its reason, for example *Could not write 2 sidecars. You may not change this
sidecar or create files in its folder* (with *More reasons in Details* when they differ);
**Details** lists each file with the reason and
**Retry failed sidecars** tries again. honeycomb never overwrites a sidecar it cannot read — not
well-formed XML, not UTF-8, larger than 1 MiB — and then leaves that photo unchanged until you
open the folder again. Folders you may only read, and shared folders: [shared
folders](shared-folders.md).
