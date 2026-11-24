# Culling Immich uploads

honeycomb can cull the photos and videos your phone uploads to Immich, once your Nextcloud admin
has connected it ([connecting Immich](admin/immich.md)). Choose **Immich** in the navigation; with
more than one connection, switch between them there. The grid shows the
connection's uploads newest first and loads more as you scroll.

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

## Kept per connection

honeycomb keeps each connection's filters for you on the server, so they are back the next time you
open that connection, on any device. A month you chose stays chosen until it leaves the time options
a year later; the current month follows the calendar, so on the first of a month you see the new
one.
