<!--
SPDX-FileCopyrightText: 2026 honeycomb contributors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Series in the loupe (concept)

Status: proposal for the owner's sign-off (2026-11-13), revised with the owner's three decisions
of 2026-11-13 (see *Owner decisions*). Interactive mockup:
[`docs/mockup/loupe-series/index.html`](../mockup/loupe-series/index.html), open it in a browser.

## Summary

The loupe shows by itself that a photo belongs to a series, and offers the series actions where
the decision is made:

1. **Series chip in the title row:** "⧉ 2/5" (photo 2 of a series of 5). A tap on it, or `N`,
   opens *Compare series* on **this** series with the shown photo active, using the whole
   screen as a grid of the series' photos; closing returns to the loupe.
2. **Group frame in the filmstrip** (series part 2): a honey frame around the series' photos
   with a "⧉ 5" tab, which does the same as the chip.
3. ***Pick this, reject the rest*** joins the loupe's rating row while the photo is in a series,
   with `Shift+K`: the same button and key as in the compare and the series viewer, one undo
   step. The loupe then lands on the first photo after the series.
4. **A one-time hint** at the first series photo in the loupe, since the owner never found the
   feature.
5. **Part 1 (#147, merged) stays**, with two corrections: a series ends 60 s after its first
   shot, and the series viewer preloads a window of neighbours, not the whole series.
6. **Part 3 decided:** a plain *Pick* never rejects the others silently; its undo toast offers
   "Reject the other 4" as one explicit tap.
7. **One flag button order everywhere:** *Pick* left, *Unflag* in the middle, *Reject* right.

## Owner decisions

The owner reviewed the first proposal (2026-11-13) and decided three points; the sections below
already follow them.

1. **After *Pick this, reject the rest* the loupe lands on the first photo right after the
   series**, not on the picked one: the series is decided, so the next photo to judge is the
   one after it. This holds for every way in: the loupe's button, `Shift+K`, the compare opened
   from the loupe and the toast's *Reject the other N*.
2. **The flag buttons run *Pick* left, *Unflag* in the middle, *Reject* right on every device**,
   in the loupe's portrait row and its landscape layout, and the series viewer follows (it uses
   the loupe's action bar). This revises UX review L5 (#143), which put *Unflag* below *Reject*
   on the right edge in landscape.
3. **The series compare uses the whole screen as a grid** of the series' photos, sized so all of
   them fit without scrolling where possible, instead of the sideways-scrolling strip of #147.
   The active card, the flags per card, *Pick this, reject the rest* and the arrow keys stay;
   `↑` `↓` join for the grid's rows.

As UX lead I decided the details:

- **Landscape *Unflag*:** *Pick* keeps the left edge and *Reject* the right edge, each at the
  height of the thumbs; *Unflag* floats centred at the bottom of the photo, just above the
  filmstrip, as a 56 px button with its word (44 px with a fine pointer). It is the rarest of the
  three, so the middle of the screen, further from the thumbs, suits it.
- **The order holds for every flag button group:** the loupe, the series viewer, the compare's
  cards and the grid's action bar, so a hand learns one order. It replaces the 2026-11-12
  decision that the small buttons keep *Pick*, *Reject*, *Unflag*.
- **The grid toolbar's *Compare series* uses the same full-screen grid.** One compare, one
  layout (DRY); opened from the grid it keeps its title "Compare series 1 of 3 · photo 2 of 5",
  *Skip* and the move to the next series after *Pick this, reject the rest*.
- **No photo after the series:** when the series ends the loupe's photos, the loupe stays on the
  picked photo. A series split by another sort counts from its last member in the loupe's
  order. *Undo* restores the flags only and does not move the loupe back, as elsewhere.
- **The toast's *Reject the other N*** lands after the series only while the loupe shows a member
  of that series; after `Shift+P` has moved on past it, the loupe stays where it is.

Rejected: a gesture (undiscoverable, conflicts with swipe and zoom) and an inline series strip
in the loupe (a second compare view, thumbnails too small, duplicated logic).

## Problem

Series are reachable only through *Compare series* in the grid toolbar (or the ⋯ menu below
900 px) and `N`. *Pick this, reject the rest* (`Shift+K`) and the series viewer live inside that
dialog. The owner culls in the loupe and never found them (2026-11-13). The loupe gives no sign
that the shown photo belongs to a series, and the grid's "⧉ N" badge is gone once the loupe is
open.

Three questions, answered below for phone portrait, iPad and desktop:

1. How does the loupe show that the shown photo belongs to a series?
2. How do I see the whole series from there?
3. How do I pick one and reject the rest?

## Recommendation: chip, frame, button

One rule: **the series appears where the loupe already shows position and decisions**, with the
words, icon, key and components the app already has. No new screen, no gesture.

### 1. Show it: the series chip

- The title row gets a **series chip** right after the position count, only while the shown photo
  is in a series: "⧉ 2/5", labelled "Photo 2 of a series of 5 – compare". It uses the grid
  badge's ⧉ mark and number, so the two read as one thing.
- Phone portrait: "⧉ 2/5" only. iPad and desktop: "⧉ Series 2/5". The chip is a 44 px target
  (34 px with a fine pointer), honey outline, never filled: honey fill marks a pressed state.
- The chip counts the series' pictures that are not rejected, at least two, whether or not they
  are decided: unlike *Compare series*, which offers only series with an unflagged picture, the
  loupe shows the fact, so the chip stays on a series with two picks.
- It hides with the title row when idle, like every overlay. A photo outside any series shows
  no chip, so nothing changes in an unrelated cull.

### 2. See the whole series: the existing compare, opened on this series

- A tap on the chip, a tap on the filmstrip frame's label, or `N` in the loupe opens the existing
  **series compare on this series** with the shown photo as the active card. Its title says
  "Series of 5 · photo 2" instead of "Compare series 1 of 3": opened from the loupe it holds this
  one series, so *Skip* and the series stepping hide, and the position orients in a long burst.
- **The compare uses the whole screen** (owner decision 3), from the loupe and from the grid
  toolbar alike: a title row (title, *Skip* from the grid, close), a **grid of cards** and a
  bottom bar with *Pick this, reject the rest* for the active card (`Shift+K` on a desktop).
  Each card shows the photo, its name and the flag buttons *Pick*, *Unflag*, *Reject*; the
  active card has the honey frame.
- **Sizing:** the compare picks the column count that gives the largest card while every card
  fits the screen; a phone shows a series of 5 in 2 columns, an iPad and a desktop in 3. Only
  when a card would drop below a minimum width (150 px on a phone, 220 px otherwise) does the
  grid scroll, downwards and never sideways, with the active card kept in view. The rule is a
  pure function of the card count and the area, so it is unit tested.
- A tap on a card's photo makes it active, and a tap on the active photo opens the series viewer
  with synchronised zoom, as today. `←` `→` move the active card in reading order, `↑` `↓` to
  the card above or below; `P` `U` `X` decide the active card.
- Closing it (button, `Esc`) returns to the loupe **on the active card's photo**. *Pick this,
  reject the rest* in the compare closes it too and returns to the loupe **on the first photo
  after the series** (owner decision 1), rather than moving to the next series: the user came
  from the loupe and continues there.
- **The filmstrip group frame** (series part 2) draws one honey frame around the members of a
  series in the strip, with a "⧉ 5" tab at its start. The frame shows where a burst starts and
  ends before you page into it; the tab is the same action as the chip. In the default sort by
  capture time the members are neighbours; when another sort splits them, each run gets its own
  frame and every tab says the whole count.

### 3. Decide: *Pick this, reject the rest* in the loupe

- While the shown photo is in a series, the loupe's rating row ends with **Pick this, reject the
  rest** (`Shift+K`), the same `pickRestBtn` the compare and the viewer use, secondary in the
  loupe so the big *Pick* stays the main button. It picks the shown photo and rejects every
  other member as one undo step; the toast reads "Picked 1, rejected 4" with *Undo*.
- The loupe then **lands on the first photo after the series** (owner decision 1): the series is
  decided, so the next photo to judge follows it. While *Rejected* is not pressed in the flag
  filter, the rejected members leave the strip (LOUPE-001.22); with it pressed they stay, and the
  loupe still moves past them. With no photo after the series the loupe stays on the picked one.
- Phone portrait: the rating row wraps and the button takes its own line below the stars and
  colour labels. iPad and phone landscape: it sits in the bottom overlay with the rating row,
  where the series viewer already puts it (plan.md *Loupe layout* 3). Desktop: the same, plus
  `Shift+K`; the tooltip names the key.
- With the flag buttons hidden (`B`) the button stays in the rating row.

### 4. Make it found once: the first-series hint

The owner's actual problem is discoverability, so the first time the loupe shows a photo of a
series, the chip gets a single honey pulse and a hint card under it: "This photo is part of a
series of 5. ⧉ compares them; Shift+K picks this one and rejects the rest." with *Got it*.
Dismissed once per user on the server, like the gesture guide (LOUPE-003). No pulse under
`prefers-reduced-motion`.

### 5. One flag button order

*Pick* left, *Unflag* in the middle, *Reject* right (owner decision 2). Phone portrait: the row
of large buttons below the photo, as today. iPad and desktop landscape: *Pick* at the left edge,
*Reject* at the right edge, *Unflag* centred at the bottom of the photo above the filmstrip. The
series viewer, the compare's cards and the grid's action bar use the same order.

### Per device

| | Phone portrait (390 × 844) | iPad landscape (1180 × 820) | Desktop (1440 × 900) |
|---|---|---|---|
| Shows the series | chip "⧉ 2/5" in the title row, frame in the strip | chip "⧉ Series 2/5", frame | same as iPad |
| Whole series | tap chip or frame tab | tap chip or frame tab | click, or `N` |
| Pick one, reject the rest | button on its own line under the rating row | button in the bottom overlay row | button, or `Shift+K` |
| After it | the first photo after the series | same | same |
| Compare | full screen, 2 columns for 5 | full screen, 3 columns for 5 | same as iPad, plus arrow keys |
| Flag buttons | row: *Pick*, *Unflag*, *Reject* | *Pick* left edge, *Unflag* bottom centre, *Reject* right edge | same as iPad |
| Paging inside the series | swipe, tap zones, strip | same, edge buttons | `←` `→` |

## Series parts 1–3: review and decisions

As UX lead for series (owner, 2026-11-13) I reviewed part 1 and decided parts 2 and 3.

### Part 1, merged as #147: one burst is one series — keep, with two corrections

Showing a burst whole is right: splitting 5 into 3 + 2 hid the best frame from its rivals. Its
sideways-scrolling row gives way to the full-screen grid (owner decision 3), which shows a whole
burst at once and keeps the cards large. Two more consequences need a fix:

1. **A series needs an end.** Shots link photo to photo (`src/logic/series.ts`, `linked`), and
   the cap of four was the only limit on a run. A quiet subject shot every 20 s now chains into
   one series over minutes, and *Pick this, reject the rest* would reject all of them in one
   tap. Rule: **a series ends once a shot is more than 60 s after the series' first shot**; the
   next run starts there. A real burst lasts seconds, so it stays whole. This amends ADR 0021
   (new constant `SERIES_SPAN_SECONDS`).
2. **The series viewer preloads a window**, not the whole series (SERIES-002.1): the shown
   photo, then 3 ahead and 2 behind, as the loupe does (LOUPE-001). A burst of 26 at the 4096 px
   tier would otherwise load 26 large images before the first page. Synchronised zoom is a
   view state and needs no preloaded image.

The compare's title gains the active photo's position ("Compare series 1 of 3 · photo 7 of 26"),
so a long burst whose grid scrolls down does not lose the user.

### Part 2: the group frame in the filmstrip — as in section 2

One honey frame around each run of a series' pictures in the loupe's filmstrip, 2 px, 8 px
corners, with a "⧉ N" tab at its top left whose hit area reaches 44 px (34 px with a fine
pointer); the tab opens the compare on that series. N counts the pictures that are not rejected;
fewer than two ends the frame. Rejected pictures shown under the *Rejected* flag filter stay
outside the frame. The grid keeps its "⧉ N" badge and gets no frame: tiles wrap across rows,
where a frame would break.

### Part 3: picking one rejects the others — explicit, never implicit

A plain *Pick* (`P`, button, swipe) on a series photo **does not** reject the others:

- Two good frames of one burst are common, and *Pick* must keep meaning what it means everywhere
  else; a silent reject would also write the reject (`digiKam:PickLabel` 1, `xmp:Rating` −1)
  into the others' sidecars, which digiKam and Lightroom then show (`docs/06-xmp-interop.md`).
- Instead, when the picked photo's series still has unflagged pictures, its undo toast offers
  **Reject the other 4** next to *Undo*. One tap does what *Pick this, reject the rest* does,
  as one undo step, so the plain *Pick* becomes the place where users discover it.
- *Pick this, reject the rest* stays the explicit action in the loupe, compare and viewer.
- *Reject the other 4* lands after the series like the button, while the loupe shows a member of
  that series.

## Alternatives rejected

1. **A gesture** (long-press on the photo to open the series, a two-finger swipe for *Pick this,
   reject the rest*). Invisible, so it repeats the problem the owner reported; long-press is
   the iOS callout and a two-finger swipe is a pan while zoomed; the vertical swipes already
   belong to the *Swipe up* / *Swipe down* settings. A desktop has no equivalent.
2. **An inline series strip in the loupe**: when the shown photo is in a series, the filmstrip
   grows into a larger row of just the series members with flag buttons under each. It shows the
   series without a dialog, but it is a second compare view beside *Compare series*, which
   duplicates its logic and layout (against the DRY rule for grid, loupe and series viewer), its
   thumbnails are too small to judge focus on a phone, and it takes the photo's height in
   landscape, which the owner asked to keep for the photo (plan.md *Loupe layout* 1).

3. **The sideways-scrolling strip of #147 as the compare** (the first proposal): it shows one
   to three cards on a phone, so the user scrolls to compare and never sees the series whole.
   The owner chose the full-screen grid.

A fourth idea, opening the series viewer automatically when paging into a series, was dropped
early: a mode switch the user did not ask for breaks the paging rhythm.

## What it reuses, what is new

- Reused unchanged: the series logic (`src/logic/series.ts`), the series viewer, the
  `pickRestBtn` action through the undo history, the `Shift+K` and `N` keys of the shared key
  map, the tooltip, the toast.
- Changed: `SeriesCompare.vue` lays its cards out as the full-screen grid; the flag button
  component (`FlagButtons.vue`) and the grid's action bar take the one order.
- New: the grid sizing rule (a pure module), `↑` `↓` in the compare, the landing after the
  series, the series span rule, the toast's *Reject the other N*, the chip in the loupe's title
  row, the compare's "opened from the loupe" entry (one series, return target), *Pick this,
  reject the rest* in the loupe's action bar (the `ActionBar` slot the viewer already uses), the
  frame in the filmstrip (series part 2), the once-per-user hint.
- Keys: `N` gains a meaning in the loupe (the plan's key table already lists it for the loupe),
  `Shift+K` does nothing outside a series, as today.

## Follow-up PRs in build order, after sign-off

1. **Series span** (fix to part 1): `SERIES_SPAN_SECONDS = 60` in `src/logic/series.ts`, ADR 0021
   amended, SERIES-001 updated.
2. **Viewer preload window** (fix to part 1): SERIES-002.1 preloads the loupe's neighbour window;
   the compare's title shows the active photo's position.
3. **Flag button order** (owner decision 2): *Pick*, *Unflag*, *Reject* in the loupe's portrait
   row, *Unflag* at the bottom centre in landscape, the same order in the series viewer, the
   compare's cards and the grid's action bar; LOUPE-002.11, SERIES-001, the grid's spec and the
   main mockup.
4. **Compare as a full-screen grid** (owner decision 3): the grid sizing rule as a pure module,
   `SeriesCompare.vue` full screen with the bottom bar, `↑` `↓`; SERIES-001. It replaces the
   sideways scrolling, and with it the `scroll-snap-type` suspected in the flaky e2e test of
   `TODO.md`.
5. **Filmstrip group frame** (part 2): the frame and its tab in the loupe's filmstrip,
   LOUPE-001.19 extended; the tab opens nothing until step 6 lands, so it ships hidden behind
   it or together with it.
6. **Chip and `N` in the loupe**: the compare opened on one series, its return to the loupe and
   its *Pick this, reject the rest* landing after the series, LOUPE-001 and SERIES-001.
7. ***Pick this, reject the rest* in the loupe** (part 3): the rating-row button and `Shift+K`,
   landing on the first photo after the series, LOUPE-002.
8. ***Reject the other N* in the undo toast** (part 3): after a plain *Pick* in the loupe and the
   series viewer, landing after the series while a member shows, DECISIONS and SERIES-002.
9. **First-series hint**, stored per user like the gesture guide (LOUPE-003).

Each PR updates its spec and starts with the failing tests.
