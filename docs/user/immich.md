# Culling Immich uploads

honeycomb can cull the photos and videos your phone uploads to Immich, once your Nextcloud admin
has connected it ([connecting Immich](admin/immich.md)). Choose **Immich** in the navigation; with
more than one connection, switch between them there. The grid shows the
connection's uploads newest first and loads more as you scroll.

## A pass over your uploads

1. Choose **Immich**, then a time filter, usually the current month. Narrow it by device or kind.
2. Open a photo in the loupe and decide as for folders: stars, colour labels, Pick and Reject, by
   buttons, gestures or [keys](keyboard-shortcuts.md), with undo and redo.
3. Page on. The grid keeps loading as you scroll, and the loupe goes on past what the grid has
   loaded.
4. Filter by **Flag** to review your Rejects once more before you stop.

Every decision is kept in honeycomb's database, per connection and upload.
honeycomb changes nothing in Immich yet: no rating, favourite, archive or trash bin, and nothing
is deleted.

The grid shows what the connected Immich account's timeline holds. If it lists photos that are not
yours, the account has partner sharing turned on; ask your Nextcloud admin for an account without
it ([connecting Immich](admin/immich.md#use-an-account-without-partner-sharing)).

## Filters

The filter bar above the grid narrows the uploads. Each chip shows how many uploads it would
show under the other filters; the numbers come from the server, so they cover the whole library,
not only what the grid has loaded.

- **Time:** *Last 7 days*, each month with uploads among the current month and the eleven before
  it, and *All phone uploads*. One at a time; the current month is the default.
- **Device:** the camera models that took the uploads, and *No camera data* for uploads without
  one. Tick any number; none ticked shows every device. A device shows only while it has uploads
  under the other filters, or while you have ticked it.
- **Kind:** *Photos*, *Motion photos* and *Videos*. Tick any number; none ticked shows every kind.
- **Flag:** *Picked*, *Unflagged* and *Rejected* in the toolbar, as for folders.

Chips in one group add up, the groups narrow each other: *Videos* with two devices shows the
videos of either device. When nothing passes the filters, the grid says so.

**Clear filters** shows while any filter differs from its default and puts them all back.

A tile's pills, top left, say what the upload is: *LIVE* for a motion photo, ▶ with the length for a
video, and the number of photos in a stack. The grid loads more uploads as you scroll; when a page
fails to load, the grid names why (*Immich unreachable*, for example), keeps the uploads above and
offers **Try again**.

## Deciding and selecting

The grid takes the folder grid's [keys](keyboard-shortcuts.md): the arrow keys move the focus,
`P`, `X`, `U`, `0`–`5` and `6`–`9` decide the focused upload with an *Undo* in the notice, `E` opens
the loupe, and `Ctrl+Z` undoes. A rejected upload leaves the grid at once while the flag filter
hides rejects. `Tab`, `\` and `Ctrl+L` do nothing here: the Immich toolbar and filter
bar always stay shown.

**Select**, a long-press or `Ctrl+A` starts selection mode; the action bar at the bottom then
decides every selected upload in one step that one `Ctrl+Z` undoes. It has no *Keep RAW* and no
tags, since Immich keeps neither. *Select all (loaded)* and `Ctrl+A` take the uploads the grid has
loaded so far, not the whole library. A filter change, `Esc` or **Done** ends selection mode.

## Kept per connection

honeycomb keeps each connection's filters for you on the server, so they are back the next time you
open that connection, on any device. A month you chose stays chosen until it leaves the time options
a year later; the current month follows the calendar, so on the first of a month you see the new
one.
