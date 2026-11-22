# Statistics

honeycomb counts what you do per day: photos decided, moved to the trash bin or deleted for good,
sidecars written, series done, and your active time. It keeps no file names and nothing leaves
your Nextcloud ([ADR 0039](../dev/adr/0039-statistics-as-daily-counters.md)).

## Open the statistics

Open **Statistics** in the navigation, or press **Statistics** on the *Cull finished* card.
**Back to the cull** returns to the grid.

## What the page shows

- **Period:** *7 days*, *30 days* (shown first), the current year or *All time*. Each period ends
  today, in the time zone of your Nextcloud account.
- **Tiles:** *Photos decided*, with the change against the same number of days before; *Moved to
  the trash bin*, with the size and how many were deleted for good; *Sidecars created / updated*;
  and *Days in a row*, the days you culled without a gap up to today or yesterday, with your
  longest run.
- **A line below:** your active time, the photos a minute, the series done and the RAW files
  removed, each once there is one.
- **Bars:** the photos decided and moved to the trash bin per day (7 days), per week (30 days) or
  per month (year, all time).
- **Library progress:** the share of your photos in done folders, for the library and each root,
  with the folders done, those marked done this month and the share of photos decided; *Open
  Folders* leads to the list ([cleaning up the library](cleaning-up-the-library.md)).
- **Of the pictures read so far:** the shares picked, rejected, unflagged and rated among the
  pictures whose XMP honeycomb has read. A folder you have not opened yet is not in it, whichever
  program set its flags.
- **Counted since:** the first day honeycomb counted, and how many series were already done before
  that (*Before that: 12 series done*). Decided pictures have no such number: honeycomb counts them
  from the first day on. The space of photos in the trash bin is freed
  when the trash bin is emptied.

## Year in review

In December and January the page opens with your year: the photos decided, the photos moved to the
trash bin and their size, the RAW files removed, the sidecars created and updated (and how many
came from digiKam or darktable), the series done, the longest streak and the busiest day. Below
them, a calendar shades every active day. From 1 December a hint in the navigation of the cull page
points to it, once per year: close it, or open the year in review, and it stays away until the next
December.

## Switch it off or reset it

Both sit in the *Statistics* section of the [settings](settings.md). With *Keep statistics* off,
honeycomb counts nothing new; the page still shows what it counted before and says so. *Reset
statistics* removes every counter, and counting starts again today.
