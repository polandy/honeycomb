# APP-001 – App page and navigation

- Status: implemented
- Area: app
- Origin: plan.md M1.1, M2.1, Translations, Target versions, Shared UI components; ADR 0007
- Depends on: LISTING-003

## Purpose

honeycomb is a Nextcloud app with one page. A user reaches it from Nextcloud's navigation and
starts from an empty state that leads to the folder picker.

## Behaviour

The app installs on Nextcloud 35 with PHP 8.3 or later and adds a *honeycomb* entry to the
navigation. The entry opens the app's page for the logged-in user. While no folder set is chosen
the page shows an empty state, *No folder chosen*, with the folder picker open over it. Every
text the user reads comes from the translation catalogue (`t()`), except names taken from the
user's files. On a phone, below 520 px, every confirm dialog is a bottom sheet: full width, at
the bottom edge, rounded at the top only, its footer clear of the home indicator.

Nextcloud's navigation beside the page holds only *Folder*, the recent folder sets and
*Settings*, so it starts closed below 1280 px, where the grid needs the room. Once the user opens
or closes it with Nextcloud's toggle, the app keeps that choice in the browser and starts with it
on every width. Below 1024 px Nextcloud shows the navigation over the page and closes it itself;
there the app neither applies nor remembers a choice.

Every route that writes is limited to 600 requests a minute per user, the visual hash save to
300 (SERIES-003.23); Nextcloud answers a request beyond the limit `429` without running it
(ADR 0031). The routes that only read are not limited.

Each page loads its script by the name the build gave it, which carries a hash of its content
(ADR 0033), so a new build reaches the browser on the next page load even when the app version
stays the same.

## Acceptance criteria

### APP-001.1 – The navigation opens the app page

- **Given** honeycomb is installed
- **When** a logged-in user opens its navigation entry, the app's root URL
- **Then** Nextcloud renders honeycomb's main template for that user

### APP-001.2 – Nextcloud 35 and PHP 8.3 only

- **Given** the app's `info.xml`
- **When** Nextcloud checks its requirements
- **Then** it accepts Nextcloud 35 only and PHP 8.3 or later

### APP-001.3 – Empty state without a folder set

- **Given** a user who has not chosen a folder set
- **When** the app page opens
- **Then** it shows *No folder chosen* with "Pick a folder to start culling." and opens the
  folder picker

### APP-001.4 – Every text is translatable

- **Given** any screen of the app
- **When** it renders
- **Then** every text it shows comes from the translation catalogue, except names of folders and
  files

### APP-001.5 – An unexpected error is logged

- **Given** the app is running
- **When** an error reaches Vue that no component handles
- **Then** it is logged as an error together with its cause

### APP-001.6 – A dialog is a bottom sheet on a phone

- **Given** a screen at most 520 px wide
- **When** a confirm dialog opens, e.g. the folder picker
- **Then** it spans the full width, rests on the bottom edge, leaves at least 24 px above it and
  has rounded top corners only

### APP-001.7 – The navigation starts closed below 1280 px

- **Given** a user who has never opened or closed the navigation in this browser
- **When** the app page opens on a screen at least 1024 px wide
- **Then** the navigation is open from 1280 px on and closed below; below 1024 px Nextcloud
  decides alone

### APP-001.8 – The navigation remembers the user's choice

- **Given** a screen at least 1024 px wide
- **When** the user opens or closes the navigation with its toggle and later opens the app page
  again
- **Then** the navigation starts as the user left it, at any width from 1024 px on; a choice made
  below 1024 px is not remembered

### APP-001.9 – Every write route is limited per user

- **Given** a route that writes: a save, the move or the trash
- **When** one user sends it more than 600 times within a minute (300 for the visual hash save)
- **Then** Nextcloud answers the further requests `429` and runs none of them

### APP-001.10 – A new build reaches the browser

- **Given** a build of honeycomb, deployed with the same app version as the one before
- **When** a user opens the app page or the similarity page
- **Then** the page loads its script by the content-hashed name the build wrote, so the
  browser fetches the new script instead of a cached one; without a build the page fails loud

### APP-001.11 – The navigation toggle sits in the toolbar row

- **Given** the grid with its toolbar, from an iPad width on, the navigation open or closed
- **Then** exactly one toggle shows, centred vertically in the toolbar row, with no toolbar
  control under it; hovering it keeps it fully opaque and tints its background

### APP-001.12 – A dialog closed while it opens logs no error

- **Given** a dialog that is taken away before its opening fade has ended, such as the folder
  picker confirmed at once, or the series compare opened from the toolbar, the `n` key or a series
  badge right after
- **Then** its focus trap is skipped and nothing is logged as an error; any other error is still
  logged as one (APP-001.5)

### APP-001.13 – An error toast stays until it is closed

- **Given** a toast that reports a failure, such as *Could not save the settings*, *Could not
  clear the cache.*, *Could not move the photos* or *Not changed: read only*
- **When** the user looks away and back, however long it takes
- **Then** the toast is still there, announced by a screen reader at once (`role="alert"`), with a
  *Close* button; another toast replaces it; a toast that reports success keeps its timer and
  stays a polite status (`role="status"`)

### APP-001.14 – A toast's details open in a dialog

- **Given** a toast with *Details*, such as *Picked 7 photos; 3 photos not changed: read only*
- **When** the user chooses *Details*, by touch or with the keyboard
- **Then** the toast closes and a dialog lists the toast's message and each detail, one per line,
  with *Close*; the dialog traps the focus and `Esc` closes it

### APP-001.15 – No serious accessibility fault, light or dark

- **Given** the real app in the light and in the dark theme
- **When** the grid, folder tree, settings, selection, *Move…*, ⋯ menu, reject review, *Delete…*,
  loupe, gesture guide, series compare and series viewer are open
- **Then** an axe-core scan (WCAG 2.2 A and AA rules, ADR 0042) finds no fault rated *serious* or
  *critical*, contrast included; a known fault is excluded only by its rule and element, each with
  a `TODO.md` item

## Out of scope

- The folder picker itself: LISTING-003.
- The grid that replaces the empty state: GRID-001.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged code of #31 and #39 (ADR 0015) |
| 2026-11-10 | A confirm dialog is a bottom sheet on a phone (APP-001.6) |
| 2026-11-13 | The navigation starts closed below 1280 px and remembers the user's choice (APP-001.7, APP-001.8; UX L3) |
| 2026-11-15 | Every write route is rate limited per user (APP-001.9, ADR 0031, risk review R10) |
| 2026-11-16 | Each page loads its script by its content-hashed name (APP-001.10, ADR 0033) |
| 2026-11-17 | The navigation toggle is centred in the toolbar row, alone and opaque on hover (APP-001.11) |
| 2026-11-18 | A dialog closed while it opens logs no focus trap error (APP-001.12) |
| 2026-11-18 | An error toast stays until closed and is announced as an alert; a toast's details open in a dialog (APP-001.13, .14; review UX-1, UX-2) |
| 2026-11-19 | An axe-core scan of every screen, light and dark (APP-001.15, ADR 0042; review UX-5) |
