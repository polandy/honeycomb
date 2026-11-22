# STATS-001 – Statistics

- Status: accepted
- Area: stats
- Origin: concept *Nutzen-Metriken* (owner sign-off 2026-11-18), ADR 0039, mockup
  `docs/dev/mockup/statistics/index.html`
- Depends on: SETTINGS-001, DECISIONS-002, DELETE-001, DELETE-003, XMP-002, SERIES-005, MOVE-002,
  LOUPE-003

## Purpose

Shows each user what honeycomb did for them: pictures decided, pictures moved to the trash bin,
space freed, sidecars created and updated, series done, and the time spent culling. Statistics
never change a photo or a sidecar.

## Behaviour

Statistics are daily counters per user (ADR 0039): one sum per day and metric, no file ids, no
paths. The day is the calendar day in the user's Nextcloud time zone, UTC without one.

| Metric | Key | Counted when |
|---|---|---|
| Pictures decided | `pictures_decided` | A picture's flag changes from unflagged to picked or rejected (+1), or back to unflagged (−1); undo subtracts what it takes back |
| Pictures picked, pictures rejected | `pictures_picked`, `pictures_rejected` | A picture becomes picked, rejected (+1), or stops being so (−1); net of undo |
| Ratings, colour labels, tags set | `ratings_set`, `colour_labels_set`, `tags_set` | A picture's rating, colour label or tags change; net of undo |
| Pictures, files, bytes moved to the trash bin | `trash_pictures`, `trash_files`, `trash_bytes` | A delete moves them to the trash bin; a pair is one picture, every member and sidecar a file |
| Pictures, files, bytes deleted for good | `deleted_pictures`, `deleted_files`, `deleted_bytes` | A delete removes files the trash bin would not keep (ADR 0036); a picture with such a file counts here, not as moved to the trash bin |
| RAW files removed, their bytes | `raws_removed`, `raws_removed_bytes` | *Remove RAWs* moves RAW files to the trash bin or deletes them for good; not counted as pictures, their sidecars not counted |
| Sidecars created | `sidecars_created` | A sidecar save creates a new sidecar |
| Sidecars updated | `sidecars_updated` | A sidecar save replaces an existing sidecar last changed before the start of the user's day |
| Sidecars from digiKam or darktable | `sidecars_foreign` | A sidecar updated that holds data of digiKam or darktable: `darktable:xmp_version`, or a digiKam property honeycomb does not write |
| Series done | `series_done` | A series write sets a stored open series to done or creates a series as done |
| Folders done | `folders_done` | A *Mark done* request succeeds (FOLDERS-006); a reopen subtracts nothing |
| Pictures moved | `pictures_moved` | A move reports every file of a picture as moved |
| Active time | `active_seconds` | Seconds of the cull with an input at most 2 minutes earlier |

Only successful results count. A day's net counter never goes below zero. The server counts
trash, deletes for good, *Remove RAWs*, sidecar saves, series done and moves in the request that
acts, one sum per metric and request, with the sizes the server reads before it moves a file.
*Space freed* is the bytes moved to the trash bin and deleted for good; the page notes that the
space is freed when the trash bin is emptied.

**What only the browser knows** rides as counts on the request that saves it. A flag save carries
pictures decided, picked and rejected; a sidecar save carries ratings, colour labels and tags set,
and marks each existing sidecar that holds data of digiKam or darktable; a position save carries
the active seconds since the last one. A picture's counts ride on one item of its save, an object
of metric keys with −1, 0 or 1 (undo sends −1), and count only when that item is saved. The server
caps each value at ±1, a key the endpoint does not take answers 400, and active seconds are capped
at the time since the folder set's previous position save, since the start of the user's day
without one. Reading a sidecar, taking a flag over, *Write XMP* and the fresh check before a delete
count nothing.

**Cull finished** is a card over the grid: a bottom sheet on a phone, a dialog from the iPad width
on. It opens once when a decision of the user leaves no undecided picture in the folder set, and
when a delete from the reject review ends (after the delete report, if one opens); it waits while
the loupe, the series compare or a delete dialog is open. It shows this session only, computed in
the browser and never sent: the pictures the user decided (a picture changed by a decision, undo
or redo and decided now, or deleted since) split into picked, unflagged and rejected; the pictures
moved to the trash bin and deleted for good by the session's deletes, *Remove RAWs* left out, with
the space freed; the sidecars created and updated, each once; before and after (pictures and bytes
of the folder set when the session started and now); active time and, from one active minute on,
pictures a minute. A session starts when a folder set opens with pictures. Active time adds the time
between two inputs (a pointer press, a key, a wheel turn), at most 2 minutes each. *Statistics*
opens the statistics page and comes with it (metrics PR 6); *Done* closes the card.

