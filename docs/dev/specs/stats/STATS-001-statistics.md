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
*Space freed* is the bytes moved to the trash bin, deleted for good and of the RAW files removed;
the page notes that the space is freed when the trash bin is emptied.

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
opens the statistics page and comes with it (metrics PR 6); *Close* closes the card.

**The statistics page** is a navigation entry *Statistics* beside *Similarity*. Its title row and
its content share one centred column of 1040 px, so the title starts at the content's left edge.
It shows one
calendar period: a segment offers *Week*, *Month*, *Year* and *All time*, the current month
preselected. At the right end of its row *Today*, which goes to the period that holds today, comes
before a stepper that names the period (*Nov 22 – 28, 2026*, *November 2026*, *2026*) between
*Previous period* and *Next period*; the name has a fixed width, so the arrows stay put while the
user steps. *All time* has no stepper and no *Today*, only *Since {day}*. Below a content width of
560 px the segment and the stepper each fill a row of their own.
A week starts on the first day of the week of the
user's Nextcloud locale. Changing the segment keeps the day the user stepped to, so March 2025
becomes 2025 and back March 2025. The user's day is the `today` the server answers; stepping never
goes past the period of today nor before the period of the first counted day. The hero *Photos
decided* shows the period's pictures decided in large, the change against the period before as an
arrow and words (*▲ 12 % more than October*), a bar of picked (filled, ✓) against rejected
(hatched, ✕) and, as rows below it, the pictures picked, rejected, decided per active day and the
active days (a day is active when any of its counters is above zero). From a content width of
960 px the hero takes the first of four columns and the bars the other three, both as tall as the
taller; below that the hero is a band above the bars. Four tiles follow: *Space freed* (with the pictures moved to the trash bin or
deleted for good and the RAW files removed), *Keep rate* (the share picked of the pictures picked
or rejected, with *n kept of m*), *Active time* (with pictures a minute from one active minute on)
and *Days in a row* (with the longest streak; in a past week, month or year the longest run of
active days inside it). A line shows the sidecars created and updated (with those from digiKam or
darktable) and the series done, each once there is one, until *Work done* takes them. The chart
shows one bar per day (week, month), per month (year) or per year (all time; per month while the
counting lies in one calendar year). A switch *Chart shows* picks *Decided* (the default: picked
filled with ✓ stacked under rejected hatched with ✕), *Space freed* (moved to the trash bin
filled, deleted for good hatched, RAWs removed dotted) or *Active time*; the axis names the
highest bar and its half, and a key names every part. Days and months after today show as hatched
empty slots (*Still to come* in the key), those before the first counted day as plain empty
slots, and the bar of today (week, month, year) is outlined. Every bar is a button whose label
names its day and value. A fixed panel below the chart, never a bubble over it, shows one bar's
numbers: its name, the pictures decided with picked and rejected, the space freed and the active
time; *Still to come.*, *Before counting began.* or *Nothing counted.* for a bar without them.
A tap, a click, Enter or Space holds a bar (pressed) and again releases it; a mouse over a bar
only previews it, and the panel returns to the held bar when the mouse leaves. A held month or
year with a count offers *Show {month}* or *Show {year}*, which opens that month or year. *Show
as table* swaps the bars for a table of the same values, one row per day, month or year up to
today from the first counted day on, and *Show as chart* swaps back; the switch and the table
stay when the period changes, a held bar does not. A period without a count says *Nothing
counted in this period.* instead of the chart.
*Library progress* shows how far the library roots have come (below);
*Of the pictures read so far* shows the shares picked, rejected, unflagged and rated from the XMP
cache, counting only the pictures whose XMP honeycomb has read, so a library not yet opened shows
little. A footnote says *Counted since {date}.* and, when stored series were done before the
counting began, *Before that: n series done (no date).* There is no start value for decided
pictures: honeycomb is deployed nowhere with decisions of the old table, so the page counts from
the first counter on.

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
settings field `keepStatistics`; only `false` turns it off). There is no control to reset the
numbers: only an admin resets them, with `occ honeycomb:stats:reset` (STATS-001.3).

