# Deleting photos

Every photo you delete goes to the Nextcloud trash bin, with all its files (JPEG, RAW and their
sidecars), where you can restore it until the trash bin empties itself. Keep a backup all the same.
honeycomb deletes a file for good only after you confirm a warning that names it (see
[Files the trash bin would not keep](#files-the-trash-bin-would-not-keep)).

A photo restored from the trash bin comes back without a decision of its own. With *Write picks,
rejects and Keep RAW to XMP sidecars* on (the default), its restored sidecar still states its pick
or reject, so honeycomb takes it over again the next time it sees the photo; with the setting off,
or when the flag was never written to a sidecar, it comes back without its pick or reject.

## Delete every rejected photo

Reject the photos you do not want (`X`), then open the ⋯ menu and choose **Review rejects**, or
press `Ctrl+Backspace` (`⌘+Backspace` on a Mac). From 900 px window width the toolbar has the same
command as a trash icon with the number of rejects. It works like Lightroom's *Delete Rejected
Photos* and takes every rejected photo of the folders you cull, even the ones the filter hides.

1. The review shows every rejected photo. Tap one to rescue it: it is no longer rejected.
2. **Continue** opens the summary: how many photos and files go, from which folders, and the list
   of every file.
3. **Move … files to trash** sends them. Before that honeycomb lists the folders afresh, and the
   server moves a photo, as a whole or not at all, only while it is still rejected there. A photo
   someone picked in between stays, and the report says *No longer rejected*. When a folder cannot
   be listed just then, nothing of it is deleted and the report lists its photos as skipped; when
   the request fails, nothing is deleted and the toast says so.
   While it runs, the button
   reads *Checking the photos…*, then *Moving to trash…*, and the footer counts the photos sent.
   Each file takes the server a moment, so a large delete takes a while; the toast says how many
   photos moved, and the report lists every file that could not move, with the reason.

## Files the trash bin would not keep

A storage without a trash bin (for example some external storages), or a file larger than the
trash bin allows (`trashbin_size`, by default the free quota left), cannot go to the trash bin.
Instead of the report, a warning opens first: *N files will be deleted permanently*, each file
with its reason. The focus is on **Cancel**: it sends nothing more, the files stay and the
report lists them with the same reasons.
No key confirms the warning: `Enter` acts on the focused **Cancel**.
**Delete permanently** deletes them for good, with the other files of their photos; they cannot be
restored. The toast then also counts the files deleted permanently. Team folders have their own
trash bin and keep every file.

## Delete the photos you choose

Select photos and choose **Delete…** in the action bar, or press `Delete` on the focused photo or
in the loupe. The same summary opens, without the review.