**The statistics page** is a navigation entry *Statistics* beside *Similarity*. A period chip row
offers *7 days*, *30 days*, the current year and *All time*, 30 days preselected. Tiles show
pictures decided (with the change against the period before), moved to the trash bin (with space
freed and deleted for good), sidecars created / updated (with those from digiKam or darktable) and
days in a row (with the longest streak); a day counts toward days in a row when any of its
counters is above zero. A line shows active time, pictures a minute (from one active minute on),
series done and RAW files removed. Bars show pictures decided and moved to the trash bin per day
(7 days), per 7 days ending today (30 days, the oldest bar shorter) or per calendar month (year,
all time). The period ends today, the user's day the server answers; the current year starts on 1
January, all time on the first counted day. *Library progress* shows how far the library roots
have come (below); *Of the pictures read so far* shows the shares picked, rejected, unflagged and
rated from the XMP cache, counting only the pictures whose XMP honeycomb has read, so a library
not yet opened shows little. A footnote says *Counted since {date}.* and, when stored series were
done before the counting began, *Before that: n series done (no date).* There is no start value
for decided pictures: honeycomb is deployed nowhere with decisions of the old table, so the page
counts from the first counter on.

**The year in review** opens the page from 1 December to 31 January, for the year that ends or
just ended, above the period tiles: a headline with the pictures decided and the space freed, tiles
for pictures moved to the trash bin (with those deleted for good), RAW files removed (with their
space), sidecars created, sidecars updated (with those from digiKam or darktable), series done, the
longest streak, active time (with pictures a minute) and the busiest day (the day with most
pictures decided, the earlier one on a tie, none while no picture was decided), and a calendar of
the active days: one square per day from 1 January to 31 December, empty without a counter, else
the lightest shade, and from 1 to 3 by the day's share of the busiest day's pictures decided (up
to a third, up to two thirds, above). Its footnote says *Counted since {date}.* when the counting
began in that year. The hint *Your {year} in honeycomb* shows in the navigation from 1 December to
31 January once for each year, until the user closes it or opens the year in review; the view
state remembers the year closed (LOUPE-003), so it follows the user to every device and comes back
for the next year. The day for the hint is the browser's, for the page the server's `today`.

**Settings:** a section *Statistics* with the switch *Keep statistics* (on by default, the
settings field `keepStatistics`; only `false` turns it off) and *Reset statistics*, which asks
*Reset all statistics?* first; a toast says *Statistics reset* or that they could not be reset.

**Storage and API:** the table `honeycomb_stats` holds one row per user, day and metric. A count
adds to the row of the day, never below zero; two counts at once both arrive (the second insert
of a new row retries as an update). `GET /apps/honeycomb/api/v1/stats` takes the optional days
`from` and `to` (`YYYY-MM-DD`, both included) and answers `counters`, the user's rows of those
days as `{day, metric, value}` ordered by day and metric, `firstDay`, the user's first counted
day or `null`, `today`, the user's day, `seriesDoneBefore`, the user's done series that no
counter holds (done series now less the counted ones, never below zero), and `read`, the
`{pictures, picked, rejected, rated}` of the user's XMP cache rows that were read; a malformed
day or `from` after `to` answers 400.
`DELETE` on the same URL resets.
Strings are English, translated per ADR 0007; the mockup lists them.

## Acceptance criteria

### STATS-001.1 – Counting needs the setting

- **Given** a user with *Keep statistics* off
- **When** they decide, delete, save sidecars or move pictures
- **Then** no counter changes; the numbers already counted stay and the page shows them with the
  note *Statistics are off.*

### STATS-001.2 – On by default

- **Given** a user who never changed *Keep statistics*
- **When** they act
- **Then** their actions are counted

### STATS-001.3 – Reset after a confirmation

- **Given** a user with counted numbers
- **When** they press *Reset statistics* and confirm
- **Then** every counter of that user is gone, the page shows *Nothing counted yet*, and their
  photos, sidecars, decisions and resume positions are unchanged; *Cancel* changes nothing