**Storage and API:** the table `honeycomb_stats` holds one row per user, day and metric. A count
adds to the row of the day, never below zero; two counts at once both arrive (the second insert
of a new row retries as an update). `GET /apps/honeycomb/api/v1/stats` takes the optional days
`from` and `to` (`YYYY-MM-DD`, both included) and answers `counters`, the user's rows of those
days as `{day, metric, value}` ordered by day and metric, `firstDay`, the user's first counted
day or `null`, `today`, the user's day, `seriesDoneBefore`, the user's done series that no
counter holds (done series now less the counted ones, never below zero), and `read`, the
`{pictures, picked, rejected, rated}` of the user's XMP cache rows that were read; a malformed
day or `from` after `to` answers 400. The URL has no `DELETE`: no route removes counters.
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

### STATS-001.3 – Reset only by an admin with occ

- **Given** users with counted numbers
- **When** an admin runs `occ honeycomb:stats:reset <user>` or `occ honeycomb:stats:reset --all`
- **Then** it asks *Delete N statistics rows of …?* and deletes only after a yes, or without the
  question with `--force`; it prints the rows each user lost and the total; the photos, sidecars,
  decisions and resume positions are unchanged, and a user not named keeps their rows
- **And** `--dry-run` prints the same counts and deletes nothing, without asking
- **And** it fails, deleting nothing, for an unknown user, for neither or both of a user and
  `--all`, and without a terminal to answer on and without `--force`; a user without rows, or
  `--all` with none, prints *Nothing to delete* and succeeds
- **And** the settings show no *Reset statistics* control and no API route removes counters

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

### STATS-001.21 – The page shows a calendar period

- **Given** counters on several days
- **When** the page opens, and when the user picks *Week*, *Month*, *Year* or *All time*
- **Then** it opens on the current month; the hero and the tiles show the sums of that calendar
  period and the bars split it per day (week, month), per month (year) or per year (all time, per
  month while the counting lies in one calendar year)

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
  *Similarity* with the navigation (APP-001.25) and *Back to the cull* at the right end of its
  title row (STATS-001.73); the navigation's page entries come from one list

### STATS-001.41 – The period before

- **Given** pictures decided in the period and in the period before it
- **When** the page shows the hero *Photos decided*
- **Then** it adds the change in percent against the period before, in the period of today only
  up to the same day (1–26 November against 1–26 October), as ▲ and *more than*, ▼ and *fewer
  than*, or *Same as*, naming the period before; without numbers before, or for *All time*, it adds
  nothing

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
- **Then** the year is stored as the view state's `year_review_hint_closed`; a failed write is logged,
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

### STATS-001.52 – Step through the periods

- **Given** the page shows a week, month or year
- **When** the user picks *Previous period*, *Next period* or *Today*
- **Then** it shows the period before, the period after or the period of today, at the same
  granularity; *Next period* and *Today* are disabled in the period of today, *Previous period* in
  the period of the first counted day; a new segment keeps the day stepped to

### STATS-001.53 – The week starts with the locale

- **Given** the user's Nextcloud locale starts the week on Sunday, or on Monday
- **When** the page shows a week
- **Then** the week runs from that day for seven days

### STATS-001.54 – Days to come, the first counted day and today

- **Given** a period that holds today, or the first counted day
- **When** the page draws its bars
- **Then** the slots after today are hatched and empty, those before the first counted day empty
  without hatching, and the bar of today is outlined (not under *All time*)

### STATS-001.55 – A period without a count

- **Given** a period in which nothing was counted, e.g. a month off
- **When** the page shows it
- **Then** the hero shows 0 without a change, *—* per active day, 0 active days and an empty bar, the
  bars give way to *Nothing counted in this period.*, and the segment and the stepper stay usable

### STATS-001.56 – Days in a row in a past period

- **Given** a past week, month or year
- **When** the page shows the tile *Days in a row*
- **Then** it shows the longest run of active days inside the period with the note *Longest in
  this period*; in the period of today and under *All time* it shows the streak and *Longest n*

### STATS-001.57 – The period is in the address

- **Given** the page shows a period
- **When** the user picks a segment, steps or presses *Today*
- **Then** the address hash names it, replaced in place so the back button is not filled:
  `#week=YYYY-MM-DD` (the first day of the week), `#month=YYYY-MM`, `#year=YYYY` or `#all`; the
  period of today is `#week`, `#year` or, for the month, no hash at all

### STATS-001.58 – Open a period by its address

- **Given** an address hash such as `#month=2025-07`, `#week=2026-11-18` (any day of the week) or
  `#year=2025`
- **When** the page opens or is reloaded
- **Then** it shows that period; a period after today shows the period of today and one before
  the first counted day the period of that day, and a hash that names no valid period (another
  word, `#month=2026-13`, `#week=2026-02-30`) shows the month of today; the address is then
  rewritten to the period shown

