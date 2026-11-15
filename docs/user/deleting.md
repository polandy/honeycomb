# Deleting photos

honeycomb never deletes a file for good: every photo you delete goes to the Nextcloud trash bin,
with all its files (JPEG, RAW and their sidecars), where you can restore it until the trash bin
empties itself. Keep a backup all the same.

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
   changed on the desktop in between stays, and the report says why.

## Delete the photos you choose

Select photos and choose **Delete…** in the action bar, or press `Delete` on the focused photo or
in the loupe. The same summary opens, without the review.