### STATS-001.4 – Only one's own numbers

- **Given** two users
- **When** one reads statistics
- **Then** the answer holds only their own counters; there is no way to read another user's

### STATS-001.5 – Statistics never touch a sidecar

- **Given** any sidecar save with statistics on
- **When** it is written
- **Then** its bytes equal the bytes of the same save with statistics off

### STATS-001.6 – Counters hold no file ids

- **Given** any counted action
- **When** the stored counters are read
- **Then** they hold user, day, metric and value only; no file id, path or name

### STATS-001.7 – Counting never breaks an action

- **Given** the counter write fails
- **When** a delete, sidecar save, series change or move runs
- **Then** the action and its answer are as without statistics, and a warning is logged

### STATS-001.8 – Trash counts as moved to the trash bin

- **Given** a delete of 3 pairs, each a JPEG, a RAW file and a sidecar
- **When** every file is moved to the trash bin
- **Then** pictures moved to the trash bin rise by 3, files by 9 and bytes by the files' sizes on
  the server

### STATS-001.9 – Deleted for good is its own number

- **Given** a delete where the trash bin would not keep a picture and the user confirmed the
  permanent delete warning
- **When** it is deleted
- **Then** it counts as deleted for good, not as moved to the trash bin

### STATS-001.10 – Only successes count

- **Given** a delete or move where some files fail or are skipped
- **When** it ends
- **Then** only the pictures and files that succeeded count; a picture counts only when every one
  of its files succeeded

### STATS-001.11 – Remove RAWs counts RAW files

- **Given** *Remove RAWs* moves 10 RAW files to the trash bin
- **When** it ends
- **Then** RAW files removed rise by 10 and their bytes by their sizes; pictures moved to the
  trash bin stay

### STATS-001.12 – A created sidecar counts once

- **Given** a picture without a sidecar
- **When** a decision saves a new sidecar, and later saves to it again
- **Then** sidecars created rise by 1 and sidecars updated do not rise that day

### STATS-001.13 – An existing sidecar counts once a day

- **Given** a sidecar last changed before today
- **When** honeycomb saves to it three times today
- **Then** sidecars updated rise by 1

### STATS-001.14 – Decisions count net

- **Given** a picture unflagged
- **When** the user picks it, undoes the pick, and rejects it
- **Then** pictures decided rise by 1, pictures rejected by 1 and pictures picked by 0

### STATS-001.15 – No counter below zero

- **Given** a picture decided yesterday
- **When** the user unflags it today
- **Then** today's pictures decided stay at 0 or above

### STATS-001.16 – A browser count is bounded

- **Given** a flag or sidecar save of n items
- **When** its counts claim more than n changes of one kind (more than one per item), or a
  position save claims active time longer than the time since the folder set's previous position
  save
- **Then** the server caps the count at that bound

### STATS-001.17 – Active time leaves idle time out

- **Given** a cull with 5 minutes of input, 10 minutes without input, and 3 minutes of input
- **When** the session's active time is computed
- **Then** it is 10 minutes: the 5 and 3 minutes plus the first 2 minutes of the pause

### STATS-001.18 – The day is the user's day

- **Given** a user in the time zone Europe/Berlin
- **When** they act at 00:30 local time on 2 March
- **Then** the action counts on 2 March

### STATS-001.19 – Cull finished opens once

- **Given** a folder set with one undecided picture
- **When** the user decides it
- **Then** *Cull finished* opens with the session's numbers; it does not open again until a picture
  becomes undecided and is decided again

### STATS-001.20 – Cull finished after the delete report

- **Given** a delete from the reject review
- **When** the user closes the delete report
- **Then** *Cull finished* opens with the session's numbers, the delete included

### STATS-001.32 – Cull finished counts the session net

- **Given** a session in which the user picked 2 pictures, rejected 1 and took one pick back by undo
- **When** *Cull finished* opens
- **Then** it shows 2 pictures decided, 1 picked and 1 rejected; a picture decided before the
  session and not changed in it does not count

### STATS-001.33 – Before and after

- **Given** a folder set of 3 pictures of 30 MB when the session started
- **When** the user deletes 1 picture of 10 MB from the reject review
- **Then** *Cull finished* shows before 3 pictures · 30 MB and after 2 · 20 MB, 1 picture moved to the
  trash bin and 10 MB freed

### STATS-001.34 – Only a decision of the user opens the card