### STATS-001.59 – Picked against rejected

- **Given** a period with pictures picked and rejected
- **When** the page shows the hero *Photos decided*
- **Then** a bar splits picked from rejected by their shares, picked filled and rejected hatched,
  the bar's label naming both counts; below the bar four rows, each its name at the start and its
  figure at the end: *✓ Picked*, *✕ Rejected*, *Per active day* (rounded, *—* without an active
  day) and *Active days*

### STATS-001.60 – Keep rate

- **Given** a period with 31 pictures picked and 55 rejected
- **When** the page shows the tile *Keep rate*
- **Then** it shows 36 % and *31 kept of 86*; with only rejected pictures 0 %, and with none picked
  or rejected *—* and *Nothing decided*

### STATS-001.61 – Space freed counts the RAW files removed

- **Given** bytes moved to the trash bin, deleted for good and of RAW files removed in a period
- **When** the page shows the tile *Space freed*
- **Then** it shows the sum of the three, with the pictures moved to the trash bin or deleted for
  good and, from one on, the RAW files removed

### STATS-001.62 – Active time and pace

- **Given** active time in a period
- **When** the page shows the tile *Active time*
- **Then** it shows the time with the pictures decided a minute to one decimal; below one active
  minute the pace is *—*

### STATS-001.63 – The chart shows decided, space freed or active time

- **Given** a period with pictures picked and rejected, bytes freed and active time
- **When** the page shows the chart, and when the user picks *Decided*, *Space freed* or *Active
  time* under *Chart shows*
- **Then** *Decided* is preselected and stacks picked (filled, ✓) under rejected (hatched, ✕);
  *Space freed* stacks the bytes moved to the trash bin (filled), deleted for good (hatched) and
  of the RAW files removed (dotted); *Active time* shows the active time; each bar's height is its
  share of the highest bar, the axis names the highest and its half, and the key names the parts

### STATS-001.64 – A bar's numbers in the detail panel

- **Given** the chart of a period
- **When** the user taps or clicks a bar, or focuses it and presses Enter or Space, and when a
  mouse passes over a bar
- **Then** the panel below the chart shows the bar's day, month or year with its pictures decided
  (picked and rejected), space freed and active time, and the bar is pressed; the same input
  again releases it and the panel asks to select a bar; a mouse over another bar shows that bar
  until it leaves, then the held bar again; a bar to come says *Still to come.*, one before the
  first counted day *Before counting began.* and one without a counter *Nothing counted.*; the
  panel is announced politely and never covers the chart; a new period releases the bar

### STATS-001.65 – Drill down from a month or a year

- **Given** a held bar of a month or a year with a count (a year, all time)
- **When** the user presses *Show {month}* or *Show {year}* in the panel
- **Then** the page shows that month or year, the segment and the address follow; a day's bar
  offers no drill-down

### STATS-001.66 – The chart as a table

- **Given** the chart of a period
- **When** the user presses *Show as table*
- **Then** a table replaces the bars with one row per day, month or year up to today from the
  first counted day on and one column per part of the chosen chart, *Show as chart* brings the
  bars back, and the switch and the table stay when the user steps to another period

### STATS-001.67 – Five highlights of the period

- **Given** a period with a count
- **When** the page shows the highlights below the tiles
- **Then** it shows *Best day*, *Busiest weekday*, *Pace*, *Active days* and *Longest streak*, each
  with its figure and a line of words; a period without a counter shows the line *Nothing counted
  in this period.* instead

### STATS-001.68 – Best day and Show day

- **Given** a period with pictures decided
- **When** the page shows *Best day*
- **Then** it names the day with the most pictures decided, the earlier day when two tie, with the
  count and the active time of that day; in a month, a year and all time *Show day* shows the week
  of that day (the segment and the address follow), in a week there is no such button

### STATS-001.69 – Busiest weekday, pace, active days and longest streak

- **Given** a period with a count
- **When** the page shows the other four highlights
- **Then** *Busiest weekday* names the weekday with the most pictures decided on average over the
  days of the period up to today and from the first counted day on (the first in the locale's
  week when two tie) with seven small bars from the locale's first weekday, the highest marked,
  and the figures as text; *Pace* shows the pictures decided a minute as the tile *Active time*
  does, with ▲, ▼ or *Same as* against the days compared with (STATS-001.41), or no comparison
  when either has no pace; *Active days* shows the days with a counter of those days and their
  share; *Longest streak* shows the longest run of days with a counter inside the period with
  its first and last day, the earlier run when two tie

