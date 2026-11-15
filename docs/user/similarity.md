# Similarity

honeycomb groups photos taken one after another into **series** when they look alike. To tell, it
needs the similarity of every photo, which the grid computes while you cull. For a large folder you
can compute it ahead of the cull, once, so series show at once on every device.

## Compute the similarity of a folder

1. Open **Similarity** in the navigation.
2. Choose a folder. Its subfolders are always included.
3. Press **Start**. The page shows how many photos it found, how many are done, how many failed and
   how many are left. *Found* ends in `+` while the page is still looking for more.

Only your own photos count: shared folders, group folders and external storage are skipped. Photos
whose similarity is already known are skipped too, so a second run is quick.

## Pause, resume and failures

- **Pause** stops handing out photos; the page finishes the ones in work and saves them first.
  **Resume** goes on.
- If you close the page, start again on the same folder: only the photos still missing are done.
- If saving or loading fails, the run pauses and says so. **Resume** tries again.
- A photo that cannot be compared, for example because it has no preview, is listed under
  *Photos that could not be compared* and is not tried again in this run.

## Correct a series

In the grid, press **Select**, select photos and open **Series…** in the action bar. Its heading
says how many of the selected photos are in a series. Then choose:

- **New series from n photos** makes one series of the selection, taking the photos out of their
  series.
- **Add n photos to series ⧉ k** adds the selected photos outside the series to the one series the
  selection touches.
- **Merge k series · m photos**, offered when the selection touches two series or more, makes one
  series of their whole series and the other selected photos.
- **Remove n photos from their series** takes the photos out; they are never grouped
  automatically again.

An entry that does not fit the selection is greyed out and says why. Every change shows a message
with **Undo**, and a series you changed stays as you made it.