- **Given** a folder set whose last undecided pictures become decided by reading their sidecars,
  or that opens with no undecided picture
- **When** nothing else happens
- **Then** *Cull finished* does not open

### STATS-001.35 – Active time leaves gaps over 2 minutes out

- **Given** inputs at 0 s, 30 s and 5 min
- **When** *Cull finished* opens at 5 min
- **Then** active time is 2 min 30 s

### STATS-001.36 – Browser counts need a saved item

- **Given** a flag save of 2 pictures whose second file the server skips, or a sidecar save whose
  counted sidecar changed meanwhile
- **When** it ends
- **Then** only the saved items' counts count; a sidecar saved in the second round carries the
  counts again

### STATS-001.37 – Ratings, colour labels and tags count each change

- **Given** a picture with no rating and no tags
- **When** the user rates it, gives it a colour label, adds a tag, and undoes the tag
- **Then** ratings set and colour labels set rise by 1 and tags set by 0

### STATS-001.38 – A sidecar from digiKam or darktable

- **Given** sidecars last changed before today, one written by darktable, one with a digiKam
  property honeycomb does not write, and one written by honeycomb only
- **When** honeycomb saves to each
- **Then** sidecars updated rise by 3 and sidecars from digiKam or darktable by 2

### STATS-001.39 – Active time rides with the position save

- **Given** a cull with 90 seconds of input since the last position save
- **When** the next position save is sent
- **Then** it carries 90 active seconds and the one after it starts again from 0

### STATS-001.21 – The page shows a period

- **Given** counters on several days
- **When** the user picks *7 days*, *30 days*, the year or *All time*
- **Then** the tiles show the sums of that period and the bars split it per day, week or month

### STATS-001.22 – Days in a row

- **Given** counted actions today, yesterday and the day before, none three days ago
- **When** the page shows days in a row
- **Then** it shows 3; without an action today but yesterday it still counts up to yesterday

### STATS-001.23 – Nothing counted yet

- **Given** a user without counters
- **When** they open the statistics page
- **Then** it shows *Nothing counted yet. Cull a folder and the numbers show here.* and the folder
  sets

### STATS-001.24 – Counted since

- **Given** a user whose first counter is on 12 December 2026
- **When** they open the page
- **Then** the footnote says *Counted since 12 Dec 2026.*

### STATS-001.25 – Year in review in December and January

- **Given** the date is 1 December 2026 to 31 January 2027 and a user with counters
- **When** the user opens the statistics page
- **Then** the year in review for 2026 is shown above the period tiles; outside those dates it is
  not

### STATS-001.26 – The year-in-review hint shows once

- **Given** 1 December and a user who has not closed this year's hint
- **When** the navigation is shown
- **Then** it shows the hint *Your 2026 in honeycomb*; once closed, or once the year in review was
  opened, it stays away on every device until the next December, and outside December and January
  it never shows; a hint closed for 2025 does not hide the one for 2026

### STATS-001.27 – Clear cache keeps statistics

- **Given** a user with counters
- **When** they press *Clear cache*
- **Then** their counters are unchanged

### STATS-001.28 – A deleted user's statistics go

- **Given** a user with counters
- **When** the user is deleted
- **Then** their counters are deleted

### STATS-001.29 – A series counts done once

- **Given** a stored series that is open
- **When** a write sets it to done, and a later write sends it as done again
- **Then** series done rise by 1; a series created as done counts 1, one set back to open takes
  nothing back

### STATS-001.30 – A picture with a file deleted for good

- **Given** a pair whose JPEG goes to the trash bin and whose RAW the trash bin would not keep,
  with the permanent delete confirmed
- **When** both succeed
- **Then** pictures deleted for good rise by 1, files moved to the trash bin by 1 and files
  deleted for good by 1, each with its bytes

### STATS-001.31 – Moves count whole pictures

- **Given** a move of 2 pictures where one file of the second fails and its files move back
- **When** it ends
- **Then** pictures moved rise by 1

### STATS-001.40 – The navigation entry opens the page

- **Given** the cull page or the *Cull finished* card
- **When** the user picks *Statistics* in the navigation or on the card
- **Then** the statistics page opens at `/apps/honeycomb/statistics`, a page of its own like
  *Similarity* with *Back to the cull*; the navigation's page entries come from one list

### STATS-001.41 – The period before