### STATS-001.70 – The activity calendar of the period

- **Given** a period with a count
- **When** the page shows the card *Activity*
- **Then** a week and a month show one square per day with its date, under the weekdays from the
  locale's first weekday and after as many empty places as the first day lies after it (a month
  starting on a Sunday has six of them with Monday first, none with Sunday first); a year shows
  its twelve months as small day squares; all time shows one row per year with a square per
  month, the months of the first and of the current year in full; each square is filled from the
  bottom to the height of its level (STATS-001.71), a day to come is hatched, one before the
  first counted day dotted and today framed, so no state shows by colour alone; a key says that
  the fill height shows the amount

### STATS-001.71 – One level for the calendar and the year in review

- **Given** the pictures decided of each square and the highest of the period (of the year for
  the year in review)
- **When** a level is chosen
- **Then** a square without a counter is level 0, one at or below a third of the highest level 1,
  one at or below two thirds level 2, any higher level 3; a square with a counter and no picture
  decided is level 1; the calendar and the year in review's calendar take it from the same
  function, so a day has the same level in both

### STATS-001.72 – A square's numbers in the detail panel

- **Given** the calendar of a period
- **When** the user taps or clicks a square, or focuses it and presses Enter or Space
- **Then** the panel below the calendar shows the day or month as the chart's panel does
  (STATS-001.64), and the square is pressed; the same input again releases it and the panel asks
  to select a day; a square to come, one before the first counted day and one without a counter
  say why they have no numbers; a month of all time offers *Show {month}* (STATS-001.65); a new
  period releases the square; each square is named for a screen reader by its date and numbers
  and the panel is announced politely

### STATS-001.73 – One column for the title row and the page

- **Given** the statistics page with numbers counted
- **When** it renders with a content width of 1040 px or more, or less
- **Then** the title row and the page share one column of at most 1040 px, centred in the
  content; the title's left edge is the first card's unless the title steps aside for the
  navigation toggle (APP-001.22); *Back to the cull* stands at the right end of the title row, on
  the title's line, its right edge the cards' right edge

### STATS-001.74 – The control row

- **Given** the statistics page with numbers counted
- **When** it shows a week, month or year, or *All time*, with a content width of 560 px or more,
  or less
- **Then** the segment is one group at the content's left edge and *Today* stands before the
  stepper at its right edge, the name between the arrows 168 px wide so stepping never moves them;
  under *All time* only *Since {day}* stands there; below 560 px the segment and the stepper each
  span the content's width on a row of their own, the segment above

### STATS-001.75 – The hero beside the bars on four columns

- **Given** the statistics page with numbers counted
- **When** it renders with a content width of 960 px or more, or less
- **Then** from 960 px the overview is four equal columns with 16 px between them, the hero in the
  first and the bars in the other three, both starting on one line and equally tall, the hero's
  rows spread down to its bottom; below 960 px the hero is a band across the content's width
  above the bars, its number at the start and the bar with its rows beside it, the rows in two
  columns, from a content width of 560 px, and all stacked below that

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
| 2026-11-26 | Calendar periods replace the rolling 7 and 30 days: segment, stepper, *Today*, week start from the locale, bars with days to come (.21, .41 reworded; .52–.56; statistics slice 1) |
| 2026-11-26 | The period in the address hash (.57, .58; statistics slice 2) |
| 2026-11-26 | Redesign R1: the hero *Photos decided* with picked against rejected, the tiles *Space freed* with the RAW files removed, *Keep rate*, *Active time* with pace (.41, .55 reworded; .59–.62) |
| 2026-11-26 | Redesign R2: the main chart with *Decided*, *Space freed* and *Active time*, the detail panel, the drill-down and the table (.63–.66) |
| 2026-11-26 | Redesign R3: the highlights Best day, Busiest weekday, Pace, Active days and Longest streak (.67–.69) |
| 2026-11-26 | Redesign R4: the activity calendar of every period with one level function shared with the year in review (.70–.72) |
| 2026-11-27 | One centred column of 1040 px for the title row and the page, *Back to the cull* in the title row (.40 reworded, .73; layout variant A, tasks 1+2) |
| 2026-11-27 | The control row: the segment at the left, *Today* before a stepper of fixed width at the right, two rows on a phone (.74; layout variant A, task 3) |
| 2026-11-27 | The hero beside the bars on four columns, its figures as rows below the bar (.55, .59 reworded; .75; layout variant A task 4) |
