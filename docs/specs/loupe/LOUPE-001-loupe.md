# LOUPE-001 – Loupe

- Status: implemented
- Area: loupe
- Origin: plan.md M3.1, Loupe layout, Tap zones, Image delivery & performance; decisions.md 2026-11-10
- Depends on: GRID-001, IMAGES-001, SETTINGS-001

## Purpose

The loupe shows one picture full screen so the user can judge it, page through the pictures the
grid shows, and zoom in on a detail, by touch, mouse or keyboard.

## Behaviour

The loupe opens from the grid on one picture and pages through a snapshot of the grid's view taken
when it opens, so a decision that hides a picture does not shift it; once the loupe leaves a
picture the filters no longer let through, it drops out of the snapshot (LOUPE-001.22). It covers
the whole page, the Nextcloud header included, until the user shows the Nextcloud navigation
above it.

The photo area has three tap zones: a tap on the left 30 % goes to the previous picture, on the
right 30 % to the next, on the middle 40 % it shows or hides the overlays; a double-tap in the
middle toggles the chrome-free mode. Only a short, still touch is a tap. While zoomed, and for a
mouse click, the whole area is the middle. A sideways drag pages once it passes 22 % of the width,
or on a quick flick.

| Key | Action |
|---|---|
| `←` `→` `↑` `↓`, `Home` `End` | previous, next, first, last picture |
| `Esc`, `G` | back to the grid |
| `Z`, `Ctrl+=`, `Ctrl+-` | zoom to 100 %, zoom in, zoom out |
| `Tab` (on the loupe), double-tap | chrome-free mode |
| `F` | browser fullscreen |
| `I` | info panel |

The title row's *Fit / 100 %*, *Move*, *Info* and *Fullscreen* are icon buttons on a transparent
fill, pressed while zoomed, open or on; the position count never wraps.

The overlays (title row, filmstrip, rating row) hide when idle after the last touch, unless a
control has keyboard focus; a mouse move or a middle tap shows them. The filmstrip is a slim dark
band of square photos edge to edge that keeps the shown picture in its middle. The settings *Pin
the filmstrip* and *Pin the rating row* keep either one below the photo instead of over it, never
idle; the pin toggle at the filmstrip's end switches *Pin the filmstrip* in landscape. The loupe
loads the shown picture first, then 3 neighbours ahead and 2 behind, nearest first, so the next
picture shows without a request. The info panel lists the picture's file facts, its decision and
how many neighbours are loaded; its width can be dragged. The panel's width and the Nextcloud
navigation choice are kept in the browser; whether the panel is open and whether the gesture guide was
dismissed are kept per user on the server (LOUPE-003).

## Acceptance criteria

### LOUPE-001.1 – Opens on the grid's picture

- **Given** the grid shows pictures
- **When** the user opens one (a tap or `E`)
- **Then** the loupe opens as a focused modal dialog on that picture, over the pictures the grid
  shows, attached to the page body so no Nextcloud bar covers it

### LOUPE-001.2 – Closes back to the grid

- **Given** the loupe is open and was paged
- **When** the user presses `Esc`, `G` or the close button
- **Then** the loupe closes and the grid focuses the last shown picture

### LOUPE-001.3 – Pages by keys and buttons, never past an end

- **Given** the loupe shows a picture
- **When** the user presses an arrow key, `Home` or `End`, or *Previous* or *Next*
- **Then** it shows the previous, next, first or last picture; on the first or last picture the
  key does nothing and the button towards the end is not shown

### LOUPE-001.4 – Tap zones

- **Given** the loupe is fitted and touched
- **When** the user taps the left 30 %, the right 30 % or the middle 40 % of the photo area
- **Then** it shows the previous picture, the next picture, or shows or hides the overlays; an
  outer tap pages at once, so two quick taps page twice, and a filmstrip tap shows that picture

### LOUPE-001.5 – Only a short, still touch is a tap

- **Given** the user touches the photo area
- **When** the touch is a long press, or the browser cancels it
- **Then** nothing happens

### LOUPE-001.6 – Paging by a drag

- **Given** the loupe is fitted
- **When** the user drags sideways past 22 % of the width, or flicks quickly
- **Then** the photo follows the finger and pages; a short slow drag or a cancelled one settles
  back on the same picture

### LOUPE-001.7 – Zoom to 100 %

- **Given** the loupe shows a fitted picture
- **When** the user presses `Z` or the zoom button, or pinches with two fingers
- **Then** the photo zooms to 100 % (one image pixel per device pixel) at that point and loads the
  full image; the same again fits it, and a pinch below the threshold snaps back to fit

### LOUPE-001.8 – Zoomed, the zones are off

- **Given** the photo is zoomed in
- **When** the user drags or taps
- **Then** a drag pans the photo within its edges instead of paging, a tap acts as the middle,
  and another picture is shown fitted again

### LOUPE-001.9 – Browser zoom keys

- **Given** the loupe is open
- **When** the user presses `Ctrl+=` or `Ctrl+-`
- **Then** `Ctrl+=` zooms in only while fitted and `Ctrl+-` out only while zoomed; otherwise the
  browser keeps the key

### LOUPE-001.10 – Chrome-free mode and fullscreen

- **Given** the loupe has focus
- **When** the user presses `Tab` on the loupe itself, double-taps the middle, or presses `F`
- **Then** `Tab` and the double-tap toggle the chrome-free mode, `Tab` on a focused control moves
  the focus instead, and `F` toggles browser fullscreen