- **Given** pictures decided in the period and in the period of the same length before it
- **When** the page shows the tile *Photos decided*
- **Then** it adds the change in percent against the period before; without numbers before, or
  for *All time*, it adds nothing

### STATS-001.42 – The library progress

- **Given** library roots whose folders are in part done
- **When** the page shows the *Library progress*
- **Then** it shows the photos in done folders as a share of all photos below the roots, in
  total and per root, the folders done of all folders, the folders marked done in the month of
  the user's today and the share of photos decided as a cross-check (the card of *Folders*,
  ADR 0049), read from the library folders of each root, and a link *Open Folders*

### STATS-001.43 – Statistics off

- **Given** *Keep statistics* off
- **When** the user opens the page
- **Then** it adds *Statistics are off. Turn on Keep statistics in the settings to count again.*

### STATS-001.44 – Series done before the counting

- **Given** a user with 5 done stored series, of which counters hold 2
- **When** they ask for the statistics
- **Then** `seriesDoneBefore` is 3; with as many counted as stored, or more, it is 0, and the
  footnote adds *Before that: 3 series done (no date).* only above 0

### STATS-001.45 – The state of the pictures read so far

- **Given** XMP cache rows of the user: two picked, one rejected, one unflagged, one refused, one
  without XMP, two of them rated
- **When** they ask for the statistics
- **Then** `read` counts only the four rows that were read: 4 pictures, 2 picked, 1 rejected, 2
  rated, and no other user's rows; the page shows *Of the pictures read so far* with the shares
  picked, rejected, unflagged and rated, and nothing while no picture was read

### STATS-001.46 – The year's numbers

- **Given** counters in 2026 and in 2025, and the date 5 December 2026
- **When** the year in review is shown
- **Then** every sum, the longest streak and the active time count only the days of 2026, the
  headline names the pictures decided and the space freed, and the tiles show the trash bin, RAW,
  sidecar, series, streak and active time numbers with *from digiKam or darktable* under the
  sidecars updated only above 0

### STATS-001.47 – The busiest day and the calendar of active days

- **Given** the days of 2026 with their counters
- **When** the year in review is shown
- **Then** the busiest day is the one with most pictures decided, the earlier on a tie, and the
  tile is absent while none was decided; the calendar has one square per day of the year, in the
  shade the behaviour above names, and says in words how many days were active

### STATS-001.48 – A closed or opened year in review is remembered

- **Given** the hint shows
- **When** the user closes it, or opens the year in review on the statistics page
- **Then** the year is stored as the view state's `yearReviewHintClosed`; a failed write is logged,
  keeps the hint away for this visit and tells the user nothing

### STATS-001.49 – Counted since inside the year

- **Given** the year in review and a first counted day in that year, or before it
- **When** it is shown
- **Then** it says *Counted since {date}.* for a first day inside the year and nothing otherwise

### STATS-001.50 – No library roots

- **Given** a user without library roots
- **When** the page shows the *Library progress*
- **Then** it says *Choose your library* with the link *Open Folders*, and reads no folders

### STATS-001.51 – The library cannot be read

- **Given** the library folders cannot be read
- **When** the page loads
- **Then** the *Library progress* says *The library progress could not be loaded.* and the other
  numbers still show; the error is logged

## History

| Date | Change |
|---|---|
| 2026-11-19 | Written from the signed-off concept *Nutzen-Metriken* (metrics PR 1 of 8) |
| 2026-11-19 | Storage and API, the settings section (metrics PR 2 of 8) |
| 2026-11-19 | Server counts: trash, deleted for good, Remove RAWs, sidecars, series done, moves (.29–.31; metrics PR 3 of 8) |
| 2026-11-19 | *Cull finished*: when it opens, what the session counts (.32–.35; metrics PR 4 of 8) |
| 2026-11-19 | Browser counts on the flag, sidecar and position saves (.36–.39; metrics PR 5 of 8) |
| 2026-11-20 | The statistics page and its navigation entry, `today` in the answer (.40–.43; metrics PR 6 of 8) |
| 2026-11-20 | Series done before the counting and the state of the pictures read so far; no start value for decided pictures (.24, .44, .45; metrics PR 7 of 8) |
| 2026-11-20 | Year in review: numbers, calendar of active days, hint in the navigation (.25, .26, .46–.49; metrics PR 8 of 8) |
| 2026-11-22 | The library progress replaces *Folder sets* (.42, .50, .51; ADR 0049, M12 PR 7) |
