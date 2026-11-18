# Deleting photos

Every photo you delete goes to the Nextcloud trash bin, with all its files (JPEG, RAW and their
sidecars), where you can restore it until the trash bin empties itself. Keep a backup all the same.
honeycomb deletes a file for good only after you confirm a warning that names it (see
[Files the trash bin would not keep](#files-the-trash-bin-would-not-keep)).

## Delete every rejected photo

Reject the photos you do not want (`X`), then open the ⋯ menu and choose **Review rejects**, or
press `Ctrl+Backspace` (`⌘+Backspace` on a Mac). From 900 px window width the toolbar has the same
command as a trash icon with the number of rejects. It works like Lightroom's *Delete Rejected
Photos* and takes every rejected photo of the folders you cull, even the ones the filter hides.

1. The review shows every rejected photo. Tap one to rescue it: it is no longer rejected.
2. **Continue** opens the summary: how many photos and files go, from which folders, and the list
   of every file.
3. **Move … files to trash** sends them. Before that honeycomb reads each photo's sidecars afresh;
   a photo goes only when they still say rejected, and as a whole or not at all. A photo someone
   changed on the desktop in between stays, and the report says why. When a folder or its
   sidecars cannot be read just then, honeycomb first asks *Fresh check not possible for N photos*:
   **Cancel** deletes nothing, not even the photos it could check; **Delete anyway** sends them as
   honeycomb knows them, and a file changed since the folder was listed still stays.
   While it runs, the button
   reads *Checking the photos…*, then *Moving to trash…*, and the footer counts the photos sent.
   Each file takes the server a moment, so a large delete takes a while; the toast says how many
   photos moved, and the report lists every file that could not move, with the reason.

## Files the trash bin would not keep

A storage without a trash bin (for example some external storages), or a file larger than the
trash bin allows (`trashbin_size`), cannot go to the trash bin. Instead of the report, a warning
opens first: *N files will be deleted permanently*, each file with its reason. The focus is on
**Cancel**: it sends nothing more, the files stay and the report lists them with the same reasons.
No key confirms the warning: `Enter` acts on the focused **Cancel**.
**Delete permanently** deletes them for good, with the other files of their photos; they cannot be
restored. The toast then also counts the files deleted permanently. Team folders have their own
trash bin and keep every file.

## Delete the photos you choose

Select photos and choose **Delete…** in the action bar, or press `Delete` on the focused photo or
in the loupe. The same summary opens, without the review.