- **Given** the browser can show an element fullscreen (`fullscreenEnabled`, or
  `webkitFullscreenEnabled` on iPad Safari)
- **When** the user taps the *Fullscreen* icon button of the title row
- **Then** the loupe enters or leaves fullscreen and the button follows the browser's state, also
  when Escape leaves it; where the browser cannot (iPhone Safari) the button is not shown, and
  deciding and the one shown photo work as outside fullscreen

### LOUPE-001.11 – Overlays idle

- **Given** the overlays are shown
- **When** no touch follows for the idle time
- **Then** they hide, unless a control has keyboard focus; a mouse move or a middle tap shows them

### LOUPE-001.12 – Prefetch

- **Given** the loupe opens or pages to a picture
- **When** it loads images
- **Then** it shows the grid tier until the loupe tier loads, loads 3 neighbours ahead and 2
  behind, nearest first, each once, retries a failed one on the next page, and shows a
  prefetched 24 MP neighbour without a new request

### LOUPE-001.13 – Info panel and filmstrip

- **Given** the loupe is open
- **When** the user presses `I` or the info toggle, drags the divider or uses its arrow keys, or
  presses the filmstrip toggle
- **Then** the info panel opens beside the photo with the file facts, decision and loaded
  neighbours, at the dragged width within its limits; open state and width are kept for the
  next visit; the filmstrip shows the pictures around the shown one, all at full opacity with
  the shown one marked by its border, or hides

### LOUPE-001.14 – Nextcloud navigation

- **Given** the loupe covers the Nextcloud navigation
- **When** the user presses the navigation toggle
- **Then** the Nextcloud navigation shows above the loupe, and the next loupe opens below it too

### LOUPE-001.15 – Gesture guide on first opening

- **Given** the user has never dismissed the gesture guide
- **When** the loupe opens
- **Then** the guide lists the decision swipes, paging gestures, tap zones with their sketch,
  pinch, double-tap and keys, above the overlays, with *Got it* focused; after *Got it* it never
  shows again

### LOUPE-001.16 – Without site data

- **Given** the browser blocks site data
- **When** the user opens the loupe, the info panel or the navigation toggle
- **Then** they work for this visit with their defaults

### LOUPE-001.17 – Reduced motion

- **Given** the browser asks for reduced motion
- **When** the loupe pages
- **Then** it shows the next picture without a transition

## Out of scope

Decisions in the loupe: LOUPE-002. The key map and the shortcut sheet: KEYS-001. Image tiers:
IMAGES-001.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged M3.1 (#45–#48) |
| 2026-11-10 | The info panel's open state and the dismissed gesture guide moved to the server (LOUPE-003) |
| 2026-11-10 | LOUPE-001.17 closed by a guard test; the loupe has no transition |
| 2026-11-12 | .21 the info panel is a bottom sheet at 520 px and below (UX H4) |
| 2026-11-12 | .20 a pinned filmstrip also keeps the title row above the photo (UX H5) |
| 2026-11-12 | .13 the filmstrip shows what fits; .19 its Lightroom-like look, .20 pinned filmstrip and rating row |
| 2026-11-12 | .20 a pin toggle in the title row; .22 a picture the filters hide leaves the loupe (owner, iPad) |
| 2026-11-12 | .20 the pin toggle moved from the title row to the filmstrip's end (owner, iPad) |

### LOUPE-001.18 – One photo in view

- **Given** the loupe or the series viewer shows a picture, at any width or in browser fullscreen
- **When** its neighbours are loaded
- **Then** only that photo is in view: each neighbour waits one full stage width aside, hidden,
  and shows only while a drag moves it in; a photo turned by its EXIF orientation is fitted
  upright

### LOUPE-001.19 – Filmstrip

- **Given** the filmstrip shows
- **When** the loupe shows a picture, or the user scrolls the strip
- **Then** the strip is one slim dark band of square photos edge to edge, the shown one with a
  thin white border, scrolled to the middle of the strip, the first and last too; it renders
  only the photos in view and a few beyond, and a scroll shows others without paging

### LOUPE-001.20 – Pinned filmstrip and rating row

- **Given** the loupe is wider than tall
- **When** *Pin the filmstrip* or *Pin the rating row* is on (SETTINGS-001), or the user presses
  the pin toggle at the filmstrip's end, beside its photos, shown in landscape
- **Then** that one stays below the photo, the rating row below the filmstrip, and never idles;
  with the filmstrip pinned the title row stays above the photo too and never idles, so the photo
  fits the space between the two; one not pinned floats over the photo and idles as before; one
  photo stays in view (LOUPE-001.18), and the chrome-free mode still hides both

### LOUPE-001.21 – Info panel as a bottom sheet on a phone

- **Given** the loupe is open and the viewport is 520 px wide or narrower
- **When** the info panel is open
- **Then** it shows as a bottom sheet over the action bar at the full width, without the divider,
  and the photo keeps the full width

### LOUPE-001.22 – A hidden picture leaves the loupe

- **Given** the loupe is open and the user decides a picture so the filters no longer let it
  through, such as a reject while *Rejected* is not pressed
- **When** the loupe shows another picture
- **Then** the decided picture leaves the filmstrip and the "x of y" count; while it is shown it
  stays, so the decision does not shift the photo, and a decision that cannot be saved brings it
  back
