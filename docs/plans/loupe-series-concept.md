<!--
SPDX-FileCopyrightText: 2026 honeycomb contributors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Series in the loupe (concept)

Status: proposal for the owner's sign-off (2026-11-13). Interactive mockup:
[`docs/mockup/loupe-series/index.html`](../mockup/loupe-series/index.html), open it in a browser.

## Kurzfassung (Deutsch)

Die Lupe zeigt künftig selbst, dass ein Foto zu einer Serie gehört, und bietet die
Serienaktionen dort an, wo man ohnehin entscheidet:

1. **Serien-Chip in der Titelzeile:** „⧉ 2/5" (Foto 2 einer Serie aus 5). Ein Tipp darauf oder
   `N` öffnet *Serie vergleichen* direkt für **diese** Serie, mit dem gezeigten Foto aktiv.
   Schließen führt zurück in die Lupe.
2. **Gruppenrahmen im Filmstreifen** (Serien-Teil 2): ein Honig-Rahmen um die Fotos der Serie
   mit dem Etikett „⧉ 5"; ein Tipp aufs Etikett tut dasselbe wie der Chip.
3. **„Dieses nehmen, Rest ablehnen"** steht in der Lupe in der Bewertungszeile, sobald das Foto
   zu einer Serie gehört, mit `Shift+K` – derselbe Knopf und dieselbe Taste wie im
   Serienvergleich und im Serienbetrachter, ein Rückgängig-Schritt.
4. **Einmaliger Hinweis** beim ersten Serienfoto in der Lupe, weil der Besitzer die Funktion
   bisher nie gefunden hat.

Verworfen: eine Geste (unauffindbar, kollidiert mit Wischen und Zoom) und ein aufklappender
Serienstreifen in der Lupe (zweite Vergleichsansicht neben *Serie vergleichen*, zu kleine Bilder,
doppelte Logik).

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
- It hides with the title row when idle, like every overlay. A photo outside any series shows
  no chip, so nothing changes in an unrelated cull.

### 2. See the whole series: the existing compare, opened on this series

- A tap on the chip, a tap on the filmstrip frame's label, or `N` in the loupe opens the existing
  **series compare dialog on this series** with the shown photo as the active card. Its title
  says "Series of 5" instead of "Compare series 1 of 3": opened from the loupe it holds this one
  series, so *Skip* and the series stepping hide.
- Everything inside is unchanged: the cards scroll sideways for long bursts (PR #147), a tap on a
  card's photo opens the series viewer with synchronised zoom, `←` `→` move the active card.
- Closing it (button, `Esc`) returns to the loupe **on the active card's photo**. *Pick this,
  reject the rest* in the dialog closes it too and returns to the loupe on the picked photo,
  rather than moving to the next series: the user came from the loupe and continues there.
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
- The loupe stays on the picked photo, as a plain decision does. While *Rejected* is not pressed
  in the flag filter, the rejected members leave the strip (LOUPE-001.22), so `→` goes straight
  to the first photo after the series.
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

### Per device

| | Phone portrait (390 × 844) | iPad landscape (1180 × 820) | Desktop (1440 × 900) |
|---|---|---|---|
| Shows the series | chip "⧉ 2/5" in the title row, frame in the strip | chip "⧉ Series 2/5", frame | same as iPad |
| Whole series | tap chip or frame tab | tap chip or frame tab | click, or `N` |
| Pick one, reject the rest | button on its own line under the rating row | button in the bottom overlay row | button, or `Shift+K` |
| Paging inside the series | swipe, tap zones, strip | same, edge buttons | `←` `→` |

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

A third idea, opening the series viewer automatically when paging into a series, was dropped
early: a mode switch the user did not ask for breaks the paging rhythm.

## What it reuses, what is new

- Reused unchanged: the series logic (`src/logic/series.ts`), `SeriesCompare.vue` and the series
  viewer, the `pickRestBtn` action through the undo history, the `Shift+K` and `N` keys of the
  shared key map, the tooltip, the toast.
- New: the chip in the loupe's title row, the compare's "opened from the loupe" entry (one series,
  return target), *Pick this, reject the rest* in the loupe's action bar (the `ActionBar` slot the
  viewer already uses), the frame in the filmstrip (series part 2), the once-per-user hint.
- Keys: `N` gains a meaning in the loupe (the plan's key table already lists it for the loupe),
  `Shift+K` does nothing outside a series, as today.

## Order of work, after sign-off

1. Series part 2: the filmstrip group frame and its tab (look as in the mockup).
2. Chip and `N` in the loupe, the compare opened on one series with its return to the loupe.
3. *Pick this, reject the rest* and `Shift+K` in the loupe (series part 3).
4. The first-series hint.

Each step gets its spec update (LOUPE-001, SERIES-001, SERIES-002) and tests first.
