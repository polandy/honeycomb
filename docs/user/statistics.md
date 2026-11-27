# Statistics

honeycomb counts what you do per day: photos decided, moved to the trash bin or deleted for good,
sidecars written, series done, and your active time. It keeps no file names and nothing leaves
your Nextcloud.

## Open the statistics

Open **Statistics** in the navigation, or press **Statistics** on the *Cull finished* card.
**Back to the cull** returns to the grid.

## What the page shows

- **Period:** *Week*, *Month* (shown first), *Year* or *All time*. A week starts on the first day
  of the week of your Nextcloud locale. *Previous period*, *Next period* and *Today* step through
  the periods, never past today nor before the first counted day. Today is the day in the time
  zone of your Nextcloud account.
- **Photos decided:** the big number of the period, with the change against the period before
  in words, e.g. *▲ 12 % more than October* (in the current period, up to the same day), a bar of
  the picked (✓, filled) against the rejected (✕, hatched), and below it the photos picked,
  rejected and decided per active day and the active days. On a wide screen it stands beside the
  chart, as tall as it; on a narrower one it is a band above the chart.
- **Tiles:** *Space freed*, the size moved to the trash bin, deleted for good and of the RAW files
  removed; *Keep rate*, the picked among the picked and rejected (*—* when nothing was decided);
  *Active time*, with the photos a minute from one active minute on; and *Days in a row*, the days
  you culled without a gap up to today or yesterday, with your longest run (in a past period, the
  longest run inside it).
- **Clean-up**, beside the activity calendar: the space freed in all, a bar and a row for what it
  is made of (moved to the trash bin, deleted for good, RAW files removed), each with its size.
- **Work done**, beside the library progress: the sidecars created and updated (and how many came
  from digiKam or darktable), the ratings, colour labels and tags set, the series and folders
  done and the pictures moved. A row at zero is left out.
- **Chart:** one bar per day (week, month), per month (year) or per year (all time), in a card.
  *Chart shows*, at its top right, picks *Decided* (picked ✓ filled under rejected ✕ hatched),
  *Space freed* (trash bin filled, deleted for good hatched, RAW files removed dotted), *Active
  time* or *Added*, the photos added to the library on the day they were shot, also before the
  counting began. Days to come are hatched. Tap or click a bar to hold its numbers in the panel
  below; a held month or year offers *Show {month}* or *Show {year}*. *Show as table*, at the
  card's bottom right, lists the same values. A line below the card's header sets the period's
  photos added against its pictures decided and deleted: *Added 1,240 · Decided 980 · Deleted
  410*. Photos added count only the pictures still in the library roots, from their folders' last
  scan. A period without a count or photos added says so.
- **Highlights:** below the tiles, one card for the period with five cells, a strip on a wide
  page and rows on a narrow one: the *Best day* (*Show day* opens its week), the *Busiest weekday*
  with seven small bars, the *Pace* in photos a minute against the period before, the *Active
  days* and the *Longest streak*. A period without a count says so.
- **Activity:** a calendar of the period. A week and a month show a square per day, a year its
  twelve months, all time a row per year with a square per month. The fill height of a square
  shows the pictures decided against the busiest one (a third, two thirds, more); days to come are
  hatched, days before the first count dotted and today framed. Tap a square to hold its numbers
  in the panel below; a held month of all time offers *Show {month}*.
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

*Keep statistics* sits in the *Statistics* section of the [settings](settings.md). Off, honeycomb
counts nothing new; the page still shows what it counted before and says so. The settings have
no reset: ask your Nextcloud admin, who removes the counters with
[`occ honeycomb:stats:reset`](admin/apps-and-commands.md#occ-commands), and counting starts
again today.
