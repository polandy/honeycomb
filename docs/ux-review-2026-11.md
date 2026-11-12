# UX review of the app, 2026-11

A review of the app as it runs, after the owner's note of 2026-11-11 that it does not yet look
appealing and professional. [`ux-review.md`](ux-review.md) reviewed the mockup; this one reviews
`main` at 84c39ad. Each fix is one item in [`TODO.md`](../TODO.md), in the order of the table.

## Method

- **Rendering:** `main` built and served by `scripts/e2e-server.sh` (Nextcloud 35.0.2), driven by
  Playwright on the [reference devices](plan.md#reference-devices) — Pixel 9 Pro and iPad mini
  (2024), portrait and landscape, touch — and the 1440 × 900 desktop, light and dark: 146
  screenshots. The test folder holds 24 synthetic photos (20 JPEG+NEF pairs, 4 JPEG only, one
  series of four), 8 of them decided; the owner's photos are not used because the screenshots are
  public.
- **Measured:** contrast from the computed Nextcloud CSS variables, and the photo's box in the
  loupe against the viewport.
- **Judged against:** visual hierarchy (one primary action per view, the photo first), spacing
  and alignment, consistency of the shared components ([`plan.md`](plan.md#shared-ui-components))
  and the [glossary](04-glossary.md#words-and-conventions-in-the-ui), WCAG 2.2 AA, and the look of
  Lightroom Classic, Photo Mechanic and Nextcloud Photos.
- **Screenshots:** the *before* images are in `polandy/honeycomb-assets` under
  `ux-review-2026-11/`, outside the `pr-<n>/` folders that are pruned after a merge.

## Summary

Most of the impression of "not yet professional" comes from five things: the flag colours lost
their contrast with Nextcloud 35's theme variables (H1, H2), the loupe's title row and info panel
break on a phone (H3, H4), the photo sits under the loupe's chrome (H5), and the grid toolbar and
tiles carry too many equally loud elements (M1–M3). Fixing H1–H5 and M1–M5 changes the look the
most for the least work.

## Findings

**low** is polish. *Decided by the owner* marks a fix that changes a look or a word the owner signed
off and has since decided.
**low** is polish. *Decided by the owner* marks a fix that changes a look or a word the owner signed off and has since decided.

| ID | Severity | Screen | Finding | Fix |
|---|---|---|---|---|
| H1 | high | Loupe, series compare, grid selection | A pressed *Pick* or *Reject* is unreadable: `FlagButtons` and `FlagMark` fill with `--color-success` and `--color-error` and draw the icon in `--color-main-background`, but Nextcloud 35 made these pale tints (#11321A dark, #D8F3DA light). Contrast: *Pick* 1.28:1 dark and 1.18:1 light, *Reject* 1.39:1 and 1.18:1. | App tokens `--honeycomb-pick-fill` #1f7a46 and `--honeycomb-reject-fill` #b3302c with a white icon and word (5.3:1 and 6.2:1), as in the mockup, used by `FlagButtons`, `FlagMark` and the large flag buttons. |
| H2 | high | Grid, series compare | Stars and the flag mark on a tile are dark grey or dark green on the photo in the dark theme and white on white in the light theme; on most photos they cannot be seen. | The tile's marks (stars, flag mark, colour dot) sit on one dark bottom shade with white stars, the same in both themes, because the photo, not the theme, is their background. |
| H3 | high | Loupe title row | On a phone the text buttons truncate to "F.", "M…", "I…" and "Full…", and "2 of 20" wraps to two lines. On every size the row mixes text buttons and icon buttons, each on a tinted fill. | Icon buttons with tooltips for *Fit / 100 %*, *Move*, *Info* and *Fullscreen*, like the flag-button and filmstrip toggles, on a transparent fill; the count never wraps. |
| H4 | high | Loupe info panel, phone | The info panel takes three quarters of the width and leaves the photo a 120 px sliver. | At 520 px and below the info panel opens as a bottom sheet over the action bar; the photo keeps the full width. |
| H5 | high | Loupe, desktop and tablet landscape | With the filmstrip pinned, the photo is still laid out over the whole viewport (1350 × 900 at the top on a 1440 × 900 screen): the title row hides its top 42 px, the filmstrip and rating row its bottom 110 px, and the side flag buttons sit on it. | When the filmstrip is pinned, the stage is the space between the title row and the filmstrip; the photo fits into it. |
| M1 | medium | Grid toolbar | The toolbar has two identical funnel icons (before the flag chips and for the filter bar), two filled chips, progress and five icon buttons. It wraps to two rows on an iPad mini in landscape and to four on a phone, the last holding only "…". | Drop the funnel icon before the flag chips; below 900 px *Delete rejects* and *Compare* move into *More*; at most two rows on a phone. |
| M2 | medium | Grid toolbar, navigation | One screen shows two progress numbers for the same folder set: "4 / 20 decided" in the toolbar (the filtered photos) and "8 / 24 decided" in the navigation (all of them). | *Decided by the owner, 2026-11-12.* The toolbar names its scope when a flag filter hides photos, e.g. "4 / 20 shown decided"; without a filter both read the same. |
| M3 | medium | Grid | "JPG+NEF" on 20 of 24 tiles is the loudest element of the grid; the normal case shouts and the exceptions ("JPG only") do not stand out. | *Decided by the owner, 2026-11-12.* No badge on a complete pair; a single keeps its "JPG only" or "NEF only" badge. |
| M4 | medium | Grid, loupe | The *Continue where you left off* toast stays after the user opened a photo themselves, over the grid's last row and the loupe's title row. | The resume toast closes when the user opens a photo, decides or scrolls the grid. |
| M5 | medium | Series compare | Five primary buttons (four *Pick this, reject the rest* and *Skip*) leave no hierarchy; the photos are 200 px wide in a 900 px dialog under a two-line paragraph; a card with a pressed flag pushes its button 4 px lower. | *Pick this, reject the rest* is primary only on the active card, secondary on the others; the cards fill the dialog's height; one line of instructions, the keys in the tooltips; equal flag-button heights. |
| M6 | medium | Loupe info panel | Rows 52 px apart, right-aligned labels, "Sidecar XMP, XMP", lowercase "none", and a *Preloading* section that reads like debug output. | 32 px rows with left-aligned muted labels; sidecars by file name, each once; "—" for an empty value; *Preloading* leaves the panel. |
| M7 | medium | Grid *More* menu | View options (thumbnail size, sort) and actions (remove RAWs, move picks, resume, settings) run together without separators, and the menu stays open above the *Settings* dialog it opened. | A separator between view options and actions; an item that opens a dialog closes the menu. |
| M8 | medium | Gesture guide, desktop | With a mouse the guide starts with swipes and taps; the keys come last and wrap, "? All keys" alone on a line; the tap-zone figure does not line up with the list text. | The guide follows the pointer type: keys first as a two-column list with a fine pointer, gestures first with a coarse one; the figure aligns with the text. |
| M9 | medium | All | The glossary and the mockup give primary actions, the rating and *Keep RAW* the honey accent; the app uses Nextcloud's primary colour, blue by default, so the documents and the app disagree. | *Decided by the owner, 2026-11-12.* Keep Nextcloud's primary colour (colours come from Nextcloud's CSS variables, `docs/conventions.md`) and change "honey" to "primary" in the glossary and `plan.md`. |
| L1 | low | Keyboard shortcuts | The description column starts at a different x in each section. | One grid for the whole sheet with a shared key column. |
| L2 | low | Folder picker | "Tick one or more folders." is bold like an error, and folder rows are 34 or 41 px high. | The status line in regular weight and the muted colour; one row height. |
| L3 | low | Grid, tablet landscape and laptop | The Nextcloud navigation holds only *Folder*, one recent folder set and *Settings*, yet takes 230–300 px and pushes the toolbar to two rows. | The navigation starts closed below 1280 px and remembers the user's choice. |
| L4 | low | Settings | The *File types* heading sits 8 px left of the other section headings. | One section heading style for every settings section. |
| L5 | low | Loupe, landscape | *Pick* and *Reject* at the side edges carry their word; *Unflag* below *Reject* is an icon only. | *Unflag* carries its word like the other two. |
| L6 | low | Grid selection, phone | The action bar wraps to three rows with the flag buttons alone on the last. | Two rows: flags, *Move* and *Delete* first; rating, label and *Keep RAW* second. |
| L7 | low | Loupe filmstrip | On the first photos the strip starts in the middle and leaves the left half empty. | The strip starts at the left edge until the current photo reaches the middle. |

## Before

Images: [`polandy/honeycomb-assets/ux-review-2026-11`](https://github.com/polandy/honeycomb-assets/tree/main/ux-review-2026-11).
The *after* column follows in the pull requests that fix each item.

### Flag colours and tile marks (H1, H2, M3)

| Grid, dark | Grid, light |
|---|---|
| ![Grid tiles, desktop dark](https://raw.githubusercontent.com/polandy/honeycomb-assets/main/ux-review-2026-11/grid-tiles-dark.png) | ![Grid tiles, desktop light](https://raw.githubusercontent.com/polandy/honeycomb-assets/main/ux-review-2026-11/grid-tiles-light.png) |

![Series compare, desktop dark (H1, H2, M5)](https://raw.githubusercontent.com/polandy/honeycomb-assets/main/ux-review-2026-11/series-compare-dark.png)

### Loupe on a phone (H1, H3, H4)

| Loupe | Info panel |
|---|---|
| ![Loupe, Pixel 9 Pro portrait dark](https://raw.githubusercontent.com/polandy/honeycomb-assets/main/ux-review-2026-11/loupe-phone-dark.png) | ![Info panel, Pixel 9 Pro portrait dark](https://raw.githubusercontent.com/polandy/honeycomb-assets/main/ux-review-2026-11/loupe-info-phone-dark.png) |

### Loupe on a desktop and a tablet (H1, H3, H5, L5, L7)

![Loupe, desktop dark](https://raw.githubusercontent.com/polandy/honeycomb-assets/main/ux-review-2026-11/loupe-desktop-dark.png)

![Loupe, iPad mini landscape light](https://raw.githubusercontent.com/polandy/honeycomb-assets/main/ux-review-2026-11/loupe-ipad-land-light.png)

![Info panel, desktop dark (M6)](https://raw.githubusercontent.com/polandy/honeycomb-assets/main/ux-review-2026-11/loupe-info-desktop-dark.png)

### Grid toolbar (M1, M2, M4, L3, L6)

![Grid toolbar, desktop dark](https://raw.githubusercontent.com/polandy/honeycomb-assets/main/ux-review-2026-11/grid-toolbar-desktop-dark.png)

| Phone | Phone, selection | iPad mini landscape |
|---|---|---|
| ![Grid, Pixel 9 Pro portrait dark](https://raw.githubusercontent.com/polandy/honeycomb-assets/main/ux-review-2026-11/grid-phone-dark.png) | ![Grid selection, Pixel 9 Pro portrait dark](https://raw.githubusercontent.com/polandy/honeycomb-assets/main/ux-review-2026-11/grid-select-phone-dark.png) | ![Grid, iPad mini landscape light](https://raw.githubusercontent.com/polandy/honeycomb-assets/main/ux-review-2026-11/grid-ipad-land-light.png) |

### Dialogs (M7, M8, L1, L2, L4)

![More menu above the settings dialog, desktop light](https://raw.githubusercontent.com/polandy/honeycomb-assets/main/ux-review-2026-11/settings-menu-light.png)

| Gesture guide | Keyboard shortcuts | Folder picker |
|---|---|---|
| ![Gesture guide, desktop dark](https://raw.githubusercontent.com/polandy/honeycomb-assets/main/ux-review-2026-11/guide-desktop-dark.png) | ![Keyboard shortcuts, desktop dark](https://raw.githubusercontent.com/polandy/honeycomb-assets/main/ux-review-2026-11/shortcuts-desktop-dark.png) | ![Folder picker, desktop dark](https://raw.githubusercontent.com/polandy/honeycomb-assets/main/ux-review-2026-11/picker-desktop-dark.png) |

![Series compare, iPad mini portrait light (H1, H2, M5)](https://raw.githubusercontent.com/polandy/honeycomb-assets/main/ux-review-2026-11/series-compare-ipad-port-light.png)
