# UX review of the mockup

A review of the interactive mockup [`mockup/index.html`](mockup/index.html) for ease of use
and visual quality, as of 2026-11-09. High and medium findings are fixed in the mockup; low
findings are open items in `TODO.md`. Screenshots are in [`ux/`](ux/).

## Method

- **Rendering:** Playwright 1.63.0 in its pinned container, every screen and state (picker,
  first run, grid, filters, multi-select, toast, loupe, zoom, gesture guide, series, move,
  reject review, delete summary, error report, settings, keyboard help) at 390×844 (phone),
  768×1024 (iPad portrait) and 1440×900 (desktop), light and dark: 120 screenshots.
- **Measured:** text contrast of every visible element, target size of every button, focus
  ring, `prefers-reduced-motion`, accessible names of icon buttons.
- **Judged against:** Nielsen's ten heuristics; culling conventions of Lightroom Classic,
  Photo Mechanic, Narrative Select, Aftershoot and digiKam; WCAG 2.2 AA; first-run clarity and
  discoverability of gestures and keys; feedback and undo; one-handed phone use; perceived
  speed; a neutral, photo-first dark UI.

## Findings

Severity: **high** breaks a task or misleads, **medium** slows or confuses, **low** is polish.

| ID | Severity | Screen | Finding | Fix | Status |
|---|---|---|---|---|---|
| H1 | high | Loupe | On first open the stage is measured before the chrome renders: the photo shows small with its neighbour in view, at every size. | Render the chrome first, then measure the stage. | Fixed |
| H2 | high | Picker, settings, move dialog, template preview | Every `.hint` paragraph is invisible: the loupe's swipe hint rule (absolute, opacity 0) also hits them. | Rename the loupe rule to `.swipe-hint`; add one shared `.hint` style. | Fixed |
| H3 | high | All | The chrome and the loupe stage are warm-tinted (#0b0a07, #f4efe2); a tinted surround shifts how colour in the photo is judged. | Neutral greys for every surface; stage tokens for the loupe and series viewer. | Fixed |
| H4 | high | Loupe, series (dark) | Pressed *Pick* and *Reject* put white text on light green and red, about 2:1 contrast. | Dedicated fill tokens `--pick-fill` and `--reject-fill`, white text at ≥ 4.5:1. | Fixed |
| M1 | medium | Loupe | Full-width green and red flag bars dominate the photo, and pressed and unpressed look alike. | Neutral buttons with coloured icons; only the pressed flag fills; capped at 720 px. | Fixed |
| M2 | medium | Grid | A loud honey `JPG+NEF` badge on every tile: the normal case shouts, the exceptions do not stand out. | A quiet neutral badge for a complete pair; singles keep the highlight. | Fixed |
| M3 | medium | Grid | Five empty stars on every unrated tile add noise. | Stars only once a photo is rated. | Fixed |
| M4 | medium | Picker | First run gives no orientation; the disabled confirm reads "Choose ". | A one-line intro (decisions save, undo, trash bin); the button reads "Choose" or "Choose *folder*". | Fixed |
| M5 | medium | Loupe | Swipe, pinch and keys are only in a dense line in the title bar. | A gesture guide on the first loupe open, dismissed with *Got it*; the gestures move to the info panel. | Fixed |
| M6 | medium | Loupe | A debug-looking preloading chip sits over the photo. | Move the preloading state into the info panel. | Fixed |
| M7 | medium | Move dialog | The confirm reads "Move 0 files" before a target is chosen. | "Move" until a target is chosen, then "Move *n* files". | Fixed |
| M8 | medium | Grid | The filter scope switch is icon-only; the active scope has no name. | The active scope shows its name beside the icon above 520 px. | Fixed |
| M9 | medium | Grid | The change-folder button is 38 px wide, below the 44 px target. | `min-width: 44px` on breadcrumb buttons. | Fixed |
| M10 | medium | All dialogs (phone) | Dialogs open centred, out of thumb reach on a phone. | Bottom sheet at ≤ 520 px, with the safe-area inset. | Fixed |
| L1 | low | Grid | No loading state while thumbnails arrive. | Skeleton tiles. | Fixed |
| L2 | low | Grid (phone) | The scope name is hidden at phone width. | At 520 px and below the slim row shows one button with the active scope's name that opens the three scopes as a menu. | Fixed |
| L3 | low | Series (phone) | *Pick this, reject the rest* wraps to three lines. | In a card narrower than 200 px the button drops its icon and wraps to two balanced lines. | Fixed in the mockup; the app in `TODO.md` |
| L4 | low | Toast | The undo toast times out with no way to pause it (WCAG 2.2.1). | Pause on focus and pointer down. | `TODO.md` |
| L5 | low | Loupe, grid | Filmstrip at opacity .6 and a tile gradient without stars or flag. | Full opacity with an outline for the current photo; gradient only when needed. | `TODO.md` |
| L6 | low | Settings | The gesture guide cannot be shown again. | A settings entry "Show the gesture guide". | `TODO.md` |
| L7 | low | Grid toolbar | Count badges on the toolbar compete with the photos. | Quieter neutral badges. | `TODO.md` |
| L8 | low | All (light) | The app bar stays dark in the light theme. | A light app bar for the light theme. | `TODO.md` |

## Before and after

### Loupe on a phone (H1, H3, H4, M1, M6)

| Before | After |
|---|---|
| ![Loupe before, 390 dark](ux/before-loupe-390-dark.png) | ![Loupe after, 390 dark](ux/after-loupe-390-dark.png) |

### Loupe on a desktop (H1, H3, M1, M5)

| Before | After |
|---|---|
| ![Loupe before, 1440 dark](ux/before-loupe-1440-dark.png) | ![Loupe after, 1440 dark](ux/after-loupe-1440-dark.png) |

### Gesture guide on the first loupe open (M5)

![Gesture guide, 390 dark](ux/after-coach-390-dark.png)

### Grid (H3, M2, M3, M8, M9)

| Before | After |
|---|---|
| ![Grid before, 390 dark](ux/before-grid-390-dark.png) | ![Grid after, 390 dark](ux/after-grid-390-dark.png) |
| ![Grid before, 768 light](ux/before-grid-768-light.png) | ![Grid after, 768 light](ux/after-grid-768-light.png) |

### First run (H2, M4, M10)

| Before | After |
|---|---|
| ![First run before, 390 light](ux/before-firstrun-390-light.png) | ![First run after, 390 light](ux/after-firstrun-390-light.png) |

### Settings (H2, M10)

| Before | After |
|---|---|
| ![Settings before, 390 light](ux/before-settings-390-light.png) | ![Settings after, 390 light](ux/after-settings-390-light.png) |

### Move dialog (H2, M7, M10)

| Before | After |
|---|---|
| ![Move before, 390 dark](ux/before-move-390-dark.png) | ![Move after, 390 dark](ux/after-move-390-dark.png) |

## Landscape loupe

The owner tested the mockup on the iPad (2026-11-09): in landscape the photo was too small and
the controls at the bottom took too much room. The fix is the rule in
[plan.md](plan.md#loupe-layout): the photo fills the screen, *Pick* and *Reject* float at the
side edges, everything else overlays the photo and hides when idle.

**Measured** with Playwright 1.63.0 (Chromium) in the dark theme on the
[reference devices](plan.md#reference-devices), on photo 4 of the *Dolomites* folder (3:2) and
the first series. *Before* is `main` before this change. *Photo* is the fitted photo's area as a
share of the screen. *Controls* are the strips across the full width that the photo has to
share: before, the title row, the filmstrip and the bottom bar, all always shown; after, in
landscape, only the overlays, which hide when idle. Both are measured at the bare viewport; the
safe areas add their insets on top. In landscape the flag buttons after are two 84 × 240 px
buttons at the edges (68 × 154 px on the Pixel) plus *Unflag*, outside the middle half of the
screen.

| Device, orientation, viewport | Loupe photo before → after | Loupe controls before → after | Series viewer photo before → after | Series viewer controls before → after |
|---|---|---|---|---|
| Pixel 9 Pro landscape 952 × 427 | 10 % → 65 % | 259 px always → 182 px, hidden when idle | 67 % → 67 % | 194 px → 116 px, Pick and Reject always shown |
| iPad mini A17 Pro landscape 1133 × 744 | 40 % → 95 % | 259 px always → 182 px, hidden when idle | 99 % → 99 % | 194 px → 116 px, Pick and Reject always shown |
| iPad mini A20 Pro landscape 1158 × 756 | 41 % → 94 % | 259 px always → 182 px, hidden when idle | 98 % → 98 % | 194 px → 116 px, Pick and Reject always shown |
| iPad Pro 11″ landscape 1210 × 834 | 47 % → 93 % | 259 px always → 182 px, hidden when idle | 97 % → 97 % | 194 px → 116 px, Pick and Reject always shown |
| Desktop 1440 × 900 | 46 % → 90 % | 259 px always → 182 px, hidden when idle | 94 % → 94 % | 194 px → 116 px, Pick and Reject always shown |
| Pixel 9 Pro portrait 427 × 952 | 29 %, unchanged | 301 px, unchanged | 30 %, unchanged | 236 px, unchanged |
| iPad mini A17 Pro portrait 744 × 1133 | 42 %, unchanged | 259 px, unchanged | 44 %, unchanged | 194 px, unchanged |
| iPad mini A20 Pro portrait 756 × 1158 | 42 %, unchanged | 259 px, unchanged | 44 %, unchanged | 194 px, unchanged |
| iPad Pro 11″ portrait 834 × 1210 | 44 %, unchanged | 259 px, unchanged | 46 %, unchanged | 194 px, unchanged |

Before, on the Pixel in landscape, the flag row covered the middle of the photo; after, no
control reaches it on any device.

**Every screen on every device.** The mockup's device preview framed each reference device in
both orientations with its safe areas set, and a Playwright check opened eleven screens on each
(grid, selection, filter bar, loupe, series viewer, burst, *Move…*, *Delete…*, folder picker,
settings, keyboard shortcuts): 99 screens. It flags a control that is clipped, lies in a safe
area or is smaller than 44 × 44 px. It found two defects, now fixed: the bottom sheets' buttons
sat under the Pixel's gesture bar, and *Clear filters* under its camera in landscape. All 99
screens now pass, with no console errors.

### Loupe in landscape, per device

Before is the bare viewport; after is framed with the safe areas, the dot marks the camera.

| Device | Before | After |
|---|---|---|
| Pixel 9 Pro | ![Loupe before, Pixel 9 Pro landscape](ux/before-loupe-pixel9pro-land.png) | ![Loupe after, Pixel 9 Pro landscape](ux/after-loupe-pixel9pro-land.png) |
| iPad mini A17 Pro | ![Loupe before, iPad mini A17 Pro landscape](ux/before-loupe-ipadmini24-land.png) | ![Loupe after, iPad mini A17 Pro landscape](ux/after-loupe-ipadmini24-land.png) |
| iPad mini A20 Pro | ![Loupe before, iPad mini A20 Pro landscape](ux/before-loupe-ipadmini26-land.png) | ![Loupe after, iPad mini A20 Pro landscape](ux/after-loupe-ipadmini26-land.png) |
| iPad Pro 11″ | ![Loupe before, iPad Pro 11″ landscape](ux/before-loupe-ipadpro11-land.png) | ![Loupe after, iPad Pro 11″ landscape](ux/after-loupe-ipadpro11-land.png) |

### Loupe in portrait, per device

| Pixel 9 Pro | iPad mini A17 Pro | iPad mini A20 Pro | iPad Pro 11″ |
|---|---|---|---|
| ![Loupe, Pixel 9 Pro portrait](ux/after-loupe-pixel9pro-port.png) | ![Loupe, iPad mini A17 Pro portrait](ux/after-loupe-ipadmini24-port.png) | ![Loupe, iPad mini A20 Pro portrait](ux/after-loupe-ipadmini26-port.png) | ![Loupe, iPad Pro 11″ portrait](ux/after-loupe-ipadpro11-port.png) |

### Series viewer in landscape

| Pixel 9 Pro | iPad mini A17 Pro |
|---|---|
| ![Series viewer, Pixel 9 Pro landscape](ux/after-serie-pixel9pro-land.png) | ![Series viewer, iPad mini A17 Pro landscape](ux/after-serie-ipadmini24-land.png) |

## What already works

- Every icon button has an accessible name.
- A visible 3 px focus ring in both themes.
- `prefers-reduced-motion` turns off every transition.
- Every decision shows a toast with *Undo*, and Ctrl+Z / Ctrl+Shift+Z work everywhere.
- Deleting moves to the trash bin, and the error report lists each failed file with *Retry*.
- The P, X, U and 0–5 keys match Lightroom and Photo Mechanic, so photographers already know them.

## Design direction

- **Colour:** neutral greys only, so nothing tints the photo. Honey is the accent for
  selection, the current item and the primary action, never a surface.

  | Token | Light | Dark |
  |---|---|---|
  | `--bg` | `#f7f7f7` | `#161616` |
  | `--card` / `--card-2` | `#ffffff` / `#f0f0f0` | `#222222` / `#2c2c2c` |
  | `--text` / `--muted` | `#1b1b1b` / `#5e5e5e` | `#f2f2f2` / `#a6a6a6` |
  | `--border` | `#dcdcdc` | `#3a3a3a` |

  The loupe and series viewer use theme-independent stage tokens: `--stage #111111`,
  `--stage-2 #1a1a1a`, `--stage-text #f2f2f2`, `--stage-muted #b0b0b0`. A pressed flag fills
  with `--pick-fill #1f7a46` or `--reject-fill #b3302c`; unpressed flag buttons are neutral
  with a coloured icon.
- **Type:** the system UI font stack, as Nextcloud uses; 15 px body, 13 px hints and metadata,
  17–19 px headings, weight 600–700 only for headings and pressed states.
- **Spacing:** a 4/8 px grid; 44 px minimum targets; the photo gets every pixel the chrome
  does not need.
- **Motion:** 150–350 ms ease-out, only to show where something went (swipe, toast, sheet);
  none under `prefers-reduced-motion`.
- **Phone:** dialogs are bottom sheets; the main actions sit in the lower half.
